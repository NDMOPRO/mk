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

// Domain: geo
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const geoRouterDefs = {
  cities: router({
    all: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const activeOnly = input?.activeOnly ?? true;
        return cacheThrough(CACHE_KEYS.allCities(activeOnly), CACHE_TTL.CITY_LIST, () => db.getAllCities(activeOnly));
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCityById(input.id);
      }),

    count: publicProcedure.query(async () => {
      return { count: await db.getCityCount() };
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        nameEn: z.string(),
        nameAr: z.string(),
        region: z.string().optional(),
        regionAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCity(input as any);
        cache.invalidatePrefix('cities:');
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        region: z.string().optional(),
        regionAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        imageUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCity(id, data as any);
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    toggle: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isActive: z.boolean(), isFeatured: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await db.toggleCityActive(input.id, input.isActive);
        if (input.isFeatured !== undefined) {
          await db.updateCity(input.id, { isFeatured: input.isFeatured });
        }
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    toggleFeatured: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isFeatured: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.updateCity(input.id, { isFeatured: input.isFeatured });
        cache.invalidatePrefix('cities:');
        return { success: true };
      }),

    getFeatured: publicProcedure.query(async () => {
      return cacheThrough(CACHE_KEYS.featuredCities(), CACHE_TTL.CITY_LIST, () => db.getFeaturedCities());
    }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCity(input.id);
        cache.invalidatePrefix('cities:'); cache.invalidatePrefix('districts:');
        return { success: true };
      }),

    uploadPhoto: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `cities/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
  }),

  districts: router({
    all: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllDistricts(input?.activeOnly ?? true);
      }),

    byCity: publicProcedure
      .input(z.object({ city: z.string(), activeOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        return db.getDistrictsByCity(input.city, input.activeOnly ?? true);
      }),

    byCityId: publicProcedure
      .input(z.object({ cityId: z.number(), activeOnly: z.boolean().optional() }))
      .query(async ({ input }) => {
        return db.getDistrictsByCityId(input.cityId, input.activeOnly ?? true);
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getDistrictById(input.id);
      }),

    count: publicProcedure.query(async () => {
      return { count: await db.getDistrictCount() };
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        cityId: z.number().optional(),
        city: z.string(),
        cityAr: z.string(),
        nameEn: z.string(),
        nameAr: z.string(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createDistrict(input as any);
        cache.invalidatePrefix('districts:');
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        id: z.number(),
        cityId: z.number().optional(),
        city: z.string().optional(),
        cityAr: z.string().optional(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDistrict(id, data as any);
        return { success: true };
      }),

    toggle: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.toggleDistrictActive(input.id, input.isActive);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDistrict(input.id);
        cache.invalidatePrefix('districts:');
        return { success: true };
      }),

    bulkCreate: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({
        districts: z.array(z.object({
          cityId: z.number().optional(),
          city: z.string(),
          cityAr: z.string(),
          nameEn: z.string(),
          nameAr: z.string(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.bulkCreateDistricts(input.districts as any[]);
        cache.invalidatePrefix('districts:');
        return { success: true, count: input.districts.length };
      }),

    deleteByCity: adminWithPermission(PERMISSIONS.MANAGE_CITIES)
      .input(z.object({ city: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteDistrictsByCity(input.city);
        cache.invalidatePrefix('districts:');
        return { success: true };
      }),
  }),

  maps: router({
    // Public: get maps config (no secrets)
    getConfig: publicProcedure.query(async () => {
      const { getMapsConfigPublic } = await import("../maps-service");
      return getMapsConfigPublic();
    }),

    // Admin: geocode an address
    geocode: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        city: z.string().optional(),
        district: z.string().optional(),
        address: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { geocodeAddress } = await import("../maps-service");
        return geocodeAddress(input, ctx.user.id);
      }),

    // Admin: update property location (from geocode, pin, or manual)
    setPropertyLocation: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        propertyId: z.number(),
        latitude: z.string(),
        longitude: z.string(),
        locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]),
        locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
        placeId: z.string().optional(),
        geocodeProvider: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updatePropertyLocation } = await import("../maps-service");
        const result = await updatePropertyLocation(input.propertyId, input, ctx.user.id);
        cache.invalidatePrefix('property:');
        return result;
      }),

    // Admin: get geocode cache stats
    cacheStats: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .query(async () => {
        const { getGeocodeStats } = await import("../maps-service");
        return getGeocodeStats();
      }),

    // Public: get property location with privacy applied
    getPropertyLocation: publicProcedure
      .input(z.object({ propertyId: z.number() }))
      .query(async ({ input }) => {
        const { getMapsConfigPublic, approximateCoordinates } = await import("../maps-service");
        const config = await getMapsConfigPublic();
        if (!config.enabled || !config.showOnPropertyPage) {
          return { showMap: false, reason: "maps_disabled" as const };
        }
        const prop = await db.getPropertyById(input.propertyId);
        if (!prop || !prop.latitude || !prop.longitude) {
          return { showMap: false, reason: "no_coordinates" as const };
        }
        const visibility = (prop as any).locationVisibility || "APPROXIMATE";
        if (visibility === "HIDDEN") {
          return { showMap: false, reason: "hidden" as const, city: prop.city, district: prop.district };
        }
        const lat = parseFloat(String(prop.latitude));
        const lng = parseFloat(String(prop.longitude));
        if (visibility === "APPROXIMATE") {
          const approx = approximateCoordinates(lat, lng);
          return {
            showMap: true,
            lat: approx.lat,
            lng: approx.lng,
            visibility: "APPROXIMATE" as const,
            zoom: config.defaultZoom,
            provider: config.provider,
          };
        }
        // EXACT
        return {
          showMap: true,
          lat,
          lng,
          visibility: "EXACT" as const,
          zoom: config.defaultZoom + 2,
          provider: config.provider,
        };
      }),
  }),

};
