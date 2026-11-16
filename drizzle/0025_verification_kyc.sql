-- Migration 0025: verification fields, KYC tables, integration credentials.
-- audit_log enum changes moved to 0026 (audit_log columns become VARCHAR).
-- Idempotent: every ALTER is guarded by an information_schema check, so this
-- file is a no-op where the object already exists (production, where these
-- were added at runtime) and creates it where it does not (new databases).
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'emailVerified') = 0, 'ALTER TABLE `users` ADD COLUMN `emailVerified` boolean DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'phoneVerified') = 0, 'ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'emailVerifiedAt') = 0, 'ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'phoneVerifiedAt') = 0, 'ALTER TABLE `users` ADD COLUMN `phoneVerifiedAt` timestamp NULL DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycStatus') = 0, 'ALTER TABLE `users` ADD COLUMN `kycStatus` ENUM(''none'',''pending'',''submitted'',''verified'',''rejected'',''expired'') DEFAULT ''none''', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycVerifiedAt') = 0, 'ALTER TABLE `users` ADD COLUMN `kycVerifiedAt` timestamp NULL DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycLevel') = 0, 'ALTER TABLE `users` ADD COLUMN `kycLevel` varchar(20) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycProvider') = 0, 'ALTER TABLE `users` ADD COLUMN `kycProvider` varchar(50) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycProviderRef') = 0, 'ALTER TABLE `users` ADD COLUMN `kycProviderRef` varchar(255) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'kycRejectionReason') = 0, 'ALTER TABLE `users` ADD COLUMN `kycRejectionReason` varchar(100) DEFAULT NULL', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
SET @mk_sql := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'isBreakglassAdmin') = 0, 'ALTER TABLE `users` ADD COLUMN `isBreakglassAdmin` boolean DEFAULT false', 'DO 0');
--> statement-breakpoint
PREPARE mk_stmt FROM @mk_sql;
--> statement-breakpoint
EXECUTE mk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE mk_stmt;
--> statement-breakpoint
UPDATE `users`
SET `emailVerified` = true, `phoneVerified` = true,
    `emailVerifiedAt` = `updatedAt`, `phoneVerifiedAt` = `updatedAt`
WHERE `isVerified` = true AND `emailVerified` = false
  AND `emailVerifiedAt` IS NULL AND `phoneVerifiedAt` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kyc_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `status` ENUM('pending','submitted','under_review','verified','rejected','expired') NOT NULL DEFAULT 'pending',
  `level` varchar(20) DEFAULT 'basic',
  `provider` varchar(50) DEFAULT 'manual',
  `providerRef` varchar(255) DEFAULT NULL,
  `submittedAt` timestamp NULL DEFAULT NULL,
  `reviewedAt` timestamp NULL DEFAULT NULL,
  `reviewedBy` int DEFAULT NULL,
  `reviewerName` varchar(255) DEFAULT NULL,
  `rejectionReason` text DEFAULT NULL,
  `rejectionReasonCode` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_kyc_userId` (`userId`),
  INDEX `idx_kyc_status` (`status`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kyc_documents` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `kycRequestId` int NOT NULL,
  `userId` int NOT NULL,
  `documentType` ENUM('national_id','passport','driving_license','residence_permit','selfie','proof_of_address','other') NOT NULL,
  `storageKey` text NOT NULL,
  `originalFilename` varchar(500) DEFAULT NULL,
  `mimeType` varchar(100) DEFAULT NULL,
  `fileSizeBytes` int DEFAULT NULL,
  `uploadedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verifiedAt` timestamp NULL DEFAULT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  INDEX `idx_kycdoc_requestId` (`kycRequestId`),
  INDEX `idx_kycdoc_userId` (`userId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `integration_credentials` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `integrationKey` varchar(50) NOT NULL UNIQUE,
  `providerName` varchar(100) NOT NULL,
  `encryptedConfig` text DEFAULT NULL,
  `configHash` varchar(64) DEFAULT NULL,
  `isEnabled` boolean NOT NULL DEFAULT false,
  `lastTestedAt` timestamp NULL DEFAULT NULL,
  `lastTestResult` varchar(50) DEFAULT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
