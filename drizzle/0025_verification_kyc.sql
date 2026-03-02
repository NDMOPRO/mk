-- Migration 0025: Verification granular fields, KYC readiness, integration credentials
-- All changes are ADDITIVE: new columns have defaults, new tables use CREATE IF NOT EXISTS.
-- Existing data is NOT modified except the backfill of emailVerified/phoneVerified for
-- users who already have isVerified=true.
-- Root admin records are explicitly protected: no ALTER on role, isVerified, or permissions.

-- ─── 1. Granular verification columns on users ─────────────────────
ALTER TABLE `users` ADD COLUMN `emailVerified` boolean DEFAULT false;
ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean DEFAULT false;
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` timestamp NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `phoneVerifiedAt` timestamp NULL DEFAULT NULL;

-- ─── 2. KYC columns on users ───────────────────────────────────────
ALTER TABLE `users` ADD COLUMN `kycStatus` ENUM('none','pending','submitted','verified','rejected','expired') DEFAULT 'none';
ALTER TABLE `users` ADD COLUMN `kycVerifiedAt` timestamp NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `kycLevel` varchar(20) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `kycProvider` varchar(50) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `kycProviderRef` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `kycRejectionReason` varchar(100) DEFAULT NULL;

-- ─── 3. Break-glass admin flag (cached from env for frontend) ──────
ALTER TABLE `users` ADD COLUMN `isBreakglassAdmin` boolean DEFAULT false;

-- ─── 4. Backfill: existing verified users get both channels marked ──
-- This is a pragmatic decision: users who were isVerified=true under the old
-- single-flag system are treated as having verified both channels.
UPDATE `users`
SET `emailVerified` = true,
    `phoneVerified` = true,
    `emailVerifiedAt` = `updatedAt`,
    `phoneVerifiedAt` = `updatedAt`
WHERE `isVerified` = true;

-- ─── 5. KYC Requests table ─────────────────────────────────────────
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

-- ─── 6. KYC Documents table ────────────────────────────────────────
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

-- ─── 7. Integration Credentials table (encrypted secrets) ──────────
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

-- ─── 8. Extend audit_log enums ─────────────────────────────────────
-- MySQL requires redefining the full ENUM to add values.
ALTER TABLE `audit_log` MODIFY COLUMN `action` ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','SEND','APPROVE','REJECT','REVIEW') NOT NULL;
ALTER TABLE `audit_log` MODIFY COLUMN `entityType` ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','WHATSAPP_MESSAGE','WHATSAPP_TEMPLATE','KYC_REQUEST','INTEGRATION_CREDENTIAL','FEATURE_FLAG','USER_VERIFICATION') NOT NULL;
