-- Migration 0027: schema that used to be created at runtime.
-- server/db/connection.ts and server/shomoos.ts created these tables and
-- columns on every startup; they now live here and the runtime DDL is gone.
-- Statements are taken verbatim from what the startup code executed, and
-- are idempotent (CREATE TABLE IF NOT EXISTS / guarded ADD COLUMN), so this
-- is a no-op on production, where all of them already exist.
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'externalReservationId') = 0, 'ALTER TABLE `bookings` ADD COLUMN `externalReservationId` varchar(255) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'isOwner') = 0, 'ALTER TABLE `users` ADD COLUMN `isOwner` boolean DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'userType') = 0, 'ALTER TABLE `users` ADD COLUMN `userType` enum(''saudi'',''resident'',''visitor'') DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'residentNo') = 0, 'ALTER TABLE `users` ADD COLUMN `residentNo` varchar(20) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'passportNo') = 0, 'ALTER TABLE `users` ADD COLUMN `passportNo` varchar(50) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'propertyManagers' AND column_name = 'editTokenExpiresAt') = 0, 'ALTER TABLE `propertyManagers` ADD COLUMN `editTokenExpiresAt` timestamp NULL DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS availability_blocks ( id int AUTO_INCREMENT PRIMARY KEY, propertyId int NOT NULL, unitId int DEFAULT NULL, bookingId int DEFAULT NULL, blockType ENUM('BOOKING','MAINTENANCE','BEDS24_IMPORT','MANUAL_BLOCK') NOT NULL DEFAULT 'BOOKING', status ENUM('ACTIVE','CANCELLED','EXPIRED') NOT NULL DEFAULT 'ACTIVE', startDate date NOT NULL, endDate date NOT NULL, source ENUM('LOCAL','BEDS24','ICAL','ADMIN') NOT NULL DEFAULT 'LOCAL', sourceRef varchar(255) DEFAULT NULL, notes text, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_ab_propertyId (propertyId), INDEX idx_ab_bookingId (bookingId), INDEX idx_ab_dates (startDate, endDate), INDEX idx_ab_status (status), UNIQUE KEY uq_booking_block (bookingId, blockType) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_content_versions ( id INT AUTO_INCREMENT PRIMARY KEY, settingKey VARCHAR(100) NOT NULL, value TEXT, status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft', version INT NOT NULL DEFAULT 1, changedBy INT, changedByName VARCHAR(255), changeNote TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_cms_key_status (settingKey, status), INDEX idx_cms_key_version (settingKey, version) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cms_media ( id INT AUTO_INCREMENT PRIMARY KEY, url TEXT NOT NULL, filename VARCHAR(500) NOT NULL, contentType VARCHAR(100) NOT NULL, size INT, alt VARCHAR(500), altAr VARCHAR(500), uploadedBy INT, uploadedByName VARCHAR(255), folder VARCHAR(100) DEFAULT 'general', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_cms_media_folder (folder) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS hidden_properties ( id int AUTO_INCREMENT PRIMARY KEY, userId int NOT NULL, propertyId int NOT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_hidden (userId, propertyId), INDEX idx_hidden_user (userId) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS integration_logs ( id int AUTO_INCREMENT PRIMARY KEY, integrationKey varchar(50) NOT NULL DEFAULT 'beds24', direction ENUM('INBOUND','OUTBOUND','RECONCILE') NOT NULL, action varchar(100) NOT NULL, entityType varchar(50) DEFAULT NULL, entityId varchar(100) DEFAULT NULL, requestPayload JSON DEFAULT NULL, responsePayload JSON DEFAULT NULL, status ENUM('SUCCESS','FAILED','SKIPPED') NOT NULL DEFAULT 'SUCCESS', errorMessage text DEFAULT NULL, durationMs int DEFAULT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_il_key (integrationKey), INDEX idx_il_direction (direction), INDEX idx_il_status (status), INDEX idx_il_created (createdAt) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS property_enquiries ( id int AUTO_INCREMENT PRIMARY KEY, userId int NOT NULL, propertyId int NOT NULL, message text, status enum('sent','read','replied') NOT NULL DEFAULT 'sent', createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_enquiry_user (userId), INDEX idx_enquiry_property (propertyId) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS wa_conversations ( id int AUTO_INCREMENT PRIMARY KEY, contactPhone varchar(20) NOT NULL, contactName varchar(255) DEFAULT NULL, userId int DEFAULT NULL, status enum('open','assigned','resolved','closed') NOT NULL DEFAULT 'open', assignedTo int DEFAULT NULL, assignedToName varchar(255) DEFAULT NULL, priority enum('normal','high','urgent') NOT NULL DEFAULT 'normal', subject varchar(255) DEFAULT NULL, tags json DEFAULT NULL, unreadCount int NOT NULL DEFAULT 0, messageCount int NOT NULL DEFAULT 0, lastMessageAt timestamp NULL DEFAULT NULL, lastInboundAt timestamp NULL DEFAULT NULL, closedAt timestamp NULL DEFAULT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_wa_conv_phone (contactPhone), INDEX idx_wa_conv_status (status), INDEX idx_wa_conv_last_msg (lastMessageAt) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS wa_messages ( id int AUTO_INCREMENT PRIMARY KEY, conversationId int NOT NULL, direction enum('inbound','outbound') NOT NULL, senderPhone varchar(20) DEFAULT NULL, senderName varchar(255) DEFAULT NULL, content text DEFAULT NULL, messageType enum('text','image','audio','video','document','location','contact','sticker') NOT NULL DEFAULT 'text', mediaUrl text DEFAULT NULL, taqnyatMessageId varchar(255) DEFAULT NULL, status enum('received','sent','delivered','read','failed') NOT NULL DEFAULT 'received', sentById int DEFAULT NULL, sentByName varchar(255) DEFAULT NULL, metadata json DEFAULT NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_wa_msg_conv (conversationId), INDEX idx_wa_msg_created (createdAt) );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS shomoos_submissions (id INT AUTO_INCREMENT PRIMARY KEY,
      bookingId INT NULL,
      tenantId INT NULL,
      propertyId INT NULL,
      submissionType ENUM('check_in','check_out','companion','update') NOT NULL DEFAULT 'check_in',
      status ENUM('pending','submitted','accepted','rejected','failed') NOT NULL DEFAULT 'pending',
      shomoosRefId VARCHAR(100) NULL,
      requestPayload JSON NOT NULL,
      responsePayload JSON NULL,
      errorMessage TEXT NULL,
      retryCount INT NOT NULL DEFAULT 0,
      submittedBy INT NULL COMMENT 'User ID who triggered submission',
      submittedByName VARCHAR(100) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_booking (bookingId),
      INDEX idx_tenant (tenantId),
      INDEX idx_property (propertyId),
      INDEX idx_status (status),
      INDEX idx_type_status (submissionType, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
