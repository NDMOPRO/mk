/**
 * Payment Handlers for Monthly Key Telegram Bot
 * Integrates Telegram's built-in Payment system (Telegram Payments API)
 *
 * Telegram Payments flow:
 *   1. Bot sends an invoice via sendInvoice()
 *   2. User taps "Pay" button in the invoice message
 *   3. Telegram sends pre_checkout_query to the bot
 *   4. Bot answers the pre_checkout_query (approve or reject)
 *   5. If approved, user completes payment via their payment provider
 *   6. Telegram sends successful_payment message to the bot
 *   7. Bot confirms the booking and notifies the user
 *
 * Provider token is configured via PAYMENT_PROVIDER_TOKEN env var.
 * For testing, use Stripe test token or Telegram's test provider.
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t } = require("../i18n");
const db = require("../services/database");

// Payment provider token from environment
// For Telegram Payments, you need a provider token from @BotFather
// Test mode: use the test token provided by BotFather
const PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || "";

// Currency: SAR (Saudi Riyal) — amounts in smallest unit (halalah = 1/100 SAR)
const CURRENCY = "SAR";

/**
 * Send a Telegram Payment invoice for a booking
 */
async function sendBookingInvoice(ctx, booking, lang) {
  if (!PROVIDER_TOKEN) {
    // If no payment provider is configured, show a message
    await ctx.reply(
      lang === "ar"
        ? "💳 الدفع الإلكتروني غير متاح حالياً. يرجى التواصل مع الدعم لإتمام الدفع.\n\n📞 تواصل معنا عبر الموقع: monthlykey.com"
        : "💳 Online payment is not available at the moment. Please contact support to complete payment.\n\n📞 Contact us via: monthlykey.com",
      { parse_mode: "Markdown" }
    );
    return;
  }

  try {
    const grandTotal = Number(booking.grand_total || 0);
    // Convert SAR to halalah (smallest currency unit) — 1 SAR = 100 halalah
    const amountInHalalah = Math.round(grandTotal * 100);

    if (amountInHalalah <= 0) {
      await ctx.reply(
        lang === "ar"
          ? "❌ مبلغ الحجز غير صالح."
          : "❌ Invalid booking amount."
      );
      return;
    }

    const title = lang === "ar"
      ? `حجز #${booking.id} — ${booking.property_title || "عقار"}`
      : `Booking #${booking.id} — ${booking.property_title || "Property"}`;

    const description = buildInvoiceDescription(booking, lang);

    // Build price breakdown for the invoice
    const prices = buildPriceBreakdown(booking, lang);

    // Send the invoice
    await ctx.replyWithInvoice(
      title,                    // title
      description,              // description
      `booking_${booking.id}`,  // payload (used to identify the booking in callbacks)
      PROVIDER_TOKEN,           // provider_token
      CURRENCY,                 // currency
      prices,                   // prices array
      {
        // Optional parameters
        need_name: true,
        need_phone_number: true,
        need_email: true,
        is_flexible: false,
        // Photo of the property (if available)
        photo_url: undefined,
        photo_width: undefined,
        photo_height: undefined,
        // Start parameter for deep linking
        start_parameter: `pay_booking_${booking.id}`,
        // Provider-specific data (JSON string)
        provider_data: JSON.stringify({
          booking_id: booking.id,
          property_id: booking.property_id,
        }),
      }
    );

    await ctx.reply(t(lang, "paymentInvoiceSent"), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[Payment] Error sending invoice:", error.message);

    // Handle specific Telegram errors
    if (error.message?.includes("PAYMENT_PROVIDER_INVALID")) {
      await ctx.reply(
        lang === "ar"
          ? "❌ مزود الدفع غير مهيأ. يرجى التواصل مع الدعم."
          : "❌ Payment provider is not configured. Please contact support."
      );
    } else {
      await ctx.reply(t(lang, "paymentFailed"));
    }
  }
}

/**
 * Build invoice description text
 */
function buildInvoiceDescription(booking, lang) {
  const rent = Number(booking.monthly_rent || 0).toLocaleString();
  const duration = booking.duration_months || 1;

  if (lang === "ar") {
    return [
      `عقار: ${booking.property_title || "—"}`,
      `تاريخ الدخول: ${booking.check_in_date}`,
      `تاريخ الخروج: ${booking.check_out_date}`,
      `المدة: ${duration} شهر`,
      `الإيجار الشهري: ${rent} ر.س`,
    ].join("\n");
  }

  return [
    `Property: ${booking.property_title || "—"}`,
    `Check-in: ${booking.check_in_date}`,
    `Check-out: ${booking.check_out_date}`,
    `Duration: ${duration} month(s)`,
    `Monthly Rent: ${rent} SAR`,
  ].join("\n");
}

/**
 * Build price breakdown array for Telegram invoice
 * Each item has { label, amount } where amount is in smallest currency unit
 */
function buildPriceBreakdown(booking, lang) {
  const prices = [];

  const totalRent = Number(booking.total_amount || 0);
  const deposit = Number(booking.security_deposit || 0);
  const serviceFee = Number(booking.service_fee || 0);
  const vat = Number(booking.vat_amount || 0);

  if (totalRent > 0) {
    prices.push({
      label: lang === "ar"
        ? `إيجار ${booking.duration_months || 1} شهر`
        : `Rent for ${booking.duration_months || 1} month(s)`,
      amount: Math.round(totalRent * 100),
    });
  }

  if (deposit > 0) {
    prices.push({
      label: lang === "ar" ? "تأمين" : "Security Deposit",
      amount: Math.round(deposit * 100),
    });
  }

  if (serviceFee > 0) {
    prices.push({
      label: lang === "ar" ? "رسوم الخدمة" : "Service Fee",
      amount: Math.round(serviceFee * 100),
    });
  }

  if (vat > 0) {
    prices.push({
      label: lang === "ar" ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)",
      amount: Math.round(vat * 100),
    });
  }

  // If no breakdown items, use grand total as single line
  if (prices.length === 0) {
    const grandTotal = Number(booking.grand_total || 0);
    prices.push({
      label: lang === "ar" ? "إجمالي الحجز" : "Booking Total",
      amount: Math.round(grandTotal * 100),
    });
  }

  return prices;
}

/**
 * Register payment-related handlers on the bot
 */
function registerPaymentHandlers(bot) {
  // ─── Pre-Checkout Query Handler ─────────────────────────────
  // Telegram sends this before processing the payment.
  // The bot MUST answer within 10 seconds.
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      const query = ctx.preCheckoutQuery;
      const payload = query.invoice_payload;

      console.log(`[Payment] Pre-checkout query: ${payload}, from: ${query.from.id}`);

      // Extract booking ID from payload
      const match = payload.match(/^booking_(\d+)$/);
      if (!match) {
        return ctx.answerPreCheckoutQuery(false, "Invalid booking reference.");
      }

      const bookingId = parseInt(match[1]);
      const booking = db.getBooking(bookingId);

      if (!booking) {
        return ctx.answerPreCheckoutQuery(false, "Booking not found.");
      }

      if (booking.chat_id !== query.from.id) {
        return ctx.answerPreCheckoutQuery(false, "Unauthorized payment attempt.");
      }

      if (booking.payment_status === "paid") {
        return ctx.answerPreCheckoutQuery(false, "This booking is already paid.");
      }

      if (booking.status === "cancelled") {
        return ctx.answerPreCheckoutQuery(false, "This booking has been cancelled.");
      }

      // Everything is OK — approve the checkout
      await ctx.answerPreCheckoutQuery(true);
      console.log(`[Payment] Pre-checkout approved for booking #${bookingId}`);
    } catch (error) {
      console.error("[Payment] Pre-checkout error:", error.message);
      try {
        await ctx.answerPreCheckoutQuery(false, "An error occurred. Please try again.");
      } catch (e) {
        console.error("[Payment] Failed to answer pre-checkout:", e.message);
      }
    }
  });

  // ─── Successful Payment Handler ─────────────────────────────
  // Telegram sends this after the payment is successfully processed.
  bot.on("successful_payment", async (ctx) => {
    try {
      const payment = ctx.message.successful_payment;
      const payload = payment.invoice_payload;
      const chatId = ctx.chat.id;
      const lang = db.getUserLanguage(chatId) || "ar";

      console.log(`[Payment] Successful payment: ${payload}`);
      console.log(`[Payment] Amount: ${payment.total_amount} ${payment.currency}`);
      console.log(`[Payment] Provider charge ID: ${payment.provider_payment_charge_id}`);
      console.log(`[Payment] Telegram charge ID: ${payment.telegram_payment_charge_id}`);

      // Extract booking ID
      const match = payload.match(/^booking_(\d+)$/);
      if (!match) {
        console.error("[Payment] Invalid payload in successful payment:", payload);
        return;
      }

      const bookingId = parseInt(match[1]);

      // Update booking payment status
      db.updateBookingPayment(bookingId, {
        paymentStatus: "paid",
        providerPaymentId: payment.provider_payment_charge_id,
        chargeId: payment.telegram_payment_charge_id,
      });

      // Send confirmation
      const booking = db.getBooking(bookingId);
      const grandTotal = Number(booking?.grand_total || 0).toLocaleString();

      const successMsg = lang === "ar"
        ? `✅ *تم الدفع بنجاح!*\n\nشكراً لك! تم تأكيد حجزك رقم *#${bookingId}*.\n\n💰 المبلغ المدفوع: ${grandTotal} ر.س\n📋 الحالة: مؤكد ومدفوع\n\n🔑 شكراً لاستخدامك المفتاح الشهري!`
        : `✅ *Payment Successful!*\n\nThank you! Your booking *#${bookingId}* is confirmed.\n\n💰 Amount paid: ${grandTotal} SAR\n📋 Status: Confirmed & Paid\n\n🔑 Thank you for using Monthly Key!`;

      const buttons = Markup.inlineKeyboard([
        [Markup.button.callback(
          lang === "ar" ? "📋 عرض حجوزاتي" : "📋 View My Bookings",
          "action_mybookings"
        )],
        [Markup.button.url(
          lang === "ar" ? "🌐 الموقع الإلكتروني" : "🌐 Website",
          config.websiteUrl
        )],
      ]);

      await ctx.reply(successMsg, {
        parse_mode: "Markdown",
        ...buttons,
      });

      // Log the payment notification
      db.logNotification(chatId, "payment_success", `Booking #${bookingId} paid`, "sent");
    } catch (error) {
      console.error("[Payment] Error handling successful payment:", error.message);
    }
  });

  // ─── Pay command handler (for paying existing bookings) ─────
  bot.hears(/^\/pay_(\d+)$/, async (ctx) => {
    const bookingId = parseInt(ctx.match[1]);
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const booking = db.getBooking(bookingId);
    if (!booking || booking.chat_id !== ctx.chat.id) {
      return ctx.reply(t(lang, "bookingNotFound"));
    }

    if (booking.payment_status === "paid") {
      return ctx.reply(
        lang === "ar" ? "✅ هذا الحجز مدفوع بالفعل." : "✅ This booking is already paid."
      );
    }

    if (booking.status === "cancelled") {
      return ctx.reply(
        lang === "ar" ? "❌ هذا الحجز ملغي." : "❌ This booking has been cancelled."
      );
    }

    await sendBookingInvoice(ctx, booking, lang);
  });

  // ─── My Bookings callback ──────────────────────────────────
  bot.action("action_mybookings", async (ctx) => {
    await ctx.answerCbQuery();
    const { handleMyBookings } = require("./booking");
    // Create a mock ctx with message for the handler
    await handleMyBookings(ctx);
  });
}

module.exports = {
  sendBookingInvoice,
  registerPaymentHandlers,
  PROVIDER_TOKEN,
  CURRENCY,
};
