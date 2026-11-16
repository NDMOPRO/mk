import {
  router,
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  sendTaqnyatWhatsAppText,
  formatPhoneForTaqnyat,
} from "../_shared";

// waInbox.* procedures: WhatsApp inbox (inbound conversation routing).
export const waInboxRouter = router({
  // List conversations for admin inbox
  list: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listWaConversations({
        status: input?.status,
        search: input?.search,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),

  // Get a single conversation with its messages
  get: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const conversation = await db.getWaConversation(input.id);
      if (!conversation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
      const messages = await db.getWaMessages(input.id, 200);
      // Mark as read when admin opens it
      await db.markWaConversationRead(input.id);
      return { conversation, messages };
    }),

  // Get messages for a conversation (paginated)
  messages: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      conversationId: z.number(),
      limit: z.number().min(1).max(200).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input }) => {
      return db.getWaMessages(input.conversationId, input.limit ?? 100, input.offset ?? 0);
    }),

  // Reply to a conversation (send outbound message via Taqnyat)
  reply: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await db.getWaConversation(input.conversationId);
      if (!conversation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });

      // Check 24-hour window
      if (conversation.lastInboundAt) {
        const hoursSinceLastInbound = (Date.now() - new Date(conversation.lastInboundAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastInbound > 24) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'نافذة الـ 24 ساعة انتهت. لا يمكن الرد إلا خلال 24 ساعة من آخر رسالة واردة. استخدم قالب رسالة بدلاً من ذلك.',
          });
        }
      }

      // Send via Taqnyat conversation API
      const phoneForApi = formatPhoneForTaqnyat(conversation.contactPhone);
      const sendResult = await sendTaqnyatWhatsAppText(phoneForApi, input.content);

      if (!sendResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `فشل إرسال الرسالة: ${sendResult.error}`,
        });
      }

      // Store outbound message
      const adminName = ctx.user?.name || ctx.user?.displayName || `Admin #${ctx.user?.id}`;
      const msgId = await db.addOutboundWaMessage({
        conversationId: input.conversationId,
        content: input.content,
        sentById: ctx.user!.id,
        sentByName: adminName,
        taqnyatMessageId: sendResult.messageId?.toString(),
      });

      return { success: true, messageId: msgId, taqnyatMessageId: sendResult.messageId };
    }),

  // Update conversation (status, assignment, priority, etc.)
  update: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({
      id: z.number(),
      status: z.enum(['open', 'assigned', 'resolved', 'closed']).optional(),
      assignedTo: z.number().nullable().optional(),
      assignedToName: z.string().nullable().optional(),
      priority: z.enum(['normal', 'high', 'urgent']).optional(),
      subject: z.string().max(255).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateWaConversation(input.id, {
        status: input.status,
        assignedTo: input.assignedTo,
        assignedToName: input.assignedToName,
        priority: input.priority,
        subject: input.subject,
        tags: input.tags,
      });
      return { success: true };
    }),

  // Get unread count for badge
  unreadCount: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .query(async () => {
      const total = await db.getWaUnreadTotal();
      return { count: total };
    }),

  // Mark conversation as read
  markRead: adminWithPermission(PERMISSIONS.MANAGE_SETTINGS)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.markWaConversationRead(input.id);
      return { success: true };
    }),
});
