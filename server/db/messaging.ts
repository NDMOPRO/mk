// Database access: messaging. Moved verbatim from server/db.ts.
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

// ─── Conversations & Messages ────────────────────────────────────────
export async function getOrCreateConversation(tenantId: number, landlordId: number, propertyId?: number) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(conversations.tenantId, tenantId), eq(conversations.landlordId, landlordId)];
  if (propertyId) conditions.push(eq(conversations.propertyId, propertyId));
  const existing = await db.select().from(conversations).where(and(...conditions)).limit(1);
  if (existing.length > 0) return existing[0];
  const result = await db.insert(conversations).values({ tenantId, landlordId, propertyId });
  const newConv = await db.select().from(conversations).where(eq(conversations.id, result[0].insertId)).limit(1);
  return newConv[0] ?? null;
}

export async function getConversationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations)
    .where(or(eq(conversations.tenantId, userId), eq(conversations.landlordId, userId)))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getMessagesByConversation(conversationId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt)).limit(limit).offset(offset);
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(messages).values(data);
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return result[0].insertId;
}

export async function markMessagesAsRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ isRead: true })
    .where(and(eq(messages.conversationId, conversationId), sql`${messages.senderId} != ${userId}`));
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const userConvs = await getConversationsByUser(userId);
  if (userConvs.length === 0) return 0;
  const convIds = userConvs.map(c => c.id);
  const result = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(and(inArray(messages.conversationId, convIds), eq(messages.isRead, false), sql`${messages.senderId} != ${userId}`));
  return result[0]?.count ?? 0;
}

// ─── Notifications ───────────────────────────────────────────────────
export async function createNotification(data: { userId: number; type: string; titleEn: string; titleAr?: string; contentEn?: string; contentAr?: string; relatedId?: number; relatedType?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(data as any);
  return result[0].insertId;
}

export async function getNotificationsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

export async function getAllPayments(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit).offset(offset);
}

export async function updatePaymentStatus(id: number, status: string, paidAt?: Date) {
  const db = await getDb();
  if (!db) return;
  const data: any = { status };
  if (paidAt) data.paidAt = paidAt;
  await db.update(payments).set(data).where(eq(payments.id, id));
}

// ─── Contact Messages ───────────────────────────────────────────────
export async function createContactMessage(data: InsertContactMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(contactMessages).values(data as any);
  return result[0].insertId;
}

export async function getContactMessages(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db.select().from(contactMessages)
      .where(eq(contactMessages.status, status as any))
      .orderBy(desc(contactMessages.createdAt));
  }
  return await db.select().from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));
}

export async function updateContactMessageStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(contactMessages).set({ status: status as any }).where(eq(contactMessages.id, id));
}
