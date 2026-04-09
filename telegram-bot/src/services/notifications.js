/**
 * Push Notification Service for Monthly Key Telegram Bot
 * Handles sending notifications to users about new properties, price drops, and bookings
 */
const config = require("../config");
const db = require("./database");

/**
 * Send a notification to a single user
 */
async function sendNotification(bot, chatId, message, options = {}) {
  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      disable_web_page_preview: options.disablePreview || false,
      ...options,
    });
    db.logNotification(chatId, options.type || "general", message, "sent");
    return true;
  } catch (error) {
    console.error(`[Notification] Failed to send to ${chatId}:`, error.message);
    // If user blocked the bot, deactivate them
    if (error.code === 403 || error.description?.includes("blocked")) {
      db.deactivateUser(chatId);
      db.logNotification(chatId, options.type || "general", message, "blocked");
    } else {
      db.logNotification(chatId, options.type || "general", message, "failed");
    }
    return false;
  }
}

/**
 * Broadcast a notification to all active users
 */
async function broadcastNotification(bot, message, options = {}) {
  const users = db.getActiveUsers();
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const success = await sendNotification(bot, user.chat_id, message, options);
    if (success) sent++;
    else failed++;

    // Rate limiting: Telegram allows ~30 messages per second
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return { sent, failed, total: users.length };
}

/**
 * Send new property notification to subscribed users
 */
async function notifyNewProperty(bot, property) {
  const users = db.getNotifiableUsers("new_properties");
  let sent = 0;

  for (const user of users) {
    const isAr = user.language === "ar";

    // If user has a preferred city, only notify for that city
    if (user.preferred_city && property.city && 
        user.preferred_city.toLowerCase() !== property.city.toLowerCase()) {
      continue;
    }

    const title = isAr ? property.titleAr : property.titleEn;
    const city = isAr ? property.cityAr : property.city;
    const rent = Number(property.monthlyRent || 0).toLocaleString();

    const message = isAr
      ? `🏠 *عقار جديد!*\n\n${title}\n📍 ${city}\n💰 ${rent} ر.س/شهرياً\n\n🔗 [عرض التفاصيل](${config.websiteUrl}/property/${property.id})`
      : `🏠 *New Property!*\n\n${title}\n📍 ${city}\n💰 ${rent} SAR/month\n\n🔗 [View Details](${config.websiteUrl}/property/${property.id})`;

    const success = await sendNotification(bot, user.chat_id, message, {
      type: "new_property",
      disablePreview: false,
    });
    if (success) sent++;

    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return sent;
}

/**
 * Send price drop notification
 */
async function notifyPriceDrop(bot, property, oldPrice, newPrice) {
  const users = db.getNotifiableUsers("price_drops");
  let sent = 0;

  for (const user of users) {
    const isAr = user.language === "ar";
    const title = isAr ? property.titleAr : property.titleEn;
    const city = isAr ? property.cityAr : property.city;
    const oldRent = Number(oldPrice).toLocaleString();
    const newRent = Number(newPrice).toLocaleString();

    const message = isAr
      ? `📉 *تخفيض سعر!*\n\n${title}\n📍 ${city}\n💰 ~~${oldRent}~~ → *${newRent}* ر.س/شهرياً\n\n🔗 [عرض التفاصيل](${config.websiteUrl}/property/${property.id})`
      : `📉 *Price Drop!*\n\n${title}\n📍 ${city}\n💰 ~~${oldRent}~~ → *${newRent}* SAR/month\n\n🔗 [View Details](${config.websiteUrl}/property/${property.id})`;

    const success = await sendNotification(bot, user.chat_id, message, {
      type: "price_drop",
    });
    if (success) sent++;

    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return sent;
}

/**
 * Send booking confirmation notification
 */
async function notifyBookingConfirmation(bot, chatId, booking) {
  const user = db.getUser(chatId);
  const isAr = user?.language === "ar";

  const message = isAr
    ? `✅ *تأكيد الحجز!*\n\nتم تأكيد حجزك بنجاح.\n\n🏠 ${booking.propertyTitle}\n📅 تاريخ البدء: ${booking.startDate}\n⏱️ المدة: ${booking.duration} شهر\n💰 الإجمالي: ${booking.total} ر.س\n\nشكراً لاستخدامك المفتاح الشهري! 🔑`
    : `✅ *Booking Confirmed!*\n\nYour booking has been confirmed.\n\n🏠 ${booking.propertyTitle}\n📅 Start Date: ${booking.startDate}\n⏱️ Duration: ${booking.duration} months\n💰 Total: ${booking.total} SAR\n\nThank you for using Monthly Key! 🔑`;

  return sendNotification(bot, chatId, message, { type: "booking_confirmation" });
}

module.exports = {
  sendNotification,
  broadcastNotification,
  notifyNewProperty,
  notifyPriceDrop,
  notifyBookingConfirmation,
};
