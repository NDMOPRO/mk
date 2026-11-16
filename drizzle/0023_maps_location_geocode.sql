-- Migration 0023: Maps location fields + geocode cache
-- Idempotent: every ALTER is guarded by an information_schema check, so this
-- file is a no-op where the object already exists (production, where these
-- were added at runtime) and creates it where it does not (new databases).
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'locationSource') = 0, 'ALTER TABLE `properties` ADD COLUMN `locationSource` ENUM(''MANUAL'',''GEOCODE'',''PIN'') DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'locationVisibility') = 0, 'ALTER TABLE `properties` ADD COLUMN `locationVisibility` ENUM(''EXACT'',''APPROXIMATE'',''HIDDEN'') NOT NULL DEFAULT ''APPROXIMATE''', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'placeId') = 0, 'ALTER TABLE `properties` ADD COLUMN `placeId` varchar(255) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'geocodeProvider') = 0, 'ALTER TABLE `properties` ADD COLUMN `geocodeProvider` varchar(20) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'properties' AND column_name = 'geocodeLastCheckedAt') = 0, 'ALTER TABLE `properties` ADD COLUMN `geocodeLastCheckedAt` timestamp DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `geocode_cache` (
  `id` int AUTO_INCREMENT NOT NULL,
  `addressHash` varchar(64) NOT NULL,
  `provider` varchar(20) NOT NULL DEFAULT 'google',
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `placeId` varchar(255) DEFAULT NULL,
  `formattedAddress` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  `hitCount` int NOT NULL DEFAULT 0,
  CONSTRAINT `geocode_cache_id` PRIMARY KEY(`id`),
  CONSTRAINT `geocode_cache_hash_provider` UNIQUE(`addressHash`, `provider`)
);
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'geocode_cache' AND index_name = 'idx_geocode_cache_hash') = 0, 'CREATE INDEX `idx_geocode_cache_hash` ON `geocode_cache` (`addressHash`)', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
