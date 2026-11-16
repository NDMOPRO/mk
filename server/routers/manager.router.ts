import {
  TRPCError, z, router,
  publicProcedure, protectedProcedure, adminProcedure, adminWithPermission,
  PERMISSIONS,
  db,
  rateLimiter, getClientIP,
  storagePut, nanoid,
  sanitizeText, validateContentType,
  MAX_BASE64_SIZE, MAX_AVATAR_BASE64_SIZE, ALLOWED_IMAGE_TYPES,
} from "./_shared";

// Domain: manager
// Extracted from server/routers/misc.router.ts — DO NOT modify procedure names/shapes

export const managerRouterDefs = {
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
        return db.omitManagerSecrets(manager);
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

};
