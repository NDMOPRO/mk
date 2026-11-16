import {
  TRPCError,
  z,
  adminWithPermission,
  PERMISSIONS,
  db,
  withTransaction,
  notifyOwner,
  logAudit,
  sendPaymentReceipt,
} from "../_shared";

// admin.* procedures: Refunds, payment confirmation and payment lists.
export const adminPaymentProcedures = {

  // ── Calculate Refund (read-only, no side effects) ────────────────
  calculateRefund: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      // Get all PAID ledger entries for this booking
      let ledgerEntries: any[] = [];
      try {
        const { getLedgerByBookingId } = await import('../../finance-registry.js');
        ledgerEntries = await getLedgerByBookingId(input.bookingId);
      } catch { /* no ledger */ }
      const paidEntries = ledgerEntries.filter((e: any) => e.status === 'PAID' && e.direction === 'IN');
      const totalPaid = paidEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      const refundedEntries = ledgerEntries.filter((e: any) => e.type === 'REFUND');
      const totalRefunded = refundedEntries.reduce((sum: number, e: any) => sum + Math.abs(Number(e.amount)), 0);
      // Calculate prorated refund based on days used
      const moveIn = new Date(booking.moveInDate);
      const moveOut = new Date(booking.moveOutDate);
      const now = new Date();
      const totalDays = Math.max(1, Math.ceil((moveOut.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24)));
      const daysUsed = now < moveIn ? 0 : Math.min(totalDays, Math.ceil((now.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24)));
      const daysRemaining = totalDays - daysUsed;
      const dailyRate = totalPaid / totalDays;
      const proratedRefund = Math.round(dailyRate * daysRemaining * 100) / 100;
      const maxRefundable = Math.max(0, totalPaid - totalRefunded);
      // Price breakdown from booking if available
      const breakdown = (booking as any).priceBreakdown || null;
      return {
        bookingId: input.bookingId,
        bookingStatus: booking.status,
        totalAmount: Number(booking.totalAmount),
        totalPaid,
        totalRefunded,
        maxRefundable,
        moveInDate: booking.moveInDate,
        moveOutDate: booking.moveOutDate,
        totalDays,
        daysUsed,
        daysRemaining,
        dailyRate: Math.round(dailyRate * 100) / 100,
        proratedRefund: Math.min(proratedRefund, maxRefundable),
        breakdown,
        paidEntries: paidEntries.map((e: any) => ({ id: e.id, invoiceNumber: e.invoiceNumber, amount: Number(e.amount), type: e.type, paidAt: e.paidAt })),
        refundedEntries: refundedEntries.map((e: any) => ({ id: e.id, invoiceNumber: e.invoiceNumber, amount: Number(e.amount), createdAt: e.createdAt })),
        currency: breakdown?.currency || 'SAR',
      };
    }),

  // ── Record Refund (manual — creates ledger entry only, no API call) ──
  recordRefund: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
    .input(z.object({
      bookingId: z.number(),
      amount: z.number().positive(),
      reason: z.string().min(5, 'Refund reason must be at least 5 characters'),
      refundMethod: z.enum(['bank_transfer', 'cash', 'original_payment_method']).default('bank_transfer'),
      cancelBooking: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      // Validate refund amount against max refundable
      let totalPaid = 0;
      let totalRefunded = 0;
      try {
        const { getLedgerByBookingId } = await import('../../finance-registry.js');
        const entries = await getLedgerByBookingId(input.bookingId);
        totalPaid = entries.filter((e: any) => e.status === 'PAID' && e.direction === 'IN').reduce((s: number, e: any) => s + Number(e.amount), 0);
        totalRefunded = entries.filter((e: any) => e.type === 'REFUND').reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);
      } catch { /* ignore */ }
      const maxRefundable = totalPaid - totalRefunded;
      if (input.amount > maxRefundable + 0.01) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Refund amount (${input.amount}) exceeds max refundable (${maxRefundable.toFixed(2)})` });
      }
      // Create REFUND ledger entry (direction: OUT)
      let refundLedgerId: number | undefined;
      try {
        const { createLedgerEntry } = await import('../../finance-registry.js');
        ({ id: refundLedgerId } = await createLedgerEntry({
          bookingId: input.bookingId,
          unitId: (booking as any).unitId || undefined,
          unitNumber: undefined,
          buildingId: (booking as any).buildingId || undefined,
          propertyDisplayName: undefined,
          type: 'REFUND',
          direction: 'OUT',
          amount: String(input.amount),
          currency: (booking as any).priceBreakdown?.currency || 'SAR',
          status: 'PAID',
          paymentMethod: input.refundMethod === 'original_payment_method' ? undefined : (input.refundMethod === 'bank_transfer' ? 'BANK_TRANSFER' : 'CASH') as any,
          provider: 'manual' as any,
          paidAt: new Date(),
          dueAt: new Date(),
          createdBy: ctx.user?.id,
          notes: `REFUND: ${input.reason} (recorded by ${ctx.user?.name || ctx.user?.email || 'admin'})`,
        }));
      } catch (e) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create refund ledger entry: ${(e as Error).message}` });
      }
      // Optionally cancel the booking
      if (input.cancelBooking) {
        await db.updateBooking(input.bookingId, { status: 'cancelled' });
        try {
          const { cancelBookingBlock } = await import('../../availability-blocks.js');
          await cancelBookingBlock(input.bookingId, `Refund processed: ${input.reason}`);
        } catch { /* best-effort */ }
      }
      // Audit log
      try {
        const { logAudit } = await import('../../audit-log.js');
        await logAudit({
          userId: ctx.user?.id, userName: ctx.user?.name || ctx.user?.email || 'admin',
          action: 'CREATE', entityType: 'PAYMENT', entityId: refundLedgerId || input.bookingId,
          entityLabel: `Refund for Booking #${input.bookingId}`,
          metadata: { amount: input.amount, reason: input.reason, method: input.refundMethod, cancelBooking: input.cancelBooking },
        });
      } catch { /* audit is best-effort */ }
      // Notify tenant
      await db.createNotification({
        userId: booking.tenantId,
        type: 'booking_approved',
        titleEn: 'Refund Processed',
        titleAr: 'تم معالجة الاسترداد',
        contentEn: `A refund of ${input.amount} SAR has been recorded for booking #${input.bookingId}. The refund will be processed via ${input.refundMethod.replace('_', ' ')}.`,
        contentAr: `تم تسجيل استرداد بمبلغ ${input.amount} ر.س للحجز رقم #${input.bookingId}. سيتم معالجة الاسترداد عبر ${input.refundMethod === 'bank_transfer' ? 'تحويل بنكي' : input.refundMethod === 'cash' ? 'نقدي' : 'طريقة الدفع الأصلية'}.`,
        relatedId: input.bookingId,
        relatedType: 'booking',
      });
      await notifyOwner({ title: `تم تسجيل استرداد للحجز #${input.bookingId}`, content: `المبلغ: ${input.amount} ر.س\nالسبب: ${input.reason}\nالطريقة: ${input.refundMethod}` });
      return { success: true, refundLedgerId };
    }),

  // Check if payment override is enabled (for admin UI)
  isOverrideEnabled: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
    .query(async () => {
      const settings = await db.getAllSettings();
      return {
        enabled: settings['payment.enableOverride'] === 'true',
      };
    }),

  confirmPayment: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS_OVERRIDE)
    .input(z.object({
      bookingId: z.number(),
      paymentMethod: z.enum(['paypal', 'cash', 'bank_transfer']).optional(),
      reason: z.string().min(10, 'Override reason must be at least 10 characters'),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check override flag is enabled
      const settings = await db.getAllSettings();
      if (settings['payment.enableOverride'] !== 'true') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Payment override is disabled. Enable it in Settings > Payment to use this feature.' });
      }
      
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      if (booking.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only approved bookings can have payment confirmed' });
      
      // TRANSACTION: booking status + payment updates must be atomic
      await withTransaction(async () => {
        await db.updateBooking(input.bookingId, { status: 'active' });
        const bookingPayments = await db.getPaymentsByBooking(input.bookingId);
        for (const p of bookingPayments) {
          if (p.status === 'pending') {
            await db.updatePaymentStatus(p.id, 'completed', new Date());
            if (input.paymentMethod) {
              await db.updatePayment(p.id, { paymentMethod: input.paymentMethod });
            }
          }
        }
      });
      // Mark ledger entries as PAID
      let ledgerIds: number[] = [];
      try {
        const { getLedgerByBookingId, updateLedgerStatusSafe } = await import('../../finance-registry.js');
        const ledgerEntries = await getLedgerByBookingId(input.bookingId);
        for (const le of ledgerEntries) {
          if (le.status === 'DUE' || le.status === 'PENDING') {
            await updateLedgerStatusSafe(le.id, 'PAID', {
              paymentMethod: (input.paymentMethod === 'cash' ? 'CASH' : input.paymentMethod === 'bank_transfer' ? 'BANK_TRANSFER' : undefined) as any,
              provider: 'manual_override',
              webhookVerified: true, // admin-confirmed = trusted
            });
            ledgerIds.push(le.id);
          }
        }
      } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'ledger', msg: 'Failed to mark ledger PAID on payment confirmation', error: (e as Error).message }) + '\n'); }
      
      // ── AUDIT LOG: Record the manual override ──
      try {
        const { logAudit } = await import('../../audit-log.js');
        await logAudit({
          userId: ctx.user.id,
          userName: ctx.user.displayName || ctx.user.name || 'Admin',
          action: 'UPDATE',
          entityType: 'LEDGER',
          entityId: input.bookingId,
          entityLabel: `Manual payment override for booking #${input.bookingId}`,
          changes: {
            bookingStatus: { old: 'approved', new: 'active' },
            ledgerStatus: { old: 'DUE', new: 'PAID' },
            overrideReason: { old: null, new: input.reason },
          },
          metadata: {
            overrideType: 'manual_payment_confirmation',
            bookingId: input.bookingId,
            ledgerIds,
            paymentMethod: input.paymentMethod || 'unspecified',
            reason: input.reason,
            notes: input.notes || null,
          },
        });
      } catch (e) { console.error('[Audit] Failed to log payment override', e); }
      
      // ── Create availability block for occupancy tracking ──
      try {
        const { createBookingBlock } = await import('../../availability-blocks.js');
        const startDate = booking.moveInDate ? new Date(booking.moveInDate).toISOString().split('T')[0] : null;
        const endDate = booking.moveOutDate ? new Date(booking.moveOutDate).toISOString().split('T')[0] : null;
        if (startDate && endDate) {
          await createBookingBlock({
            propertyId: booking.propertyId,
            unitId: (booking as any).unitId || undefined,
            bookingId: input.bookingId,
            startDate,
            endDate,
            source: 'LOCAL',
          });
        }
      } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'availability', msg: 'Failed to create availability block', error: (e as Error).message }) + '\n'); }
      
      // ── Outbound Beds24 sync: push booking to Beds24 if unit is LOCAL-controlled ──
      try {
        const { pushBookingToBeds24 } = await import('../../beds24-sync.js');
        await pushBookingToBeds24(input.bookingId);
      } catch (e) { process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: 'error', component: 'beds24-sync', msg: 'Failed to push booking to Beds24', error: (e as Error).message }) + '\n'); }
      
      // Notify tenant: payment confirmed (outside tx — best-effort)
      await db.createNotification({
        userId: booking.tenantId,
        type: 'payment_received',
        titleEn: 'Payment Confirmed - Booking Active',
        titleAr: 'تم تأكيد الدفع - الحجز نشط الآن',
        contentEn: `Payment for booking #${input.bookingId} has been confirmed (admin override). Your booking is now active!`,
        contentAr: `تم تأكيد دفعة الحجز رقم #${input.bookingId} (تأكيد يدوي). حجزك نشط الآن!`,
        relatedId: input.bookingId,
        relatedType: 'booking',
      });
      // Send payment receipt email
      try {
        const tenant = await db.getUserById(booking.tenantId);
        if (tenant?.email) {
          await sendPaymentReceipt({
            tenantEmail: tenant.email,
            tenantName: tenant.displayName || tenant.name || '',
            amount: Number(booking.totalAmount),
            bookingId: input.bookingId,
            paymentMethod: input.paymentMethod || 'cash',
          });
        }
      } catch { /* email is best-effort */ }
      await notifyOwner({ title: `⚠️ تأكيد دفع يدوي للحجز #${input.bookingId}`, content: `السبب: ${input.reason}` });
      return { success: true, overrideLogged: true };
    }),

  allPayments: adminWithPermission(PERMISSIONS.MANAGE_PAYMENTS)
    .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getAllPayments(input.limit, input.offset);
    }),
};
