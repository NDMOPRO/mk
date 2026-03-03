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

// Domain: cms
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const cmsRouterDefs = {
  siteSettings: router({
    getAll: publicProcedure.query(async () => {
      return cacheThrough(CACHE_KEYS.settings(), CACHE_TTL.SETTINGS, () => db.getAllSettings());
    }),
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return { value: await cacheThrough(CACHE_KEYS.settingsSingle(input.key), CACHE_TTL.SETTINGS, () => db.getSetting(input.key)) };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ settings: z.record(z.string(), z.string()) }))
      .mutation(async ({ input }) => {
        await db.bulkSetSettings(input.settings);
        cache.invalidatePrefix('settings:');
        return { success: true };
      }),
    uploadAsset: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string(), purpose: z.string() }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'png';
        const key = `site-assets/${input.purpose}-${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        await db.setSetting(input.purpose, url);
        return { url };
      }),
    seed: adminProcedure.mutation(async () => {
      const defaults: Record<string, string> = {
        "site.nameAr": "Monthly Key",
        "site.nameEn": "Monthly Key",
        "site.descriptionAr": "Monthly Key تربط المستأجرين بأفضل العقارات للإيجار الشهري في المملكة العربية السعودية",
        "site.descriptionEn": "Monthly Key connects tenants with the best monthly rental properties across Saudi Arabia",
        "site.logoUrl": "",
        "site.faviconUrl": "",
        "site.primaryColor": "#3ECFC0",
        "site.accentColor": "#C9A96E",
        "hero.titleAr": "خبير الإيجار الشهري — الآن في السعودية",
        "hero.titleEn": "Monthly Rental Expert — Now in Saudi Arabia",
        "hero.subtitleAr": "إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة",
        "hero.subtitleEn": "Premium monthly rental management | Riyadh • Jeddah • Madinah",
        "hero.bgImage": "",
        "stats.properties": "500+",
        "stats.propertiesLabelAr": "عقار متاح",
        "stats.propertiesLabelEn": "Available Properties",
        "stats.tenants": "1000+",
        "stats.tenantsLabelAr": "مستأجر سعيد",
        "stats.tenantsLabelEn": "Happy Tenants",
        "stats.cities": "50+",
        "stats.citiesLabelAr": "مدينة",
        "stats.citiesLabelEn": "Cities",
        "stats.satisfaction": "98%",
        "stats.satisfactionLabelAr": "رضا العملاء",
        "stats.satisfactionLabelEn": "Customer Satisfaction",
        "fees.serviceFeePercent": "5",
        "fees.minRent": "500",
        "fees.maxRent": "100000",
        "fees.depositPercent": "10",
        "fees.vatPercent": "15",
        "rental.minMonths": "1",
        "rental.maxMonths": "2",
        "rental.minMonthsLabelAr": "الحد الأدنى لمدة الإيجار (بالأشهر)",
        "rental.minMonthsLabelEn": "Minimum Rental Duration (months)",
        "rental.maxMonthsLabelAr": "الحد الأقصى لمدة الإيجار (بالأشهر)",
        "rental.maxMonthsLabelEn": "Maximum Rental Duration (months)",
        "footer.aboutAr": "Monthly Key هي المنصة الرائدة للإيجار الشهري في المملكة العربية السعودية. نقدم حلول إيجار مرنة لتسهيل تجربة السكن الشهري.",
        "footer.aboutEn": "Monthly Key is Saudi Arabia's leading monthly rental platform. We offer flexible rental solutions for a seamless monthly living experience.",
        "footer.email": "",
        "footer.phone": "",
        "footer.addressAr": "الرياض، المملكة العربية السعودية",
        "footer.addressEn": "Riyadh, Saudi Arabia",
        "footer.twitter": "",
        "footer.instagram": "",
        "footer.linkedin": "",
        "whatsapp.number": "966504466528",
        "whatsapp.message": "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري",
        "whatsapp.textAr": "تواصل معنا",
        "whatsapp.textEn": "Chat with us",
        "legal.tourismLicence": "٢٣٤٥٦٧٨٩٠١",
        "legal.crNumber": "",
        "legal.vatNumber": "",
        "legal.ejarLicence": "",
        "terms.contentAr": "",
        "terms.contentEn": "",
        "privacy.contentAr": "",
        "privacy.contentEn": "",
        "faq.items": "[]",
        "maintenance.enabled": "true",
        "maintenance.titleAr": "قريباً... الانطلاق",
        "maintenance.titleEn": "Coming Soon",
        "maintenance.subtitleAr": "نعمل على تجهيز تجربة مميزة لكم",
        "maintenance.subtitleEn": "We're preparing an exceptional experience for you",
        "maintenance.messageAr": "ستكون رحلة مميزة معنا في عالم الإيجارات الشهرية. ترقبونا!",
        "maintenance.messageEn": "An exceptional journey awaits you in the world of monthly rentals. Stay tuned!",
        "maintenance.imageUrl": "",
        "maintenance.countdownDate": "",
        "maintenance.showCountdown": "false",
        "social.twitter": "",
        "social.instagram": "",
        "social.snapchat": "",
        "social.tiktok": "",
        "social.linkedin": "",
        "social.youtube": "",
        "ai.enabled": "true",
        "ai.name": "المفتاح الشهري الذكي",
        "ai.nameEn": "Monthly Key AI",
        "ai.personality": "professional_friendly",
        "ai.welcomeMessage": "مرحباً! أنا المفتاح الشهري الذكي، كيف أقدر أساعدك؟",
        "ai.welcomeMessageEn": "Hello! I'm Monthly Key AI, how can I help you?",
        "ai.customInstructions": "",
        "ai.maxResponseLength": "800",
        // Homepage services (JSON array)
        "homepage.services": JSON.stringify([
          { iconName: "Building2", titleAr: "إدارة العقارات", titleEn: "Property Management", descAr: "إدارة شاملة لعقارك الشهري مع تقارير دورية", descEn: "Complete monthly property management with periodic reports" },
          { iconName: "Key", titleAr: "الإيجار الشهري", titleEn: "Monthly Rentals", descAr: "تأجير مرن بعقود رقمية متوافقة", descEn: "Flexible rentals with Ejar-compliant digital contracts" },
          { iconName: "TrendingUp", titleAr: "إدارة الإيرادات", titleEn: "Revenue Management", descAr: "تسعير ذكي وتحسين العوائد بناءً على السوق", descEn: "Smart pricing and yield optimization based on market data" },
          { iconName: "Paintbrush", titleAr: "العناية بالعقار", titleEn: "Property Care", descAr: "صيانة وتجديد وتصميم داخلي احترافي", descEn: "Professional maintenance, renovation & interior design" },
          { iconName: "Headphones", titleAr: "تجربة المستأجر", titleEn: "Tenant Experience", descAr: "دعم المستأجرين على مدار الساعة بالعربية", descEn: "24/7 Arabic tenant support" },
          { iconName: "UserCheck", titleAr: "التحقق والأمان", titleEn: "Verification & Security", descAr: "تحقق من الهوية الوطنية وعقود رقمية آمنة", descEn: "National ID verification & secure digital contracts" },
        ]),
        // Homepage steps (JSON array)
        "homepage.steps": JSON.stringify([
          { num: "01", titleAr: "ابحث عن عقارك", titleEn: "Search Properties", descAr: "تصفح مئات العقارات المتاحة للتأجير الشهري في مدينتك", descEn: "Browse hundreds of monthly rental properties in your city" },
          { num: "02", titleAr: "احجز إقامتك", titleEn: "Book Your Stay", descAr: "اختر المدة المناسبة واحجز بسهولة مع عقد رقمي", descEn: "Choose your duration and book easily with a digital contract" },
          { num: "03", titleAr: "استمتع بسكنك", titleEn: "Enjoy Your Home", descAr: "انتقل واستمتع بإقامة مريحة مع دعم متواصل", descEn: "Move in and enjoy a comfortable stay with ongoing support" },
        ]),
        // Homepage testimonials (JSON array)
        "homepage.testimonials": JSON.stringify([
          { textAr: "منصة المفتاح الشهري سهّلت علي البحث عن شقة شهرية في الرياض. الخدمة ممتازة والعقود واضحة.", textEn: "المفتاح الشهري made it easy to find a monthly apartment in Riyadh. Excellent service and clear contracts.", nameAr: "أحمد المطيري", nameEn: "Ahmed Al-Mutairi", roleAr: "مستأجر - الرياض", roleEn: "Tenant - Riyadh", rating: 5 },
          { textAr: "سعيدة جداً باختياري لمنصة المفتاح الشهري. من البحث وحتى التوقيع، كل شيء كان سلس واحترافي.", textEn: "Very happy with المفتاح الشهري. From search to signing, everything was smooth and professional.", nameAr: "سارة الحربي", nameEn: "Sara Al-Harbi", roleAr: "مستأجرة - جدة", roleEn: "Tenant - Jeddah", rating: 5 },
          { textAr: "كمالك عقار، المفتاح الشهري وفّرت لي إدارة كاملة لشقتي. العوائد ممتازة والتواصل مع المستأجرين سهل.", textEn: "As a property owner, المفتاح الشهري provided complete management. Great returns and easy tenant communication.", nameAr: "خالد العتيبي", nameEn: "Khaled Al-Otaibi", roleAr: "مالك عقار - المدينة", roleEn: "Property Owner - Madinah", rating: 5 },
        ]),
        // Section headings
        "services.titleAr": "خدماتنا",
        "services.titleEn": "Our Services",
        "services.subtitleAr": "نقدم مجموعة متكاملة من الخدمات لتسهيل تجربة التأجير الشهري",
        "services.subtitleEn": "A complete suite of services for a seamless monthly rental experience",
        "steps.titleAr": "كيف يعمل",
        "steps.titleEn": "How It Works",
        "steps.subtitleAr": "ثلاث خطوات بسيطة للحصول على سكنك الشهري المثالي",
        "steps.subtitleEn": "Three simple steps to find your perfect monthly home",
        "featured.titleAr": "عقارات مميزة",
        "featured.titleEn": "Featured Properties",
        "featured.subtitleAr": "اكتشف أفضل العقارات المتاحة للتأجير الشهري",
        "featured.subtitleEn": "Discover the best monthly rental properties",
        "testimonials.titleAr": "آراء عملائنا",
        "testimonials.titleEn": "What Our Clients Say",
        "testimonials.subtitleAr": "تجارب حقيقية من مستأجرين وملاك عقارات",
        "testimonials.subtitleEn": "Real experiences from tenants and property owners",
      };
      await db.bulkSetSettings(defaults);
      return { success: true };
    }),
  }),

  cms: router({
    history: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) return [];
        const [rows] = await pool.execute(
          `SELECT * FROM cms_content_versions WHERE settingKey = ? ORDER BY version DESC LIMIT 50`,
          [input.key]
        );
        return rows as any[];
      }),
    pendingDrafts: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .query(async () => {
        const pool = (await import('../db')).getPool();
        if (!pool) return [];
        const [rows] = await pool.execute(
          `SELECT cv.* FROM cms_content_versions cv INNER JOIN (SELECT settingKey, MAX(version) as maxVer FROM cms_content_versions WHERE status='draft' GROUP BY settingKey) latest ON cv.settingKey = latest.settingKey AND cv.version = latest.maxVer ORDER BY cv.createdAt DESC`
        );
        return rows as any[];
      }),
    saveDraft: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ key: z.string(), value: z.string(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) throw new Error('No DB');
        const [maxRows] = await pool.execute(`SELECT COALESCE(MAX(version), 0) as maxVer FROM cms_content_versions WHERE settingKey = ?`, [input.key]);
        const nextVersion = ((maxRows as any[])[0]?.maxVer ?? 0) + 1;
        await pool.execute(
          `INSERT INTO cms_content_versions (settingKey, value, status, version, changedBy, changedByName, changeNote) VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
          [input.key, input.value, nextVersion, ctx.user?.id ?? null, ctx.user?.name ?? 'System', input.note ?? null]
        );
        return { success: true, version: nextVersion };
      }),
    publish: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ key: z.string(), versionId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) throw new Error('No DB');
        let versionRow: any;
        if (input.versionId) {
          const [rows] = await pool.execute(`SELECT * FROM cms_content_versions WHERE id = ?`, [input.versionId]);
          versionRow = (rows as any[])[0];
        } else {
          const [rows] = await pool.execute(`SELECT * FROM cms_content_versions WHERE settingKey = ? AND status = 'draft' ORDER BY version DESC LIMIT 1`, [input.key]);
          versionRow = (rows as any[])[0];
        }
        if (!versionRow) throw new Error('No draft found to publish');
        await pool.execute(`UPDATE cms_content_versions SET status = 'archived' WHERE settingKey = ? AND status = 'published'`, [input.key]);
        await pool.execute(`UPDATE cms_content_versions SET status = 'published' WHERE id = ?`, [versionRow.id]);
        await db.setSetting(input.key, versionRow.value ?? '');
        cache.invalidatePrefix('settings:');
        return { success: true, publishedVersion: versionRow.version };
      }),
    bulkPublish: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ keys: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) throw new Error('No DB');
        let published = 0;
        for (const key of input.keys) {
          const [rows] = await pool.execute(`SELECT * FROM cms_content_versions WHERE settingKey = ? AND status = 'draft' ORDER BY version DESC LIMIT 1`, [key]);
          const draft = (rows as any[])[0];
          if (!draft) continue;
          await pool.execute(`UPDATE cms_content_versions SET status = 'archived' WHERE settingKey = ? AND status = 'published'`, [key]);
          await pool.execute(`UPDATE cms_content_versions SET status = 'published' WHERE id = ?`, [draft.id]);
          await db.setSetting(key, draft.value ?? '');
          published++;
        }
        cache.invalidatePrefix('settings:');
        return { success: true, published };
      }),
    rollback: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ versionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) throw new Error('No DB');
        const [rows] = await pool.execute(`SELECT * FROM cms_content_versions WHERE id = ?`, [input.versionId]);
        const target = (rows as any[])[0];
        if (!target) throw new Error('Version not found');
        await pool.execute(`UPDATE cms_content_versions SET status = 'archived' WHERE settingKey = ? AND status = 'published'`, [target.settingKey]);
        const [maxRows] = await pool.execute(`SELECT COALESCE(MAX(version), 0) as maxVer FROM cms_content_versions WHERE settingKey = ?`, [target.settingKey]);
        const nextVersion = ((maxRows as any[])[0]?.maxVer ?? 0) + 1;
        await pool.execute(
          `INSERT INTO cms_content_versions (settingKey, value, status, version, changedBy, changedByName, changeNote) VALUES (?, ?, 'published', ?, ?, ?, ?)`,
          [target.settingKey, target.value, nextVersion, ctx.user?.id ?? null, ctx.user?.name ?? 'System', `Rollback to v${target.version}`]
        );
        await db.setSetting(target.settingKey, target.value ?? '');
        cache.invalidatePrefix('settings:');
        return { success: true, newVersion: nextVersion };
      }),
    inventory: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .query(async () => {
        const pool = (await import('../db')).getPool();
        if (!pool) return { keys: {}, drafts: {} };
        const allSettings = await db.getAllSettings();
        const [draftRows] = await pool.execute(`SELECT settingKey, value, version, createdAt, changedByName FROM cms_content_versions WHERE status = 'draft' ORDER BY version DESC`);
        const drafts: Record<string, any> = {};
        for (const row of draftRows as any[]) {
          if (!drafts[row.settingKey]) drafts[row.settingKey] = row;
        }
        return { keys: allSettings, drafts };
      }),
    mediaList: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ folder: z.string().optional(), page: z.number().min(1).default(1), limit: z.number().min(1).max(100).default(50) }))
      .query(async ({ input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) return { items: [], total: 0 };
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.folder) { conditions.push('folder = ?'); params.push(input.folder); }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (input.page - 1) * input.limit;
        const [rows] = await pool.execute(`SELECT * FROM cms_media ${where} ORDER BY createdAt DESC LIMIT ${input.limit} OFFSET ${offset}`, params);
        const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM cms_media ${where}`, params);
        return { items: rows as any[], total: (countRows as any[])[0]?.total ?? 0 };
      }),
    mediaUpload: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ base64: z.string(), filename: z.string(), contentType: z.string(), folder: z.string().default('general'), alt: z.string().optional(), altAr: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split('.').pop() || 'png';
        const key = `cms-media/${input.folder}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        const pool = (await import('../db')).getPool();
        if (pool) {
          await pool.execute(
            `INSERT INTO cms_media (url, filename, contentType, size, alt, altAr, uploadedBy, uploadedByName, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [url, input.filename, input.contentType, buffer.length, input.alt ?? null, input.altAr ?? null, ctx.user?.id ?? null, ctx.user?.name ?? 'System', input.folder]
          );
        }
        return { url, filename: input.filename };
      }),
    mediaDelete: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) throw new Error('No DB');
        await pool.execute(`DELETE FROM cms_media WHERE id = ?`, [input.id]);
        return { success: true };
      }),
    seedDefaults: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .mutation(async () => {
        const result = await db.seedMissingSettings({
          "site.nameAr": "\u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a",
          "site.nameEn": "Monthly Key",
          "site.descriptionAr": "\u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a \u062a\u0631\u0628\u0637 \u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631\u064a\u0646 \u0628\u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a \u0644\u0644\u0625\u064a\u062c\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
          "site.descriptionEn": "Monthly Key connects tenants with the best monthly rental properties across Saudi Arabia",
          "site.logoUrl": "",
          "site.faviconUrl": "",
          "site.primaryColor": "#3ECFC0",
          "site.accentColor": "#C9A96E",
          "hero.titleAr": "\u062e\u0628\u064a\u0631 \u0627\u0644\u0625\u064a\u062c\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064a \u2014 \u0627\u0644\u0622\u0646 \u0641\u064a \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
          "hero.titleEn": "Monthly Rental Expert \u2014 Now in Saudi Arabia",
          "hero.subtitleAr": "\u0646\u0631\u0628\u0637 \u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631\u064a\u0646 \u0628\u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a \u0627\u0644\u0634\u0647\u0631\u064a\u0629 \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629",
          "hero.subtitleEn": "Connecting tenants with the best monthly properties in the Kingdom",
          "hero.bgImage": "",
          "hero.ctaTextAr": "\u0627\u0628\u062d\u062b \u0627\u0644\u0622\u0646",
          "hero.ctaTextEn": "Search Now",
          "services.titleAr": "\u062e\u062f\u0645\u0627\u062a\u0646\u0627",
          "services.titleEn": "Our Services",
          "services.subtitleAr": "\u0646\u0642\u062f\u0645 \u0645\u062c\u0645\u0648\u0639\u0629 \u0645\u062a\u0643\u0627\u0645\u0644\u0629 \u0645\u0646 \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0644\u062a\u0633\u0647\u064a\u0644 \u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u062a\u0623\u062c\u064a\u0631 \u0627\u0644\u0634\u0647\u0631\u064a",
          "services.subtitleEn": "A complete suite of services for a seamless monthly rental experience",
          "steps.titleAr": "\u0643\u064a\u0641 \u064a\u0639\u0645\u0644",
          "steps.titleEn": "How It Works",
          "steps.subtitleAr": "\u062b\u0644\u0627\u062b \u062e\u0637\u0648\u0627\u062a \u0628\u0633\u064a\u0637\u0629 \u0644\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0633\u0643\u0646\u0643 \u0627\u0644\u0634\u0647\u0631\u064a \u0627\u0644\u0645\u062b\u0627\u0644\u064a",
          "steps.subtitleEn": "Three simple steps to find your perfect monthly home",
          "featured.titleAr": "\u0639\u0642\u0627\u0631\u0627\u062a \u0645\u0645\u064a\u0632\u0629",
          "featured.titleEn": "Featured Properties",
          "featured.subtitleAr": "\u0627\u0643\u062a\u0634\u0641 \u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u062a\u0623\u062c\u064a\u0631 \u0627\u0644\u0634\u0647\u0631\u064a",
          "featured.subtitleEn": "Discover the best monthly rental properties",
          "testimonials.titleAr": "\u0622\u0631\u0627\u0621 \u0639\u0645\u0644\u0627\u0626\u0646\u0627",
          "testimonials.titleEn": "What Our Clients Say",
          "testimonials.subtitleAr": "\u062a\u062c\u0627\u0631\u0628 \u062d\u0642\u064a\u0642\u064a\u0629 \u0645\u0646 \u0645\u0633\u062a\u0623\u062c\u0631\u064a\u0646 \u0648\u0645\u0644\u0627\u0643 \u0639\u0642\u0627\u0631\u0627\u062a",
          "testimonials.subtitleEn": "Real experiences from tenants and property owners",
          "homepage.services": JSON.stringify([
            { iconName: "Building2", titleAr: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a", titleEn: "Property Management", descAr: "\u0625\u062f\u0627\u0631\u0629 \u0634\u0627\u0645\u0644\u0629 \u0644\u0639\u0642\u0627\u0631\u0643 \u0627\u0644\u0634\u0647\u0631\u064a \u0645\u0639 \u062a\u0642\u0627\u0631\u064a\u0631 \u062f\u0648\u0631\u064a\u0629", descEn: "Complete monthly property management with periodic reports" },
            { iconName: "Key", titleAr: "\u0627\u0644\u0625\u064a\u062c\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064a", titleEn: "Monthly Rentals", descAr: "\u062a\u0623\u062c\u064a\u0631 \u0645\u0631\u0646 \u0628\u0639\u0642\u0648\u062f \u0631\u0642\u0645\u064a\u0629 \u0645\u062a\u0648\u0627\u0641\u0642\u0629", descEn: "Flexible rentals with Ejar-compliant digital contracts" },
            { iconName: "TrendingUp", titleAr: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a", titleEn: "Revenue Management", descAr: "\u062a\u0633\u0639\u064a\u0631 \u0630\u0643\u064a \u0648\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u0639\u0648\u0627\u0626\u062f \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0627\u0644\u0633\u0648\u0642", descEn: "Smart pricing and yield optimization based on market data" },
            { iconName: "Paintbrush", titleAr: "\u0627\u0644\u0639\u0646\u0627\u064a\u0629 \u0628\u0627\u0644\u0639\u0642\u0627\u0631", titleEn: "Property Care", descAr: "\u0635\u064a\u0627\u0646\u0629 \u0648\u062a\u062c\u062f\u064a\u062f \u0648\u062a\u0635\u0645\u064a\u0645 \u062f\u0627\u062e\u0644\u064a \u0627\u062d\u062a\u0631\u0627\u0641\u064a", descEn: "Professional maintenance, renovation & interior design" },
            { iconName: "Headphones", titleAr: "\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631", titleEn: "Tenant Experience", descAr: "\u062f\u0639\u0645 \u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631\u064a\u0646 \u0639\u0644\u0649 \u0645\u062f\u0627\u0631 \u0627\u0644\u0633\u0627\u0639\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629", descEn: "24/7 Arabic tenant support" },
            { iconName: "UserCheck", titleAr: "\u0627\u0644\u062a\u062d\u0642\u0642 \u0648\u0627\u0644\u0623\u0645\u0627\u0646", titleEn: "Verification & Security", descAr: "\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0647\u0648\u064a\u0629 \u0627\u0644\u0648\u0637\u0646\u064a\u0629 \u0648\u0639\u0642\u0648\u062f \u0631\u0642\u0645\u064a\u0629 \u0622\u0645\u0646\u0629", descEn: "National ID verification & secure digital contracts" },
          ]),
          "homepage.steps": JSON.stringify([
            { num: "01", titleAr: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0639\u0642\u0627\u0631\u0643", titleEn: "Search Properties", descAr: "\u062a\u0635\u0641\u062d \u0645\u0626\u0627\u062a \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u062a\u0623\u062c\u064a\u0631 \u0627\u0644\u0634\u0647\u0631\u064a \u0641\u064a \u0645\u062f\u064a\u0646\u062a\u0643", descEn: "Browse hundreds of monthly rental properties in your city" },
            { num: "02", titleAr: "\u0627\u062d\u062c\u0632 \u0625\u0642\u0627\u0645\u062a\u0643", titleEn: "Book Your Stay", descAr: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062f\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0648\u0627\u062d\u062c\u0632 \u0628\u0633\u0647\u0648\u0644\u0629 \u0645\u0639 \u0639\u0642\u062f \u0631\u0642\u0645\u064a", descEn: "Choose your duration and book easily with a digital contract" },
            { num: "03", titleAr: "\u0627\u0633\u062a\u0645\u062a\u0639 \u0628\u0633\u0643\u0646\u0643", titleEn: "Enjoy Your Home", descAr: "\u0627\u0646\u062a\u0642\u0644 \u0648\u0627\u0633\u062a\u0645\u062a\u0639 \u0628\u0625\u0642\u0627\u0645\u0629 \u0645\u0631\u064a\u062d\u0629 \u0645\u0639 \u062f\u0639\u0645 \u0645\u062a\u0648\u0627\u0635\u0644", descEn: "Move in and enjoy a comfortable stay with ongoing support" },
          ]),
          "homepage.testimonials": JSON.stringify([
            { textAr: "\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a \u0633\u0647\u0651\u0644\u062a \u0639\u0644\u064a \u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0634\u0642\u0629 \u0634\u0647\u0631\u064a\u0629 \u0641\u064a \u0627\u0644\u0631\u064a\u0627\u0636. \u0627\u0644\u062e\u062f\u0645\u0629 \u0645\u0645\u062a\u0627\u0632\u0629 \u0648\u0627\u0644\u0639\u0642\u0648\u062f \u0648\u0627\u0636\u062d\u0629.", textEn: "Monthly Key made it easy to find a monthly apartment in Riyadh. Excellent service and clear contracts.", nameAr: "\u0623\u062d\u0645\u062f \u0627\u0644\u0645\u0637\u064a\u0631\u064a", nameEn: "Ahmed Al-Mutairi", roleAr: "\u0645\u0633\u062a\u0623\u062c\u0631 - \u0627\u0644\u0631\u064a\u0627\u0636", roleEn: "Tenant - Riyadh", rating: 5 },
            { textAr: "\u0633\u0639\u064a\u062f\u0629 \u062c\u062f\u0627\u064b \u0628\u0627\u062e\u062a\u064a\u0627\u0631\u064a \u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a. \u0645\u0646 \u0627\u0644\u0628\u062d\u062b \u0648\u062d\u062a\u0649 \u0627\u0644\u062a\u0648\u0642\u064a\u0639\u060c \u0643\u0644 \u0634\u064a\u0621 \u0643\u0627\u0646 \u0633\u0644\u0633 \u0648\u0627\u062d\u062a\u0631\u0627\u0641\u064a.", textEn: "Very happy with Monthly Key. From search to signing, everything was smooth and professional.", nameAr: "\u0633\u0627\u0631\u0629 \u0627\u0644\u062d\u0631\u0628\u064a", nameEn: "Sara Al-Harbi", roleAr: "\u0645\u0633\u062a\u0623\u062c\u0631\u0629 - \u062c\u062f\u0629", roleEn: "Tenant - Jeddah", rating: 5 },
            { textAr: "\u0643\u0645\u0627\u0644\u0643 \u0639\u0642\u0627\u0631\u060c \u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a \u0648\u0641\u0651\u0631\u062a \u0644\u064a \u0625\u062f\u0627\u0631\u0629 \u0643\u0627\u0645\u0644\u0629 \u0644\u0634\u0642\u062a\u064a. \u0627\u0644\u0639\u0648\u0627\u0626\u062f \u0645\u0645\u062a\u0627\u0632\u0629 \u0648\u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0633\u062a\u0623\u062c\u0631\u064a\u0646 \u0633\u0647\u0644.", textEn: "As a property owner, Monthly Key provided complete management. Great returns and easy tenant communication.", nameAr: "\u062e\u0627\u0644\u062f \u0627\u0644\u0639\u062a\u064a\u0628\u064a", nameEn: "Khaled Al-Otaibi", roleAr: "\u0645\u0627\u0644\u0643 \u0639\u0642\u0627\u0631 - \u0627\u0644\u0645\u062f\u064a\u0646\u0629", roleEn: "Property Owner - Madinah", rating: 5 },
          ]),
          "footer.aboutAr": "\u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0627\u0644\u0634\u0647\u0631\u064a \u0647\u064a \u0645\u0646\u0635\u0629 \u0631\u0627\u0626\u062f\u0629 \u0641\u064a \u0645\u062c\u0627\u0644 \u0627\u0644\u062a\u0623\u062c\u064a\u0631 \u0627\u0644\u0634\u0647\u0631\u064a \u0641\u064a \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629 \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629",
          "footer.aboutEn": "Monthly Key is a leading monthly rental platform in Saudi Arabia",
          "footer.emailAddress": "info@monthlykey.com",
          "footer.phoneNumber": "+966 55 000 0000",
          "footer.instagramUrl": "",
          "footer.twitterUrl": "",
          "footer.linkedinUrl": "",
          "footer.tiktokUrl": "",
          "footer.snapchatUrl": "",
          "footer.copyrightAr": "\u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0642 \u0645\u062d\u0641\u0648\u0638\u0629",
          "footer.copyrightEn": "All rights reserved",
          "terms.contentAr": "",
          "terms.contentEn": "",
          "privacy.contentAr": "",
          "privacy.contentEn": "",
          "stats.properties": "500+",
          "stats.propertiesLabelAr": "\u0639\u0642\u0627\u0631 \u0645\u062a\u0627\u062d",
          "stats.propertiesLabelEn": "Available Properties",
          "stats.cities": "8",
          "stats.citiesLabelAr": "\u0645\u062f\u064a\u0646\u0629",
          "stats.citiesLabelEn": "Cities",
          "stats.tenants": "2000+",
          "stats.tenantsLabelAr": "\u0645\u0633\u062a\u0623\u062c\u0631 \u0633\u0639\u064a\u062f",
          "stats.tenantsLabelEn": "Happy Tenants",
          "stats.satisfaction": "98%",
          "stats.satisfactionLabelAr": "\u0646\u0633\u0628\u0629 \u0627\u0644\u0631\u0636\u0627",
          "stats.satisfactionLabelEn": "Satisfaction Rate",
          "whatsapp.number": "966550000000",
          "whatsapp.messageAr": "\u0645\u0631\u062d\u0628\u0627\u064b\u060c \u0623\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629 \u0641\u064a \u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0639\u0642\u0627\u0631 \u0634\u0647\u0631\u064a",
          "whatsapp.messageEn": "Hello, I need help finding a monthly rental",
        });
        cache.invalidatePrefix('settings:');
        return { success: true, seeded: result.seeded, skipped: result.skipped };
      }),
  }),

};
