import {
  TRPCError, z, router,
  publicProcedure, protectedProcedure, adminProcedure, adminWithPermission,
  PERMISSIONS,
  db, cache, cacheThrough, CACHE_TTL, CACHE_KEYS,
  generateLeaseContractHTML,
  calculateBookingTotal, parseCalcSettings,
  isBookingParticipant,
} from "./_shared";

// Domain: lease
// Extracted from server/routers/misc.router.ts — DO NOT modify procedure names/shapes

export const leaseRouterDefs = {
  lease: router({
    generate: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // The contract contains both parties' names, phones and emails.
        const booking = await db.getBookingById(input.bookingId);
        if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
        if (!isBookingParticipant(ctx.user, booking)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        const { html, data } = await generateLeaseContractHTML(input.bookingId);
        return { html, contractNumber: data.contractNumber };
      }),
  }),

  calculator: router({
    /** GET config: returns all calculator parameters for frontend/mobile */
    getConfig: publicProcedure.query(async () => {
      const settings = await cacheThrough(
        CACHE_KEYS.settings(),
        CACHE_TTL.SETTINGS,
        () => db.getAllSettings()
      );
      const allowedMonthsRaw = settings["calculator.allowedMonths"] || settings["rental.allowedMonths"] || "[1,2]";
      let allowedMonths: number[];
      try {
        allowedMonths = JSON.parse(allowedMonthsRaw);
        if (!Array.isArray(allowedMonths) || allowedMonths.length === 0) allowedMonths = [1, 2];
      } catch {
        allowedMonths = [1, 2];
      }
      // Insurance mode: "percentage" or "fixed"
      const insuranceMode = settings["calculator.insuranceMode"] || "percentage";
      const hideInsurance = settings["calculator.hideInsuranceFromTenant"] === "true";

      return {
        allowedMonths: allowedMonths.sort((a, b) => a - b),
        insuranceRate: parseFloat(settings["fees.depositPercent"] || "10"),
        insuranceFixedAmount: parseFloat(settings["calculator.insuranceFixedAmount"] || "0"),
        insuranceMode,
        hideInsuranceFromTenant: hideInsurance,
        serviceFeeRate: parseFloat(settings["fees.serviceFeePercent"] || "5"),
        vatRate: parseFloat(settings["fees.vatPercent"] || "15"),
        currency: settings["payment.currency"] || "SAR",
        currencySymbolAr: "ر.س",
        currencySymbolEn: "SAR",
        version: settings["calculator.version"] || "1",
        labels: {
          insuranceAr: settings["calculator.insuranceLabelAr"] || "التأمين",
          insuranceEn: settings["calculator.insuranceLabelEn"] || "Insurance/Deposit",
          serviceFeeAr: settings["calculator.serviceFeeLabelAr"] || "رسوم الخدمة",
          serviceFeeEn: settings["calculator.serviceFeeLabelEn"] || "Service Fee",
          vatAr: settings["calculator.vatLabelAr"] || "ضريبة القيمة المضافة",
          vatEn: settings["calculator.vatLabelEn"] || "VAT",
          insuranceTooltipAr: settings["calculator.insuranceTooltipAr"] || "مبلغ تأمين قابل للاسترداد عند انتهاء العقد",
          insuranceTooltipEn: settings["calculator.insuranceTooltipEn"] || "Refundable deposit returned at end of contract",
          serviceFeeTooltipAr: settings["calculator.serviceFeeTooltipAr"] || "رسوم إدارة المنصة لتسهيل عملية التأجير",
          serviceFeeTooltipEn: settings["calculator.serviceFeeTooltipEn"] || "Platform management fee for facilitating the rental",
          vatTooltipAr: settings["calculator.vatTooltipAr"] || "ضريبة القيمة المضافة وفقاً لنظام هيئة الزكاة والضريبة والجمارك",
          vatTooltipEn: settings["calculator.vatTooltipEn"] || "Value Added Tax as per ZATCA regulations",
        },
      };
    }),

    /** POST calculate: server-side calculation with full validation
     *  Uses the SAME shared calculateBookingTotal function as booking.create
     *  to guarantee calculator preview matches actual charge. */
    calculate: publicProcedure
      .input(z.object({
        monthlyRent: z.number().positive("Monthly rent must be positive"),
        selectedMonths: z.number().int().positive("Duration must be a positive integer"),
      }))
      .mutation(async ({ input }) => {
        const settings = await cacheThrough(
          CACHE_KEYS.settings(),
          CACHE_TTL.SETTINGS,
          () => db.getAllSettings()
        );

        // Parse allowed months
        const allowedMonthsRaw = settings["calculator.allowedMonths"] || settings["rental.allowedMonths"] || "[1,2]";
        let allowedMonths: number[];
        try {
          allowedMonths = JSON.parse(allowedMonthsRaw);
          if (!Array.isArray(allowedMonths) || allowedMonths.length === 0) allowedMonths = [1, 2];
        } catch {
          allowedMonths = [1, 2];
        }

        // Validate duration
        if (!allowedMonths.includes(input.selectedMonths)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Duration ${input.selectedMonths} months is not allowed. Allowed: ${allowedMonths.join(", ")} months`,
          });
        }

        // Validate rent range
        const minRent = parseFloat(settings["fees.minRent"] || "500");
        const maxRent = parseFloat(settings["fees.maxRent"] || "100000");
        if (input.monthlyRent < minRent || input.monthlyRent > maxRent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Monthly rent must be between ${minRent} and ${maxRent}`,
          });
        }

        // Use the SHARED calculator (same as booking.create)
        const { calculateBookingTotal, parseCalcSettings } = await import("../booking-calculator");
        const calcSettings = parseCalcSettings(settings);
        const calc = calculateBookingTotal(
          { monthlyRent: input.monthlyRent, durationMonths: input.selectedMonths },
          calcSettings
        );

        return {
          // Input echo
          monthlyRent: input.monthlyRent,
          selectedMonths: input.selectedMonths,
          // Breakdown for tenant (insurance may be hidden)
          rentTotal: calc.displayRentTotal,
          insuranceAmount: calc.displayInsurance,
          serviceFeeAmount: calc.serviceFeeAmount,
          subtotal: calc.hideInsuranceFromTenant
            ? (calc.displayRentTotal + calc.serviceFeeAmount)
            : calc.subtotal,
          vatAmount: calc.vatAmount,
          grandTotal: calc.grandTotal,
          // Flag so frontend knows whether to show insurance line
          insuranceHidden: calc.hideInsuranceFromTenant,
          // Applied rates (for transparency)
          appliedRates: calc.appliedRates,
          currency: calc.currency,
          // Admin-only breakdown (full details for backend/admin use)
          _adminBreakdown: {
            baseRentTotal: calc.baseRentTotal,
            insuranceAmount: calc.insuranceAmount,
            insuranceMode: calc.appliedRates.insuranceMode,
            insuranceHidden: calc.hideInsuranceFromTenant,
          },
        };
      }),
  }),

  maintenance: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        bookingId: z.number().optional(),
        title: z.string().min(1),
        titleAr: z.string().optional(),
        description: z.string().min(1),
        descriptionAr: z.string().optional(),
        category: z.enum(["plumbing", "electrical", "hvac", "appliance", "structural", "pest_control", "cleaning", "other"]).optional(),
        priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        const id = await db.createMaintenanceRequest({
          ...input,
          tenantId: ctx.user.id,
          landlordId: prop.landlordId,
          status: "submitted",
        });
        await db.createNotification({
          userId: prop.landlordId,
          type: "maintenance_update",
          titleEn: "New Maintenance Request",
          titleAr: "طلب صيانة جديد",
          contentEn: input.title,
          contentAr: input.titleAr,
          relatedId: id ?? undefined,
          relatedType: "maintenance",
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["acknowledged", "in_progress", "completed", "cancelled"]).optional(),
        landlordResponse: z.string().optional(),
        landlordResponseAr: z.string().optional(),
        estimatedCost: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const req = await db.getMaintenanceById(id);
        if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        if (req.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        const updateData: any = { ...data };
        if (input.status === "completed") updateData.resolvedAt = new Date();
        await db.updateMaintenanceRequest(id, updateData);
        await db.createNotification({
          userId: req.tenantId,
          type: "maintenance_update",
          titleEn: `Maintenance Request Updated: ${input.status ?? "updated"}`,
          titleAr: `تحديث طلب الصيانة`,
          relatedId: id,
          relatedType: "maintenance",
        });
        return { success: true };
      }),

    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getMaintenanceByTenant(ctx.user.id);
    }),

    landlordRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getMaintenanceByLandlord(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const req = await db.getMaintenanceById(input.id);
        if (!req) return null;
        if (req.tenantId !== ctx.user.id && req.landlordId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        return req;
      }),
  }),

};
