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

export const authRouterDefs = {
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        name: z.string().optional(),
        nameAr: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        nationalId: z.string().optional(),
        nationality: z.string().optional(),
        nationalityAr: z.string().optional(),
        dateOfBirth: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyContactName: z.string().optional(),
        idDocumentUrl: z.string().optional(),
        avatarUrl: z.string().optional(),
        bio: z.string().optional(),
        bioAr: z.string().optional(),
        recoveryEmail: z.string().email().optional(),
        preferredLang: z.enum(["ar", "en"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profileData: any = { ...input };
        if (input.dateOfBirth) profileData.dateOfBirth = new Date(input.dateOfBirth);
        // Calculate profile completion
        const fields = ['name','phone','whatsapp','nationalId','nationality','address','emergencyContact','avatarUrl'];
        const user = await db.getUserById(ctx.user.id);
        const merged = { ...user, ...profileData };
        const filled = fields.filter(f => !!(merged as any)[f]).length;
        profileData.profileCompletionPct = Math.round((filled / fields.length) * 100);
        await db.updateUserProfile(ctx.user.id, profileData);
        return { success: true };
      }),
    getFullProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserById(ctx.user.id);
    }),
    switchRole: protectedProcedure
      .input(z.object({ role: z.enum(["tenant", "landlord"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

};
