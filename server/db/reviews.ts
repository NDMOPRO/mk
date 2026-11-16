// Database access: reviews. Moved verbatim from server/db.ts.
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

// ─── Reviews ─────────────────────────────────────────────────────────
export async function createReview(data: { propertyId: number; tenantId: number; bookingId?: number; rating: number; comment?: string; commentAr?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(reviews).values(data);
  return result[0].insertId;
}

export async function getReviewsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id,
    propertyId: reviews.propertyId,
    tenantId: reviews.tenantId,
    bookingId: reviews.bookingId,
    rating: reviews.rating,
    comment: reviews.comment,
    commentAr: reviews.commentAr,
    isPublished: reviews.isPublished,
    createdAt: reviews.createdAt,
    tenantName: users.name,
    tenantNameAr: users.nameAr,
    tenantAvatar: users.avatarUrl,
  })
    .from(reviews)
    .leftJoin(users, eq(reviews.tenantId, users.id))
    .where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true)))
    .orderBy(desc(reviews.createdAt));
}

export async function getReviewsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.tenantId, tenantId)).orderBy(desc(reviews.createdAt));
}

export async function getAllReviews(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: reviews.id,
    propertyId: reviews.propertyId,
    tenantId: reviews.tenantId,
    bookingId: reviews.bookingId,
    rating: reviews.rating,
    comment: reviews.comment,
    commentAr: reviews.commentAr,
    isPublished: reviews.isPublished,
    createdAt: reviews.createdAt,
    tenantName: users.name,
    tenantNameAr: users.nameAr,
    propertyTitle: properties.titleEn,
    propertyTitleAr: properties.titleAr,
  })
    .from(reviews)
    .leftJoin(users, eq(reviews.tenantId, users.id))
    .leftJoin(properties, eq(reviews.propertyId, properties.id))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateReviewPublished(id: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews).set({ isPublished }).where(eq(reviews.id, id));
}

export async function deleteReview(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(reviews).where(eq(reviews.id, id));
}

export async function getPropertyAverageRating(propertyId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const result = await db.select({
    average: sql<number>`COALESCE(AVG(rating), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(reviews)
    .where(and(eq(reviews.propertyId, propertyId), eq(reviews.isPublished, true)));
  return { average: Number(result[0]?.average ?? 0), count: Number(result[0]?.count ?? 0) };
}

export async function getAverageRating(propertyId: number) {
  const { average } = await getPropertyAverageRating(propertyId);
  return average;
}

export async function hasUserReviewedBooking(tenantId: number, bookingId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ count: sql<number>`count(*)` }).from(reviews)
    .where(and(eq(reviews.tenantId, tenantId), eq(reviews.bookingId, bookingId)));
  return (result[0]?.count ?? 0) > 0;
}

export async function getReviewCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(reviews);
  return result[0]?.count ?? 0;
}
