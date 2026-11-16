// Database access: properties. Moved verbatim from server/db.ts.
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

// ─── Properties ──────────────────────────────────────────────────────
export async function createProperty(data: InsertProperty) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(properties).values(data);
  return result[0].insertId;
}

export async function updateProperty(id: number, data: Partial<InsertProperty>) {
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set(data).where(eq(properties.id, id));
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPropertiesByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(properties).where(eq(properties.landlordId, landlordId)).orderBy(desc(properties.createdAt));
}

export async function searchProperties(filters: {
  query?: string; city?: string; propertyType?: string; minPrice?: number; maxPrice?: number;
  bedrooms?: number; furnishedLevel?: string; status?: string;
  limit?: number; offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [eq(properties.status, "published")];
  if (filters.query) {
    const q = `%${filters.query}%`;
    conditions.push(or(
      like(properties.titleAr, q),
      like(properties.titleEn, q),
      like(properties.city, q),
      like(properties.cityAr, q),
      like(properties.district, q),
      like(properties.districtAr, q),
      like(properties.descriptionAr, q),
      like(properties.descriptionEn, q),
    )!);
  }
  if (filters.city) conditions.push(like(properties.city, `%${filters.city}%`));
  if (filters.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType as any));
  if (filters.minPrice) conditions.push(gte(properties.monthlyRent, String(filters.minPrice)));
  if (filters.maxPrice) conditions.push(lte(properties.monthlyRent, String(filters.maxPrice)));
  if (filters.bedrooms) conditions.push(eq(properties.bedrooms, filters.bedrooms));
  if (filters.furnishedLevel) conditions.push(eq(properties.furnishedLevel, filters.furnishedLevel as any));
  const where = and(...conditions);
  const items = await db.select().from(properties).where(where!)
    .orderBy(desc(properties.createdAt))
    .limit(filters.limit ?? 20).offset(filters.offset ?? 0);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(properties).where(where!);
  // Batch load manager info (eliminates N+1 queries)
  const itemIds = items.map(i => i.id);
  let managerMap = new Map<number, { name: string; nameAr: string | null; photoUrl: string | null }>();
  if (itemIds.length > 0) {
    const assignments = await db.select().from(propertyManagerAssignments)
      .where(inArray(propertyManagerAssignments.propertyId, itemIds));
    const managerIds = Array.from(new Set(assignments.map(a => a.managerId)));
    if (managerIds.length > 0) {
      const managers = await db.select().from(propertyManagers)
        .where(inArray(propertyManagers.id, managerIds));
      const mgrById = new Map(managers.map(m => [m.id, m]));
      for (const a of assignments) {
        const mgr = mgrById.get(a.managerId);
        if (mgr) managerMap.set(a.propertyId, { name: mgr.name, nameAr: mgr.nameAr, photoUrl: mgr.photoUrl });
      }
    }
  }
  const itemsWithManager = items.map(item => {
    const mgr = managerMap.get(item.id);
    return mgr ? { ...item, managerName: mgr.name, managerNameAr: mgr.nameAr, managerPhotoUrl: mgr.photoUrl } : item;
  });
  return { items: itemsWithManager, total: countResult[0]?.count ?? 0 };
}

export async function getMapProperties(filters?: {
  city?: string; propertyType?: string; minPrice?: number; maxPrice?: number;
  bedrooms?: number; furnishedLevel?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(properties.status, "published")];
  if (filters?.city) conditions.push(like(properties.city, `%${filters.city}%`));
  if (filters?.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType as any));
  if (filters?.minPrice) conditions.push(gte(properties.monthlyRent, String(filters.minPrice)));
  if (filters?.maxPrice) conditions.push(lte(properties.monthlyRent, String(filters.maxPrice)));
  if (filters?.bedrooms) conditions.push(eq(properties.bedrooms, filters.bedrooms));
  if (filters?.furnishedLevel) conditions.push(eq(properties.furnishedLevel, filters.furnishedLevel as any));
  // Only return properties with valid coordinates (not null, not empty, not zero)
  conditions.push(sql`${properties.latitude} IS NOT NULL AND ${properties.latitude} != '' AND ${properties.latitude} != '0'`);
  conditions.push(sql`${properties.longitude} IS NOT NULL AND ${properties.longitude} != '' AND ${properties.longitude} != '0'`);
  const where = and(...conditions);
  return db.select({
    id: properties.id,
    titleEn: properties.titleEn,
    titleAr: properties.titleAr,
    propertyType: properties.propertyType,
    city: properties.city,
    cityAr: properties.cityAr,
    district: properties.district,
    districtAr: properties.districtAr,
    latitude: properties.latitude,
    longitude: properties.longitude,
    monthlyRent: properties.monthlyRent,
    bedrooms: properties.bedrooms,
    bathrooms: properties.bathrooms,
    sizeSqm: properties.sizeSqm,
    furnishedLevel: properties.furnishedLevel,
    photos: properties.photos,
    isFeatured: properties.isFeatured,
  }).from(properties).where(where!).limit(500);
}

export async function getAllProperties(limit = 50, offset = 0, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (status) conditions.push(eq(properties.status, status as any));
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(properties.titleEn, term),
      like(properties.titleAr, term),
      like(properties.city, term),
      like(properties.cityAr, term),
    ));
  }
  return db.select().from(properties)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(properties.createdAt)).limit(limit).offset(offset);
}

export async function getPropertyCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = status ? [eq(properties.status, status as any)] : [];
  const result = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(conditions.length ? and(...conditions) : undefined);
  return result[0]?.count ?? 0;
}

export async function deleteProperty(id: number) {
  // Soft delete: archive instead of hard delete to preserve data integrity
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set({ status: 'archived' }).where(eq(properties.id, id));
}

export async function incrementPropertyViews(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(properties).set({ viewCount: sql`${properties.viewCount} + 1` }).where(eq(properties.id, id));
}

// ─── Favorites ───────────────────────────────────────────────────────
export async function addFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(favorites).values({ userId, propertyId });
}

export async function removeFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)));
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const favs = await db.select().from(favorites).where(eq(favorites.userId, userId));
  if (favs.length === 0) return [];
  const propIds = favs.map(f => f.propertyId);
  return db.select().from(properties).where(inArray(properties.id, propIds));
}

export async function isFavorite(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId))).limit(1);
  return result.length > 0;
}

// ─── Saved Searches ──────────────────────────────────────────────────
export async function createSavedSearch(userId: number, name: string, filters: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(savedSearches).values({ userId, name, filters });
  return result[0].insertId;
}

export async function getSavedSearches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
}

export async function deleteSavedSearch(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}

// ─── Property Availability ──────────────────────────────────────────
export async function getPropertyAvailability(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(propertyAvailability)
    .where(eq(propertyAvailability.propertyId, propertyId))
    .orderBy(asc(propertyAvailability.startDate));
}

export async function setPropertyAvailability(data: { propertyId: number; startDate: Date; endDate: Date; isBlocked?: boolean; priceOverride?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertyAvailability).values(data);
  return result[0].insertId;
}

// ─── Property Submissions (Lead Intake) ──────────────────────────────
export async function createPropertySubmission(data: InsertPropertySubmission) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertySubmissions).values(data);
  return result[0].insertId;
}

export async function getPropertySubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(propertySubmissions).where(eq(propertySubmissions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllPropertySubmissions(limit = 50, offset = 0, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions: any[] = [];
  if (status && status !== "all") {
    conditions.push(eq(propertySubmissions.status, status as any));
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(propertySubmissions.ownerName, term),
      like(propertySubmissions.ownerNameAr, term),
      like(propertySubmissions.phone, term),
      like(propertySubmissions.email, term),
      like(propertySubmissions.city, term),
      like(propertySubmissions.cityAr, term),
    ));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const items = await db.select().from(propertySubmissions)
    .where(where!)
    .orderBy(desc(propertySubmissions.createdAt))
    .limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions).where(where!);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function updatePropertySubmission(id: number, data: Partial<InsertPropertySubmission>) {
  const db = await getDb();
  if (!db) return;
  await db.update(propertySubmissions).set(data as any).where(eq(propertySubmissions.id, id));
}

export async function getSubmissionPhotosBySubmissionId(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissionPhotos)
    .where(eq(submissionPhotos.submissionId, submissionId))
    .orderBy(asc(submissionPhotos.sortOrder));
}

export async function addSubmissionPhoto(data: InsertSubmissionPhoto) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(submissionPhotos).values(data);
  return result[0].insertId;
}

export async function deleteSubmissionPhoto(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(submissionPhotos).where(eq(submissionPhotos.id, id));
}

export async function getPropertySubmissionCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  if (status && status !== "all") {
    const result = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions)
      .where(eq(propertySubmissions.status, status as any));
    return result[0]?.count ?? 0;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(propertySubmissions);
  return result[0]?.count ?? 0;
}

// ─── Hidden Properties ──────────────────────────────────────────────
export async function hideProperty(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  const exists = await db.select().from(hiddenProperties)
    .where(and(eq(hiddenProperties.userId, userId), eq(hiddenProperties.propertyId, propertyId))).limit(1);
  if (exists.length === 0) {
    await db.insert(hiddenProperties).values({ userId, propertyId } as any);
  }
}
export async function unhideProperty(userId: number, propertyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(hiddenProperties)
    .where(and(eq(hiddenProperties.userId, userId), eq(hiddenProperties.propertyId, propertyId)));
}
export async function isPropertyHidden(userId: number, propertyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(hiddenProperties)
    .where(and(eq(hiddenProperties.userId, userId), eq(hiddenProperties.propertyId, propertyId))).limit(1);
  return result.length > 0;
}
export async function getUserHiddenProperties(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const hidden = await db.select().from(hiddenProperties).where(eq(hiddenProperties.userId, userId));
  if (hidden.length === 0) return [];
  const propIds = hidden.map(h => h.propertyId);
  return db.select().from(properties).where(inArray(properties.id, propIds));
}

// ─── Property Enquiries ─────────────────────────────────────────────
export async function createPropertyEnquiry(userId: number, propertyId: number, message?: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(propertyEnquiries).values({ userId, propertyId, message } as any);
  return result[0].insertId;
}
export async function getUserEnquiries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const enquiries = await db.select().from(propertyEnquiries)
    .where(eq(propertyEnquiries.userId, userId))
    .orderBy(desc(propertyEnquiries.createdAt));
  if (enquiries.length === 0) return [];
  const propIds = [...new Set(enquiries.map(e => e.propertyId))];
  const props = await db.select().from(properties).where(inArray(properties.id, propIds));
  return enquiries.map(e => ({
    ...e,
    property: props.find(p => p.id === e.propertyId) || null,
  }));
}
export async function getPropertyEnquiries(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(propertyEnquiries)
    .where(eq(propertyEnquiries.propertyId, propertyId))
    .orderBy(desc(propertyEnquiries.createdAt));
}
