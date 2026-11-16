-- Migration 0018: Admin CRUD enhancements
-- Adds isArchived to buildings/units, audit_log table, unique(buildingId+unitNumber)
-- ADDITIVE ONLY — no destructive changes.

-- ─── Add isArchived to buildings ────────────────────────────────────
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'buildings' AND column_name = 'isArchived') = 0, 'ALTER TABLE `buildings` ADD COLUMN `isArchived` boolean NOT NULL DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint

-- ─── Add isArchived to units ────────────────────────────────────────
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'units' AND column_name = 'isArchived') = 0, 'ALTER TABLE `units` ADD COLUMN `isArchived` boolean NOT NULL DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint

-- ─── Unique constraint: one unit_number per building ────────────────
-- Prevents duplicate apartment numbers within the same building
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'units' AND index_name = 'uq_building_unitNumber') = 0, 'CREATE UNIQUE INDEX `uq_building_unitNumber` ON `units` (`buildingId`, `unitNumber`)', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint

-- ─── Audit Log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int,
  `userName` varchar(255),
  `action` enum('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24') NOT NULL,
  `entityType` enum('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD') NOT NULL,
  `entityId` int NOT NULL,
  `entityLabel` varchar(255),
  `changes` json,
  `metadata` json,
  `ipAddress` varchar(45),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_entityType_entityId` (`entityType`, `entityId`),
  INDEX `idx_audit_userId` (`userId`),
  INDEX `idx_audit_createdAt` (`createdAt`)
);
