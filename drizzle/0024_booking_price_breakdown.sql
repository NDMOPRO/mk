-- Migration 0024: priceBreakdown JSON snapshot on bookings.
-- NULL priceBreakdown = legacy booking (base-rent-only total).
-- Idempotent: every ALTER is guarded by an information_schema check, so this
-- file is a no-op where the object already exists (production, where these
-- were added at runtime) and creates it where it does not (new databases).
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bookings' AND column_name = 'priceBreakdown') = 0, 'ALTER TABLE `bookings` ADD COLUMN `priceBreakdown` json DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
