// Database access: bookings. Moved verbatim from server/db.ts.
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

// ─── Bookings ────────────────────────────────────────────────────────
export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(bookings).values(data);
  return result[0].insertId;
}

export async function updateBooking(id: number, data: Partial<InsertBooking>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set(data).where(eq(bookings.id, id));
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.tenantId, tenantId)).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.landlordId, landlordId)).orderBy(desc(bookings.createdAt));
}

export async function getBookingsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(eq(bookings.propertyId, propertyId)).orderBy(desc(bookings.createdAt));
}

export async function getAllBookings(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset);
}

export async function getBookingCount(status?: string) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = status ? [eq(bookings.status, status as any)] : [];
  const result = await db.select({ count: sql<number>`count(*)` }).from(bookings)
    .where(conditions.length ? and(...conditions) : undefined);
  return result[0]?.count ?? 0;
}

// ─── Payments ────────────────────────────────────────────────────────
export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(payments).values(data);
  return result[0].insertId;
}

export async function updatePayment(id: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.tenantId, tenantId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentsByLandlord(landlordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.landlordId, landlordId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentsByBooking(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt));
}

export async function getTotalRevenue() {
  const db = await getDb();
  if (!db) return 0;
  // Include both 'completed' (manual override) and 'paid' (Moyasar webhook) statuses
  const result = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(payments)
    .where(sql`${payments.status} IN ('completed', 'paid')`);
  return result[0]?.total ?? 0;
}

// ─── PayPal Payment Helpers ──────────────────────────────────────────
export async function updateBookingPayment(bookingId: number, data: {
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paymentStatus?: string;
  payerEmail?: string;
  paidAmount?: string;
}) {
  const db = await getDb();
  if (!db) return;
  // Update or create payment record
  const existing = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
  if (existing.length > 0) {
    await db.update(payments).set({
      paypalOrderId: data.paypalOrderId || existing[0].paypalOrderId,
      paypalCaptureId: data.paypalCaptureId || existing[0].paypalCaptureId,
      payerEmail: data.payerEmail || existing[0].payerEmail,
      status: data.paymentStatus === "paid" ? "completed" : data.paymentStatus === "pending" ? "pending" : existing[0].status,
      paymentMethod: "paypal",
      paidAt: data.paymentStatus === "paid" ? new Date() : existing[0].paidAt,
    }).where(eq(payments.id, existing[0].id));
  } else {
    // Get booking details to create payment
    const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (booking.length > 0) {
      await db.insert(payments).values({
        bookingId,
        tenantId: booking[0].tenantId,
        landlordId: booking[0].landlordId,
        type: "rent",
        amount: data.paidAmount || booking[0].totalAmount || "0",
        currency: "SAR",
        status: data.paymentStatus === "paid" ? "completed" : "pending",
        paypalOrderId: data.paypalOrderId,
        paypalCaptureId: data.paypalCaptureId,
        payerEmail: data.payerEmail,
        paymentMethod: "paypal",
        paidAt: data.paymentStatus === "paid" ? new Date() : null,
      });
    }
  }
}
