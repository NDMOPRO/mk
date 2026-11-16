// Database access: locations. Moved verbatim from server/db.ts.
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

// ─── Cities ────────────────────────────────────────────────────────
export async function getAllCities(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(cities).where(eq(cities.isActive, true)).orderBy(cities.sortOrder, cities.nameEn);
  }
  return db.select().from(cities).orderBy(cities.sortOrder, cities.nameEn);
}

export async function getCityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cities).where(eq(cities.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createCity(data: InsertCity) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(cities).values(data);
  return result[0].insertId;
}

export async function updateCity(id: number, data: Partial<InsertCity>) {
  const db = await getDb();
  if (!db) return;
  await db.update(cities).set(data).where(eq(cities.id, id));
}

export async function deleteCity(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cities).where(eq(cities.id, id));
}

export async function toggleCityActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(cities).set({ isActive }).where(eq(cities.id, id));
}

export async function getCityCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(cities);
  return result[0]?.count ?? 0;
}

// ─── Districts ──────────────────────────────────────────────────────
export async function getAllDistricts(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(eq(districts.isActive, true)).orderBy(districts.city, districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).orderBy(districts.city, districts.sortOrder, districts.nameEn);
}

export async function getDistrictsByCity(city: string, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(and(eq(districts.city, city), eq(districts.isActive, true))).orderBy(districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).where(eq(districts.city, city)).orderBy(districts.sortOrder, districts.nameEn);
}

export async function getDistrictsByCityId(cityId: number, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(districts).where(and(eq(districts.cityId, cityId), eq(districts.isActive, true))).orderBy(districts.sortOrder, districts.nameEn);
  }
  return db.select().from(districts).where(eq(districts.cityId, cityId)).orderBy(districts.sortOrder, districts.nameEn);
}

export async function getDistrictById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(districts).where(eq(districts.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createDistrict(data: InsertDistrict) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(districts).values(data);
  return result[0].insertId;
}

export async function updateDistrict(id: number, data: Partial<InsertDistrict>) {
  const db = await getDb();
  if (!db) return;
  await db.update(districts).set(data).where(eq(districts.id, id));
}

export async function deleteDistrict(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(districts).where(eq(districts.id, id));
}

export async function toggleDistrictActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(districts).set({ isActive }).where(eq(districts.id, id));
}

export async function bulkCreateDistricts(data: InsertDistrict[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < data.length; i += 50) {
    const batch = data.slice(i, i + 50);
    await db.insert(districts).values(batch);
  }
}

export async function deleteDistrictsByCity(city: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(districts).where(eq(districts.city, city));
}

export async function getDistrictCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(districts);
  return result[0]?.count ?? 0;
}


// ─── Featured Cities ────────────────────────────────────────────
export async function getFeaturedCities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cities)
    .where(and(eq(cities.isFeatured, true), eq(cities.isActive, true)))
    .orderBy(asc(cities.sortOrder));
}
