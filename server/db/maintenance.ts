// Database access: maintenance. Moved verbatim from server/db.ts.
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

// ─── Maintenance Requests ────────────────────────────────────────────
export async function createMaintenanceRequest(data: InsertMaintenanceRequest) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(maintenanceRequests).values(data);
  return result[0].insertId;
}

export async function updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(maintenanceRequests).set(data).where(eq(maintenanceRequests.id, id));
}

export async function getMaintenanceByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.createdAt));
}

export async function getMaintenanceByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.landlordId, landlordId)).orderBy(desc(maintenanceRequests.createdAt));
}

export async function getMaintenanceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Inspection Requests ───────────────────────────────────────────
export async function createInspectionRequest(data: any) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(inspectionRequests).values(data);
  return result[0].insertId;
}

export async function getUserInspectionRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionRequests)
    .where(eq(inspectionRequests.userId, userId))
    .orderBy(desc(inspectionRequests.createdAt));
}

export async function getAllInspectionRequests(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db.select().from(inspectionRequests)
      .where(eq(inspectionRequests.status, status as any))
      .orderBy(desc(inspectionRequests.createdAt));
  }
  return await db.select().from(inspectionRequests)
    .orderBy(desc(inspectionRequests.createdAt));
}

export async function updateInspectionStatus(id: number, status: string, adminNotes?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (adminNotes) updateData.adminNotes = adminNotes;
  if (status === "confirmed") updateData.confirmedAt = new Date();
  if (status === "completed") updateData.completedAt = new Date();
  await db.update(inspectionRequests).set(updateData).where(eq(inspectionRequests.id, id));
}

// ─── Platform Services ──────────────────────────────────────────────
export async function createPlatformService(data: InsertPlatformService) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(platformServices).values(data).$returningId();
  return result;
}

export async function updatePlatformService(id: number, data: Partial<InsertPlatformService>) {
  const db = await getDb();
  if (!db) return;
  await db.update(platformServices).set(data).where(eq(platformServices.id, id));
}

export async function deletePlatformService(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(platformServices).where(eq(platformServices.id, id));
}

export async function getAllPlatformServices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(platformServices).orderBy(platformServices.sortOrder);
}

export async function getActivePlatformServices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(platformServices)
    .where(eq(platformServices.isActive, true))
    .orderBy(platformServices.sortOrder);
}

// ─── Service Requests ───────────────────────────────────────────────
export async function createServiceRequest(data: InsertServiceRequest) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(serviceRequests).values(data).$returningId();
  return result;
}

export async function getServiceRequestsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceRequests)
    .where(eq(serviceRequests.tenantId, tenantId))
    .orderBy(desc(serviceRequests.createdAt));
}

export async function getAllServiceRequests() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(serviceRequests)
    .orderBy(desc(serviceRequests.createdAt));
}

export async function updateServiceRequest(id: number, data: Partial<InsertServiceRequest>) {
  const db = await getDb();
  if (!db) return;
  await db.update(serviceRequests).set(data).where(eq(serviceRequests.id, id));
}

// ─── Emergency Maintenance ──────────────────────────────────────────
export async function createEmergencyMaintenance(data: InsertEmergencyMaintenance) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(emergencyMaintenance).values(data).$returningId();
  return result;
}

export async function getEmergencyMaintenanceByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emergencyMaintenance)
    .where(eq(emergencyMaintenance.tenantId, tenantId))
    .orderBy(desc(emergencyMaintenance.createdAt));
}

export async function getAllEmergencyMaintenance() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emergencyMaintenance)
    .orderBy(desc(emergencyMaintenance.createdAt));
}

export async function getEmergencyMaintenanceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(emergencyMaintenance)
    .where(eq(emergencyMaintenance.id, id));
  return result || null;
}

export async function updateEmergencyMaintenance(id: number, data: Partial<InsertEmergencyMaintenance>) {
  const db = await getDb();
  if (!db) return;
  await db.update(emergencyMaintenance).set(data).where(eq(emergencyMaintenance.id, id));
}

// ─── Maintenance Updates ────────────────────────────────────────────
export async function createMaintenanceUpdate(data: InsertMaintenanceUpdate) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(maintenanceUpdates).values(data).$returningId();
  return result;
}

export async function getMaintenanceUpdates(maintenanceId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(maintenanceUpdates)
    .where(eq(maintenanceUpdates.maintenanceId, maintenanceId))
    .orderBy(maintenanceUpdates.createdAt);
}
