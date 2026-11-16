// Database access: whatsapp. Moved verbatim from server/db.ts.
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
import { getDb, getPool } from "./connection";

// ─── WhatsApp Messages ──────────────────────────────────────────────
export async function createWhatsAppMessage(data: {
  recipientPhone: string;
  recipientName: string | null;
  userId: number | null;
  messageType: string;
  templateName: string | null;
  messageBody: string;
  propertyId: number | null;
  bookingId: number | null;
  channel: string;
  sentBy: number;
  status: string;
  sentAt: Date;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");
  // Auto-create table if not exists
  await pool.execute(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipientPhone VARCHAR(20) NOT NULL,
    recipientName VARCHAR(255),
    userId INT,
    messageType ENUM('property_share','booking_reminder','follow_up','custom','welcome','payment_reminder') NOT NULL,
    templateName VARCHAR(100),
    messageBody TEXT,
    propertyId INT,
    bookingId INT,
    status ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending' NOT NULL,
    providerMsgId VARCHAR(255),
    channel ENUM('click_to_chat','cloud_api') DEFAULT 'click_to_chat' NOT NULL,
    sentBy INT,
    errorMessage TEXT,
    sentAt TIMESTAMP NULL,
    deliveredAt TIMESTAMP NULL,
    readAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  const [result] = await pool.query(
    `INSERT INTO whatsapp_messages (recipientPhone, recipientName, userId, messageType, templateName, messageBody, propertyId, bookingId, channel, sentBy, status, sentAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [data.recipientPhone, data.recipientName, data.userId, data.messageType, data.templateName, data.messageBody, data.propertyId, data.bookingId, data.channel, data.sentBy, data.status, data.sentAt]
  );
  return (result as any).insertId as number;
}

export async function listWhatsAppMessages(filters: { limit?: number; offset?: number; messageType?: string; status?: string }) {
  const pool = getPool();
  if (!pool) return { messages: [], total: 0 };
  let where = "1=1";
  const params: any[] = [];
  if (filters.messageType) { where += " AND messageType = ?"; params.push(filters.messageType); }
  if (filters.status) { where += " AND status = ?"; params.push(filters.status); }
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  try {
    const [rows] = await pool.query(`SELECT * FROM whatsapp_messages WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM whatsapp_messages WHERE ${where}`, params);
    return { messages: rows as any[], total: (countResult as any[])[0]?.total || 0 };
  } catch {
    return { messages: [], total: 0 };
  }
}

export async function getWhatsAppStats() {
  const pool = getPool();
  if (!pool) return { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) as totalMessages,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as \`read\`,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as last24h,
        SUM(CASE WHEN createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last7d
      FROM whatsapp_messages
    `);
    return (rows as any[])[0] || { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  } catch {
    return { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0, last24h: 0, last7d: 0 };
  }
}


// ─── WhatsApp Templates (DB-stored, admin-managed) ──────────────────

export async function ensureWhatsAppTemplatesTable() {
  const pool = getPool();
  if (!pool) return;
  await pool.execute(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    templateKey VARCHAR(100) NOT NULL UNIQUE,
    nameEn VARCHAR(255) NOT NULL,
    nameAr VARCHAR(255) NOT NULL,
    metaTemplateName VARCHAR(255) DEFAULT NULL COMMENT 'Meta-approved template name for Cloud API',
    languageCode VARCHAR(10) DEFAULT 'ar',
    messageType ENUM('property_share','booking_reminder','follow_up','custom','welcome','payment_reminder','booking_approved','booking_rejected') NOT NULL,
    bodyEn TEXT,
    bodyAr TEXT,
    variableKeys JSON COMMENT 'Array of variable placeholder names',
    isActive BOOLEAN DEFAULT TRUE NOT NULL,
    channel ENUM('click_to_chat','cloud_api','both') DEFAULT 'both' NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
  )`);
}

export async function listWhatsAppTemplates(activeOnly: boolean = false) {
  const pool = getPool();
  if (!pool) return [];
  await ensureWhatsAppTemplatesTable();
  const where = activeOnly ? "WHERE isActive = TRUE" : "";
  const [rows] = await pool.query(`SELECT * FROM whatsapp_templates ${where} ORDER BY createdAt DESC`);
  return rows as any[];
}

export async function getWhatsAppTemplate(id: number) {
  const pool = getPool();
  if (!pool) return null;
  await ensureWhatsAppTemplatesTable();
  const [rows] = await pool.query(`SELECT * FROM whatsapp_templates WHERE id = ?`, [id]);
  return (rows as any[])[0] || null;
}

export async function createWhatsAppTemplateRecord(data: {
  templateKey: string; nameEn: string; nameAr: string; metaTemplateName?: string;
  languageCode?: string; messageType: string; bodyEn?: string; bodyAr?: string;
  variableKeys?: string[]; channel?: string;
}) {
  const pool = getPool();
  if (!pool) return null;
  await ensureWhatsAppTemplatesTable();
  const [result] = await pool.query(
    `INSERT INTO whatsapp_templates (templateKey, nameEn, nameAr, metaTemplateName, languageCode, messageType, bodyEn, bodyAr, variableKeys, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.templateKey, data.nameEn, data.nameAr, data.metaTemplateName || null, data.languageCode || 'ar',
     data.messageType, data.bodyEn || null, data.bodyAr || null,
     data.variableKeys ? JSON.stringify(data.variableKeys) : null, data.channel || 'both']
  );
  return (result as any).insertId;
}

export async function updateWhatsAppTemplateRecord(id: number, data: {
  nameEn?: string; nameAr?: string; metaTemplateName?: string; languageCode?: string;
  messageType?: string; bodyEn?: string; bodyAr?: string; variableKeys?: string[];
  isActive?: boolean; channel?: string;
}) {
  const pool = getPool();
  if (!pool) return;
  const sets: string[] = [];
  const params: any[] = [];
  if (data.nameEn !== undefined) { sets.push("nameEn = ?"); params.push(data.nameEn); }
  if (data.nameAr !== undefined) { sets.push("nameAr = ?"); params.push(data.nameAr); }
  if (data.metaTemplateName !== undefined) { sets.push("metaTemplateName = ?"); params.push(data.metaTemplateName); }
  if (data.languageCode !== undefined) { sets.push("languageCode = ?"); params.push(data.languageCode); }
  if (data.messageType !== undefined) { sets.push("messageType = ?"); params.push(data.messageType); }
  if (data.bodyEn !== undefined) { sets.push("bodyEn = ?"); params.push(data.bodyEn); }
  if (data.bodyAr !== undefined) { sets.push("bodyAr = ?"); params.push(data.bodyAr); }
  if (data.variableKeys !== undefined) { sets.push("variableKeys = ?"); params.push(JSON.stringify(data.variableKeys)); }
  if (data.isActive !== undefined) { sets.push("isActive = ?"); params.push(data.isActive); }
  if (data.channel !== undefined) { sets.push("channel = ?"); params.push(data.channel); }
  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE whatsapp_templates SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function deleteWhatsAppTemplateRecord(id: number) {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`DELETE FROM whatsapp_templates WHERE id = ?`, [id]);
}

export async function seedDefaultWhatsAppTemplates() {
  const pool = getPool();
  if (!pool) return;
  await ensureWhatsAppTemplatesTable();
  const [existing] = await pool.query(`SELECT COUNT(*) as cnt FROM whatsapp_templates`);
  if ((existing as any[])[0]?.cnt > 0) return;
  const defaults = [
    { templateKey: "welcome", nameEn: "Welcome New Tenant", nameAr: "ترحيب بمستأجر جديد", messageType: "welcome",
      bodyEn: "Welcome {name}! 🏠\nWelcome to Monthly Key. We're happy to have you.\nIf you need any help, don't hesitate to reach out.",
      bodyAr: "مرحباً {name}! 🏠\nأهلاً بك في Monthly Key. نحن سعداء بانضمامك.\nإذا احتجت أي مساعدة، لا تتردد في التواصل معنا.",
      variableKeys: ["name"] },
    { templateKey: "booking_confirm", nameEn: "Booking Confirmation", nameAr: "تأكيد حجز", messageType: "booking_reminder",
      bodyEn: "Hi {name}! ✅\nYour booking is confirmed for: {property}\nMove-in: {date}\nMonthly rent: {rent} SAR",
      bodyAr: "مرحباً {name}! ✅\nتم تأكيد حجزك للعقار: {property}\nتاريخ الدخول: {date}\nالإيجار الشهري: {rent} ر.س",
      variableKeys: ["name", "property", "date", "rent"] },
    { templateKey: "payment_reminder", nameEn: "Payment Reminder", nameAr: "تذكير بالدفع", messageType: "payment_reminder",
      bodyEn: "Hi {name} 💰\nReminder for your monthly rent for: {property}\nAmount: {rent} SAR",
      bodyAr: "مرحباً {name} 💰\nنذكرك بموعد دفع الإيجار الشهري للعقار: {property}\nالمبلغ: {rent} ر.س",
      variableKeys: ["name", "property", "rent"] },
    { templateKey: "booking_approved", nameEn: "Booking Approved", nameAr: "تمت الموافقة على الحجز", messageType: "booking_approved",
      bodyEn: "Hi {name}! ✅\nYour booking for {property} has been approved.\nPlease proceed with payment.",
      bodyAr: "مرحباً {name}! ✅\nتمت الموافقة على حجزك للعقار: {property}\nيرجى إتمام الدفع لتأكيد الحجز.",
      variableKeys: ["name", "property"] },
    { templateKey: "booking_rejected", nameEn: "Booking Rejected", nameAr: "تم رفض الحجز", messageType: "booking_rejected",
      bodyEn: "Hi {name},\nYour booking for {property} could not be approved.\nReason: {reason}",
      bodyAr: "مرحباً {name},\nللأسف لم تتم الموافقة على حجزك للعقار: {property}\nالسبب: {reason}",
      variableKeys: ["name", "property", "reason"] },
    { templateKey: "follow_up", nameEn: "Follow Up", nameAr: "متابعة", messageType: "follow_up",
      bodyEn: "Hi {name}! 👋\nWe hope you're enjoying your stay. Need any help?",
      bodyAr: "مرحباً {name}! 👋\nنتمنى أنك مستمتع بإقامتك. هل تحتاج أي مساعدة؟",
      variableKeys: ["name"] },
    { templateKey: "custom", nameEn: "Custom Message", nameAr: "رسالة مخصصة", messageType: "custom",
      bodyEn: "", bodyAr: "", variableKeys: [] },
  ];
  for (const t of defaults) {
    await pool.query(
      `INSERT INTO whatsapp_templates (templateKey, nameEn, nameAr, messageType, bodyEn, bodyAr, variableKeys, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'both')`,
      [t.templateKey, t.nameEn, t.nameAr, t.messageType, t.bodyEn, t.bodyAr, JSON.stringify(t.variableKeys)]
    );
  }
}

// ─── WhatsApp Delivery Status Updates ───────────────────────────────

export async function updateWhatsAppMessageStatus(providerMsgId: string, status: string, timestamp?: Date) {
  const pool = getPool();
  if (!pool) return;
  try {
    const sets: string[] = [`status = ?`];
    const params: any[] = [status];
    if (status === "delivered" && timestamp) { sets.push("deliveredAt = ?"); params.push(timestamp); }
    if (status === "read" && timestamp) { sets.push("readAt = ?"); params.push(timestamp); }
    if (status === "failed") { sets.push("errorMessage = COALESCE(errorMessage, 'Delivery failed')"); }
    params.push(providerMsgId);
    await pool.query(`UPDATE whatsapp_messages SET ${sets.join(", ")} WHERE providerMsgId = ?`, params);
  } catch {
    // Silently ignore - delivery status is best-effort
  }
}


// ─── WhatsApp Inbox (Inbound Conversation Routing) ─────────────────

/**
 * Find or create a WhatsApp conversation by contact phone number.
 * If the phone matches a registered user, auto-link userId.
 */
export async function getOrCreateWaConversation(contactPhone: string, contactName?: string): Promise<{ id: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize phone: strip spaces, ensure starts with +
  const phone = contactPhone.replace(/\s+/g, "");

  // Look for existing open/assigned conversation with this phone
  const existing = await db.select().from(waConversations)
    .where(and(
      eq(waConversations.contactPhone, phone),
      inArray(waConversations.status, ["open", "assigned"])
    ))
    .orderBy(desc(waConversations.lastMessageAt))
    .limit(1);

  if (existing.length > 0) {
    // Update contactName if provided and different
    if (contactName && contactName !== existing[0].contactName) {
      await db.update(waConversations)
        .set({ contactName })
        .where(eq(waConversations.id, existing[0].id));
    }
    return { id: existing[0].id, isNew: false };
  }

  // Try to find a matching registered user by phone
  let matchedUserId: number | null = null;
  try {
    const phoneVariants = [phone];
    // Also try without + prefix, and with/without country code
    if (phone.startsWith("+")) phoneVariants.push(phone.substring(1));
    if (phone.startsWith("+966")) phoneVariants.push("0" + phone.substring(4));
    if (phone.startsWith("966")) phoneVariants.push("0" + phone.substring(3));

    const userMatch = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.phone, phoneVariants))
      .limit(1);
    if (userMatch.length > 0) {
      matchedUserId = userMatch[0].id;
      if (!contactName) contactName = userMatch[0].name ?? undefined;
    }
  } catch { /* ignore user lookup errors */ }

  // Create new conversation
  const result = await db.insert(waConversations).values({
    contactPhone: phone,
    contactName: contactName ?? null,
    userId: matchedUserId,
    status: "open",
    priority: "normal",
    unreadCount: 0,
    messageCount: 0,
  } as any);

  return { id: result[0].insertId, isNew: true };
}

/**
 * Add an inbound message to a WhatsApp conversation.
 */
export async function addInboundWaMessage(data: {
  conversationId: number;
  senderPhone: string;
  senderName?: string;
  content?: string;
  messageType?: string;
  mediaUrl?: string;
  taqnyatMessageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(waMessages).values({
    conversationId: data.conversationId,
    direction: "inbound",
    senderPhone: data.senderPhone,
    senderName: data.senderName ?? null,
    content: data.content ?? null,
    messageType: (data.messageType as any) ?? "text",
    mediaUrl: data.mediaUrl ?? null,
    taqnyatMessageId: data.taqnyatMessageId ?? null,
    status: "received",
    metadata: data.metadata ?? null,
  } as any);

  // Update conversation counters
  const now = new Date();
  await db.update(waConversations).set({
    lastMessageAt: now,
    lastInboundAt: now,
    unreadCount: sql`unreadCount + 1`,
    messageCount: sql`messageCount + 1`,
  } as any).where(eq(waConversations.id, data.conversationId));

  // Re-open if resolved/closed
  const conv = await db.select({ status: waConversations.status })
    .from(waConversations).where(eq(waConversations.id, data.conversationId)).limit(1);
  if (conv.length > 0 && (conv[0].status === "resolved" || conv[0].status === "closed")) {
    await db.update(waConversations).set({ status: "open", closedAt: null } as any)
      .where(eq(waConversations.id, data.conversationId));
  }

  return result[0].insertId;
}

/**
 * Add an outbound (admin reply) message to a WhatsApp conversation.
 */
export async function addOutboundWaMessage(data: {
  conversationId: number;
  content: string;
  sentById: number;
  sentByName: string;
  taqnyatMessageId?: string;
  messageType?: string;
  mediaUrl?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(waMessages).values({
    conversationId: data.conversationId,
    direction: "outbound",
    content: data.content,
    messageType: (data.messageType as any) ?? "text",
    mediaUrl: data.mediaUrl ?? null,
    taqnyatMessageId: data.taqnyatMessageId ?? null,
    status: "sent",
    sentById: data.sentById,
    sentByName: data.sentByName,
  } as any);

  // Update conversation counters
  await db.update(waConversations).set({
    lastMessageAt: new Date(),
    messageCount: sql`messageCount + 1`,
  } as any).where(eq(waConversations.id, data.conversationId));

  return result[0].insertId;
}

/**
 * List WhatsApp conversations for the admin inbox.
 */
export async function listWaConversations(filters?: {
  status?: string;
  assignedTo?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions: any[] = [];
  if (filters?.status && filters.status !== "all") {
    conditions.push(eq(waConversations.status, filters.status as any));
  }
  if (filters?.assignedTo) {
    conditions.push(eq(waConversations.assignedTo, filters.assignedTo));
  }
  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(
      like(waConversations.contactPhone, term),
      like(waConversations.contactName, term),
      like(waConversations.subject, term),
    ));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const items = await db.select().from(waConversations)
    .where(where!)
    .orderBy(desc(waConversations.lastMessageAt))
    .limit(limit).offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(waConversations).where(where!);
  const total = countResult[0]?.count ?? 0;

  return { items, total };
}

/**
 * Get a single WhatsApp conversation by ID.
 */
export async function getWaConversation(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(waConversations)
    .where(eq(waConversations.id, id)).limit(1);
  return result[0] ?? null;
}

/**
 * Get messages for a WhatsApp conversation.
 */
export async function getWaMessages(conversationId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(waMessages)
    .where(eq(waMessages.conversationId, conversationId))
    .orderBy(asc(waMessages.createdAt))
    .limit(limit).offset(offset);
}

/**
 * Update WhatsApp conversation status/assignment.
 */
export async function updateWaConversation(id: number, data: {
  status?: string;
  assignedTo?: number | null;
  assignedToName?: string | null;
  priority?: string;
  subject?: string;
  tags?: string[];
}) {
  const db = await getDb();
  if (!db) return;

  const sets: any = {};
  if (data.status !== undefined) sets.status = data.status;
  if (data.assignedTo !== undefined) sets.assignedTo = data.assignedTo;
  if (data.assignedToName !== undefined) sets.assignedToName = data.assignedToName;
  if (data.priority !== undefined) sets.priority = data.priority;
  if (data.subject !== undefined) sets.subject = data.subject;
  if (data.tags !== undefined) sets.tags = data.tags;
  if (data.status === "closed" || data.status === "resolved") sets.closedAt = new Date();

  if (Object.keys(sets).length > 0) {
    await db.update(waConversations).set(sets).where(eq(waConversations.id, id));
  }
}

/**
 * Mark all messages in a WhatsApp conversation as read (reset unread count).
 */
export async function markWaConversationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(waConversations).set({ unreadCount: 0 } as any)
    .where(eq(waConversations.id, id));
}

/**
 * Get total unread count across all WhatsApp conversations.
 */
export async function getWaUnreadTotal(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: sql<number>`COALESCE(SUM(unreadCount), 0)` })
    .from(waConversations)
    .where(inArray(waConversations.status, ["open", "assigned"]));
  return result[0]?.total ?? 0;
}

/**
 * Delete a user by ID.
 */
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}
