/**
 * Monthly Key Telegram Bot — Main Entry Point
 * Built for Monthly Key (المفتاح الشهري)
 *
 * Phase 1: Search, AI Chat, Notifications, Mini App
 * Phase 2: Booking System, Payment Integration, Property Alerts
 * Phase 3: Admin Dashboard, Channel Auto-Posting, Multi-language, Enhanced Inline
 */
const { Telegraf, session } = require("telegraf");
const config = require("./config");
const db = require("./services/database");
const ai = require("./services/ai");
const {
  handleStart,
  handleHelp,
  handleSearch,
  handleLanguage,
  handleNotifications,
  registerUser,
  getMainKeyboard,
} = require("./handlers/commands");
const { registerCallbacks } = require("./handlers/callbacks");
const { registerInlineHandler } = require("./handlers/inline");
const { t } = require("./i18n");

// Phase 2 imports
const {
  handleBook,
  handleMyBookings,
  registerBookingCallbacks,
  handleBookingTextInput,
} = require("./handlers/booking");
const { registerPaymentHandlers } = require("./handlers/payment");
const {
  handleAlerts,
  handleSubscribe,
  handleUnsubscribe,
  registerAlertCallbacks,
  handleAlertTextInput,
} = require("./handlers/alerts");

// Phase 3 imports
const {
  handleAdmin,
  handleStats,
  handleBroadcast,
  handleManageBookings,
  handleManageListings,
  registerAdminCallbacks,
} = require("./handlers/admin");
const { initChannelPosting, stopChannelPosting } = require("./services/channel");

// Initialize Bot
const bot = new Telegraf(config.botToken);

// Middleware
bot.use(session());

// Initialize Database
db.getDb();

// ─── Command Handlers ────────────────────────────────────────

bot.start(handleStart);
bot.help(handleHelp);
bot.command("search", handleSearch);
bot.command("language", handleLanguage);
bot.command("notifications", handleNotifications);

// Phase 2: Booking commands
bot.command("book", handleBook);
bot.command("mybookings", handleMyBookings);

// Phase 2: Alert commands
bot.command("alerts", handleAlerts);
bot.command("subscribe", handleSubscribe);
bot.command("unsubscribe", handleUnsubscribe);

// Phase 3: Admin commands
bot.command("admin", handleAdmin);
bot.command("stats", handleStats);
bot.command("broadcast", handleBroadcast);
bot.command("manage_bookings", handleManageBookings);
bot.command("manage_listings", handleManageListings);

// ─── Text Message Handler (AI Chatbot + Booking/Alert input) ─
// Also handles reply keyboard button presses in all languages

/**
 * Build a set of all button labels across all languages for quick lookup.
 * This lets us detect when a user taps a reply keyboard button regardless
 * of which language they are using.
 */
const { strings } = require("./i18n");
const ALL_BUTTON_LABELS = (() => {
  const map = {}; // label -> action
  for (const [langCode, s] of Object.entries(strings)) {
    if (s.btnSearch)        map[s.btnSearch]        = "action_search";
    if (s.btnFeatured)      map[s.btnFeatured]      = "action_featured";
    if (s.btnHelp)          map[s.btnHelp]          = "action_help";
    if (s.btnNotifications) map[s.btnNotifications] = "action_notifications";
    // Language button — open language picker
    if (s.btnLanguage)      map[s.btnLanguage]      = "action_language";
    // Website / App buttons are URL-based, no text action needed
  }
  return map;
})();

bot.on("text", async (ctx) => {
  // Ignore commands
  if (ctx.message.text.startsWith("/")) return;
  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;
  // Always ensure user exists in DB before any DB writes (prevents FK constraint errors)
  registerUser(ctx);
  const lang = db.getUserLanguage(chatId) || "ar";

  // ── Reply keyboard button detection ──────────────────────────
  // If the user tapped a reply keyboard button, route to the correct action
  // instead of sending the label text to the AI.
  const buttonAction = ALL_BUTTON_LABELS[userMessage];
  if (buttonAction) {
    if (buttonAction === "action_search") {
      return handleSearch(ctx);
    }
    if (buttonAction === "action_featured") {
      // Simulate the featured callback
      const { Markup } = require("telegraf");
      const searchingMsg = await ctx.reply(t(lang, "searching"));
      try {
        const api = require("./services/api");
        const properties = await api.getFeaturedProperties();
        try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
        if (!properties || properties.length === 0) {
          return ctx.reply(t(lang, "noResults"));
        }
        await ctx.reply(
          lang === "ar"
            ? `\u200F⭐ *العقارات المميزة* (${properties.length})`
            : `⭐ *Featured Properties* (${properties.length})`,
          { parse_mode: "Markdown" }
        );
        for (const property of properties.slice(0, 5)) {
          const formatted = api.formatProperty(property, lang);
          if (!formatted) continue;
          const buttons = Markup.inlineKeyboard([
            [Markup.button.url(t(lang, "viewOnWebsite"), `${config.websiteUrl}/property/${property.id}`)],
          ]);
          if (formatted.photo) {
            try {
              await ctx.replyWithPhoto(formatted.photo, { caption: formatted.text, parse_mode: "Markdown", ...buttons });
              continue;
            } catch (e) {}
          }
          await ctx.reply(formatted.text, { parse_mode: "Markdown", ...buttons });
        }
      } catch (error) {
        try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
        await ctx.reply(t(lang, "error"));
      }
      return;
    }
    if (buttonAction === "action_help") {
      return handleHelp(ctx);
    }
    if (buttonAction === "action_notifications") {
      return handleNotifications(ctx);
    }
    if (buttonAction === "action_language") {
      return handleLanguage(ctx);
    }
    return;
  }

  // Phase 2: Check if this is a booking flow input (date entry)
  if (ctx.session?.booking) {
    const handled = handleBookingTextInput(ctx);
    if (handled) return;
  }

  // Phase 2: Check if this is an alert subscription input (price range)
  if (ctx.session?.alertSubscription) {
    const handled = handleAlertTextInput(ctx);
    if (handled) return;
  }

  // Show typing status
  await ctx.sendChatAction("typing");

  try {
    const aiResponse = await ai.getAiResponse(chatId, userMessage);

    await ctx.reply(aiResponse, {
      parse_mode: "Markdown",
      ...getMainKeyboard(lang),
    });
  } catch (error) {
    console.error("[Bot] Error in text handler:", error);
    await ctx.reply(t(lang, "error"));
  }
});

// ─── Inline Search & Callbacks ───────────────────────────────

registerCallbacks(bot);
registerInlineHandler(bot);

// Phase 2: Register booking, payment, and alert callbacks
registerBookingCallbacks(bot);
registerPaymentHandlers(bot);
registerAlertCallbacks(bot);

// Phase 3: Register admin callbacks
registerAdminCallbacks(bot);

// ─── Set Bot Menu & Commands ─────────────────────────────────

async function setupBot() {
  try {
    // Set Bot Commands (Phase 1-3, public commands only)
    await bot.telegram.setMyCommands([
      { command: "start", description: "Start the bot | بدء المحادثة" },
      { command: "search", description: "Search properties | البحث عن عقارات" },
      { command: "book", description: "Book a property | حجز عقار" },
      { command: "mybookings", description: "My bookings | حجوزاتي" },
      { command: "alerts", description: "Property alerts | تنبيهات العقارات" },
      { command: "subscribe", description: "Subscribe to alerts | الاشتراك في التنبيهات" },
      { command: "unsubscribe", description: "Unsubscribe from alerts | إلغاء الاشتراك" },
      { command: "notifications", description: "Notification settings | إعدادات الإشعارات" },
      { command: "language", description: "Change language | تغيير اللغة" },
      { command: "help", description: "Show help | المساعدة" },
    ]);

    // Set Menu Button to open Mini App
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Monthly Key 🔑",
        web_app: { url: config.webappUrl },
      },
    });

    console.log("[Bot] Commands and Menu Button configured");
    console.log(`[Bot] Mini App URL: ${config.webappUrl}`);

    // Phase 3: Log admin config
    if (config.adminIds.length > 0) {
      console.log(`[Bot] Admin IDs: ${config.adminIds.join(", ")}`);
    } else {
      console.log("[Bot] No admin IDs configured. Admin commands disabled.");
    }

    // Phase 3: Initialize channel auto-posting
    initChannelPosting(bot);
  } catch (error) {
    console.error("[Bot] Error setting up commands/menu:", error.message);
  }
}

// ─── Start Bot ───────────────────────────────────────────────

setupBot();

bot
  .launch()
  .then(() => {
    console.log("-------------------------------------------");
    console.log("Monthly Key Telegram Bot is RUNNING");
    console.log(`Bot Username: @${bot.botInfo?.username || "Bot"}`);
    console.log("Phase 1: Search, AI Chat, Notifications");
    console.log("Phase 2: Booking, Payments, Alerts");
    console.log("Phase 3: Admin, Channel, Multi-lang, Inline");
    console.log("Languages: AR, EN, FR, UR, HI");
    console.log("-------------------------------------------");
  })
  .catch((err) => {
    console.error("Failed to launch bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => {
  stopChannelPosting();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopChannelPosting();
  bot.stop("SIGTERM");
});
