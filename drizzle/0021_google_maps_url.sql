-- Add googleMapsUrl to properties and property_submissions (guarded: safe to re-run).
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'googleMapsUrl') = 0, 'ALTER TABLE `properties` ADD COLUMN `googleMapsUrl` text', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'property_submissions' AND column_name = 'googleMapsUrl') = 0, 'ALTER TABLE `property_submissions` ADD COLUMN `googleMapsUrl` text', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
