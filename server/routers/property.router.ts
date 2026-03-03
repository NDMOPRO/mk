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

// Domain: property
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const propertyRouterDefs = {
  property: router({
    create: protectedProcedure
      .input(z.object({
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        floor: z.number().optional(),
        totalFloors: z.number().optional(),
        yearBuilt: z.number().optional(),
        furnishedLevel: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).optional(),
        monthlyRent: z.string(),
        securityDeposit: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        houseRules: z.string().optional(),
        houseRulesAr: z.string().optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        instantBook: z.boolean().optional(),
        photos: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createProperty({ ...input, landlordId: ctx.user.id, status: "pending" } as any);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        descriptionEn: z.string().optional(),
        descriptionAr: z.string().optional(),
        propertyType: z.enum(["apartment", "villa", "studio", "duplex", "furnished_room", "compound", "hotel_apartment"]).optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        district: z.string().optional(),
        districtAr: z.string().optional(),
        address: z.string().optional(),
        addressAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        sizeSqm: z.number().optional(),
        floor: z.number().optional(),
        totalFloors: z.number().optional(),
        yearBuilt: z.number().optional(),
        furnishedLevel: z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).optional(),
        monthlyRent: z.string().optional(),
        securityDeposit: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        utilitiesIncluded: z.array(z.string()).optional(),
        houseRules: z.string().optional(),
        houseRulesAr: z.string().optional(),
        minStayMonths: z.number().optional(),
        maxStayMonths: z.number().optional(),
        instantBook: z.boolean().optional(),
        photos: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const prop = await db.getPropertyById(id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.updateProperty(id, data as any);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (prop.landlordId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: 'FORBIDDEN', message: 'Unauthorized' });
        await db.deleteProperty(input.id);
        cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
        return { success: true };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prop = await db.getPropertyById(input.id);
        if (!prop) return null;
        await db.incrementPropertyViews(input.id);
        const manager = await db.getPropertyManagerByProperty(input.id);
        // When pricingSource=UNIT, override monthlyRent with the linked unit's rent
        let effectiveRent = prop.monthlyRent;
        if (prop.pricingSource === "UNIT") {
          try {
            const financeReg = await import("../finance-registry");
            const linkedUnit = await financeReg.getLinkedUnitByPropertyId(input.id);
            if (linkedUnit?.monthlyBaseRentSAR) {
              effectiveRent = linkedUnit.monthlyBaseRentSAR;
            }
          } catch (e) {
            console.error("[getById] Failed to get unit price:", e);
          }
        }
        return { ...prop, monthlyRent: effectiveRent, manager: manager ?? null };
      }),

    getByLandlord: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getPropertiesByLandlord(ctx.user.id);
      }),

    search: publicProcedure
      .input(z.object({
        query: z.string().max(200).optional(),
        city: z.string().optional(),
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        furnishedLevel: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // Rate limit public search
        const ip = getClientIP(ctx.req);
        const rl = await Promise.resolve(rateLimiter.check(`search:${ip}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs));
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' });
        // Cache search results by input hash
        const hash = JSON.stringify(input);
        return cacheThrough(CACHE_KEYS.searchResults(hash), CACHE_TTL.SEARCH_RESULTS, () => db.searchProperties(input));
      }),

    featured: publicProcedure
      .query(async () => {
        return cacheThrough('property:featured', CACHE_TTL.HOMEPAGE_DATA, async () => {
          const result = await db.searchProperties({ limit: 6 });
          return result.items;
        });
      }),

    mapData: publicProcedure
      .input(z.object({
        city: z.string().optional(),
        propertyType: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        furnishedLevel: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const ip = getClientIP(ctx.req);
        const rl = await Promise.resolve(rateLimiter.check(`map:${ip}`, RATE_LIMITS.PUBLIC_READ.maxRequests, RATE_LIMITS.PUBLIC_READ.windowMs));
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded.' });
        const hash = JSON.stringify(input || {});
        return cacheThrough(`map:data:${hash}`, CACHE_TTL.SEARCH_RESULTS, () => db.getMapProperties(input || undefined));
      }),

    uploadPhoto: protectedProcedure
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type. Only images allowed.' });
        const buffer = Buffer.from(input.base64, 'base64');
        const basePath = `properties/${ctx.user.id}`;
        try {
          const optimized = await optimizeImage(buffer, basePath, input.filename);
          return {
            url: optimized.original.url,
            thumbnail: optimized.thumbnail.url,
            medium: optimized.medium.url,
            variants: optimized,
          };
        } catch (err) {
          // Fallback to original upload if optimization fails
          console.error('[UploadPhoto] Optimization failed, uploading original:', err);
          const ext = input.filename.split('.').pop() || 'jpg';
          const key = `${basePath}/${nanoid()}.${ext}`;
          const { url } = await storagePut(key, buffer, input.contentType);
          return { url };
        }
      }),

    getAvailability: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        return db.getPropertyAvailability(input.propertyId);
      }),

    setAvailability: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        isBlocked: z.boolean().optional(),
        priceOverride: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        if (!isOwnerOrAdmin(ctx.user, prop.landlordId)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.setPropertyAvailability({
          ...input,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        });
        return { success: true };
      }),

    getReviews: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const reviews = await db.getReviewsByProperty(input.propertyId);
        const avgRating = await db.getAverageRating(input.propertyId);
        return { reviews, avgRating };
      }),
  }),

};
