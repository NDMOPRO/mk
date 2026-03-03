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

// Domain: booking
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const bookingRouterDefs = {
  booking: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        moveInDate: z.string(),
        moveOutDate: z.string(),
        durationMonths: z.number(),
        tenantNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });

        // ─── Verification gate for Instant Book ───
        // When flag is ON and property has instantBook, user must be verified.
        // Break-glass admins and root admins bypass this gate.
        if (prop.instantBook) {
          const requireVerification = await isFlagOn("verification.requireForInstantBook");
          if (requireVerification) {
            const bgBypass = isBreakglassAdmin({ email: ctx.user.email, userId: ctx.user.userId });
            const isAdmin = ctx.user.role === "admin";
            if (!bgBypass && !isAdmin) {
              const fullUser = await db.getUserById(ctx.user.id);
              const isFullyVerified = fullUser?.emailVerified && fullUser?.phoneVerified;
              if (!isFullyVerified) {
                throw new TRPCError({
                  code: 'FORBIDDEN',
                  message: 'Instant Book requires email and phone verification. Please verify your account first. / الحجز الفوري يتطلب التحقق من البريد والهاتف. يرجى توثيق حسابك أولاً.',
                });
              }
            }
          }
        }

        // ─── Validation: duration from system settings ───
        const allSettings = await db.getAllSettings();
        const minMonths = parseInt(allSettings["rental.minMonths"] || "1");
        const maxMonths = parseInt(allSettings["rental.maxMonths"] || "2");
        if (input.durationMonths < minMonths || input.durationMonths > maxMonths) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Duration must be between ${minMonths} and ${maxMonths} months / المدة يجب أن تكون بين ${minMonths} و ${maxMonths} شهر` });
        }

        // ─── Resolve effective monthly rent ───
        let effectiveRent = prop.monthlyRent;
        if ((prop as any).pricingSource === 'UNIT') {
          try {
            const { getLinkedUnitByPropertyId } = await import('../finance-registry.js');
            const linkedUnit = await getLinkedUnitByPropertyId(input.propertyId);
            if (linkedUnit?.monthlyBaseRentSAR) {
              effectiveRent = String(linkedUnit.monthlyBaseRentSAR);
            }
          } catch (e) { /* fallback to property rent */ }
        }
        const monthlyRentNum = Number(effectiveRent);
        if (!monthlyRentNum || monthlyRentNum <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Property has no valid monthly rent / العقار ليس له إيجار شهري صالح' });
        }

        // ─── Calculate full breakdown using shared calculator (same as cost calculator) ───
        const calcSettings = parseCalcSettings(allSettings);
        const calc = calculateBookingTotal(
          { monthlyRent: monthlyRentNum, durationMonths: input.durationMonths },
          calcSettings
        );

        // ─── Create booking with full total (includes fees + VAT) ───
        const id = await db.createBooking({
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          landlordId: prop.landlordId,
          status: prop.instantBook ? "approved" : "pending",
          moveInDate: new Date(input.moveInDate),
          moveOutDate: new Date(input.moveOutDate),
          durationMonths: input.durationMonths,
          monthlyRent: effectiveRent,
          securityDeposit: String(calc.insuranceAmount),
          totalAmount: String(calc.grandTotal),
          fees: String(calc.serviceFeeAmount),
          vatAmount: String(calc.vatAmount),
          tenantNotes: input.tenantNotes,
          priceBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            serviceFeeAmount: calc.serviceFeeAmount,
            subtotal: calc.subtotal,
            vatAmount: calc.vatAmount,
            grandTotal: calc.grandTotal,
            amountHalalah: calc.amountHalalah,
            roundingRule: calc.roundingRule,
            appliedRates: calc.appliedRates,
            currency: calc.currency,
            snapshotVersion: 2,
          },
        });

        // ─── Auto-create payment_ledger entry for this booking ───
        try {
          const { createLedgerEntry, getLinkedUnitByPropertyId: getUnit } = await import('../finance-registry.js');
          let unitId: number | undefined;
          let unitNumber: string | undefined;
          let buildingId: number | undefined;
          try {
            const linkedUnit = await getUnit(input.propertyId);
            if (linkedUnit) {
              unitId = linkedUnit.id;
              unitNumber = linkedUnit.unitNumber;
              buildingId = linkedUnit.buildingId;
            }
          } catch { /* no linked unit */ }
          await createLedgerEntry({
            bookingId: id!,
            unitId,
            unitNumber,
            buildingId,
            propertyDisplayName: prop.titleAr || prop.titleEn || `Property #${prop.id}`,
            type: 'RENT',
            direction: 'IN',
            amount: String(calc.grandTotal),
            currency: calc.currency,
            status: 'DUE',
            dueAt: new Date(input.moveInDate),
            createdBy: ctx.user.id,
            guestName: ctx.user.displayName || ctx.user.name || undefined,
            guestEmail: ctx.user.email || undefined,
            notes: `Booking #${id}: Rent ${calc.baseRentTotal} + Insurance ${calc.insuranceAmount} + Service ${calc.serviceFeeAmount} + VAT ${calc.vatAmount} = Total ${calc.grandTotal} SAR`,
            notesAr: `حجز #${id}: إيجار ${calc.baseRentTotal} + تأمين ${calc.insuranceAmount} + رسوم خدمة ${calc.serviceFeeAmount} + ضريبة ${calc.vatAmount} = إجمالي ${calc.grandTotal} ر.س`,
          });
        } catch (e) {
          process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to auto-create ledger entry', bookingId: id, error: (e as Error).message }) + '\n');
        }

        // Create notification for landlord
        await db.createNotification({
          userId: prop.landlordId,
          type: "booking_request",
          titleEn: "New Booking Request",
          titleAr: "طلب حجز جديد",
          contentEn: `A new booking request for ${prop.titleEn}`,
          contentAr: `طلب حجز جديد لـ ${prop.titleAr}`,
          relatedId: id ?? undefined,
          relatedType: "booking",
        });
        // Email notification to admin/owner
        try {
          await notifyOwner({
            title: `طلب حجز جديد - New Booking Request #${id}`,
            content: `طلب حجز جديد للعقار: ${prop.titleAr || prop.titleEn}\nالمستأجر: ${ctx.user.displayName || ctx.user.name}\nالمدة: ${input.durationMonths} شهر\nالإجمالي: ${calc.grandTotal} ر.س (إيجار ${calc.baseRentTotal} + تأمين ${calc.insuranceAmount} + رسوم ${calc.serviceFeeAmount} + ضريبة ${calc.vatAmount})\n\nNew booking for: ${prop.titleEn}\nTenant: ${ctx.user.displayName || ctx.user.name}\nDuration: ${input.durationMonths} month(s)\nTotal: SAR ${calc.grandTotal} (Rent ${calc.baseRentTotal} + Insurance ${calc.insuranceAmount} + Fee ${calc.serviceFeeAmount} + VAT ${calc.vatAmount})`,
          });
        } catch { /* notification delivery is best-effort */ }
        // Send booking confirmation email if instant book
        if (prop.instantBook) {
          try {
            const user = ctx.user;
            if (user.email) {
              await sendBookingConfirmation({
                tenantEmail: user.email,
                tenantName: user.displayName || user.name || "",
                propertyTitle: prop.titleAr || prop.titleEn,
                checkIn: input.moveInDate,
                checkOut: input.moveOutDate,
                totalAmount: calc.grandTotal,
                bookingId: id!,
              });
            }
          } catch { /* email is best-effort */ }
        }
        // Structured log for booking creation (observability)
        const logEntry = {
          ts: new Date().toISOString(),
          level: 'info',
          component: 'booking',
          msg: 'Booking created',
          bookingId: id,
          propertyId: input.propertyId,
          tenantId: ctx.user.id,
          durationMonths: input.durationMonths,
          monthlyRent: monthlyRentNum,
          grandTotal: calc.grandTotal,
          status: prop.instantBook ? 'approved' : 'pending',
        };
        process.stdout.write(JSON.stringify(logEntry) + '\n');

        return {
          id,
          status: prop.instantBook ? "approved" : "pending",
          priceBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            serviceFeeAmount: calc.serviceFeeAmount,
            subtotal: calc.subtotal,
            vatAmount: calc.vatAmount,
            grandTotal: calc.grandTotal,
            amountHalalah: calc.amountHalalah,
            roundingRule: calc.roundingRule,
            appliedRates: calc.appliedRates,
            currency: calc.currency,
            snapshotVersion: 2,
          },
        };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected", "cancelled"]),
        rejectionReason: z.string().optional(),
        landlordNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (booking.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.updateBooking(input.id, {
          status: input.status,
          rejectionReason: input.rejectionReason,
          landlordNotes: input.landlordNotes,
        });
        const notifType = input.status === "approved" ? "booking_approved" : "booking_rejected";
        await db.createNotification({
          userId: booking.tenantId,
          type: notifType,
          titleEn: input.status === "approved" ? "Booking Approved" : "Booking Rejected",
          titleAr: input.status === "approved" ? "تم قبول الحجز" : "تم رفض الحجز",
          relatedId: input.id,
          relatedType: "booking",
        });
        // Email notification to owner about status change
        try {
          const statusAr = input.status === "approved" ? "تم قبول الحجز" : input.status === "rejected" ? "تم رفض الحجز" : "تم إلغاء الحجز";
          await notifyOwner({
            title: `تحديث حالة الحجز #${input.id} - Booking Status Update`,
            content: `${statusAr}\nرقم الحجز: ${input.id}\n${input.rejectionReason ? `سبب الرفض: ${input.rejectionReason}` : ""}\n\nBooking #${input.id} status changed to: ${input.status}${input.rejectionReason ? `\nReason: ${input.rejectionReason}` : ""}`,
          });
        } catch { /* best-effort */ }
        // Send email to tenant about booking status change
        if (input.status === "approved") {
          try {
            const tenant = await db.getUserById(booking.tenantId);
            const prop = await db.getPropertyById(booking.propertyId);
            if (tenant?.email && prop) {
              await sendBookingConfirmation({
                tenantEmail: tenant.email,
                tenantName: tenant.displayName || tenant.name || "",
                propertyTitle: prop.titleAr || prop.titleEn,
                checkIn: String(booking.moveInDate),
                checkOut: String(booking.moveOutDate),
                totalAmount: Number(booking.totalAmount),
                bookingId: input.id,
              });
            }
          } catch { /* email is best-effort */ }
        }
        // Cancel availability block if booking is cancelled or rejected
        if (input.status === 'cancelled' || input.status === 'rejected') {
          try {
            const { cancelBookingBlock } = await import('../availability-blocks.js');
            await cancelBookingBlock(input.id, `Status changed to ${input.status}`);
          } catch { /* block may not exist */ }
          // Outbound Beds24 sync: cancel in Beds24 if applicable
          try {
            const { cancelBookingInBeds24 } = await import('../beds24-sync.js');
            await cancelBookingInBeds24(input.id);
          } catch { /* best effort */ }
        }
        return { success: true };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const booking = await db.getBookingById(input.id);
        if (!booking) return null;
        if (!isBookingParticipant(ctx.user, booking)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        // Attach ledger entries for this booking
        let ledgerEntries: any[] = [];
        let paymentConfigured = false;
        try {
          const { getLedgerByBookingId, isPaymentConfigured } = await import('../finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(input.id);
          const payConfig = await isPaymentConfigured();
          paymentConfigured = payConfig.configured;
        } catch { /* no ledger data */ }
        return { ...booking, ledgerEntries, paymentConfigured };
      }),

    myBookings: protectedProcedure.query(async ({ ctx }) => {
      const myBookings = await db.getBookingsByTenant(ctx.user.id);
      // Enrich with ledger entries and payment config
      let paymentConfigured = false;
      try {
        const { isPaymentConfigured } = await import('../finance-registry.js');
        const pc = await isPaymentConfigured();
        paymentConfigured = pc.configured;
      } catch { /* ignore */ }
      const enriched = await Promise.all(myBookings.map(async (b: any) => {
        let ledgerEntries: any[] = [];
        try {
          const { getLedgerByBookingId } = await import('../finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(b.id);
        } catch { /* ignore */ }
        return { ...b, ledgerEntries, paymentConfigured };
      }));
      return enriched;
    }),

    landlordBookings: protectedProcedure.query(async ({ ctx }) => {
      return db.getBookingsByLandlord(ctx.user.id);
    }),
  }),

};
