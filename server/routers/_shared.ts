/**
 * Shared dependencies for all domain routers.
 * Every sub-router imports from this module instead of duplicating imports.
 */
export { COOKIE_NAME } from "@shared/const";
export { parse as parseCookieHeader } from "cookie";
export { TRPCError } from "@trpc/server";
export { ENV } from "../_core/env";
export { getSessionCookieOptions } from "../_core/cookies";
export { sdk } from "../_core/sdk";
export { publicProcedure, protectedProcedure, adminProcedure, adminWithPermission, router } from "../_core/trpc";
export { PERMISSIONS, PERMISSION_CATEGORIES, clearPermissionCache } from "../permissions";
export { z } from "zod";
export { storagePut } from "../storage";
export { nanoid } from "nanoid";
export * as db from "../db";
export { withTransaction } from "../db";
export { cache, cacheThrough, CACHE_TTL, CACHE_KEYS } from "../cache";
export { rateLimiter, RATE_LIMITS, getClientIP } from "../rate-limiter";
export { getAiResponse, seedDefaultKnowledgeBase } from "../ai-assistant";
export { getKBSections, getAdminKBForCopilot } from "../ai/adminKnowledge";
export { optimizeImage, optimizeAvatar } from "../image-optimizer";
export { generateLeaseContractHTML } from "../lease-contract";
export { createPayPalOrder, capturePayPalOrder, getPayPalSettings } from "../paypal";
export { notifyOwner } from "../_core/notification";
export { isBreakglassAdmin } from "../breakglass";
export { isFlagOn } from "../feature-flags";
export { calculateBookingTotal, parseCalcSettings } from "../booking-calculator";
export { sendBookingConfirmation, sendPaymentReceipt, sendMaintenanceUpdate, sendNewMaintenanceAlert, verifySmtpConnection, isSmtpConfigured } from "../email";
export { savePushSubscription, removePushSubscription, sendPushToUser, sendPushBroadcast, isPushConfigured, getUserSubscriptionCount } from "../push";
export { roles as rolesTable, aiMessages as aiMessagesTable, whatsappMessages, units, auditLog, integrationConfigs } from "../../drizzle/schema";
export { drizzle } from "drizzle-orm/mysql2";
export { default as mysql } from "mysql2/promise";
export { eq as eqDrizzle, and as andDrizzle, ne as neDrizzle } from "drizzle-orm";
export { sanitizeText, sanitizeObject, validateContentType, validateFileExtension, MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_UPLOAD_TYPES, capLimit, capOffset, isOwnerOrAdmin, isBookingParticipant } from "../security";
export { sendTemplateMessage, sendTextMessage, getWhatsAppConfig, formatPhoneForWhatsApp, maskPhone } from "../whatsapp-cloud";
export { logAudit } from "../audit-log";
export { dbIdentity } from "../_core/env";

// Shared drizzle instance (singleton — same as original routers.ts)
import mysql2 from "mysql2/promise";
import { drizzle as drizzleFn } from "drizzle-orm/mysql2";
import { ENV as _ENV } from "../_core/env";

const sharedPool = mysql2.createPool(_ENV.databaseUrl);
export const sharedDb = drizzleFn(sharedPool);
