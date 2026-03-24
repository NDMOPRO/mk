import { TRPCError } from "@trpc/server";
import { adminWithPermission, router } from "./_core/trpc";
import { PERMISSIONS } from "./permissions";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditLog,
  bookings,
  buildings,
  integrationConfigs,
  maintenanceRequests,
  paymentLedger,
  units,
} from "../drizzle/schema";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

function parseConfig(configJson: string | null): Record<string, string> {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson);
  } catch {
    return {};
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

export const base44Router = router({
  getSyncHealth: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
    const integration = await getBase44Integration();
    const config = parseConfig(integration.configJson);

    const [unitCountRow] = await db.select({ count: sql<number>`count(*)` }).from(units);
    const [buildingCountRow] = await db.select({ count: sql<number>`count(*)` }).from(buildings);
    const [bookingCountRow] = await db.select({ count: sql<number>`count(*)` }).from(bookings);
    const [ledgerCountRow] = await db.select({ count: sql<number>`count(*)` }).from(paymentLedger);
    const [maintenanceCountRow] = await db.select({ count: sql<number>`count(*)` }).from(maintenanceRequests);

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
      recentAudit,
    };
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

      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userName: ctx.user.displayName || ctx.user.email || "admin",
        action: "UPDATE",
        entityType: "INTEGRATION",
        entityId: integration.id,
        entityLabel: integration.displayName,
        metadata: {
          mode: "manual_sync_requested",
          entities: input.entities,
          target: config.appId,
        } as any,
      });

      return {
        success: true,
        message: "Manual Base44 sync request recorded. Backend entity push handlers are the next implementation step.",
        queuedEntities: input.entities,
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
