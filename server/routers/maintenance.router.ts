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

// Domain: maintenance
// Extracted from server/routers.ts — DO NOT modify procedure names/shapes

export const maintenanceRouterDefs = {
  emergencyMaintenance: router({
    // Tenant: submit emergency request
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(), bookingId: z.number().optional(),
        urgency: z.enum(["low", "medium", "high", "critical"]),
        category: z.enum(["plumbing", "electrical", "ac_heating", "appliance", "structural", "pest", "security", "other"]),
        title: z.string().min(1), titleAr: z.string().optional(),
        description: z.string().min(1), descriptionAr: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createEmergencyMaintenance({ ...input, tenantId: ctx.user.id } as any);
        const urgencyLabel = { low: "منخفض", medium: "متوسط", high: "عالي", critical: "حرج" }[input.urgency];
        await notifyOwner({
          title: `🚨 طلب صيانة طوارئ - ${urgencyLabel} / Emergency Maintenance - ${input.urgency.toUpperCase()}`,
          content: `المستأجر: ${ctx.user.displayName || ctx.user.name}\nالعنوان: ${input.title}\nالأولوية: ${urgencyLabel}\nالتصنيف: ${input.category}\n\n${input.description}`,
        });
        // Send email alert to admins about new maintenance request
        try {
          const allUsers = await db.getAllUsers(100, 0);
          const admins = allUsers.filter((u: any) => u.role === 'admin');
          for (const admin of admins) {
            if (admin.email) {
              await sendNewMaintenanceAlert({
                adminEmail: admin.email,
                tenantName: ctx.user.displayName || ctx.user.name || "",
                ticketId: (result as any).insertId || 0,
                title: input.title,
                urgency: input.urgency,
                category: input.category,
                description: input.description,
                imageCount: input.imageUrls?.length || 0,
              });
            }
          }
        } catch { /* email is best-effort */ }
        return result;
      }),
    // Tenant: upload maintenance media (images/videos) to S3
    uploadMedia: protectedProcedure
      .input(z.object({ base64: z.string().max(MAX_BASE64_SIZE), filename: z.string().max(255), contentType: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!validateContentType(input.contentType)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid file type' });
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `maintenance/${ctx.user.id}/${nanoid()}.${ext}`;
        const buffer = Buffer.from(input.base64, 'base64');
        const { url } = await storagePut(key, buffer, input.contentType);
        return { url };
      }),
    // Tenant: my emergency requests
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEmergencyMaintenanceByTenant(ctx.user.id);
    }),
    // Admin: all emergency requests
    listAll: adminWithPermission(PERMISSIONS.MANAGE_MAINTENANCE).query(async () => {
      return await db.getAllEmergencyMaintenance();
    }),
    // Get single request with updates (owner or admin only)
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const ticket = await db.getEmergencyMaintenanceById(input.id);
        if (!ticket) return { ticket: null, updates: [] };
        if (ticket.tenantId !== ctx.user.id && ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        const updates = await db.getMaintenanceUpdates(input.id);
        return { ticket, updates };
      }),
    // Admin: update status and add update message
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_MAINTENANCE)
      .input(z.object({
        id: z.number(),
        status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
        message: z.string().min(1), messageAr: z.string().optional(),
        assignedTo: z.string().optional(), assignedPhone: z.string().optional(),
        resolution: z.string().optional(), resolutionAr: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: any = { status: input.status };
        if (input.assignedTo) updateData.assignedTo = input.assignedTo;
        if (input.assignedPhone) updateData.assignedPhone = input.assignedPhone;
        if (input.resolution) updateData.resolution = input.resolution;
        if (input.resolutionAr) updateData.resolutionAr = input.resolutionAr;
        if (input.status === "closed" || input.status === "resolved") updateData.closedAt = new Date();
        await db.updateEmergencyMaintenance(input.id, updateData);
        await db.createMaintenanceUpdate({
          maintenanceId: input.id,
          message: input.message,
          messageAr: input.messageAr || undefined,
          updatedBy: ctx.user!.displayName || ctx.user!.name || "Admin",
          newStatus: input.status,
        } as any);
        // Notify owner about status change
        const statusLabels: Record<string, string> = { open: "مفتوح", assigned: "تم التعيين", in_progress: "قيد التنفيذ", resolved: "تم الحل", closed: "مغلق" };
        await notifyOwner({
          title: `تحديث صيانة #${input.id} - ${statusLabels[input.status]} / Maintenance Update`,
          content: `الحالة: ${statusLabels[input.status]}\n${input.message}`,
        });
        // Send email to tenant about maintenance update
        try {
          const ticket = await db.getEmergencyMaintenanceById(input.id);
          if (ticket) {
            const tenant = await db.getUserById(ticket.tenantId);
            if (tenant?.email) {
              await sendMaintenanceUpdate({
                tenantEmail: tenant.email,
                tenantName: tenant.displayName || tenant.name || "",
                ticketId: input.id,
                title: ticket.titleAr || ticket.title,
                status: input.status,
                message: input.messageAr || input.message,
              });
            }
          }
        } catch { /* email is best-effort */ }
        return { success: true };
      }),
  }),

  services: router({
    // Admin: list all services
    listAll: adminWithPermission(PERMISSIONS.MANAGE_SERVICES).query(async () => {
      return await db.getAllPlatformServices();
    }),
    // Public: list active services
    listActive: publicProcedure.query(async () => {
      return await db.getActivePlatformServices();
    }),
    // Admin: create service
    create: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        nameAr: z.string().min(1), nameEn: z.string().min(1),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string(), category: z.enum(["cleaning", "maintenance", "furniture", "moving", "other"]),
        icon: z.string().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createPlatformService(input as any);
      }),
    // Admin: update service
    update: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        id: z.number(),
        nameAr: z.string().optional(), nameEn: z.string().optional(),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string().optional(), category: z.enum(["cleaning", "maintenance", "furniture", "moving", "other"]).optional(),
        icon: z.string().optional(), isActive: z.boolean().optional(), sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePlatformService(id, data as any);
        return { success: true };
      }),
    // Admin: delete service
    delete: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlatformService(input.id);
        return { success: true };
      }),
  }),

  serviceRequests: router({
    // Tenant: request a service
    create: protectedProcedure
      .input(z.object({
        serviceId: z.number(), bookingId: z.number().optional(),
        propertyId: z.number().optional(), notes: z.string().optional(),
        totalPrice: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.createServiceRequest({ ...input, tenantId: ctx.user.id } as any);
        await notifyOwner({ title: "طلب خدمة جديد / New Service Request", content: `طلب خدمة جديد من المستأجر ${ctx.user.displayName || ctx.user.name}\nService #${input.serviceId} - ${input.totalPrice} SAR` });
        return result;
      }),
    // Tenant: my requests
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getServiceRequestsByTenant(ctx.user.id);
    }),
    // Admin: all requests
    listAll: adminWithPermission(PERMISSIONS.MANAGE_SERVICES).query(async () => {
      return await db.getAllServiceRequests();
    }),
    // Admin: update request status
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_SERVICES)
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "approved", "in_progress", "completed", "cancelled"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateServiceRequest(input.id, { status: input.status, adminNotes: input.adminNotes } as any);
        return { success: true };
      }),
  }),

  inspection: router({
    create: protectedProcedure
      .input(z.object({
        propertyId: z.number(),
        requestedDate: z.string(),
        requestedTimeSlot: z.string(),
        fullName: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const manager = await db.getPropertyManagerByProperty(input.propertyId);
        const id = await db.createInspectionRequest({
          ...input,
          userId: ctx.user.id,
          managerId: manager?.id || null,
          requestedDate: new Date(input.requestedDate),
        } as any);
        return { success: true, id };
      }),
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserInspectionRequests(ctx.user.id);
    }),
    listAll: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getAllInspectionRequests(input?.status);
      }),
    updateStatus: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateInspectionStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),
    getTimeSlots: publicProcedure.query(async () => {
      const settings = await db.getAllSettings();
      const slotsStr = settings['inspection.timeSlots'];
      return slotsStr ? JSON.parse(slotsStr) : [
        "09:00-10:00", "10:00-11:00", "11:00-12:00",
        "14:00-15:00", "15:00-16:00", "16:00-17:00"
      ];
    }),
  }),

};
