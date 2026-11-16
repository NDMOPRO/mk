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
      // Auto-migrate: ensure recoveryEmail column exists
      try {
        await _pool.execute("ALTER TABLE users ADD COLUMN recoveryEmail VARCHAR(320) DEFAULT NULL");
        console.log("[Database] Added missing recoveryEmail column");
      } catch (e: any) {
        if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
          // Column already exists, that's fine
        } else {
          console.warn("[Database] recoveryEmail migration note:", e?.message);
        }
      }
      // Auto-migrate: ensure googleMapsUrl columns exist (migrations 0021/0022 failed to add them)
      const googleMapsUrlFixes = [
        { table: 'properties', sql: "ALTER TABLE `properties` ADD COLUMN `googleMapsUrl` text DEFAULT NULL" },
        { table: 'property_submissions', sql: "ALTER TABLE `property_submissions` ADD COLUMN `googleMapsUrl` text DEFAULT NULL" },
      ];
      for (const fix of googleMapsUrlFixes) {
        try {
          await _pool.execute(fix.sql);
          console.log(`[Database] Added missing googleMapsUrl column to ${fix.table}`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] googleMapsUrl migration note (${fix.table}):`, e?.message);
          }
        }
      }
      // Auto-migrate: ensure bookings table has all required columns (migrations 0017/0020/0024)
      const bookingColumnFixes = [
        // From migration 0020 (property_publish_integrations)
        "ALTER TABLE `bookings` ADD COLUMN `fees` decimal(10,2) DEFAULT 0",
        "ALTER TABLE `bookings` ADD COLUMN `vatAmount` decimal(10,2) DEFAULT 0",
        // From migration 0017 (finance_registry)
        "ALTER TABLE `bookings` ADD COLUMN `beds24BookingId` varchar(100) DEFAULT NULL",
        "ALTER TABLE `bookings` ADD COLUMN `source` enum('BEDS24','LOCAL') DEFAULT 'LOCAL'",
        "ALTER TABLE `bookings` ADD COLUMN `renewalsUsed` int DEFAULT 0",
        "ALTER TABLE `bookings` ADD COLUMN `maxRenewals` int DEFAULT 1",
        "ALTER TABLE `bookings` ADD COLUMN `renewalWindowDays` int DEFAULT 14",
        "ALTER TABLE `bookings` ADD COLUMN `buildingId` int DEFAULT NULL",
        "ALTER TABLE `bookings` ADD COLUMN `unitId` int DEFAULT NULL",
        // From migration 0024 (booking_price_breakdown)
        "ALTER TABLE `bookings` ADD COLUMN `priceBreakdown` json DEFAULT NULL",
      ];
      for (const sql of bookingColumnFixes) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] Bookings migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] Bookings migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure finance tables exist (migration 0017)
      const financeTables = [
        `CREATE TABLE IF NOT EXISTS buildings (
          id int AUTO_INCREMENT PRIMARY KEY,
          name varchar(255) NOT NULL,
          nameAr varchar(255),
          address text,
          city varchar(100),
          totalUnits int DEFAULT 0,
          isArchived boolean NOT NULL DEFAULT false,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS units (
          id int AUTO_INCREMENT PRIMARY KEY,
          buildingId int NOT NULL,
          unitNumber varchar(50) NOT NULL,
          floor int,
          bedrooms int DEFAULT 1,
          bathrooms int DEFAULT 1,
          sizeSqm decimal(10,2),
          monthlyBaseRentSAR decimal(10,2),
          status enum('AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED') NOT NULL DEFAULT 'AVAILABLE',
          beds24PropertyId varchar(100),
          beds24RoomId varchar(100),
          propertyId int DEFAULT NULL,
          isArchived boolean NOT NULL DEFAULT false,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS payment_ledger (
          id int AUTO_INCREMENT PRIMARY KEY,
          invoiceNumber varchar(50) NOT NULL UNIQUE,
          bookingId int,
          beds24BookingId varchar(100),
          customerId int,
          guestName varchar(255),
          guestEmail varchar(320),
          guestPhone varchar(20),
          buildingId int,
          unitId int,
          unitNumber varchar(50),
          propertyDisplayName varchar(255),
          type enum('RENT','RENEWAL_RENT','PROTECTION_FEE','DEPOSIT','CLEANING','PENALTY','REFUND','ADJUSTMENT') NOT NULL,
          direction enum('IN','OUT') NOT NULL DEFAULT 'IN',
          amount decimal(10,2) NOT NULL,
          currency varchar(3) NOT NULL DEFAULT 'SAR',
          status enum('DUE','PENDING','PAID','FAILED','REFUNDED','VOID') NOT NULL DEFAULT 'DUE',
          paymentMethod enum('MADA_CARD','APPLE_PAY','GOOGLE_PAY','TABBY','TAMARA','BANK_TRANSFER','CASH'),
          provider enum('moyasar','tabby','tamara','manual'),
          providerRef varchar(255),
          dueAt timestamp NULL,
          paidAt timestamp NULL,
          createdBy int,
          parentLedgerId int,
          notes text,
          notesAr text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS payment_method_settings (
          id int AUTO_INCREMENT PRIMARY KEY,
          methodKey varchar(50) NOT NULL UNIQUE,
          displayName varchar(100) NOT NULL,
          displayNameAr varchar(100),
          provider varchar(50) NOT NULL,
          isEnabled boolean NOT NULL DEFAULT false,
          apiKeyConfigured boolean NOT NULL DEFAULT false,
          configJson json,
          sortOrder int DEFAULT 0,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
      ];
      for (const sql of financeTables) {
        try {
          await _pool.execute(sql);
        } catch (e: any) {
          // Table already exists or other non-critical error
          if (!e?.message?.includes('already exists')) {
            console.warn(`[Database] Finance table migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure audit_log table exists (migration 0018)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS audit_log (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int,
          userName varchar(255),
          action enum('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND') NOT NULL,
          entityType enum('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE') NOT NULL,
          entityId int NOT NULL,
          entityLabel varchar(255),
          changes json,
          metadata json,
          ipAddress varchar(45),
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_entityType_entityId (entityType, entityId),
          INDEX idx_audit_userId (userId),
          INDEX idx_audit_createdAt (createdAt)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] audit_log table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure property_submissions table exists (migration 0019)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS property_submissions (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          titleEn varchar(255),
          titleAr varchar(255),
          descriptionEn text,
          descriptionAr text,
          propertyType varchar(50) DEFAULT 'apartment',
          city varchar(100),
          cityAr varchar(100),
          district varchar(100),
          districtAr varchar(100),
          address text,
          addressAr text,
          googleMapsUrl text,
          latitude varchar(50),
          longitude varchar(50),
          bedrooms int DEFAULT 1,
          bathrooms int DEFAULT 1,
          sizeSqm decimal(10,2),
          monthlyRent decimal(10,2),
          amenities json,
          utilitiesIncluded json,
          status enum('PENDING','APPROVED','REJECTED','CONVERTED') NOT NULL DEFAULT 'PENDING',
          adminNotes text,
          convertedPropertyId int,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] property_submissions table note:`, e?.message?.substring(0, 120));
        }
      }
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS submission_photos (
          id int AUTO_INCREMENT PRIMARY KEY,
          submissionId int NOT NULL,
          url text NOT NULL,
          sortOrder int DEFAULT 0,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] submission_photos table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure properties table has all required columns (migration 0020)
      const propertiesColumnFixes = [
        "ALTER TABLE `properties` ADD COLUMN `pricingSource` ENUM('PROPERTY','UNIT') NOT NULL DEFAULT 'PROPERTY'",
        "ALTER TABLE `properties` ADD COLUMN `submissionId` int DEFAULT NULL",
      ];
      for (const sql of propertiesColumnFixes) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] Properties migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists, that's fine
          } else {
            console.warn(`[Database] Properties migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: ensure properties status enum includes all values
      try {
        await _pool.execute("ALTER TABLE `properties` MODIFY COLUMN `status` ENUM('draft','pending','active','inactive','rejected','published','archived') NOT NULL DEFAULT 'draft'");
      } catch (e: any) {
        // Ignore if already correct
      }
      // Auto-migrate: ensure availability_blocks table exists (for occupancy tracking)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS availability_blocks (
          id int AUTO_INCREMENT PRIMARY KEY,
          propertyId int NOT NULL,
          unitId int DEFAULT NULL,
          bookingId int DEFAULT NULL,
          blockType ENUM('BOOKING','MAINTENANCE','BEDS24_IMPORT','MANUAL_BLOCK') NOT NULL DEFAULT 'BOOKING',
          status ENUM('ACTIVE','CANCELLED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
          startDate date NOT NULL,
          endDate date NOT NULL,
          source ENUM('LOCAL','BEDS24','ICAL','ADMIN') NOT NULL DEFAULT 'LOCAL',
          sourceRef varchar(255) DEFAULT NULL,
          notes text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ab_propertyId (propertyId),
          INDEX idx_ab_bookingId (bookingId),
          INDEX idx_ab_dates (startDate, endDate),
          INDEX idx_ab_status (status),
          UNIQUE KEY uq_booking_block (bookingId, blockType)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] availability_blocks table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure unit_daily_status table exists (for occupancy snapshots)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS unit_daily_status (
          id int AUTO_INCREMENT PRIMARY KEY,
          date timestamp NOT NULL,
          buildingId int NOT NULL,
          unitId int NOT NULL,
          occupied boolean NOT NULL DEFAULT false,
          available boolean NOT NULL DEFAULT true,
          source ENUM('BEDS24','LOCAL','UNKNOWN') NOT NULL DEFAULT 'LOCAL',
          bookingRef varchar(100),
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_uds_date (date),
          INDEX idx_uds_unitId (unitId)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] unit_daily_status table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure beds24_map table exists (for Beds24 integration)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS beds24_map (
          id int AUTO_INCREMENT PRIMARY KEY,
          unitId int NOT NULL,
          beds24PropertyId varchar(100),
          beds24RoomId varchar(100),
          sourceOfTruth ENUM('BEDS24','LOCAL') NOT NULL DEFAULT 'LOCAL',
          connectionType ENUM('API','ICAL') DEFAULT NULL,
          icalImportUrl text,
          icalExportUrl text,
          beds24ApiKey varchar(255),
          lastSyncAt timestamp NULL,
          lastSyncStatus ENUM('SUCCESS','FAILED','PENDING') DEFAULT 'PENDING',
          lastSyncError text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_unitId (unitId)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] beds24_map table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: ensure integration_logs table exists (for Beds24 sync logging)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS integration_logs (
          id int AUTO_INCREMENT PRIMARY KEY,
          integrationKey varchar(50) NOT NULL DEFAULT 'beds24',
          direction ENUM('INBOUND','OUTBOUND','RECONCILE') NOT NULL,
          action varchar(100) NOT NULL,
          entityType varchar(50) DEFAULT NULL,
          entityId varchar(100) DEFAULT NULL,
          requestPayload JSON DEFAULT NULL,
          responsePayload JSON DEFAULT NULL,
          status ENUM('SUCCESS','FAILED','SKIPPED') NOT NULL DEFAULT 'SUCCESS',
          errorMessage text DEFAULT NULL,
          durationMs int DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_il_key (integrationKey),
          INDEX idx_il_direction (direction),
          INDEX idx_il_status (status),
          INDEX idx_il_created (createdAt)
        )`);
      } catch (e: any) {
        if (!e?.message?.includes('already exists')) {
          console.warn(`[Database] integration_logs table note:`, e?.message?.substring(0, 120));
        }
      }
      // Auto-migrate: add externalReservationId to bookings
      const beds24BookingMigrations = [
        "ALTER TABLE `bookings` ADD COLUMN `externalReservationId` varchar(255) DEFAULT NULL",
      ];
      for (const mig of beds24BookingMigrations) {
        try { await _pool.execute(mig); } catch (e: any) { /* column already exists */ }
      }
      // Auto-migrate: extend audit_log ENUMs for WhatsApp
      const auditMigrations = [
        `ALTER TABLE audit_log MODIFY COLUMN action ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND') NOT NULL`,
        `ALTER TABLE audit_log MODIFY COLUMN entityType ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE') NOT NULL`,
      ];
      for (const migSql of auditMigrations) {
        try {
          await _pool.execute(migSql);
        } catch (e: any) {
          // Ignore if already has the values
          if (!e?.message?.includes('Duplicate')) {
            console.warn("[Database] audit_log migration note:", e?.message?.substring(0, 100));
          }
        }
      }
       // Auto-migrate: ensure cms_content_versions table exists
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS cms_content_versions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          settingKey VARCHAR(100) NOT NULL,
          value TEXT,
          status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
          version INT NOT NULL DEFAULT 1,
          changedBy INT,
          changedByName VARCHAR(255),
          changeNote TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cms_key_status (settingKey, status),
          INDEX idx_cms_key_version (settingKey, version)
        )`);
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] cms_content_versions migration note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: ensure cms_media table exists
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS cms_media (
          id INT AUTO_INCREMENT PRIMARY KEY,
          url TEXT NOT NULL,
          filename VARCHAR(500) NOT NULL,
          contentType VARCHAR(100) NOT NULL,
          size INT,
          alt VARCHAR(500),
          altAr VARCHAR(500),
          uploadedBy INT,
          uploadedByName VARCHAR(255),
          folder VARCHAR(100) DEFAULT 'general',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_cms_media_folder (folder)
        )`);
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] cms_media migration note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: verification granular fields on users (migration 0025)
      const verificationColumns = [
        "ALTER TABLE `users` ADD COLUMN `emailVerified` boolean DEFAULT false",
        "ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean DEFAULT false",
        "ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `phoneVerifiedAt` timestamp NULL DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `kycStatus` ENUM('none','pending','submitted','verified','rejected','expired') DEFAULT 'none'",
        "ALTER TABLE `users` ADD COLUMN `kycVerifiedAt` timestamp NULL DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `kycLevel` varchar(20) DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `kycProvider` varchar(50) DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `kycProviderRef` varchar(255) DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `kycRejectionReason` varchar(100) DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `isBreakglassAdmin` boolean DEFAULT false",
        "ALTER TABLE `users` ADD COLUMN `isOwner` boolean DEFAULT false",
      ];
      for (const sql of verificationColumns) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] Verification migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) { /* already exists */ }
          else console.warn(`[Database] Verification migration note:`, e?.message?.substring(0, 120));
        }
      }
      // Backfill: existing isVerified=true users get both channels marked
      try {
        await _pool.execute(`UPDATE users SET emailVerified=true, phoneVerified=true, emailVerifiedAt=updatedAt, phoneVerifiedAt=updatedAt WHERE isVerified=true AND emailVerified=false`);
      } catch (e: any) {
        console.warn("[Database] Verification backfill note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: KYC tables (migration 0025)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS kyc_requests (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          status ENUM('pending','submitted','under_review','verified','rejected','expired') NOT NULL DEFAULT 'pending',
          level varchar(20) DEFAULT 'basic',
          provider varchar(50) DEFAULT 'manual',
          providerRef varchar(255) DEFAULT NULL,
          submittedAt timestamp NULL DEFAULT NULL,
          reviewedAt timestamp NULL DEFAULT NULL,
          reviewedBy int DEFAULT NULL,
          reviewerName varchar(255) DEFAULT NULL,
          rejectionReason text DEFAULT NULL,
          rejectionReasonCode varchar(50) DEFAULT NULL,
          notes text DEFAULT NULL,
          metadata json DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_kyc_userId (userId),
          INDEX idx_kyc_status (status)
        )`);
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] kyc_requests table note:", e?.message?.substring(0, 120));
      }
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS kyc_documents (
          id int AUTO_INCREMENT PRIMARY KEY,
          kycRequestId int NOT NULL,
          userId int NOT NULL,
          documentType ENUM('national_id','passport','driving_license','residence_permit','selfie','proof_of_address','other') NOT NULL,
          storageKey text NOT NULL,
          originalFilename varchar(500) DEFAULT NULL,
          mimeType varchar(100) DEFAULT NULL,
          fileSizeBytes int DEFAULT NULL,
          uploadedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          verifiedAt timestamp NULL DEFAULT NULL,
          expiresAt timestamp NULL DEFAULT NULL,
          metadata json DEFAULT NULL,
          INDEX idx_kycdoc_requestId (kycRequestId),
          INDEX idx_kycdoc_userId (userId)
        )`);
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] kyc_documents table note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: Integration credentials table (migration 0025)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS integration_credentials (
          id int AUTO_INCREMENT PRIMARY KEY,
          integrationKey varchar(50) NOT NULL UNIQUE,
          providerName varchar(100) NOT NULL,
          encryptedConfig text DEFAULT NULL,
          configHash varchar(64) DEFAULT NULL,
          isEnabled boolean NOT NULL DEFAULT false,
          lastTestedAt timestamp NULL DEFAULT NULL,
          lastTestResult varchar(50) DEFAULT NULL,
          updatedBy int DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] integration_credentials table note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: hidden_properties and property_enquiries tables
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS hidden_properties (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          propertyId int NOT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_hidden (userId, propertyId),
          INDEX idx_hidden_user (userId)
        )`);
        await _pool.execute(`CREATE TABLE IF NOT EXISTS property_enquiries (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          propertyId int NOT NULL,
          message text,
          status enum('sent','read','replied') NOT NULL DEFAULT 'sent',
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_enquiry_user (userId),
          INDEX idx_enquiry_property (propertyId)
        )`);
      } catch (e: any) {
        console.warn("[Database] collections tables note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: user profile type fields (userType, residentNo, passportNo)
      const userProfileTypeColumns = [
        "ALTER TABLE `users` ADD COLUMN `userType` enum('saudi','resident','visitor') DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `residentNo` varchar(20) DEFAULT NULL",
        "ALTER TABLE `users` ADD COLUMN `passportNo` varchar(50) DEFAULT NULL",
      ];
      for (const sql of userProfileTypeColumns) {
        try {
          await _pool.execute(sql);
          console.log(`[Database] User profile migration applied: ${sql.substring(0, 60)}...`);
        } catch (e: any) {
          if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) {
            // Column already exists
          } else {
            console.warn(`[Database] User profile migration note:`, e?.message?.substring(0, 120));
          }
        }
      }
      // Auto-migrate: property_managers editTokenExpiresAt (security fix)
      try {
        await _pool.execute("ALTER TABLE `propertyManagers` ADD COLUMN `editTokenExpiresAt` timestamp NULL DEFAULT NULL");
        console.log("[Database] Added editTokenExpiresAt to property_managers");
      } catch (e: any) {
        if (e?.code === 'ER_DUP_FIELDNAME' || e?.errno === 1060) { /* already exists */ }
        else console.warn("[Database] editTokenExpiresAt migration note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: extend audit_log enums (migration 0025)
      try {
        await _pool.execute(`ALTER TABLE audit_log MODIFY COLUMN action ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND','APPROVE','REJECT','REVIEW') NOT NULL`);
        await _pool.execute(`ALTER TABLE audit_log MODIFY COLUMN entityType ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE','KYC_REQUEST','INTEGRATION_CREDENTIAL','FEATURE_FLAG','USER_VERIFICATION','USER') NOT NULL`);
      } catch (e: any) {
        console.warn("[Database] audit_log enum extension note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: ensure platformSettings table exists (for feature flags)
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS platformSettings (
          id int AUTO_INCREMENT PRIMARY KEY,
          settingKey varchar(100) NOT NULL UNIQUE,
          settingValue text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
        console.log("[Database] platformSettings table ready");
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] platformSettings migration note:", e?.message?.substring(0, 120));
      }
      // Auto-migrate: WhatsApp inbound conversation routing tables
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS wa_conversations (
          id int AUTO_INCREMENT PRIMARY KEY,
          contactPhone varchar(20) NOT NULL,
          contactName varchar(255) DEFAULT NULL,
          userId int DEFAULT NULL,
          status enum('open','assigned','resolved','closed') NOT NULL DEFAULT 'open',
          assignedTo int DEFAULT NULL,
          assignedToName varchar(255) DEFAULT NULL,
          priority enum('normal','high','urgent') NOT NULL DEFAULT 'normal',
          subject varchar(255) DEFAULT NULL,
          tags json DEFAULT NULL,
          unreadCount int NOT NULL DEFAULT 0,
          messageCount int NOT NULL DEFAULT 0,
          lastMessageAt timestamp NULL DEFAULT NULL,
          lastInboundAt timestamp NULL DEFAULT NULL,
          closedAt timestamp NULL DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wa_conv_phone (contactPhone),
          INDEX idx_wa_conv_status (status),
          INDEX idx_wa_conv_last_msg (lastMessageAt)
        )`);
        console.log("[Database] wa_conversations table ready");
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] wa_conversations table note:", e?.message?.substring(0, 120));
      }
      try {
        await _pool.execute(`CREATE TABLE IF NOT EXISTS wa_messages (
          id int AUTO_INCREMENT PRIMARY KEY,
          conversationId int NOT NULL,
          direction enum('inbound','outbound') NOT NULL,
          senderPhone varchar(20) DEFAULT NULL,
          senderName varchar(255) DEFAULT NULL,
          content text DEFAULT NULL,
          messageType enum('text','image','audio','video','document','location','contact','sticker') NOT NULL DEFAULT 'text',
          mediaUrl text DEFAULT NULL,
          taqnyatMessageId varchar(255) DEFAULT NULL,
          status enum('received','sent','delivered','read','failed') NOT NULL DEFAULT 'received',
          sentById int DEFAULT NULL,
          sentByName varchar(255) DEFAULT NULL,
          metadata json DEFAULT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_wa_msg_conv (conversationId),
          INDEX idx_wa_msg_created (createdAt)
        )`);
        console.log("[Database] wa_messages table ready");
      } catch (e: any) {
        if (e?.errno !== 1050) console.warn("[Database] wa_messages table note:", e?.message?.substring(0, 120));
      }
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
