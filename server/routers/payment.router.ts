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

/** Amount the tenant owes for a booking: frozen grand total, else totalAmount. */
function bookingAmountDue(booking: { priceBreakdown?: unknown; totalAmount?: string | null }): number {
  const pb = booking.priceBreakdown as { grandTotal?: number } | null | undefined;
  if (pb && typeof pb.grandTotal === "number") return pb.grandTotal;
  return Number(booking.totalAmount ?? 0);
}


// Domain: payment
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const paymentRouterDefs = {
  payment: router({
    create: protectedProcedure
      .input(z.object({
        bookingId: z.number(),
        type: z.enum(["rent", "deposit", "service_fee"]),
        /** Ignored: the amount comes from the booking. Kept for API compatibility. */
        amount: z.string().optional(),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the tenant can create payments for this booking' });
        // The client used to choose the amount, and an admin confirming the
        // booking then marked that record completed as-is.
        let amount: number;
        if (input.type === "rent") amount = bookingAmountDue(booking);
        else if (input.type === "deposit") amount = Number(booking.securityDeposit ?? 0);
        else throw new TRPCError({ code: 'BAD_REQUEST', message: 'Service fees are included in the booking total' });
        if (!(amount > 0)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing is due for this booking' });
        const id = await db.createPayment({
          bookingId: input.bookingId,
          tenantId: ctx.user.id,
          landlordId: booking.landlordId,
          type: input.type,
          amount: amount.toFixed(2),
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
      .query(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (!isBookingParticipant(ctx.user, booking)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
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
      .mutation(async ({ ctx, input }) => {
        // Only the tenant pays, and the amount comes from the booking,
        // never from the client (input.amount is kept for API compatibility).
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.tenantId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the tenant can pay for this booking' });
        const amount = bookingAmountDue(booking);
        if (!(amount > 0)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Booking has no amount due' });
        // Return URLs use the configured site URL, not a client-supplied origin.
        const origin = (ENV.publicUrl || input.origin).replace(/\/+$/, "");
        const result = await createPayPalOrder({
          bookingId: input.bookingId,
          amount,
          description: input.description,
          returnUrl: `${origin}/payment/success?bookingId=${input.bookingId}`,
          cancelUrl: `${origin}/payment/cancel?bookingId=${input.bookingId}`,
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
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (!isBookingParticipant(ctx.user, booking)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        // The order must be the one created for this booking.
        const existing = await db.getPaymentsByBooking(input.bookingId);
        if (!existing.some(p => p.paypalOrderId === input.orderId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Order does not belong to this booking' });
        }
        const result = await capturePayPalOrder(input.orderId);
        // Never mark a booking paid for less than it owes (amounts are
        // comparable only when PayPal is configured in SAR).
        const { currency } = await getPayPalSettings();
        if (result.status === "COMPLETED" && currency === "SAR" && Number(result.amount) + 0.01 < bookingAmountDue(booking)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Captured amount is less than the amount due' });
        }
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
