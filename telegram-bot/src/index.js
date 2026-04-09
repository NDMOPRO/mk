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

bot.on("text", async (ctx) => {
  // Ignore commands
  if (ctx.message.text.startsWith("/")) return;

  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;
  const lang = db.getUserLanguage(chatId) || registerUser(ctx);

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
