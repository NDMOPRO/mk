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
} from "./_shared";

// Domain: payment
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const paymentRouterDefs = {
  payment: router({
    create: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        type: z.enum(["rent", "deposit", "service_fee"]),
        amount: z.string(),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the tenant can create payments for this booking' });
        const id = await db.createPayment({
          bookingId: input.bookingId,
          tenantId: ctx.user.id,
          landlordId: booking.landlordId,
          type: input.type,
          amount: input.amount,
          status: "pending",
          description: input.description,
          descriptionAr: input.descriptionAr,
        });
        return { id };
      }),

    myPayments: protectedProcedure.query(async ({ ctx }) => {
      return db.getPaymentsByTenant(ctx.user.id);
    }),

    landlordPayments: protectedProcedure.query(async ({ ctx }) => {
      return db.getPaymentsByLandlord(ctx.user.id);
    }),

    byBooking: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input }) => {
        return db.getPaymentsByBooking(input.bookingId);
      }),
    // PayPal integration
    getPaymentSettings: publicProcedure.query(async () => {
      const settings = await getPayPalSettings();
      return {
        enabled: settings.enabled,
        cashEnabled: settings.cashEnabled,
        mode: settings.mode,
        currency: settings.currency,
        hasCredentials: !!(settings.clientId && settings.secret),
      };
    }),
    createPayPalOrder: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        amount: z.number().positive(),
        description: z.string(),
        origin: z.string(),
      }))
      .mutation(async ({ input }) => {
        const result = await createPayPalOrder({
          bookingId: input.bookingId,
          amount: input.amount,
          description: input.description,
          returnUrl: `${input.origin}/payment/success?bookingId=${input.bookingId}`,
          cancelUrl: `${input.origin}/payment/cancel?bookingId=${input.bookingId}`,
        });
        await db.updateBookingPayment(input.bookingId, {
          paypalOrderId: result.orderId,
          paymentStatus: "pending",
        });
        return result;
      }),
    capturePayPalOrder: protectedProcedure
      .input(z.object({
        orderId: z.string(),
        bookingId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const result = await capturePayPalOrder(input.orderId);
        if (result.status === "COMPLETED") {
          await db.updateBookingPayment(input.bookingId, {
            paypalOrderId: input.orderId,
            paypalCaptureId: result.captureId,
            paymentStatus: "paid",
            payerEmail: result.payerEmail,
            paidAmount: result.amount,
          });
        }
        return result;
      }),
  }),

};
