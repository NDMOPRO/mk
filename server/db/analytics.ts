// Database access: analytics. Moved verbatim from server/db.ts.
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

// ─── Analytics ──────────────────────────────────────────────────────

/** Monthly booking counts for the last N months */
export async function getBookingsByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COUNT(*) AS count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeCount,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedCount,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingCount
    FROM bookings
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** Monthly revenue for the last N months */
export async function getRevenueByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN status IN ('completed', 'paid') THEN amount ELSE 0 END), 0) AS revenue,
      COUNT(*) AS transactionCount
    FROM payments
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** User registration counts by month */
export async function getUserRegistrationsByMonth(months = 12) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      DATE_FORMAT(createdAt, '%Y-%m') AS month,
      COUNT(*) AS count,
      SUM(CASE WHEN role = 'tenant' THEN 1 ELSE 0 END) AS tenantCount,
      SUM(CASE WHEN role = 'landlord' THEN 1 ELSE 0 END) AS landlordCount
    FROM users
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
    ORDER BY month ASC
  `);
  return (result as any)[0] ?? [];
}

/** Property listings by type */
export async function getPropertiesByType() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT propertyType, COUNT(*) AS count
    FROM properties
    WHERE status = 'published'
    GROUP BY propertyType
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Property listings by city */
export async function getPropertiesByCity() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT city, cityAr, COUNT(*) AS count
    FROM properties
    WHERE status = 'published'
    GROUP BY city, cityAr
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Booking status distribution */
export async function getBookingStatusDistribution() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT status, COUNT(*) AS count
    FROM bookings
    GROUP BY status
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Revenue by payment method */
export async function getRevenueByPaymentMethod() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT paymentMethod, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM payments
    WHERE status = 'completed'
    GROUP BY paymentMethod
    ORDER BY total DESC
  `);
  return (result as any)[0] ?? [];
}

/** Top performing properties by revenue */
export async function getTopProperties(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      p.id, p.titleEn, p.titleAr, p.city, p.cityAr, p.monthlyRent,
      COUNT(b.id) AS bookingCount,
      COALESCE(SUM(b.totalAmount), 0) AS totalRevenue,
      p.viewCount
    FROM properties p
    LEFT JOIN bookings b ON b.propertyId = p.id AND b.status IN ('active', 'completed')
    WHERE p.status = 'published'
    GROUP BY p.id
    ORDER BY totalRevenue DESC
    LIMIT ${limit}
  `);
  return (result as any)[0] ?? [];
}

/** Service requests summary */
export async function getServiceRequestsSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      sr.status,
      COUNT(*) AS count,
      COALESCE(SUM(sr.totalPrice), 0) AS totalValue
    FROM service_requests sr
    GROUP BY sr.status
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Emergency maintenance summary */
export async function getMaintenanceSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    SELECT
      status, urgency, COUNT(*) AS count
    FROM emergency_maintenance
    GROUP BY status, urgency
    ORDER BY count DESC
  `);
  return (result as any)[0] ?? [];
}

/** Occupancy rate: active bookings / active properties */
export async function getOccupancyRate() {
  const db = await getDb();
  if (!db) return { occupancyRate: 0, activeBookings: 0, activeProperties: 0, bookedDays: 0, totalPropertyDays: 0 };
  // Count active bookings
  const [bookingResult] = await db.select({ count: sql<number>`count(*)` }).from(bookings)
    .where(eq(bookings.status, "active"));
  // Count published/active properties
  const [propertyResult] = await db.select({ count: sql<number>`count(*)` }).from(properties)
    .where(sql`${properties.status} IN ('published', 'active')`);
  const activeBookingsCount = bookingResult?.count ?? 0;
  const activePropertiesCount = propertyResult?.count ?? 0;

  // Try to use availability_blocks for date-based occupancy (preferred)
  let occupancyRate = 0;
  let bookedDays = 0;
  let totalPropertyDays = activePropertiesCount * 30; // last 30 days
  try {
    const { getOccupancyStats } = await import('../availability-blocks.js');
    const stats = await getOccupancyStats(30);
    occupancyRate = stats.occupancyRate;
    bookedDays = stats.bookedDays;
    totalPropertyDays = stats.totalPropertyDays;
  } catch {
    // Fallback: simple ratio if availability_blocks table doesn't exist yet
    occupancyRate = activePropertiesCount > 0 ? Math.round((activeBookingsCount / activePropertiesCount) * 100) : 0;
  }

  return { occupancyRate, activeBookings: activeBookingsCount, activeProperties: activePropertiesCount, bookedDays, totalPropertyDays };
}

/** Recent activity feed */
export async function getRecentActivity(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql`
    (SELECT 'booking' AS type, id, status AS detail, createdAt FROM bookings ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'payment' AS type, id, status AS detail, createdAt FROM payments ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'user' AS type, id, role AS detail, createdAt FROM users ORDER BY createdAt DESC LIMIT 5)
    UNION ALL
    (SELECT 'property' AS type, id, status AS detail, createdAt FROM properties ORDER BY createdAt DESC LIMIT 5)
    ORDER BY createdAt DESC
    LIMIT ${limit}
  `);
  return (result as any)[0] ?? [];
}
