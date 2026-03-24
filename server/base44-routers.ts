import { TRPCError } from "@trpc/server";
import { adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { createHash } from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auditLog,
  bookings,
  buildings,
  integrationConfigs,
  maintenanceRequests,
  paymentLedger,
  units,
} from "../drizzle/schema";
import { externalSyncMap } from "../drizzle/base44-sync-schema";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

type SyncEntity = "units" | "bookings" | "payments" | "maintenance";
type SyncEntityType = "unit" | "booking" | "payment" | "maintenance";

function parseConfig(configJson: string | null): Record<string, string> {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson);
  } catch {
    return {};
  }
}

function mapEntityType(entity: SyncEntity): SyncEntityType {
  switch (entity) {
    case "units":
      return "unit";
    case "bookings":
      return "booking";
    case "payments":
      return "payment";
    case "maintenance":
      return "maintenance";
  }
}

async function getBase44Integration() {
  const [row] = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.integrationKey, "base44"))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Base44 integration is not configured yet." });
  }
  return row;
}

function hashPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function buildPayload(entityType: SyncEntityType, localId: number) {
  switch (entityType) {
    case "unit": {
      const [row] = await db.select().from(units).where(eq(units.id, localId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Unit ${localId} not found` });
      return {
        entityType,
        localId,
        record: {
          id: row.id,
          unitId: row.unitId,
          buildingId: row.buildingId,
          unitNumber: row.unitNumber,
          floor: row.floor,
          bedrooms: row.bedrooms,
          bathrooms: row.bathrooms,
          sizeSqm: row.sizeSqm,
          unitStatus: row.unitStatus,
          monthlyBaseRentSAR: row.monthlyBaseRentSAR,
          propertyId: row.propertyId,
          notes: row.notes,
          updatedAt: row.updatedAt,
        },
      };
    }
    case "booking": {
      const [row] = await db.select().from(bookings).where(eq(bookings.id, localId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Booking ${localId} not found` });
      return {
        entityType,
        localId,
        record: {
          id: row.id,
          propertyId: row.propertyId,
          tenantId: row.tenantId,
          landlordId: row.landlordId,
          status: row.status,
          moveInDate: row.moveInDate,
          moveOutDate: row.moveOutDate,
          durationMonths: row.durationMonths,
          monthlyRent: row.monthlyRent,
          totalAmount: row.totalAmount,
          fees: row.fees,
          vatAmount: row.vatAmount,
          buildingId: row.buildingId,
          unitId: row.unitId,
          source: row.source,
          beds24BookingId: row.beds24BookingId,
          updatedAt: row.updatedAt,
        },
      };
    }
    case "payment": {
      const [row] = await db.select().from(paymentLedger).where(eq(paymentLedger.id, localId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Payment ledger row ${localId} not found` });
      return {
        entityType,
        localId,
        record: {
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          bookingId: row.bookingId,
          guestName: row.guestName,
          guestEmail: row.guestEmail,
          guestPhone: row.guestPhone,
          buildingId: row.buildingId,
          unitId: row.unitId,
          unitNumber: row.unitNumber,
          propertyDisplayName: row.propertyDisplayName,
          type: row.type,
          direction: row.direction,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          paymentMethod: row.paymentMethod,
          provider: row.provider,
          dueAt: row.dueAt,
          paidAt: row.paidAt,
          updatedAt: row.updatedAt,
        },
      };
    }
    case "maintenance": {
      const [row] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, localId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Maintenance request ${localId} not found` });
      return {
        entityType,
        localId,
        record: {
          id: row.id,
          propertyId: row.propertyId,
          tenantId: row.tenantId,
          landlordId: row.landlordId,
          bookingId: row.bookingId,
          title: row.title,
          description: row.description,
          category: row.category,
          priority: row.priority,
          status: row.status,
          photos: row.photos,
          estimatedCost: row.estimatedCost,
          resolvedAt: row.resolvedAt,
          updatedAt: row.updatedAt,
        },
      };
    }
  }
}

async function queueSyncRecords(entity: SyncEntity, requestedBy: { id: number; name: string }, targetAppId: string) {
  const entityType = mapEntityType(entity);
  let localIds: number[] = [];

  switch (entity) {
    case "units": {
      const rows = await db.select({ id: units.id }).from(units).where(eq(units.isArchived, false));
      localIds = rows.map((row) => row.id);
      break;
    }
    case "bookings": {
      const rows = await db.select({ id: bookings.id }).from(bookings);
      localIds = rows.map((row) => row.id);
      break;
    }
    case "payments": {
      const rows = await db.select({ id: paymentLedger.id }).from(paymentLedger);
      localIds = rows.map((row) => row.id);
      break;
    }
    case "maintenance": {
      const rows = await db.select({ id: maintenanceRequests.id }).from(maintenanceRequests);
      localIds = rows.map((row) => row.id);
      break;
    }
  }

  if (localIds.length === 0) {
    return { entityType, queued: 0, skipped: 0 };
  }

  const existingRows = await db
    .select({ localId: externalSyncMap.localId })
    .from(externalSyncMap)
    .where(
      and(
        eq(externalSyncMap.provider, "base44"),
        eq(externalSyncMap.entityType, entityType),
        inArray(externalSyncMap.localId, localIds),
      ),
    );

  const existingIds = new Set(existingRows.map((row) => row.localId));
  const rowsToInsert = localIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({
      provider: "base44" as const,
      entityType,
      localId: id,
      externalId: null,
      syncDirection: "push" as const,
      syncStatus: "pending" as const,
      lastSyncedAt: null,
      lastError: null,
      payloadHash: null,
      metadata: {
        requestedById: requestedBy.id,
        requestedByName: requestedBy.name,
        targetAppId,
        requestMode: "manual",
      },
    }));

  if (rowsToInsert.length > 0) {
    await db.insert(externalSyncMap).values(rowsToInsert as any);
  }

  return {
    entityType,
    queued: rowsToInsert.length,
    skipped: localIds.length - rowsToInsert.length,
  };
}

export const base44Router = router({
  getSyncHealth: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
    const integration = await getBase44Integration();
    const config = parseConfig(integration.configJson);

    const [unitCountRow] = await db.select({ count: sql<number>`count(*)` }).from(units);
    const [buildingCountRow] = await db.select({ count: sql<number>`count(*)` }).from(buildings);
    const [bookingCountRow] = await db.select({ count: sql<number>`count(*)` }).from(bookings);
    const [ledgerCountRow] = await db.select({ count: sql<number>`count(*)` }).from(paymentLedger);
    const [maintenanceCountRow] = await db.select({ count: sql<number>`count(*)` }).from(maintenanceRequests);

    const [pendingCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(externalSyncMap)
      .where(and(eq(externalSyncMap.provider, "base44"), eq(externalSyncMap.syncStatus, "pending")));

    const [failedCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(externalSyncMap)
      .where(and(eq(externalSyncMap.provider, "base44"), eq(externalSyncMap.syncStatus, "failed")));

    const [syncedCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(externalSyncMap)
      .where(and(eq(externalSyncMap.provider, "base44"), eq(externalSyncMap.syncStatus, "synced")));

    const recentSyncRows = await db
      .select()
      .from(externalSyncMap)
      .where(eq(externalSyncMap.provider, "base44"))
      .orderBy(desc(externalSyncMap.updatedAt))
      .limit(20);

    const recentAudit = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, "INTEGRATION"), eq(auditLog.entityLabel, integration.displayName)))
      .orderBy(desc(auditLog.createdAt))
      .limit(10);

    return {
      integration: {
        id: integration.id,
        enabled: integration.isEnabled,
        status: integration.status,
        lastTestedAt: integration.lastTestedAt,
        lastError: integration.lastError,
        appId: config.appId || null,
        editorUrl: config.editorUrl || null,
        previewUrl: config.previewUrl || null,
      },
      sourceCounts: {
        buildings: Number(buildingCountRow?.count || 0),
        units: Number(unitCountRow?.count || 0),
        bookings: Number(bookingCountRow?.count || 0),
        paymentLedgerEntries: Number(ledgerCountRow?.count || 0),
        maintenanceRequests: Number(maintenanceCountRow?.count || 0),
      },
      syncQueue: {
        pending: Number(pendingCountRow?.count || 0),
        failed: Number(failedCountRow?.count || 0),
        synced: Number(syncedCountRow?.count || 0),
      },
      recentSyncRows,
      recentAudit,
    };
  }),

  listSyncQueue: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ status: z.enum(["pending", "synced", "failed", "conflict"]).optional(), limit: z.number().min(1).max(100).default(25) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 25;
      const rows = await db
        .select()
        .from(externalSyncMap)
        .where(
          input?.status
            ? and(eq(externalSyncMap.provider, "base44"), eq(externalSyncMap.syncStatus, input.status))
            : eq(externalSyncMap.provider, "base44"),
        )
        .orderBy(desc(externalSyncMap.updatedAt))
        .limit(limit);
      return rows;
    }),

  preparePendingSync: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .mutation(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const pendingRows = await db
        .select()
        .from(externalSyncMap)
        .where(and(eq(externalSyncMap.provider, "base44"), eq(externalSyncMap.syncStatus, "pending")))
        .orderBy(desc(externalSyncMap.updatedAt))
        .limit(limit);

      const prepared: Array<{ syncId: number; entityType: SyncEntityType; localId: number; payloadHash: string }> = [];
      const previews: Array<{ syncId: number; entityType: SyncEntityType; localId: number; payload: unknown }> = [];

      for (const row of pendingRows) {
        const payload = await buildPayload(row.entityType, row.localId);
        const payloadHash = hashPayload(payload);
        const nextMetadata = {
          ...(row.metadata || {}),
          preparedAt: new Date().toISOString(),
          preparedById: ctx.user.id,
          preparedByName: ctx.user.displayName || ctx.user.email || "admin",
          previewReady: true,
        };

        await db
          .update(externalSyncMap)
          .set({
            payloadHash,
            metadata: nextMetadata as any,
            updatedAt: new Date(),
          })
          .where(eq(externalSyncMap.id, row.id));

        prepared.push({ syncId: row.id, entityType: row.entityType, localId: row.localId, payloadHash });
        previews.push({ syncId: row.id, entityType: row.entityType, localId: row.localId, payload });
      }

      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userName: ctx.user.displayName || ctx.user.email || "admin",
        action: "UPDATE",
        entityType: "INTEGRATION",
        entityId: 0,
        entityLabel: "Base44 Queue Preparation",
        metadata: { preparedCount: prepared.length, previewOnly: true } as any,
      });

      return { success: true, prepared, previews };
    }),

  runManualSync: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(
      z.object({
        entities: z.array(z.enum(["units", "bookings", "payments", "maintenance"]))
          .min(1)
          .max(4),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const integration = await getBase44Integration();
      const config = parseConfig(integration.configJson);
      if (!integration.isEnabled) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Base44 integration is disabled." });
      }
      if (!config.appId || !config.editorUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Base44 app configuration is incomplete." });
      }

      const requestedBy = {
        id: ctx.user.id,
        name: ctx.user.displayName || ctx.user.email || "admin",
      };

      const queueResults = [];
      for (const entity of input.entities) {
        queueResults.push(await queueSyncRecords(entity, requestedBy, config.appId));
      }

      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userName: requestedBy.name,
        action: "UPDATE",
        entityType: "INTEGRATION",
        entityId: integration.id,
        entityLabel: integration.displayName,
        metadata: {
          mode: "manual_sync_requested",
          entities: input.entities,
          target: config.appId,
          queueResults,
        } as any,
      });

      return {
        success: true,
        message: "Manual Base44 sync queued successfully.",
        queuedEntities: input.entities,
        queueResults,
      };
    }),

  openWorkspace: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
    const integration = await getBase44Integration();
    const config = parseConfig(integration.configJson);
    return {
      editorUrl: config.editorUrl || null,
      previewUrl: config.previewUrl || null,
      appId: config.appId || null,
    };
  }),
});
