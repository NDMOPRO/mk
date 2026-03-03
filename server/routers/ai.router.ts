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

// Domain: ai
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const aiRouterDefs = {
  ai: router({
    // Create or get conversations
    conversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getAiConversations(ctx.user.id);
    }),

    newConversation: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createAiConversation(ctx.user.id, input.title);
        return { id };
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiConversation(input.id);
        return { success: true };
      }),

    messages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        return db.getAiMessages(input.conversationId);
      }),

    chat: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await db.createAiMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        });

        let response: string;
        try {
          // Get AI response
          response = await getAiResponse(
            ctx.user.id,
            input.conversationId,
            input.message,
            ctx.user.role,
          );
        } catch (error: any) {
          console.error("[AI Chat Error]", error?.message || error);
          // Provide a friendly fallback response instead of crashing
          const errorMsg = error?.message || "";
          if (errorMsg.includes("API key") || errorMsg.includes("401") || errorMsg.includes("Incorrect")) {
            response = "عذراً، المساعد الذكي غير متاح حالياً بسبب مشكلة في الإعدادات. يرجى التواصل مع الدعم الفني. \n\nSorry, the AI assistant is currently unavailable due to a configuration issue. Please contact support.";
          } else if (errorMsg.includes("429") || errorMsg.includes("rate limit")) {
            response = "عذراً، تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل. \n\nSorry, rate limit exceeded. Please try again in a moment.";
          } else if (errorMsg.includes("timeout") || errorMsg.includes("ECONNREFUSED")) {
            response = "عذراً، لم أتمكن من الاتصال بالخادم. يرجى المحاولة مرة أخرى. \n\nSorry, I couldn't connect to the server. Please try again.";
          } else {
            response = "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى. \n\nSorry, an error occurred while processing your request. Please try again.";
          }
        }

        // Save assistant message
        const msgId = await db.createAiMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: response,
        });

        return { response, messageId: msgId };
      }),

    rateMessage: protectedProcedure
      .input(z.object({ messageId: z.number(), rating: z.number().min(1).max(5) }))
      .mutation(async ({ input }) => {
        await db.rateAiMessage(input.messageId, input.rating);
        return { success: true };
      }),

    // Admin: AI stats
    stats: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiStats();
    }),

    // Admin: Test API key
    testApiKey: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ apiKey: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${input.apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: "Say OK" }],
              max_tokens: 5,
            }),
          });
          if (response.ok) {
            return { success: true };
          }
          const errorData = await response.json().catch(() => ({}));
          const errMsg = (errorData as any)?.error?.message || `HTTP ${response.status}`;
          if (errMsg.includes("quota") || errMsg.includes("billing")) {
            return { success: false, error: "\u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0635\u0627\u0644\u062d \u0644\u0643\u0646 \u0644\u0627 \u064a\u0648\u062c\u062f \u0631\u0635\u064a\u062f \u0643\u0627\u0641\u064a. \u0623\u0636\u0641 \u0631\u0635\u064a\u062f \u0641\u064a platform.openai.com" };
          }
          return { success: false, error: errMsg };
        } catch (err: any) {
          return { success: false, error: err?.message || "Connection failed" };
        }
      }),

    // Admin: All conversations
    allConversations: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllAiConversations(input?.limit || 50, input?.offset || 0);
      }),

    // Admin: View any conversation messages
    adminMessages: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        return db.getAiMessages(input.conversationId);
      }),

    // Admin: Rated messages
    ratedMessages: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiRatedMessages();
    }),

    // Admin: Upload document to knowledge base
    uploadDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        base64: z.string().max(MAX_BASE64_SIZE),
        filename: z.string().max(255),
        contentType: z.string().max(100),
        category: z.string().optional(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split('.').pop() || 'pdf';
        const key = `ai-docs/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        const id = await db.createAiDocument({
          filename: input.filename,
          fileUrl: url,
          fileKey: key,
          mimeType: input.contentType,
          fileSize: buffer.length,
          extractedText: input.extractedText || null,
          category: input.category || "general",
          description: input.description || null,
          descriptionAr: input.descriptionAr || null,
          isActive: true,
          uploadedBy: ctx.user!.id,
        });
        return { id, url };
      }),

    // Admin: List documents
    documents: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAiDocuments();
    }),

    // Admin: Update document
    updateDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        category: z.string().optional(),
        extractedText: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAiDocument(id, data as any);
        return { success: true };
      }),

    // Admin: Delete document
    deleteDocument: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAiDocument(input.id);
        return { success: true };
      }),
  }),

  knowledge: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getKnowledgeArticles(input?.category);
      }),

    all: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE).query(async () => {
      return db.getAllKnowledgeArticles();
    }),

    create: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        category: z.enum(["general", "tenant_guide", "landlord_guide", "admin_guide", "faq", "policy", "troubleshooting"]),
        titleEn: z.string().min(1),
        titleAr: z.string().min(1),
        contentEn: z.string().min(1),
        contentAr: z.string().min(1),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createKnowledgeArticle(input);
        return { id };
      }),

    update: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({
        id: z.number(),
        category: z.enum(["general", "tenant_guide", "landlord_guide", "admin_guide", "faq", "policy", "troubleshooting"]).optional(),
        titleEn: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentAr: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateKnowledgeArticle(id, data as any);
        return { success: true };
      }),

    delete: adminWithPermission(PERMISSIONS.MANAGE_KNOWLEDGE)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteKnowledgeArticle(input.id);
        return { success: true };
      }),

    seed: adminProcedure.mutation(async () => {
      await seedDefaultKnowledgeBase();
      return { success: true };
    }),
    // Admin KB sections from docs/kb/ markdown files
    kbSections: protectedProcedure
      .input(z.object({ lang: z.string().optional() }))
      .query(({ input }) => {
        return getKBSections(input.lang || "ar");
      }),
  }),

  aiStats: router({
    ratingOverview: adminWithPermission(PERMISSIONS.MANAGE_AI).query(async () => {
      const allRated = await sharedDb.select().from(aiMessagesTable).where(
        eqDrizzle(aiMessagesTable.role, 'assistant')
      );
      const rated = allRated.filter(m => m.rating !== null && m.rating !== undefined);
      const total = rated.length;
      if (total === 0) return { totalRated: 0, averageRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      const sum = rated.reduce((acc, m) => acc + (m.rating || 0), 0);
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      rated.forEach(m => { if (m.rating) dist[m.rating] = (dist[m.rating] || 0) + 1; });
      return { totalRated: total, averageRating: Math.round((sum / total) * 10) / 10, distribution: dist };
    }),

    recentRated: adminWithPermission(PERMISSIONS.MANAGE_AI)
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 20;
        const messages = await sharedDb.select().from(aiMessagesTable)
          .where(eqDrizzle(aiMessagesTable.role, 'assistant'))
          .orderBy(aiMessagesTable.createdAt)
          .limit(200);
        return messages.filter(m => m.rating !== null).slice(-limit).reverse();
      }),
  }),

};
