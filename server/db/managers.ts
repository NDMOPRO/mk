// Database access: managers. Moved verbatim from server/db.ts.
import { eq, and, desc, asc, like, gte, lte, inArray, sql, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser, users,
  properties, InsertProperty,
  bookings, InsertBooking,
  payments, InsertPayment,
  messages, InsertMessage, conversations,
  maintenanceRequests, InsertMaintenanceRequest,
  favorites, reviews, notifications, savedSearches,
  propertyAvailability, platformSettings,
  aiConversations, aiMessages, knowledgeBase, InsertKnowledgeBase,
  userActivities, InsertUserActivity, adminPermissions, InsertAdminPermission, districts, InsertDistrict,
  cities, InsertCity,
  propertyManagers, InsertPropertyManager,
  propertyManagerAssignments,
  inspectionRequests, InsertInspectionRequest,
  contactMessages, InsertContactMessage,
  platformServices, InsertPlatformService,
  serviceRequests, InsertServiceRequest,
  emergencyMaintenance, InsertEmergencyMaintenance,
  maintenanceUpdates, InsertMaintenanceUpdate,
  aiDocuments, InsertAiDocument,
  propertySubmissions, InsertPropertySubmission, submissionPhotos, InsertSubmissionPhoto,
  cmsContentVersions, InsertCmsContentVersion, cmsMedia, InsertCmsMedia,
  hiddenProperties, InsertHiddenProperty,
  propertyEnquiries, InsertPropertyEnquiry,
  waConversations, InsertWaConversation,
  waMessages, InsertWaMessage,
} from "../../drizzle/schema";
import { ENV } from '../_core/env';
import { getDb } from "./connection";

// ─── Property Managers ─────────────────────────────────────────────
/**
 * Remove the self-service edit token from a property-manager row.
 * Manager rows are returned by public endpoints (listings, profiles);
 * the token lets anyone edit the manager's phone/WhatsApp, so it must
 * never leave the server.
 */
export function omitManagerSecrets<T extends Record<string, any> | null | undefined>(m: T): T {
  if (!m) return m;
  const { editToken: _t, editTokenExpiresAt: _e, ...rest } = m as any;
  return rest as T;
}

export async function getAllPropertyManagers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(propertyManagers).where(eq(propertyManagers.isActive, true));
  return rows.map(omitManagerSecrets);
}

export async function getPropertyManagerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.id, id)).limit(1);
  return omitManagerSecrets(result[0] || null);
}

export async function getPropertyManagerByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return null;
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.propertyId, propertyId))
    .limit(1);
  if (assignments.length === 0) return null;
  return await getPropertyManagerById(assignments[0].managerId);
}

export async function createPropertyManager(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(propertyManagers).values(data);
  return result[0].insertId;
}

export async function updatePropertyManager(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertyManagers).set(data).where(eq(propertyManagers.id, id));
}

export async function deletePropertyManager(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertyManagers).set({ isActive: false }).where(eq(propertyManagers.id, id));
  await db.delete(propertyManagerAssignments).where(eq(propertyManagerAssignments.managerId, id));
}

export async function assignManagerToProperties(managerId: number, propertyIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(propertyManagerAssignments).where(eq(propertyManagerAssignments.managerId, managerId));
  if (propertyIds.length > 0) {
    await db.insert(propertyManagerAssignments).values(
      propertyIds.map(propertyId => ({ managerId, propertyId }))
    );
  }
}

export async function getManagerAssignments(managerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.managerId, managerId));
}

export async function getManagerByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.editToken, token)).limit(1);
  const manager = result[0] || null;
  // Tokens without an expiry (created before expiry existed) are invalid.
  if (manager && !manager.editTokenExpiresAt) return null;
  // Check token expiry (24h)
  if (manager && manager.editTokenExpiresAt) {
    if (new Date() > new Date(manager.editTokenExpiresAt)) {
      // Token expired — clear it and return null
      await db.update(propertyManagers).set({ editToken: null, editTokenExpiresAt: null }).where(eq(propertyManagers.id, manager.id));
      return null;
    }
  }
  return manager;
}

export async function getManagerByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(propertyManagers).where(eq(propertyManagers.email, email)).limit(1);
  return omitManagerSecrets(result[0] || null);
}

export async function setManagerEditToken(managerId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  // Token expires in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(propertyManagers).set({ editToken: token, editTokenExpiresAt: expiresAt }).where(eq(propertyManagers.id, managerId));
}

export async function getManagerWithProperties(managerId: number) {
  const db = await getDb();
  if (!db) return null;
  const manager = await getPropertyManagerById(managerId);
  if (!manager) return null;
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(eq(propertyManagerAssignments.managerId, managerId));
  const propertyIds = assignments.map(a => a.propertyId);
  let assignedProperties: any[] = [];
  if (propertyIds.length > 0) {
    assignedProperties = await db.select().from(properties)
      .where(and(inArray(properties.id, propertyIds), eq(properties.status, 'published')));
  }
  return { ...manager, properties: assignedProperties, propertyCount: assignedProperties.length };
}

export async function getAllManagersWithCounts() {
  const db = await getDb();
  if (!db) return [];
  const managers = await db.select().from(propertyManagers);
  const allAssignments = await db.select().from(propertyManagerAssignments);
  // Get property titles for display
  const propIds = Array.from(new Set(allAssignments.map(a => a.propertyId)));
  let propMap = new Map<number, string>();
  if (propIds.length > 0) {
    const props = await db.select({ id: properties.id, titleEn: properties.titleEn }).from(properties).where(inArray(properties.id, propIds));
    propMap = new Map(props.map(p => [p.id, p.titleEn]));
  }
  return managers.map(omitManagerSecrets).map(m => {
    const mAssignments = allAssignments.filter(a => a.managerId === m.id);
    return {
      ...m,
      propertyCount: mAssignments.length,
      assignedProperties: mAssignments.map(a => ({ propertyId: a.propertyId, propertyTitle: propMap.get(a.propertyId) || '' })),
    };
  });
}

export async function getPropertyManagersForProperties(propertyIds: number[]) {
  const db = await getDb();
  if (!db) return new Map<number, any>();
  if (propertyIds.length === 0) return new Map<number, any>();
  const assignments = await db.select()
    .from(propertyManagerAssignments)
    .where(inArray(propertyManagerAssignments.propertyId, propertyIds));
  const managerIds = Array.from(new Set(assignments.map(a => a.managerId)));
  if (managerIds.length === 0) return new Map<number, any>();
  const managers = await db.select().from(propertyManagers)
    .where(inArray(propertyManagers.id, managerIds));
  const managerMap = new Map(managers.map(m => [m.id, m]));
  const result = new Map<number, any>();
  for (const a of assignments) {
    const mgr = managerMap.get(a.managerId);
    if (mgr) result.set(a.propertyId, omitManagerSecrets(mgr));
  }
  return result;
}
