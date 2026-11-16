import {
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  cache,
  sharedDb,
  units,
  auditLog,
  eqDrizzle,
} from "../_shared";

// admin.* procedures: Property review, publishing and editing.
export const adminPropertyProcedures = {

  properties: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional(), status: z.string().optional(), search: z.string().optional() }))
    .query(async ({ input }) => {
      const items = await db.getAllProperties(input.limit, input.offset, input.status, input.search);
      const total = await db.getPropertyCount(input.status);
      // Add server-computed coverImageUrl for reliable image display
      const s3Base = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
      const enriched = items.map((item: any) => {
        let coverImageUrl = "";
        const photos = item.photos;
        if (Array.isArray(photos) && photos.length > 0) {
          const first = typeof photos[0] === "string" ? photos[0] : (photos[0] as any)?.url || "";
          if (first) {
            coverImageUrl = first.startsWith("http") ? first
              : s3Base ? `${s3Base}/${first.replace(/^\/+/, "")}`
              : first;
          }
        }
        return { ...item, coverImageUrl };
      });
      return { items: enriched, total };
    }),

  approveProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number(), status: z.enum(["active", "rejected", "published", "draft", "archived"]), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Publish guard: if setting to 'published', enforce the same validation as publishProperty
      if (input.status === 'published') {
        const prop = await db.getPropertyById(input.id);
        if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
        const errors: string[] = [];
        if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
          if (!prop.monthlyRent || Number(prop.monthlyRent) <= 0) errors.push('monthlyRent must be > 0 / الإيجار الشهري يجب أن يكون أكبر من 0');
        } else if ((prop as any).pricingSource === 'UNIT') {
          const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
          const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
          if (validUnits.length !== 1) errors.push('UNIT pricing requires exactly one linked unit / تسعير الوحدة يتطلب وحدة واحدة مرتبطة');
          else if (!validUnits[0].monthlyBaseRentSAR || Number(validUnits[0].monthlyBaseRentSAR) <= 0) errors.push('Linked unit must have rent > 0 / الوحدة المرتبطة يجب أن يكون لها إيجار');
        }
        if (!prop.titleEn && !prop.titleAr) errors.push('Property must have at least one title / يجب أن يكون للعقار عنوان');
        const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
        if (!hasPhotos) errors.push('Property must have at least one photo / يجب أن يكون للعقار صورة واحدة على الأقل');
        if (errors.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `Publish guard failed: ${errors.join('; ')}` });
      }
      await db.updateProperty(input.id, { status: input.status });
      return { success: true };
    }),

  // Publish with guard validation
  publishProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const prop = await db.getPropertyById(input.id);
      if (!prop) throw new TRPCError({ code: 'NOT_FOUND', message: 'Property not found' });
      const errors: { en: string; ar: string }[] = [];
      // 1. Title check
      if (!prop.titleEn && !prop.titleAr) errors.push({ en: 'Property must have at least one title', ar: 'يجب أن يكون للعقار عنوان واحد على الأقل' });
      // 2. Pricing check
      if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
        if (!prop.monthlyRent || Number(prop.monthlyRent) <= 0) errors.push({ en: 'Monthly rent must be greater than 0', ar: 'الإيجار الشهري يجب أن يكون أكبر من 0' });
      } else if ((prop as any).pricingSource === 'UNIT') {
        const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
        const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
        if (validUnits.length !== 1) errors.push({ en: `UNIT pricing requires exactly one linked unit (found ${validUnits.length})`, ar: `تسعير الوحدة يتطلب وحدة واحدة مرتبطة (وجدت ${validUnits.length})` });
        else if (!validUnits[0].monthlyBaseRentSAR || Number(validUnits[0].monthlyBaseRentSAR) <= 0) errors.push({ en: 'Linked unit must have rent > 0', ar: 'الوحدة المرتبطة يجب أن يكون إيجارها أكبر من 0' });
      }
      // 3. Photos check
      const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
      if (!hasPhotos) errors.push({ en: 'Property must have at least one photo', ar: 'يجب أن يكون للعقار صورة واحدة على الأقل' });
      // 4. Cover photo check — first photo in the photos array is the cover by design
      // No separate coverPhoto column exists; the array order determines the cover.
      // 5. Location check
      if (!prop.city && !prop.cityAr) errors.push({ en: 'Property must have a city/location', ar: 'يجب تحديد مدينة/موقع العقار' });
      if (errors.length > 0) {
        const combined = errors.map(e => `${e.en} / ${e.ar}`).join('; ');
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Publish guard failed: ${combined}` });
      }
      await db.updateProperty(input.id, { status: 'published' });
      await sharedDb.insert(auditLog).values({
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.displayName ?? 'system',
        action: 'PUBLISH',
        entityType: 'PROPERTY',
        entityId: input.id,
        entityLabel: prop.titleEn || prop.titleAr,
      });
      cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
      // Structured log for property publish
      process.stdout.write(JSON.stringify({
        ts: new Date().toISOString(), level: 'info', component: 'publish',
        msg: 'Property published', propertyId: input.id, adminId: ctx.user?.id,
        title: prop.titleEn || prop.titleAr, pricingSource: (prop as any).pricingSource || 'PROPERTY',
      }) + '\n');
      return { success: true };
    }),

  unpublishProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateProperty(input.id, { status: 'draft' });
      const prop = await db.getPropertyById(input.id);
      await sharedDb.insert(auditLog).values({
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.displayName ?? 'system',
        action: 'UNPUBLISH',
        entityType: 'PROPERTY',
        entityId: input.id,
        entityLabel: prop?.titleEn || prop?.titleAr || `Property #${input.id}`,
      });
      cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
      return { success: true };
    }),

  archiveProperty: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateProperty(input.id, { status: 'archived' });
      await sharedDb.insert(auditLog).values({
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.displayName ?? 'system',
        action: 'ARCHIVE',
        entityType: 'PROPERTY',
        entityId: input.id,
        entityLabel: `Property #${input.id}`,
      });
      cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
      return { success: true };
    }),

  publishReadiness: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const prop = await db.getPropertyById(input.id);
      if (!prop) throw new TRPCError({ code: 'NOT_FOUND' });
      const checks: { label: string; labelAr: string; labelEn: string; passed: boolean; detail?: string; required?: boolean }[] = [];
      // Required checks (block publish)
      checks.push({ label: 'Has title', labelAr: 'يوجد عنوان', labelEn: 'Has title', passed: !!(prop.titleEn || prop.titleAr), required: true });
      if ((prop as any).pricingSource === 'PROPERTY' || !(prop as any).pricingSource) {
        checks.push({ label: 'Monthly rent > 0', labelAr: 'الإيجار الشهري > 0', labelEn: 'Monthly rent > 0', passed: Number(prop.monthlyRent) > 0, detail: `SAR ${prop.monthlyRent}`, required: true });
      } else {
        const linkedUnits = await sharedDb.select().from(units).where(eqDrizzle(units.propertyId, input.id));
        const validUnits = linkedUnits.filter(u => u.unitStatus !== 'BLOCKED' && u.unitStatus !== 'MAINTENANCE');
        let unitCheck = { passed: false, detail: 'No linked unit' };
        if (validUnits.length === 1 && Number(validUnits[0].monthlyBaseRentSAR) > 0) {
          unitCheck = { passed: true, detail: `Unit #${validUnits[0].unitNumber}: SAR ${validUnits[0].monthlyBaseRentSAR}` };
        } else if (validUnits.length !== 1) {
          unitCheck = { passed: false, detail: `Found ${validUnits.length} valid units (need exactly 1)` };
        } else {
          unitCheck = { passed: false, detail: 'Unit rent is 0 or null' };
        }
        checks.push({ label: 'Linked unit with valid rent', labelAr: 'وحدة مرتبطة بإيجار صالح', labelEn: 'Linked unit with valid rent', ...unitCheck, required: true });
      }
      const hasPhotos = prop.photos && (prop.photos as string[]).length > 0;
      checks.push({ label: 'Has photos', labelAr: 'يوجد صور', labelEn: 'Has photos', passed: !!hasPhotos, detail: hasPhotos ? `${(prop.photos as string[]).length} photos` : 'No photos', required: true });
      checks.push({ label: 'Has location', labelAr: 'يوجد موقع', labelEn: 'Has location', passed: !!(prop.city || prop.cityAr), required: true });
      // Warning checks (do NOT block publish)
      const hasCoords = !!(prop.latitude && prop.longitude && Number(prop.latitude) !== 0);
      checks.push({ label: 'Has coordinates', labelAr: 'يوجد إحداثيات', labelEn: 'Has coordinates', passed: hasCoords, detail: hasCoords ? `${prop.latitude}, ${prop.longitude}` : 'Recommended for map visibility', required: false });
      // ready = all REQUIRED checks pass (warnings don't block)
      const allRequiredPassed = checks.filter(c => c.required !== false).every(c => c.passed);
      return { ready: allRequiredPassed, checks, pricingSource: (prop as any).pricingSource || 'PROPERTY', status: prop.status };
    }),

  // Admin create property (creates as DRAFT)
  adminCreate: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
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
      googleMapsUrl: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]).optional(),
      locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
      placeId: z.string().optional(),
      geocodeProvider: z.string().optional(),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      sizeSqm: z.number().optional(),
      monthlyRent: z.string(),
      securityDeposit: z.string().optional(),
      pricingSource: z.enum(["PROPERTY", "UNIT"]).optional(),
      amenities: z.array(z.string()).optional(),
      utilitiesIncluded: z.array(z.string()).optional(),
      minStayMonths: z.number().optional(),
      maxStayMonths: z.number().optional(),
      photos: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createProperty({
        ...input,
        landlordId: ctx.user.id,
        status: 'draft',
        pricingSource: input.pricingSource || 'PROPERTY',
        locationSource: input.locationSource || 'MANUAL',
      } as any);
      if (id == null) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      await sharedDb.insert(auditLog).values({
        userId: ctx.user.id,
        userName: ctx.user.displayName ?? 'admin',
        action: 'CREATE',
        entityType: 'PROPERTY',
        entityId: id,
        entityLabel: input.titleEn || input.titleAr,
      });
      cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
      return { id };
    }),

  // Admin update property
  adminUpdate: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
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
      googleMapsUrl: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      locationSource: z.enum(["MANUAL", "GEOCODE", "PIN"]).optional(),
      locationVisibility: z.enum(["EXACT", "APPROXIMATE", "HIDDEN"]).optional(),
      placeId: z.string().optional(),
      geocodeProvider: z.string().optional(),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      sizeSqm: z.number().optional(),
      monthlyRent: z.string().optional(),
      securityDeposit: z.string().optional(),
      pricingSource: z.enum(["PROPERTY", "UNIT"]).optional(),
      amenities: z.array(z.string()).optional(),
      utilitiesIncluded: z.array(z.string()).optional(),
      minStayMonths: z.number().optional(),
      maxStayMonths: z.number().optional(),
      photos: z.array(z.string()).optional(),
      status: z.enum(["draft", "pending", "active", "inactive", "rejected", "published", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const prop = await db.getPropertyById(id);
      if (!prop) throw new TRPCError({ code: 'NOT_FOUND' });

      // Publish guard: block setting status to 'published' via adminUpdate
      // Must use publishProperty endpoint instead, which has full validation
      if (data.status === 'published' && prop.status !== 'published') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot publish via adminUpdate. Use publishProperty endpoint which validates readiness / لا يمكن النشر عبر التحديث. استخدم زر النشر الذي يتحقق من الجاهزية',
        });
      }

      // ── Location Contract: sanitize + validate ──
      const cleaned: any = { ...data };

      // 1. Clean empty strings → null for numeric/URL columns
      const nullableFields = ['monthlyRent', 'securityDeposit', 'latitude', 'longitude', 'sizeSqm', 'googleMapsUrl', 'placeId', 'geocodeProvider', 'address', 'addressAr'];
      for (const key of Object.keys(cleaned)) {
        if (cleaned[key] === '' && nullableFields.includes(key)) {
          cleaned[key] = null;
        }
      }

      // 2. Validate lat/lng are valid decimals when present
      if (cleaned.latitude != null) {
        const lat = parseFloat(String(cleaned.latitude));
        if (isNaN(lat) || lat < -90 || lat > 90) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid latitude (must be -90 to 90) / \u062e\u0637 \u0627\u0644\u0639\u0631\u0636 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
        }
      }
      if (cleaned.longitude != null) {
        const lng = parseFloat(String(cleaned.longitude));
        if (isNaN(lng) || lng < -180 || lng > 180) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid longitude (must be -180 to 180) / \u062e\u0637 \u0627\u0644\u0637\u0648\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
        }
      }

      // 3. Validate googleMapsUrl is a valid URL when present
      if (cleaned.googleMapsUrl && typeof cleaned.googleMapsUrl === 'string') {
        try {
          const url = new URL(cleaned.googleMapsUrl);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
        } catch {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Google Maps URL / \u0631\u0627\u0628\u0637 \u062e\u0631\u0627\u0626\u0637 \u062c\u0648\u062c\u0644 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d' });
        }
      }

      // 4. Log location changes for audit trail
      const locationChanged = ['latitude', 'longitude', 'googleMapsUrl', 'locationSource', 'locationVisibility'].some(
        k => cleaned[k] !== undefined
      );
      if (locationChanged) {
        console.log(`[Location] Property ${id} update: source=${cleaned.locationSource || 'unchanged'}, visibility=${cleaned.locationVisibility || 'unchanged'}, lat=${cleaned.latitude || 'unchanged'}, lng=${cleaned.longitude || 'unchanged'}`);
      }

      await db.updateProperty(id, cleaned as any);
      cache.invalidatePrefix('property:'); cache.invalidatePrefix('search:');
      return { success: true };
    }),
};
