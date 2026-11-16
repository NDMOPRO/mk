// Database access: connection, startup schema changes, transactions.
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

let _db: ReturnType<typeof drizzle> | null = null;

let _pool: mysql.Pool | null = null;
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _pool = mysql.createPool(ENV.databaseUrl);
      _db = drizzle(_pool);
      console.log(`[Database] Pool created for environment: ${ENV.appEnvironment}`);
      // Fail fast if the database is unreachable, so callers get null as before.
      await _pool.query("SELECT 1");
      // Schema changes live in drizzle/ migrations (run by start.sh before the
      // app starts). Nothing here alters tables; see migration 0027 for what
      // used to be created at this point.
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
export function getPool() { return _pool; }

// ─── Transaction Helper ──────────────────────────────────────────────
/**
 * Execute multiple DB operations atomically within a transaction.
 * If any step throws, all changes are rolled back.
 * Usage: await withTransaction(async (tx) => { ... });
 */
export async function withTransaction<T>(
  fn: (tx: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return (db as any).transaction(fn);
}
