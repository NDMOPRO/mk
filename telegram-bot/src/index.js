/**
 * Monthly Key Telegram Bot — Main Entry Point
 * Built for Monthly Key (المفتاح الشهري)
 *
 * Phase 1: Search, AI Chat, Notifications, Mini App
 * Phase 2: Booking System, Payment Integration, Property Alerts
 * Phase 3: Admin Dashboard, Channel Auto-Posting, Multi-language, Enhanced Inline
 * Phase 4: Operations Group — Tasks, Checklists, Follow-ups, Daily Reminders
 *
 * ─── Context Routing ─────────────────────────────────────────
 * OPS_GROUP_ID (-1003967447285) → Operations management mode
 * All other chats                → Public bot mode (property search, AI, etc.)
 */
const { Telegraf, session } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ─── Heartbeat (for keep-alive monitor) ──────────────────────
const HEARTBEAT_FILE = path.join(__dirname, "../.heartbeat");
function writeHeartbeat() {
  try { fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString()); } catch (e) {}
}
setInterval(writeHeartbeat, 2 * 60 * 1000);
writeHeartbeat();

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
  handleAdminLogin,
  handleAdminLoginInput,
  handleStats,
  handleBroadcast,
  handleManageBookings,
  handleManageListings,
  registerAdminCallbacks,
} = require("./handlers/admin");
const { initChannelPosting, stopChannelPosting } = require("./services/channel");

// Phase 4: Operations Group imports (v2 — 10-feature upgrade)
const {
  handleOpsTask,
  handleOpsChecklist,
  handleOpsTasks,
  handleOpsDone,
  handleOpsRemind,
  handleOpsSummary,
  handleOpsKpi,
  handleOpsProperty,
  handleOpsMove,
  handleOpsMessage,
  handleOpsMedia,
  handleOpsVoice,
  handleOpsPassive,
  registerTopicName,
} = require("./handlers/ops");
const { startOpsScheduler, stopOpsScheduler } = require("./services/ops-scheduler");

// ─── Ops Group ID ─────────────────────────────────────────────
const OPS_GROUP_ID = -1003967447285;

function isOpsGroup(ctx) {
  return ctx.chat?.id === OPS_GROUP_ID;
}

// ─── Initialize Bot ───────────────────────────────────────────
const bot = new Telegraf(config.botToken);
bot.use(session());
db.getDb();

// ─── Command Handlers ─────────────────────────────────────────
// Ops commands are registered globally but gated by isOpsGroup() inside.
// Public commands are ignored in the ops group.

// /start — only in private chats
bot.start((ctx) => {
  if (isOpsGroup(ctx)) return; // Ignore /start in ops group
  return handleStart(ctx);
});

// /help — only in private chats
bot.help((ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleHelp(ctx);
});

// /search — only in private chats
bot.command("search", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleSearch(ctx);
});

bot.command("language", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleLanguage(ctx);
});

bot.command("notifications", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleNotifications(ctx);
});

// Phase 2: Booking commands (private only)
bot.command("book", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleBook(ctx);
});
bot.command("mybookings", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleMyBookings(ctx);
});

// Phase 2: Alert commands (private only)
bot.command("alerts", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleAlerts(ctx);
});
bot.command("subscribe", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleSubscribe(ctx);
});
bot.command("unsubscribe", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleUnsubscribe(ctx);
});

// Phase 3: Admin commands (private only)
bot.command("admin", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleAdminLogin(ctx);
});
bot.command("stats", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleStats(ctx);
});
bot.command("broadcast", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleBroadcast(ctx);
});
bot.command("manage_bookings", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleManageBookings(ctx);
});
bot.command("manage_listings", (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleManageListings(ctx);
});

// ─── Phase 4: Ops Group Commands ─────────────────────────────
// These commands ONLY work in the ops group.

bot.command("task", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsTask(ctx);
});

bot.command("checklist", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsChecklist(ctx);
});

bot.command("tasks", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsTasks(ctx);
});

bot.command("done", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsDone(ctx);
});

bot.command("remind", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsRemind(ctx);
});

bot.command("summary", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsSummary(ctx);
});

bot.command("kpi", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsKpi(ctx);
});

bot.command("property", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsProperty(ctx);
});

bot.command("move", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsMove(ctx);
});

// ─── Text Message Handler ─────────────────────────────────────

/**
 * Build a set of all button labels across all languages for quick lookup.
 */
const { strings } = require("./i18n");
const ALL_BUTTON_LABELS = (() => {
  const map = {};
  for (const [langCode, s] of Object.entries(strings)) {
    if (s.btnSearch)        map[s.btnSearch]        = "action_search";
    if (s.btnFeatured)      map[s.btnFeatured]      = "action_featured";
    if (s.btnHelp)          map[s.btnHelp]          = "action_help";
    if (s.btnNotifications) map[s.btnNotifications] = "action_notifications";
    if (s.btnLanguage)      map[s.btnLanguage]      = "action_language";
    if (s.btnOpenApp)       map[s.btnOpenApp]       = "action_open_app";
    if (s.btnWebsite)       map[s.btnWebsite]       = "action_website";
  }
  return map;
})();

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  const isPrivate = chatType === "private";
  const userMessage = ctx.message.text || "";

  // ── Phase 4: Ops Group ───────────────────────────────────────
  if (isOpsGroup(ctx)) {
    // Skip slash commands here — they are handled by bot.command() above.
    // bot.command() in Telegraf fires BEFORE on("text"), so commands that
    // matched will already have been handled. However, if a /command@botname
    // message somehow reaches here (e.g., Telegraf didn’t match it), we
    // still want to ignore it rather than send it to the AI.
    if (userMessage.startsWith("/")) return;

    // Passive monitoring: detect follow-up promises in ALL messages
    await handleOpsPassive(ctx);

    // Active AI response: only when @mentioned or replying to bot
    const botUsername = bot.botInfo?.username || "monthlykey_bot";
    const isMentioned = userMessage.includes(`@${botUsername}`);
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === bot.botInfo?.id;

    if (isMentioned || isReplyToBot) {
      await handleOpsMessage(ctx, ai.getOpenAIClient());
    }
    return;
  }

  // Skip slash commands in all other contexts too
  if (userMessage.startsWith("/")) return;

  // ── Public Bot (private chats + other groups) ────────────────
  registerUser(ctx);
  const lang = db.getUserLanguage(chatId) || "ar";

  // In non-ops group chats, only respond if @mentioned or replied to
  if (!isPrivate) {
    const botUsername = bot.botInfo?.username;
    const isMentioned = botUsername && userMessage.includes(`@${botUsername}`);
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === bot.botInfo?.id;
    if (!isMentioned && !isReplyToBot) return;
  }

  // ── Reply keyboard button detection ──────────────────────────
  const buttonAction = ALL_BUTTON_LABELS[userMessage];
  if (buttonAction) {
    if (buttonAction === "action_search") {
      return handleSearch(ctx);
    }
    if (buttonAction === "action_featured") {
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
    if (buttonAction === "action_help")          return handleHelp(ctx);
    if (buttonAction === "action_notifications") return handleNotifications(ctx);
    if (buttonAction === "action_language")      return handleLanguage(ctx);
    if (buttonAction === "action_open_app") {
      const { Markup } = require("telegraf");
      const appMsg = lang === "ar"
        ? "\u200F📱 اضغط الزر أدناه لفتح التطبيق:"
        : "📱 Tap the button below to open the app:";
      const appBtn = Markup.inlineKeyboard([
        [Markup.button.webApp(t(lang, "btnOpenApp"), config.webappUrl)],
      ]);
      return ctx.reply(appMsg, { ...appBtn });
    }
    if (buttonAction === "action_website") {
      const { Markup } = require("telegraf");
      const webMsg = lang === "ar" ? "\u200F🌐 زر موقعنا:" : "🌐 Visit our website:";
      const webBtn = Markup.inlineKeyboard([
        [Markup.button.url(t(lang, "btnWebsite"), config.websiteUrl)],
      ]);
      return ctx.reply(webMsg, { ...webBtn });
    }
    return;
  }

  // Phase 3: Admin login flow
  if (ctx.session?.adminLogin) {
    const handled = await handleAdminLoginInput(ctx);
    if (handled) return;
  }

  // Phase 2: Booking flow
  if (ctx.session?.booking) {
    const handled = handleBookingTextInput(ctx);
    if (handled) return;
  }

  // Phase 2: Alert subscription flow
  if (ctx.session?.alertSubscription) {
    const handled = handleAlertTextInput(ctx);
    if (handled) return;
  }

  // AI Chatbot
  await ctx.sendChatAction("typing");
  try {
    const aiResponse = await ai.getAiResponse(chatId, userMessage);
    if (isPrivate) {
      await ctx.reply(aiResponse, {
        parse_mode: "Markdown",
        ...getMainKeyboard(lang),
      });
    } else {
      await ctx.reply(aiResponse, { parse_mode: "Markdown" });
    }
  } catch (error) {
    console.error("[Bot] Error in text handler:", error.message);
    try {
      await ctx.reply(t(lang, "error"));
    } catch (e) {
      console.error("[Bot] Could not send error reply:", e.message);
    }
  }
});

// ─── Phase 4: Ops Group — Photo/Document Logging (Feature 6) ──
bot.on(["photo", "document", "video"], async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    await handleOpsMedia(ctx);
  } catch (e) {
    console.error("[Bot] Ops media handler error:", e.message);
  }
});

// ─── Phase 4: Ops Group — Voice Note Transcription (Feature 10) ─
bot.on(["voice", "audio"], async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    await handleOpsVoice(ctx, ai.getOpenAIClient());
  } catch (e) {
    console.error("[Bot] Ops voice handler error:", e.message);
  }
});

// ─── Inline Search & Callbacks ────────────────────────────────

registerCallbacks(bot);
registerInlineHandler(bot);
registerBookingCallbacks(bot);
registerPaymentHandlers(bot);
registerAlertCallbacks(bot);
registerAdminCallbacks(bot);

// ─── Set Bot Menu & Commands ──────────────────────────────────

async function setupBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: "start",         description: "Start the bot | بدء المحادثة" },
      { command: "search",        description: "Search properties | البحث عن عقارات" },
      { command: "book",          description: "Book a property | حجز عقار" },
      { command: "mybookings",    description: "My bookings | حجوزاتي" },
      { command: "alerts",        description: "Property alerts | تنبيهات العقارات" },
      { command: "subscribe",     description: "Subscribe to alerts | الاشتراك في التنبيهات" },
      { command: "unsubscribe",   description: "Unsubscribe from alerts | إلغاء الاشتراك" },
      { command: "notifications", description: "Notification settings | إعدادات الإشعارات" },
      { command: "language",      description: "Change language | تغيير اللغة" },
      { command: "help",          description: "Show help | المساعدة" },
    ]);

    // Set ops-specific commands for the ops group (v2 — 10-feature upgrade)
    await bot.telegram.setMyCommands(
      [
        { command: "task",      description: "Add task | إضافة مهمة" },
        { command: "checklist", description: "Create checklist | قائمة مهام" },
        { command: "tasks",     description: "View tasks | عرض المهام" },
        { command: "done",      description: "Complete task | إنهاء مهمة" },
        { command: "remind",    description: "Set reminder | تذكير" },
        { command: "summary",   description: "All tasks summary | ملخص" },
        { command: "kpi",       description: "Weekly KPI dashboard | لوحة الأداء" },
        { command: "property",  description: "Property tracker | متابعة الوحدات" },
        { command: "move",      description: "Move task to topic | نقل مهمة" },
      ],
      { scope: { type: "chat", chat_id: OPS_GROUP_ID } }
    );

    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Monthly Key 🔑",
        web_app: { url: config.webappUrl },
      },
    });

    console.log("[Bot] Commands and Menu Button configured");
    console.log(`[Bot] Mini App URL: ${config.webappUrl}`);
    console.log(`[Bot] Ops Group ID: ${OPS_GROUP_ID}`);

    if (config.adminIds.length > 0) {
      console.log(`[Bot] Admin IDs: ${config.adminIds.join(", ")}`);
    }

    initChannelPosting(bot);
  } catch (error) {
    console.error("[Bot] Error setting up commands/menu:", error.message);
  }
}

// ─── Start Bot ────────────────────────────────────────────────

setupBot();

bot
  .launch()
  .then(() => {
    writeHeartbeat();
    console.log("-------------------------------------------");
    console.log("Monthly Key Telegram Bot is RUNNING");
    console.log(`Bot Username: @${bot.botInfo?.username || "Bot"}`);
    console.log("Phase 1: Search, AI Chat, Notifications");
    console.log("Phase 2: Booking, Payments, Alerts");
    console.log("Phase 3: Admin, Channel, Multi-lang, Inline");
    console.log("Phase 4: Ops Group v2 — 10 Features (Tasks, KPI, Escalation, Voice, etc.)");
    console.log("Languages: AR, EN, FR, UR, HI");
    console.log("-------------------------------------------");

    // Start the ops scheduler after bot is connected
    startOpsScheduler(bot);
  })
  .catch((err) => {
    console.error("Failed to launch bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => {
  stopChannelPosting();
  stopOpsScheduler();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopChannelPosting();
  stopOpsScheduler();
  bot.stop("SIGTERM");
});
