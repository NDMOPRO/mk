import {
  TRPCError, z, router,
  publicProcedure, protectedProcedure, adminProcedure, adminWithPermission,
  PERMISSIONS, PERMISSION_CATEGORIES, clearPermissionCache,
  db, withTransaction, cache, cacheThrough, CACHE_TTL, CACHE_KEYS,
  rateLimiter, RATE_LIMITS, getClientIP,
  storagePut, nanoid,
  notifyOwner, logAudit,
  ENV, dbIdentity,
  sanitizeText, sanitizeObject, validateContentType, validateFileExtension,
  MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_UPLOAD_TYPES,
  capLimit, capOffset, isOwnerOrAdmin, isBookingParticipant,
  sharedDb,
  rolesTable, aiMessagesTable, whatsappMessages, units, auditLog, integrationConfigs,
  eqDrizzle, andDrizzle, neDrizzle,
  optimizeImage, optimizeAvatar,
  sendBookingConfirmation, sendPaymentReceipt, sendMaintenanceUpdate, sendNewMaintenanceAlert,
  verifySmtpConnection, isSmtpConfigured,
  savePushSubscription, removePushSubscription, sendPushToUser, sendPushBroadcast,
  isPushConfigured, getUserSubscriptionCount,
  sendTemplateMessage, sendTextMessage, getWhatsAppConfig, formatPhoneForWhatsApp, maskPhone,
  getAiResponse, seedDefaultKnowledgeBase,
  getKBSections, getAdminKBForCopilot,
  generateLeaseContractHTML,
  createPayPalOrder, capturePayPalOrder, getPayPalSettings,
  isBreakglassAdmin, isFlagOn,
  calculateBookingTotal, parseCalcSettings,
  getSessionCookieOptions, sdk,
  parseCookieHeader,
  COOKIE_NAME,
} from "./_shared";

// Domain: auth
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

/** Strip passwordHash (and any other sensitive fields) before returning user to client */
function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): Omit<T, 'passwordHash' | 'recoveryEmail'> | null {
  if (!user) return null;
  const { passwordHash, recoveryEmail, ...safe } = user;
  return safe as Omit<T, 'passwordHash' | 'recoveryEmail'>;
}

// Profile image/document links must be our own uploads or https URLs, never
// javascript:/data: links.
const safeUrl = z.string().max(1000).refine(
  (v) => v === "" || v.startsWith("/uploads/") || /^https:\/\//i.test(v),
  "Invalid URL",
);

export const authRouterDefs = {
  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Blacklist the current JWT so it cannot be reused after logout
      const cookies = ctx.req.headers.cookie;
      if (cookies) {
        const parsed = parseCookieHeader(cookies);
        const token = parsed[COOKIE_NAME];
        if (token) {
          await sdk.revokeToken(token);
        }
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().max(255).optional(),
        nameAr: z.string().max(255).optional(),
        phone: z.string().max(255).optional(),
        whatsapp: z.string().max(255).optional(),
        userType: z.enum(["saudi", "resident", "visitor"]).optional(),
        nationalId: z.string().max(255).optional(),
        residentNo: z.string().max(255).optional(),
        passportNo: z.string().max(255).optional(),
        nationality: z.string().max(255).optional(),
        nationalityAr: z.string().max(255).optional(),
        dateOfBirth: z.string().max(255).optional(),
        address: z.string().max(2000).optional(),
        addressAr: z.string().max(2000).optional(),
        emergencyContact: z.string().max(255).optional(),
        emergencyContactName: z.string().max(255).optional(),
        idDocumentUrl: safeUrl.optional(),
        avatarUrl: safeUrl.optional(),
        bio: z.string().max(2000).optional(),
        bioAr: z.string().max(2000).optional(),
        recoveryEmail: z.string().email().optional(),
        preferredLang: z.enum(["ar", "en"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profileData: any = sanitizeObject({ ...input });
        if (input.dateOfBirth) profileData.dateOfBirth = new Date(input.dateOfBirth);
        // Calculate profile completion
        const fields = ['name','phone','whatsapp','nationalId','nationality','address','emergencyContact','avatarUrl'];
        const user = await db.getUserById(ctx.user.id);
        // A new phone number has not been verified yet.
        if (input.phone !== undefined && user && input.phone !== user.phone) {
          profileData.phoneVerified = false;
          profileData.phoneVerifiedAt = null;
          profileData.isVerified = false;
        }
        const merged = { ...user, ...profileData };
        const filled = fields.filter(f => !!(merged as any)[f]).length;
        profileData.profileCompletionPct = Math.round((filled / fields.length) * 100);
        await db.updateUserProfile(ctx.user.id, profileData);
        return { success: true };
      }),
    getFullProfile: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return sanitizeUser(user);
    }),
    switchRole: protectedProcedure
      .input(z.object({ role: z.enum(["tenant", "landlord"]) }))
      .mutation(async ({ ctx, input }) => {
        // Prevent admin from downgrading themselves via self-service
        if (ctx.user.role === 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin users cannot switch roles via self-service. Use admin panel.' });
        }
        // Log role change for audit trail
        logAudit({
          userId: ctx.user.id,
          action: 'ROLE_SWITCH',
          entityType: 'USER',
          entityId: ctx.user.id,
          metadata: { from: ctx.user.role, to: input.role },
        });
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

};
