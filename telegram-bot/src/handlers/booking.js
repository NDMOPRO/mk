/**
 * Booking Handlers for Monthly Key Telegram Bot
 * Implements the complete booking flow:
 *   1. Select city -> Search properties
 *   2. Select a property from results
 *   3. Enter check-in date
 *   4. Enter check-out date
 *   5. Review booking summary with cost breakdown
 *   6. Confirm or cancel
 *   7. Payment prompt
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t } = require("../i18n");
const db = require("../services/database");
const api = require("../services/api");

// Fee constants (aligned with main platform)
const DEPOSIT_PERCENT = 10; // 10% security deposit
const SERVICE_FEE_PERCENT = 5; // 5% service fee
const VAT_PERCENT = 15; // 15% VAT

/**
 * Calculate booking costs
 */
function calculateBookingCost(monthlyRent, durationMonths) {
  const totalRent = monthlyRent * durationMonths;
  const securityDeposit = Math.round(monthlyRent * (DEPOSIT_PERCENT / 100));
  const serviceFee = Math.round(totalRent * (SERVICE_FEE_PERCENT / 100));
  const subtotal = totalRent + securityDeposit + serviceFee;
  const vatAmount = Math.round(serviceFee * (VAT_PERCENT / 100));
  const grandTotal = subtotal + vatAmount;

  return {
    totalRent,
    securityDeposit,
    serviceFee,
    vatAmount,
    grandTotal,
  };
}

/**
 * Calculate duration in months between two dates
 */
function calculateDurationMonths(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  // Round to nearest month (30 days)
  return Math.max(1, Math.round(diffDays / 30));
}

/**
 * Validate date string in YYYY-MM-DD format
 */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) return false;
  // Verify the date components match (catches invalid dates like 2026-02-30)
  const [y, m, d] = dateStr.split("-").map(Number);
  return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
}

/**
 * Check if a date is in the past
 */
function isDateInPast(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * /book command handler — Start booking flow
 */
async function handleBook(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";

  // Check if there's a property ID after /book
  const text = ctx.message.text;
  const propertyIdStr = text.replace(/^\/book\s*/, "").trim();

  if (propertyIdStr && !isNaN(propertyIdStr)) {
    // Direct booking for a specific property
    return startBookingForProperty(ctx, parseInt(propertyIdStr), lang);
  }

  // Show city selection for booking
  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, "btnRiyadh"), "book_city_riyadh")],
    [Markup.button.callback(t(lang, "btnJeddah"), "book_city_jeddah")],
    [Markup.button.callback(t(lang, "btnMadinah"), "book_city_madinah")],
  ]);

  await ctx.reply(t(lang, "bookingStart"), {
    parse_mode: "Markdown",
    ...buttons,
  });
}

/**
 * Start booking for a specific property
 */
async function startBookingForProperty(ctx, propertyId, lang) {
  try {
    const property = await api.getPropertyById(propertyId);
    if (!property) {
      return ctx.reply(t(lang, "noResults"));
    }

    // Store property selection in session
    if (!ctx.session) ctx.session = {};
    ctx.session.booking = {
      propertyId: property.id,
      propertyTitle: lang === "ar" ? (property.titleAr || property.titleEn) : (property.titleEn || property.titleAr),
      propertyCity: lang === "ar" ? (property.cityAr || property.city) : (property.city || property.cityAr),
      monthlyRent: Number(property.monthlyRent || 0),
      step: "check_in",
    };

    const formatted = api.formatProperty(property, lang);
    if (formatted) {
      await ctx.reply(
        `${t(lang, "bookingPropertySelected")}\n\n${formatted.text}`,
        { parse_mode: "Markdown" }
      );
    }

    await ctx.reply(t(lang, "bookingEnterCheckIn"), {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true },
    });
  } catch (error) {
    console.error("[Booking] Error starting booking:", error.message);
    await ctx.reply(t(lang, "error"));
  }
}

/**
 * /mybookings command handler
 */
async function handleMyBookings(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";
  const bookings = db.getUserBookings(ctx.chat.id, 10);

  if (!bookings || bookings.length === 0) {
    return ctx.reply(t(lang, "myBookingsEmpty"), { parse_mode: "Markdown" });
  }

  let message = t(lang, "myBookingsTitle") + "\n\n";

  for (const booking of bookings) {
    const statusKey = {
      pending: "bookingStatusPending",
      confirmed: "bookingStatusConfirmed",
      cancelled: "bookingStatusCancelled",
      active: "bookingStatusActive",
      completed: "bookingStatusCompleted",
    }[booking.status] || "bookingStatusPending";

    const paymentKey = booking.payment_status === "paid" 
      ? "bookingPaymentPaid" 
      : "bookingPaymentUnpaid";

    const rent = Number(booking.grand_total || 0).toLocaleString();

    message += `━━━━━━━━━━━━━━━\n`;
    message += `📋 *#${booking.id}* — ${booking.property_title || "Property"}\n`;
    message += `📅 ${booking.check_in_date} → ${booking.check_out_date}\n`;
    message += `💰 ${rent} ${t(lang, "sar")}\n`;
    message += `${t(lang, statusKey)} | ${t(lang, paymentKey)}\n`;

    if (booking.status === "pending" && booking.payment_status === "unpaid") {
      message += `💳 /pay\\_${booking.id}\n`;
    }
    message += "\n";
  }

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(
      lang === "ar" ? "📋 حجز جديد" : "📋 New Booking",
      "action_book"
    )],
  ]);

  await ctx.reply(message, {
    parse_mode: "Markdown",
    ...buttons,
  });
}

/**
 * Register booking-related callback handlers
 */
function registerBookingCallbacks(bot) {
  // ─── City Selection for Booking ─────────────────────────────

  bot.action("action_book", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, "btnRiyadh"), "book_city_riyadh")],
      [Markup.button.callback(t(lang, "btnJeddah"), "book_city_jeddah")],
      [Markup.button.callback(t(lang, "btnMadinah"), "book_city_madinah")],
    ]);

    await ctx.reply(t(lang, "bookingStart"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  bot.action("book_city_riyadh", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await showBookingProperties(ctx, "Riyadh", lang);
  });

  bot.action("book_city_jeddah", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await ctx.reply(
      lang === "ar"
        ? "🏙️ جدة قادمة قريباً! حالياً نخدم الرياض فقط."
        : "🏙️ Jeddah is coming soon! Currently we serve Riyadh only."
    );
  });

  bot.action("book_city_madinah", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await ctx.reply(
      lang === "ar"
        ? "🏙️ المدينة المنورة قادمة قريباً! حالياً نخدم الرياض فقط."
        : "🏙️ Madinah is coming soon! Currently we serve Riyadh only."
    );
  });

  // ─── Property Selection for Booking ─────────────────────────

  bot.action(/^book_prop_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const propertyId = parseInt(ctx.match[1]);
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await startBookingForProperty(ctx, propertyId, lang);
  });

  // ─── Booking Confirmation ───────────────────────────────────

  bot.action(/^booking_confirm_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    if (!ctx.session?.booking || ctx.session.booking.step !== "confirm") {
      return ctx.reply(t(lang, "error"));
    }

    const b = ctx.session.booking;

    // Create booking in database
    const bookingId = db.createBooking(ctx.chat.id, {
      propertyId: b.propertyId,
      propertyTitle: b.propertyTitle,
      propertyCity: b.propertyCity,
      monthlyRent: b.monthlyRent,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      durationMonths: b.durationMonths,
      totalAmount: b.costs.totalRent,
      securityDeposit: b.costs.securityDeposit,
      serviceFee: b.costs.serviceFee,
      vatAmount: b.costs.vatAmount,
      grandTotal: b.costs.grandTotal,
    });

    // Clear session
    ctx.session.booking = null;

    const confirmMsg = `${t(lang, "bookingConfirmed")}${bookingId}`;

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, "bookingPayBtn"), `booking_pay_${bookingId}`)],
      [Markup.button.callback(t(lang, "bookingPayLaterBtn"), `booking_paylater_${bookingId}`)],
    ]);

    await ctx.reply(confirmMsg, {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // ─── Booking Cancellation ───────────────────────────────────

  bot.action("booking_cancel", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    // Clear session
    if (ctx.session) ctx.session.booking = null;

    await ctx.reply(t(lang, "bookingCancelled"));
  });

  // ─── Cancel existing booking ────────────────────────────────

  bot.action(/^booking_cancel_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const bookingId = parseInt(ctx.match[1]);
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const booking = db.getBooking(bookingId);
    if (!booking || booking.chat_id !== ctx.chat.id) {
      return ctx.reply(t(lang, "bookingNotFound"));
    }

    db.cancelBooking(bookingId);
    await ctx.reply(t(lang, "bookingCancelled"));
  });

  // ─── Pay Later ──────────────────────────────────────────────

  bot.action(/^booking_paylater_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    const bookingId = parseInt(ctx.match[1]);

    await ctx.reply(
      lang === "ar"
        ? `✅ تم حفظ حجزك رقم #${bookingId}. يمكنك الدفع لاحقاً باستخدام:\n/pay\\_${bookingId}`
        : `✅ Your booking #${bookingId} has been saved. You can pay later using:\n/pay\\_${bookingId}`,
      { parse_mode: "Markdown" }
    );
  });

  // ─── Trigger Payment for Booking ────────────────────────────

  bot.action(/^booking_pay_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
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

    // Trigger the payment module
    const { sendBookingInvoice } = require("./payment");
    await sendBookingInvoice(ctx, booking, lang);
  });
}

/**
 * Show properties available for booking in a city
 */
async function showBookingProperties(ctx, city, lang) {
  const searchingMsg = await ctx.reply(t(lang, "searching"));

  try {
    const result = await api.searchProperties({ city, limit: 8 });
    const properties = result?.items || result || [];

    try {
      await ctx.deleteMessage(searchingMsg.message_id);
    } catch (e) {}

    if (!properties || properties.length === 0) {
      return ctx.reply(t(lang, "bookingNoProperties"));
    }

    await ctx.reply(t(lang, "bookingSelectProperty"), { parse_mode: "Markdown" });

    // Show properties with "Book" buttons
    for (const property of properties.slice(0, 8)) {
      const formatted = api.formatProperty(property, lang);
      if (!formatted) continue;

      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            lang === "ar" ? "📋 حجز هذا العقار" : "📋 Book This Property",
            `book_prop_${property.id}`
          ),
        ],
        [
          Markup.button.url(
            t(lang, "viewOnWebsite"),
            `${config.websiteUrl}/property/${property.id}`
          ),
        ],
      ]);

      if (formatted.photo) {
        try {
          await ctx.replyWithPhoto(formatted.photo, {
            caption: formatted.text,
            parse_mode: "Markdown",
            ...buttons,
          });
          continue;
        } catch (e) {}
      }

      await ctx.reply(formatted.text, {
        parse_mode: "Markdown",
        ...buttons,
      });
    }
  } catch (error) {
    console.error("[Booking] Error showing properties:", error.message);
    try {
      await ctx.deleteMessage(searchingMsg.message_id);
    } catch (e) {}
    await ctx.reply(t(lang, "error"));
  }
}

/**
 * Handle booking date input from text messages
 * Returns true if the message was handled as a booking input
 */
function handleBookingTextInput(ctx) {
  if (!ctx.session?.booking) return false;

  const booking = ctx.session.booking;
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";
  const text = (ctx.message?.text || "").trim();

  if (booking.step === "check_in") {
    return handleCheckInInput(ctx, text, lang);
  }

  if (booking.step === "check_out") {
    return handleCheckOutInput(ctx, text, lang);
  }

  return false;
}

/**
 * Handle check-in date input
 */
async function handleCheckInInput(ctx, text, lang) {
  if (!isValidDate(text)) {
    await ctx.reply(t(lang, "bookingInvalidDate"), { parse_mode: "Markdown" });
    return true;
  }

  if (isDateInPast(text)) {
    await ctx.reply(t(lang, "bookingPastDate"));
    return true;
  }

  ctx.session.booking.checkInDate = text;
  ctx.session.booking.step = "check_out";

  await ctx.reply(t(lang, "bookingEnterCheckOut"), {
    parse_mode: "Markdown",
    reply_markup: { force_reply: true },
  });

  return true;
}

/**
 * Handle check-out date input
 */
async function handleCheckOutInput(ctx, text, lang) {
  if (!isValidDate(text)) {
    await ctx.reply(t(lang, "bookingInvalidDate"), { parse_mode: "Markdown" });
    return true;
  }

  if (isDateInPast(text)) {
    await ctx.reply(t(lang, "bookingPastDate"));
    return true;
  }

  const checkIn = new Date(ctx.session.booking.checkInDate + "T00:00:00");
  const checkOut = new Date(text + "T00:00:00");

  if (checkOut <= checkIn) {
    await ctx.reply(t(lang, "bookingCheckOutBeforeCheckIn"));
    return true;
  }

  ctx.session.booking.checkOutDate = text;
  ctx.session.booking.step = "confirm";

  // Calculate costs
  const durationMonths = calculateDurationMonths(
    ctx.session.booking.checkInDate,
    ctx.session.booking.checkOutDate
  );
  ctx.session.booking.durationMonths = durationMonths;

  const costs = calculateBookingCost(
    ctx.session.booking.monthlyRent,
    durationMonths
  );
  ctx.session.booking.costs = costs;

  // Show booking summary
  await showBookingSummary(ctx, lang);

  return true;
}

/**
 * Show booking summary for confirmation
 */
async function showBookingSummary(ctx, lang) {
  const b = ctx.session.booking;
  const costs = b.costs;

  const rentFormatted = Number(b.monthlyRent).toLocaleString();
  const totalRentFormatted = Number(costs.totalRent).toLocaleString();
  const depositFormatted = Number(costs.securityDeposit).toLocaleString();
  const feeFormatted = Number(costs.serviceFee).toLocaleString();
  const vatFormatted = Number(costs.vatAmount).toLocaleString();
  const grandFormatted = Number(costs.grandTotal).toLocaleString();

  const summary = [
    t(lang, "bookingConfirmTitle"),
    "",
    `${t(lang, "bookingProperty")}: *${b.propertyTitle}*`,
    `${t(lang, "bookingCity")}: ${b.propertyCity}`,
    `${t(lang, "bookingCheckIn")}: ${b.checkInDate}`,
    `${t(lang, "bookingCheckOut")}: ${b.checkOutDate}`,
    `${t(lang, "bookingDuration")}: ${b.durationMonths} ${t(lang, "bookingMonths")}`,
    "",
    "━━━━━━━━━━━━━━━",
    `${t(lang, "bookingMonthlyRent")}: ${rentFormatted} ${t(lang, "sar")}`,
    `${lang === "ar" ? "💰 إجمالي الإيجار" : "💰 Total Rent"}: ${totalRentFormatted} ${t(lang, "sar")}`,
    `${t(lang, "bookingDeposit")} (${DEPOSIT_PERCENT}%): ${depositFormatted} ${t(lang, "sar")}`,
    `${t(lang, "bookingServiceFee")} (${SERVICE_FEE_PERCENT}%): ${feeFormatted} ${t(lang, "sar")}`,
    `${t(lang, "bookingVAT")}: ${vatFormatted} ${t(lang, "sar")}`,
    "━━━━━━━━━━━━━━━",
    `*${t(lang, "bookingGrandTotal")}: ${grandFormatted} ${t(lang, "sar")}*`,
  ].join("\n");

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, "bookingConfirmBtn"), "booking_confirm_yes")],
    [Markup.button.callback(t(lang, "bookingCancelBtn"), "booking_cancel")],
  ]);

  await ctx.reply(summary, {
    parse_mode: "Markdown",
    ...buttons,
  });
}

module.exports = {
  handleBook,
  handleMyBookings,
  registerBookingCallbacks,
  handleBookingTextInput,
  calculateBookingCost,
  calculateDurationMonths,
  isValidDate,
  isDateInPast,
};
