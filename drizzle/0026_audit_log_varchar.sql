-- Migration 0026: audit_log.action / entityType ENUM -> VARCHAR(50).
-- The ENUM lists were redefined in four places with conflicting values and
-- rewritten on every startup; inserts with values outside the current list
-- (PAYMENT, BOOKING, SHOMOOS_SUBMISSION, WEBHOOK_EVENT, LINK, ...) were
-- silently rejected. Converting keeps every existing value. Safe to re-run.
ALTER TABLE `audit_log` MODIFY COLUMN `action` VARCHAR(50) NOT NULL;
--> statement-breakpoint
ALTER TABLE `audit_log` MODIFY COLUMN `entityType` VARCHAR(50) NOT NULL;
