// Database access: users. Moved verbatim from server/db.ts.
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

// ─── Users ───────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "phone", "nameAr", "avatarUrl", "bio", "bioAr"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    (values as any)[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  // Role is assigned explicitly during registration or by admin. No auto-admin via env var.
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "landlord" | "tenant") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  const { openId, id, ...updateData } = data as any;
  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function getAllUsers(limit = 50, offset = 0, search?: string, role?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(users.name, term),
      like(users.nameAr, term),
      like(users.displayName, term),
      like(users.email, term),
      like(users.phone, term),
    ));
  }
  if (role && role !== 'all') {
    conditions.push(eq(users.role, role as any));
  }
  // Left join adminPermissions to include isRootAdmin flag
  const baseQuery = db.select({
    id: users.id, openId: users.openId, userId: users.userId,
    displayName: users.displayName, name: users.name, nameAr: users.nameAr,
    email: users.email, phone: users.phone, whatsapp: users.whatsapp,
    role: users.role, avatarUrl: users.avatarUrl, isVerified: users.isVerified,
    createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
    // recoveryEmail stripped — sensitive field not exposed to admin panel
    isRootAdmin: adminPermissions.isRootAdmin,
  }).from(users)
    .leftJoin(adminPermissions, eq(users.id, adminPermissions.userId));
  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions)).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }
  return baseQuery.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function getUserCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return result[0]?.count ?? 0;
}

// ─── Local Auth ─────────────────────────────────────────────────────
export async function getUserByUserId(userId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  userId: string;
  passwordHash: string;
  displayName: string;
  name?: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  role?: "user" | "admin" | "landlord" | "tenant";
}) {
  const db = await getDb();
  if (!db) return null;
  const openId = `local_${data.userId}`;
  const result = await db.insert(users).values({
    openId,
    userId: data.userId,
    passwordHash: data.passwordHash,
    displayName: data.displayName,
    name: data.name || data.displayName,
    nameAr: data.nameAr,
    email: data.email,
    phone: data.phone,
    role: data.role || "user",
    loginMethod: "local",
  });
  return result[0].insertId;
}

export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

// ─── User Activity Tracking ─────────────────────────────────────────
export async function trackActivity(data: InsertUserActivity) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivities).values(data);
}

export async function getActivityLog(filters?: { userId?: number; action?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.userId) conditions.push(eq(userActivities.userId, filters.userId));
  if (filters?.action) conditions.push(eq(userActivities.action, filters.action));
  const query = db.select().from(userActivities).orderBy(desc(userActivities.createdAt));
  if (conditions.length > 0) query.where(and(...conditions));
  if (filters?.limit) query.limit(filters.limit);
  if (filters?.offset) query.offset(filters.offset);
  return query;
}

export async function getActivityStats() {
  const db = await getDb();
  if (!db) return { totalActions: 0, uniqueUsers: 0, topActions: [], recentActivity: [] };
  
  const totalActions = await db.select({ count: sql<number>`COUNT(*)` }).from(userActivities);
  const uniqueUsers = await db.select({ count: sql<number>`COUNT(DISTINCT userId)` }).from(userActivities);
  const topActions = await db.select({
    action: userActivities.action,
    count: sql<number>`COUNT(*) as cnt`,
  }).from(userActivities).groupBy(userActivities.action).orderBy(sql`cnt DESC`).limit(10);
  
  const recentActivity = await db.select().from(userActivities).orderBy(desc(userActivities.createdAt)).limit(20);
  
  return {
    totalActions: totalActions[0]?.count ?? 0,
    uniqueUsers: uniqueUsers[0]?.count ?? 0,
    topActions,
    recentActivity,
  };
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return { searches: [], viewedProperties: [], favoriteTypes: [] };
  
  const searches = await db.select({ metadata: userActivities.metadata })
    .from(userActivities)
    .where(and(eq(userActivities.userId, userId), eq(userActivities.action, "search")))
    .orderBy(desc(userActivities.createdAt)).limit(20);
  
  const viewedProperties = await db.select({ metadata: userActivities.metadata })
    .from(userActivities)
    .where(and(eq(userActivities.userId, userId), eq(userActivities.action, "property_view")))
    .orderBy(desc(userActivities.createdAt)).limit(20);
  
  return { searches, viewedProperties, favoriteTypes: [] };
}

// ─── Admin Permissions ──────────────────────────────────────────────
export async function getAdminPermissions(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(adminPermissions).where(eq(adminPermissions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function setAdminPermissions(userId: number, perms: string[], isRoot = false) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminPermissions).values({ userId, permissions: perms, isRootAdmin: isRoot })
    .onDuplicateKeyUpdate({ set: { permissions: perms, isRootAdmin: isRoot } });
}

export async function getAllAdminPermissions() {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  const perms = await db.select().from(adminPermissions);
  const permsMap = new Map(perms.map(p => [p.userId, p]));
  return admins.map(a => ({
    ...a,
    permissions: permsMap.get(a.id)?.permissions ?? [],
    isRootAdmin: permsMap.get(a.id)?.isRootAdmin ?? false,
  }));
}

export async function deleteAdminPermissions(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adminPermissions).where(eq(adminPermissions.userId, userId));
}
