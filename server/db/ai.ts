// Database access: ai. Moved verbatim from server/db.ts.
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

// ─── AI Conversations ──────────────────────────────────────────────
export async function createAiConversation(userId: number, title?: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiConversations).values({ userId, title: title || "محادثة جديدة" });
  return result[0].insertId;
}

export async function getAiConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt));
}

export async function getAiConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiConversations).where(eq(aiConversations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteAiConversation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
  await db.delete(aiConversations).where(eq(aiConversations.id, id));
}

// ─── AI Messages ───────────────────────────────────────────────────
export async function createAiMessage(data: { conversationId: number; role: "user" | "assistant"; content: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiMessages).values(data);
  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, data.conversationId));
  return result[0].insertId;
}

export async function getAiMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
}

export async function rateAiMessage(id: number, rating: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiMessages).set({ rating }).where(eq(aiMessages.id, id));
}

// ─── Knowledge Base ────────────────────────────────────────────────
export async function createKnowledgeArticle(data: InsertKnowledgeBase) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(knowledgeBase).values(data);
  return result[0].insertId;
}

export async function getKnowledgeArticles(category?: string) {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(knowledgeBase)
      .where(and(eq(knowledgeBase.category, category as any), eq(knowledgeBase.isActive, true)))
      .orderBy(desc(knowledgeBase.updatedAt));
  }
  return db.select().from(knowledgeBase)
    .where(eq(knowledgeBase.isActive, true))
    .orderBy(desc(knowledgeBase.updatedAt));
}

export async function getAllKnowledgeArticles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeBase).orderBy(desc(knowledgeBase.updatedAt));
}

export async function updateKnowledgeArticle(id: number, data: Partial<InsertKnowledgeBase>) {
  const db = await getDb();
  if (!db) return;
  await db.update(knowledgeBase).set(data).where(eq(knowledgeBase.id, id));
}

export async function deleteKnowledgeArticle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}

export async function searchKnowledgeBase(query: string) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  return db.select().from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.isActive, true),
      or(
        like(knowledgeBase.titleEn, q),
        like(knowledgeBase.titleAr, q),
        like(knowledgeBase.contentEn, q),
        like(knowledgeBase.contentAr, q),
      )
    ));
}


// ─── AI Documents ─────────────────────────────────────────────────
export async function createAiDocument(data: InsertAiDocument) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiDocuments).values(data);
  return result[0].insertId;
}

export async function getAiDocuments(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(aiDocuments).where(eq(aiDocuments.isActive, true)).orderBy(desc(aiDocuments.createdAt));
  }
  return db.select().from(aiDocuments).orderBy(desc(aiDocuments.createdAt));
}

export async function getAiDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiDocuments).where(eq(aiDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAiDocument(id: number, data: Partial<InsertAiDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiDocuments).set(data).where(eq(aiDocuments.id, id));
}

export async function deleteAiDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(aiDocuments).where(eq(aiDocuments.id, id));
}

// ─── AI Admin Stats ───────────────────────────────────────────────
export async function getAiStats() {
  const db = await getDb();
  if (!db) return { totalConversations: 0, totalMessages: 0, avgRating: 0, totalDocuments: 0, totalArticles: 0 };
  
  const [convCount] = await db.select({ count: sql<number>`count(*)` }).from(aiConversations);
  const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(aiMessages);
  const [avgRat] = await db.select({ avg: sql<number>`COALESCE(AVG(rating), 0)` }).from(aiMessages).where(sql`rating IS NOT NULL`);
  const [docCount] = await db.select({ count: sql<number>`count(*)` }).from(aiDocuments);
  const [artCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeBase);
  
  return {
    totalConversations: convCount.count,
    totalMessages: msgCount.count,
    avgRating: Number(avgRat.avg) || 0,
    totalDocuments: docCount.count,
    totalArticles: artCount.count,
  };
}

export async function getAllAiConversations(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: aiConversations.id,
    userId: aiConversations.userId,
    title: aiConversations.title,
    createdAt: aiConversations.createdAt,
    updatedAt: aiConversations.updatedAt,
  }).from(aiConversations)
    .orderBy(desc(aiConversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getAiRatedMessages() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: aiMessages.id,
    conversationId: aiMessages.conversationId,
    role: aiMessages.role,
    content: aiMessages.content,
    rating: aiMessages.rating,
    createdAt: aiMessages.createdAt,
  }).from(aiMessages)
    .where(sql`${aiMessages.rating} IS NOT NULL`)
    .orderBy(desc(aiMessages.createdAt))
    .limit(100);
}

export async function getActiveAiDocumentTexts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    filename: aiDocuments.filename,
    extractedText: aiDocuments.extractedText,
    category: aiDocuments.category,
    description: aiDocuments.description,
    descriptionAr: aiDocuments.descriptionAr,
  }).from(aiDocuments)
    .where(and(eq(aiDocuments.isActive, true), sql`${aiDocuments.extractedText} IS NOT NULL`));
}
