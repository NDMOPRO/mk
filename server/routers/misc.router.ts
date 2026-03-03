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

// Domain: misc
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const miscRouterDefs = {
  activity: router({
    track: publicProcedure
      .input(z.object({
        action: z.string(),
        page: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.trackActivity({
          userId: ctx.user?.id ?? null,
          action: input.action,
          page: input.page,
          metadata: input.metadata as Record<string, unknown>,
          ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString() || null,
          userAgent: ctx.req.headers['user-agent'] || null,
          sessionId: null,
        });
        return { success: true };
      }),

    stats: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS).query(async () => {
      return db.getActivityStats();
    }),

    log: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({
        userId: z.number().optional(),
        action: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getActivityLog(input ?? undefined);
      }),

    userPreferences: adminWithPermission(PERMISSIONS.VIEW_ANALYTICS)
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserPreferences(input.userId);
      }),
  }),

  permissions: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS).query(async () => {
      return db.getAllAdminPermissions();
    }),

    get: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getAdminPermissions(input.userId);
      }),

    set: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        userId: z.number(),
        permissions: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if target is root admin - cannot modify
        const existing = await db.getAdminPermissions(input.userId);
        if (existing?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify root admin permissions' });
        }
        await db.setAdminPermissions(input.userId, input.permissions);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const existing = await db.getAdminPermissions(input.userId);
        if (existing?.isRootAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete root admin' });
        }
        await db.deleteAdminPermissions(input.userId);
        return { success: true };
      }),
  }),

  permissionMeta: router({
    categories: publicProcedure.query(() => {
      return PERMISSION_CATEGORIES;
    }),
  }),

  roles: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_ROLES).query(async () => {
      const allRoles = await sharedDb.select().from(rolesTable);
      return allRoles.map(r => ({ ...r, permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions as string) : r.permissions }));
    }),

    getById: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const [role] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
        return { ...role, permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions as string) : role.permissions };
      }),

    create: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        name: z.string().max(100),
        nameAr: z.string().max(100),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
        permissions: z.array(z.string().max(100)),
      }))
      .mutation(async ({ input }) => {
        const result = await sharedDb.insert(rolesTable).values({
          ...input,
          permissions: JSON.stringify(input.permissions),
        } as any);
        return { id: result[0].insertId, success: true };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        id: z.number(),
        name: z.string().max(100).optional(),
        nameAr: z.string().max(100).optional(),
        description: z.string().max(500).optional(),
        descriptionAr: z.string().max(500).optional(),
        permissions: z.array(z.string().max(100)).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, permissions, ...rest } = input;
        const updateData: any = { ...rest };
        if (permissions) updateData.permissions = JSON.stringify(permissions);
        // Prevent editing system roles name
        const [existing] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, id));
        if (existing?.isSystem) {
          delete updateData.name;
          delete updateData.nameAr;
        }
        await sharedDb.update(rolesTable).set(updateData).where(eqDrizzle(rolesTable.id, id));
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const [existing] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        if (existing?.isSystem) throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete system role' });
        await sharedDb.delete(rolesTable).where(eqDrizzle(rolesTable.id, input.id));
        return { success: true };
      }),

    // Assign role to user
    assignToUser: adminWithPermission(PERMISSIONS.MANAGE_ROLES)
      .input(z.object({
        userId: z.number(),
        roleId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const [role] = await sharedDb.select().from(rolesTable).where(eqDrizzle(rolesTable.id, input.roleId));
        if (!role) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
        const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions as string) : role.permissions;
        await db.setAdminPermissions(input.userId, perms);
        clearPermissionCache(input.userId);
        return { success: true };
      }),
  }),

  lease: router({
    generate: protectedProcedure
      .input(z.object({ bookingId: z.number() }))
      .mutation(async ({ input }) => {
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
          insuranceTooltipEn: settings["calculator.insuranceTooltipEn"] || "Refundable security deposit returned at end of lease",
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

  propertyManager: router({
    list: publicProcedure.query(async () => {
      return await db.getAllPropertyManagers();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getPropertyManagerById(input.id);
    }),
    getByProperty: publicProcedure.input(z.object({ propertyId: z.number() })).query(async ({ input }) => {
      return await db.getPropertyManagerByProperty(input.propertyId);
    }),
    create: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        name: z.string().min(1), nameAr: z.string().min(1),
        phone: z.string().min(1), whatsapp: z.string().optional(),
        email: z.string().optional(), photoUrl: z.string().optional(),
        bio: z.string().optional(), bioAr: z.string().optional(),
        title: z.string().optional(), titleAr: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createPropertyManager(input as any);
        return { success: true, id };
      }),
    update: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({
        id: z.number(),
        name: z.string().optional(), nameAr: z.string().optional(),
        phone: z.string().optional(), whatsapp: z.string().optional(),
        email: z.string().optional(), photoUrl: z.string().optional(),
        bio: z.string().optional(), bioAr: z.string().optional(),
        title: z.string().optional(), titleAr: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePropertyManager(id, data as any);
        return { success: true };
      }),
    delete: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePropertyManager(input.id);
        return { success: true };
      }),
    assign: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number(), propertyIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await db.assignManagerToProperties(input.managerId, input.propertyIds);
        return { success: true };
      }),
    getAssignments: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number() }))
      .query(async ({ input }) => {
        return await db.getManagerAssignments(input.managerId);
      }),
    getWithProperties: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getManagerWithProperties(input.id);
      }),
    listWithCounts: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES).query(async () => {
      return await db.getAllManagersWithCounts();
    }),
    uploadPhoto: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ input }) => {
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `managers/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
    // Agent self-service: request edit link by email
    requestEditLink: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        // Rate limit to prevent email enumeration
        const ip = getClientIP(ctx.req);
        const rl = await Promise.resolve(rateLimiter.check(`editlink:${ip}`, 5, 300000)); // 5 per 5 min
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' });
        const manager = await db.getManagerByEmail(input.email);
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'No manager found with this email' });
        const token = nanoid(32);
        await db.setManagerEditToken(manager.id, token);
        // Token should be sent via email in production — not returned in response
        return { success: true, message: 'Edit link has been generated. Please check your email.' };
      }),
    // Agent self-service: get profile by edit token
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const manager = await db.getManagerByToken(input.token);
        if (!manager) return null;
        return manager;
      }),
    // Agent self-service: update own profile by token
    updateSelfProfile: publicProcedure
      .input(z.object({
        token: z.string(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        bio: z.string().optional(),
        bioAr: z.string().optional(),
        photoUrl: z.string().optional(),
        title: z.string().optional(),
        titleAr: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const manager = await db.getManagerByToken(input.token);
        if (!manager) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
        const { token, ...data } = input;
        const updateData: Record<string, any> = {};
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
        if (data.bio !== undefined) updateData.bio = data.bio;
        if (data.bioAr !== undefined) updateData.bioAr = data.bioAr;
        if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.titleAr !== undefined) updateData.titleAr = data.titleAr;
        await db.updatePropertyManager(manager.id, updateData);
        return { success: true };
      }),
    // Agent self-service: upload own photo by token
    uploadSelfPhoto: publicProcedure
      .input(z.object({ token: z.string(), base64: z.string().max(MAX_AVATAR_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ input }) => {
        if (!validateContentType(input.contentType, ALLOWED_IMAGE_TYPES)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type. Only images allowed.' });
        const manager = await db.getManagerByToken(input.token);
        if (!manager) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `managers/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        await db.updatePropertyManager(manager.id, { photoUrl: url });
        return { url };
      }),
    // Generate edit link for a manager (admin)
    generateEditLink: adminWithPermission(PERMISSIONS.MANAGE_PROPERTIES)
      .input(z.object({ managerId: z.number() }))
      .mutation(async ({ input }) => {
        const manager = await db.getPropertyManagerById(input.managerId);
        if (!manager) throw new TRPCError({ code: 'NOT_FOUND', message: 'Manager not found' });
        const token = nanoid(32);
        await db.setManagerEditToken(input.managerId, token);
        return { token };
      }),
  }),

  message: router({
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversationsByUser(ctx.user.id);
    }),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number(), limit: z.number().optional(), offset: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        await db.markMessagesAsRead(input.conversationId, ctx.user.id);
        return db.getMessagesByConversation(input.conversationId, input.limit, input.offset);
      }),

    send: protectedProcedure
      .input(z.object({
        conversationId: z.number().optional(),
        recipientId: z.number().optional(),
        propertyId: z.number().optional(),
        content: z.string().min(1).max(5000),
        messageType: z.enum(["text", "image", "file"]).optional(),
        fileUrl: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const rl = await Promise.resolve(rateLimiter.check(`msg:${ctx.user.id}`, 30, 60000)); // 30 per min
        if (!rl.allowed) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many messages. Please slow down.' });
        if (input.messageType === 'text') input.content = sanitizeText(input.content);
        let convId = input.conversationId;
        if (!convId && input.recipientId) {
          const conv = await db.getOrCreateConversation(ctx.user.id, input.recipientId, input.propertyId);
          convId = conv?.id;
        }
        if (!convId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        const id = await db.createMessage({
          conversationId: convId,
          senderId: ctx.user.id,
          content: input.content,
          messageType: input.messageType ?? "text",
          fileUrl: input.fileUrl,
        });
        // Notification for recipient
        const convs = await db.getConversationsByUser(ctx.user.id);
        const conv = convs.find(c => c.id === convId);
        if (conv) {
          const recipientId = conv.tenantId === ctx.user.id ? conv.landlordId : conv.tenantId;
          await db.createNotification({
            userId: recipientId,
            type: "message_new",
            titleEn: "New Message",
            titleAr: "رسالة جديدة",
            contentEn: input.content.substring(0, 100),
            relatedId: convId,
            relatedType: "conversation",
          });
        }
        return { id, conversationId: convId };
      }),

    startConversation: protectedProcedure
      .input(z.object({ recipientId: z.number(), propertyId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const conv = await db.getOrCreateConversation(ctx.user.id, input.recipientId, input.propertyId);
        return conv;
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadMessageCount(ctx.user.id) };
    }),
  }),

  audit: router({
    list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        entityType: z.string().optional(),
        action: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const pool = (await import('../db')).getPool();
        if (!pool) return { items: [], total: 0 };
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (input.entityType) { conditions.push('entityType = ?'); params.push(input.entityType); }
        if (input.action) { conditions.push('action = ?'); params.push(input.action); }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (input.page - 1) * input.limit;
        const [rows] = await pool.execute(
          `SELECT * FROM audit_log ${where} ORDER BY createdAt DESC LIMIT ${input.limit} OFFSET ${offset}`,
          params
        );
        const [countRows] = await pool.execute(
          `SELECT COUNT(*) as total FROM audit_log ${where}`,
          params
        );
        return { items: rows as any[], total: (countRows as any[])[0]?.total ?? 0 };
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
