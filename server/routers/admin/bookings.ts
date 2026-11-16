import {
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  withTransaction,
  notifyOwner,
  logAudit,
  sendBookingConfirmation,
} from "../_shared";

// admin.* procedures: Booking approval, rejection, reopening and reminders.
export const adminBookingProcedures = {

  bookings: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
    .query(async ({ input }) => {
      const bookingsList = await db.getAllBookings(input.limit, input.offset);
      // Enrich with ledger info and payment config
      let paymentConfigured = false;
      try {
        const { isPaymentConfigured } = await import('../../finance-registry.js');
        const pc = await isPaymentConfigured();
        paymentConfigured = pc.configured;
      } catch { /* ignore */ }
      const enriched = await Promise.all(bookingsList.map(async (b: any) => {
        let ledgerEntries: any[] = [];
        try {
          const { getLedgerByBookingId } = await import('../../finance-registry.js');
          ledgerEntries = await getLedgerByBookingId(b.id);
        } catch { /* ignore */ }
        return { ...b, ledgerEntries, paymentConfigured };
      }));
      return enriched;
    }),

  approveBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
    .input(z.object({ id: z.number(), landlordNotes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      if (booking.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending bookings can be approved' });
      // TRANSACTION: booking update + payment creation must be atomic
      const paymentId = await withTransaction(async () => {
        await db.updateBooking(input.id, { status: 'approved', landlordNotes: input.landlordNotes });
        const pid = await db.createPayment({
          bookingId: input.id,
          tenantId: booking.tenantId,
          landlordId: booking.landlordId,
          type: 'rent',
          amount: String(booking.totalAmount),
          status: 'pending',
          description: `Payment for booking #${input.id}`,
          descriptionAr: `دفعة الحجز رقم #${input.id}`,
        });
        return pid;
      });
      // Notify tenant: booking approved + bill ready (outside tx — best-effort)
      await db.createNotification({
        userId: booking.tenantId,
        type: 'booking_approved',
        titleEn: 'Booking Approved - Payment Required',
        titleAr: 'تم قبول الحجز - يرجى الدفع',
        contentEn: `Your booking #${input.id} has been approved. Please proceed to payment to confirm your reservation.`,
        contentAr: `تم قبول حجزك رقم #${input.id}. يرجى إتمام الدفع لتأكيد الحجز.`,
        relatedId: input.id,
        relatedType: 'booking',
      });
      // Email notification
      try {
        const tenant = await db.getUserById(booking.tenantId);
        const prop = await db.getPropertyById(booking.propertyId);
        if (tenant?.email && prop) {
          await sendBookingConfirmation({
            tenantEmail: tenant.email,
            tenantName: tenant.displayName || tenant.name || '',
            propertyTitle: prop.titleAr || prop.titleEn,
            checkIn: String(booking.moveInDate),
            checkOut: String(booking.moveOutDate),
            totalAmount: Number(booking.totalAmount),
            bookingId: input.id,
          });
        }
      } catch { /* email is best-effort */ }
      await notifyOwner({ title: `تم قبول الحجز #${input.id}`, content: `تم قبول الحجز وإرسال الفاتورة للمستأجر` });
      return { success: true, paymentId };
    }),

  rejectBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
    .input(z.object({ id: z.number(), rejectionReason: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      if (booking.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only pending bookings can be rejected' });
      await db.updateBooking(input.id, { status: 'rejected', rejectionReason: input.rejectionReason });
      // VOID all DUE ledger entries for this booking
      try {
        const { voidLedgerByBookingId } = await import('../../finance-registry.js');
        const voided = await voidLedgerByBookingId(input.id, input.rejectionReason);
        console.log(`[Ledger] Voided ${voided} entries for rejected booking #${input.id}`);
      } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to void entries on rejection', error: (e as Error).message }) + '\n'); }
      // Cancel availability block if one exists
      try {
        const { cancelBookingBlock } = await import('../../availability-blocks.js');
        await cancelBookingBlock(input.id, `Rejected: ${input.rejectionReason}`);
      } catch { /* block may not exist for pending bookings */ }
      // Outbound Beds24 sync: cancel in Beds24 if applicable
      try {
        const { cancelBookingInBeds24 } = await import('../../beds24-sync.js');
        await cancelBookingInBeds24(input.id);
      } catch { /* best effort */ }
      await db.createNotification({
        userId: booking.tenantId,
        type: 'booking_rejected',
        titleEn: 'Booking Rejected',
        titleAr: 'تم رفض الحجز',
        contentEn: `Your booking #${input.id} has been rejected. Reason: ${input.rejectionReason}`,
        contentAr: `تم رفض حجزك رقم #${input.id}. السبب: ${input.rejectionReason}`,
        relatedId: input.id,
        relatedType: 'booking',
      });
      await notifyOwner({ title: `تم رفض الحجز #${input.id}`, content: `السبب: ${input.rejectionReason}` });
      return { success: true };
    }),

  // ── Reopen Booking (rejected/cancelled → pending or approved) ────
  reopenBooking: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
    .input(z.object({
      id: z.number(),
      targetStatus: z.enum(['pending', 'approved']),
      adminNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await db.getBookingById(input.id);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      if (!['rejected', 'cancelled'].includes(booking.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Cannot reopen a booking with status "${booking.status}". Only rejected or cancelled bookings can be reopened.` });
      }
      // Update booking status
      await db.updateBooking(input.id, {
        status: input.targetStatus,
        landlordNotes: input.adminNotes ? `${booking.landlordNotes || ''}\n[Reopened] ${input.adminNotes}` : booking.landlordNotes,
        rejectionReason: null as any,
      });
      // Un-void DUE/PENDING ledger entries (restore them from VOID back to DUE)
      try {
        const { getPool } = await import('../../db.js');
        const pool = getPool();
        if (pool) {
          await pool.execute(
            `UPDATE payment_ledger SET status = 'DUE', notes = CONCAT(COALESCE(notes,''), '\n[Reopened by admin]') WHERE bookingId = ? AND status = 'VOID'`,
            [input.id]
          );
        }
      } catch { /* ledger restore is best-effort */ }
      // Re-create availability block if moving to approved
      if (input.targetStatus === 'approved') {
        try {
          const { createBookingBlock } = await import('../../availability-blocks.js');
          const prop = await db.getPropertyById(booking.propertyId);
          await createBookingBlock({
            propertyId: booking.propertyId,
            unitId: (booking as any).unitId || undefined,
            bookingId: input.id,
            startDate: new Date(booking.moveInDate).toISOString().split('T')[0],
            endDate: new Date(booking.moveOutDate).toISOString().split('T')[0],
          });
        } catch { /* block creation is best-effort */ }
        // Create payment record if approving directly
        try {
          await db.createPayment({
            bookingId: input.id,
            tenantId: booking.tenantId,
            landlordId: booking.landlordId,
            type: 'rent',
            amount: String(booking.totalAmount),
            status: 'pending',
            description: `Payment for booking #${input.id} (reopened)`,
            descriptionAr: `دفعة الحجز رقم #${input.id} (أعيد فتحه)`,
          });
        } catch { /* payment creation is best-effort */ }
      }
      // Notify tenant
      await db.createNotification({
        userId: booking.tenantId,
        type: 'booking_approved',
        titleEn: input.targetStatus === 'approved' ? 'Booking Reopened & Approved' : 'Booking Reopened',
        titleAr: input.targetStatus === 'approved' ? 'تم إعادة فتح الحجز والموافقة عليه' : 'تم إعادة فتح الحجز',
        contentEn: `Your booking #${input.id} has been reopened by admin.`,
        contentAr: `تم إعادة فتح حجزك رقم #${input.id} بواسطة المسؤول.`,
        relatedId: input.id,
        relatedType: 'booking',
      });
      // Audit log
      try {
        const { logAudit } = await import('../../audit-log.js');
        await logAudit({
          userId: ctx.user?.id, userName: ctx.user?.name || ctx.user?.email || 'admin',
          action: 'UPDATE', entityType: 'BOOKING', entityId: input.id,
          entityLabel: `Booking #${input.id}`,
          metadata: { previousStatus: booking.status, newStatus: input.targetStatus, adminNotes: input.adminNotes },
        });
      } catch { /* audit is best-effort */ }
      await notifyOwner({ title: `تم إعادة فتح الحجز #${input.id}`, content: `الحالة الجديدة: ${input.targetStatus}${input.adminNotes ? `\nملاحظات: ${input.adminNotes}` : ''}` });
      return { success: true };
    }),

  sendBillReminder: adminWithPermission(PERMISSIONS.MANAGE_BOOKINGS)
    .input(z.object({ bookingId: z.number() }))
    .mutation(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      if (booking.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only send reminders for approved bookings awaiting payment' });
      await db.createNotification({
        userId: booking.tenantId,
        type: 'payment_due',
        titleEn: 'Payment Reminder',
        titleAr: 'تذكير بالدفع',
        contentEn: `Reminder: Your booking #${input.bookingId} is awaiting payment. Total: ${booking.totalAmount} SAR.`,
        contentAr: `تذكير: حجزك رقم #${input.bookingId} بانتظار الدفع. المبلغ: ${booking.totalAmount} ريال.`,
        relatedId: input.bookingId,
        relatedType: 'booking',
      });
      return { success: true };
    }),
};
