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

// Domain: notification
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const notificationRouterDefs = {
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotificationsByUser(ctx.user.id);
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify notification belongs to user
        const notifications = await db.getNotificationsByUser(ctx.user.id);
        const owns = notifications.some((n: any) => n.id === input.id);
        if (!owns) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.markNotificationRead(input.id);
        return { success: true };
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.getUnreadNotificationCount(ctx.user.id) };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const notifications = await db.getNotificationsByUser(ctx.user.id);
        const owns = notifications.some((n: any) => n.id === input.id);
        if (!owns) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        await db.deleteNotification(input.id);
        return { success: true };
      }),
  }),

  push: router({
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
      }))
      .mutation(async ({ ctx, input }) => {
        return savePushSubscription(ctx.user.id, input);
      }),

    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return removePushSubscription(ctx.user.id, input.endpoint);
      }),

    status: protectedProcedure.query(async ({ ctx }) => {
      const count = await getUserSubscriptionCount(ctx.user.id);
      return { subscribed: count > 0, count, configured: isPushConfigured() };
    }),

    // Admin: send to specific user
    sendToUser: adminWithPermission(PERMISSIONS.SEND_NOTIFICATIONS)
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        body: z.string(),
        url: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return sendPushToUser(input.userId, { title: input.title, body: input.body, url: input.url });
      }),

    // Admin: broadcast to all
    broadcast: adminWithPermission(PERMISSIONS.SEND_NOTIFICATIONS)
      .input(z.object({
        title: z.string(),
        body: z.string(),
        url: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return sendPushBroadcast({ title: input.title, body: input.body, url: input.url });
      }),
  }),

  email: router({
    // Admin: verify SMTP connection
    verifySmtp: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return await verifySmtpConnection();
    }),
    // Admin: check if SMTP is configured
    status: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return { configured: isSmtpConfigured() };
    }),
    // Admin: send test email
    sendTest: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ to: z.string().email() }))
      .mutation(async ({ input }) => {
        const { sendEmail } = await import("../email");
        return await sendEmail({
          to: input.to,
          subject: "اختبار البريد — المفتاح الشهري",
          html: `<div style="font-family:sans-serif;direction:rtl;text-align:center;padding:40px">
            <h2 style="color:#3ECFC0">تم الاتصال بنجاح!</h2>
            <p>هذا بريد اختباري من منصة المفتاح الشهري.</p>
            <p style="color:#999;font-size:12px">إذا وصلتك هذه الرسالة، فإعدادات SMTP صحيحة.</p>
          </div>`,
        });
      }),
  }),

  whatsapp: router({
    // Send a message (click-to-chat logs only, or Cloud API actual send)
    send: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        recipientPhone: z.string().min(10),
        recipientName: z.string().optional(),
        userId: z.number().optional(),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]),
        templateName: z.string().optional(),
        messageBody: z.string().min(1),
        propertyId: z.number().optional(),
        bookingId: z.number().optional(),
        channel: z.enum(["click_to_chat", "cloud_api"]).default("click_to_chat"),
      }))
      .mutation(async ({ input, ctx }) => {
        let status: string = "sent";
        let providerMsgId: string | null = null;
        let errorMessage: string | null = null;

        if (input.channel === "cloud_api") {
          // Actually send via WhatsApp Cloud API
          const result = await sendTextMessage(input.recipientPhone, input.messageBody);
          if (result.success) {
            status = "sent";
            providerMsgId = result.providerMsgId || null;
          } else {
            status = "failed";
            errorMessage = result.error || "Unknown error";
          }
        }

        const msgId = await db.createWhatsAppMessage({
          ...input,
          recipientName: input.recipientName || null,
          userId: input.userId || null,
          templateName: input.templateName || null,
          propertyId: input.propertyId || null,
          bookingId: input.bookingId || null,
          sentBy: ctx.user.id,
          status: status as any,
          sentAt: new Date(),
        });

        // Update providerMsgId if we got one
        if (providerMsgId) {
          const pool = db.getPool();
          if (pool) {
            await pool.query(`UPDATE whatsapp_messages SET providerMsgId = ? WHERE id = ?`, [providerMsgId, msgId]);
          }
        }
        if (errorMessage) {
          const pool = db.getPool();
          if (pool) {
            await pool.query(`UPDATE whatsapp_messages SET errorMessage = ? WHERE id = ?`, [errorMessage, msgId]);
          }
        }

        // Audit log (mask phone)
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "SEND",
            entityType: "WHATSAPP_MESSAGE",
            entityId: msgId,
            entityLabel: `WhatsApp to ${maskPhone(input.recipientPhone)}`,
            metadata: { channel: input.channel, messageType: input.messageType, status },
          });
        } catch {}

        return { id: msgId, status, providerMsgId, error: errorMessage };
      }),

    // Send template message via Cloud API
    sendTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        recipientPhone: z.string().min(10),
        recipientName: z.string().optional(),
        userId: z.number().optional(),
        templateId: z.number(),
        variables: z.record(z.string(), z.string()).optional(),
        propertyId: z.number().optional(),
        bookingId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.getWhatsAppTemplate(input.templateId);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

        // Build message body from template with variable substitution
        let body = template.bodyAr || template.bodyEn || "";
        const vars = input.variables || {};
        for (const [key, val] of Object.entries(vars)) {
          body = body.replace(new RegExp(`\\{${key}\\}`, "g"), val);
        }

        let status = "sent";
        let providerMsgId: string | null = null;
        let errorMessage: string | null = null;

        // If template has a Meta template name, send via Cloud API
        if (template.metaTemplateName && (template.channel === "cloud_api" || template.channel === "both")) {
          const variableValues = template.variableKeys
            ? JSON.parse(template.variableKeys).map((k: string) => vars[k] || "")
            : [];
          const result = await sendTemplateMessage({
            to: input.recipientPhone,
            templateName: template.metaTemplateName,
            languageCode: template.languageCode || "ar",
            variables: variableValues,
          });
          if (result.success) {
            providerMsgId = result.providerMsgId || null;
          } else {
            status = "failed";
            errorMessage = result.error || "Template send failed";
          }
        }

        // Log the message
        const msgId = await db.createWhatsAppMessage({
          recipientPhone: input.recipientPhone,
          recipientName: input.recipientName || null,
          userId: input.userId || null,
          messageType: template.messageType,
          templateName: template.templateKey,
          messageBody: body,
          propertyId: input.propertyId || null,
          bookingId: input.bookingId || null,
          channel: template.metaTemplateName ? "cloud_api" : "click_to_chat",
          sentBy: ctx.user.id,
          status: status as any,
          sentAt: new Date(),
        });

        if (providerMsgId) {
          const pool = db.getPool();
          if (pool) await pool.query(`UPDATE whatsapp_messages SET providerMsgId = ? WHERE id = ?`, [providerMsgId, msgId]);
        }

        return { id: msgId, status, providerMsgId, error: errorMessage };
      }),

    // List messages with filters
    list: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        messageType: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.listWhatsAppMessages(input);
      }),

    // Get stats
    stats: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      return db.getWhatsAppStats();
    }),

    // Get message templates (from DB)
    templates: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      await db.seedDefaultWhatsAppTemplates();
      return db.listWhatsAppTemplates();
    }),

    // Create template
    createTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        templateKey: z.string().min(1).max(100),
        nameEn: z.string().min(1),
        nameAr: z.string().min(1),
        metaTemplateName: z.string().optional(),
        languageCode: z.string().default("ar"),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]),
        bodyEn: z.string().optional(),
        bodyAr: z.string().optional(),
        variableKeys: z.array(z.string()).optional(),
        channel: z.enum(["click_to_chat", "cloud_api", "both"]).default("both"),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createWhatsAppTemplateRecord(input);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "CREATE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: id || 0,
            entityLabel: input.nameEn,
          });
        } catch {}
        return { id };
      }),

    // Update template
    updateTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        metaTemplateName: z.string().optional(),
        languageCode: z.string().optional(),
        messageType: z.enum(["property_share", "booking_reminder", "follow_up", "custom", "welcome", "payment_reminder", "booking_approved", "booking_rejected"]).optional(),
        bodyEn: z.string().optional(),
        bodyAr: z.string().optional(),
        variableKeys: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        channel: z.enum(["click_to_chat", "cloud_api", "both"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWhatsAppTemplateRecord(input.id, input);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "UPDATE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: input.id,
            entityLabel: `Template #${input.id}`,
          });
        } catch {}
        return { success: true };
      }),

    // Delete template
    deleteTemplate: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteWhatsAppTemplateRecord(input.id);
        try {
          await logAudit({
            userId: ctx.user.id,
            userName: ctx.user.displayName || "admin",
            action: "DELETE",
            entityType: "WHATSAPP_TEMPLATE",
            entityId: input.id,
            entityLabel: `Template #${input.id}`,
          });
        } catch {}
        return { success: true };
      }),

    // Check if WhatsApp Cloud API is configured
    isConfigured: adminWithPermission(PERMISSIONS.MANAGE_WHATSAPP).query(async () => {
      const config = await getWhatsAppConfig();
      return {
        configured: !!config,
        cloudApiEnabled: !!config?.accessToken,
        senderName: config?.senderName || null,
      };
    }),
  }),

  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        subject: z.string().min(3),
        message: z.string().min(10),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createContactMessage(input);
        // Notify owner about new contact message
        try {
          await notifyOwner({
            title: `رسالة تواصل جديدة - New Contact Message`,
            content: `الاسم: ${input.name}\nالبريد: ${input.email}\nالهاتف: ${input.phone || "غير محدد"}\nالموضوع: ${input.subject}\nالرسالة: ${input.message}\n\nName: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone || "N/A"}\nSubject: ${input.subject}\nMessage: ${input.message}`,
          });
        } catch { /* best-effort */ }
        return { id, success: true };
      }),
    list: adminWithPermission(PERMISSIONS.MANAGE_CMS).query(async () => {
      return db.getContactMessages();
    }),
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_CMS)
      .input(z.object({ id: z.number(), status: z.enum(["read", "replied"]) }))
      .mutation(async ({ input }) => {
        await db.updateContactMessageStatus(input.id, input.status);
        return { success: true };
      }),
  }),

};
