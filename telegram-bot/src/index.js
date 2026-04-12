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
const http = require("http");

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

// Phase 4: Operations Group imports (v3 — 21-feature upgrade)
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
  // v3 new command handlers
  handleOpsSla,
  handleOpsApprove,
  handleOpsReject,
  handleOpsRecurring,
  handleOpsDepends,
  handleOpsHandover,
  handleOpsMonthlyReport,
  handleOpsExpense,
  handleOpsExpenses,
  handleOpsOccupancy,
  handleOpsMeeting,
  handleOpsGsync,
  // v5
  handleOpsMlog, handleOpsWorkflow, handleOpsTemplate, handleOpsTrends, handleOpsWeather, handleOpsClean,
  handleOpsIdea, handleOpsIdeas, handleOpsBrainstorm, handleOpsPhotos, handlePhotoReviewCallback,
  handleIdeaVoteCallback,
  // AI & media handlers
  handleOpsMessage,
  handleOpsMedia,
  handleOpsVoice,
  handleOpsPassive,
  registerTopicName,
} = require("./handlers/ops");
const { startOpsScheduler, stopOpsScheduler } = require("./services/ops-scheduler");

// Phase 4 v4: 18 new features (Security, Onboarding, Team, Operations, Communication)
const {
  handleOpsSetRole, handleOpsRoles,
  handleOpsAudit,
  handleOpsVerify,
  handleSensitiveDataCheck,
  handleNewMember,
  handleOpsOnboarding,
  handleOpsTeam,
  handleOpsPerformance, handleOpsLeaderboard,
  handleOpsAway, handleOpsBack, handleOpsAvailability,
  handleTopicRoutingSuggestion,
  handleOpsPoll, handlePollCallback,
  handleOpsPin,
  trackMentions, markMentionResponse,
  handleV4Passive,
  initV4,
} = require("./handlers/ops-v4");

// v5 Database Init
const { initV5Tables } = require("./services/ops-database-v5");
// Admin Panel handler (topic 15, thread 235)
const { handleOpsAdmin, guardAdminTopic, ADMIN_PANEL_THREAD } = require("./handlers/ops-admin");

// ─── Ops Group ID ─────────────────────────────────────────────
const OPS_GROUP_ID = -1003967447285;

function isOpsGroup(ctx) {
  return ctx.chat?.id === OPS_GROUP_ID;
}

// ─── Initialize Bot ───────────────────────────────────────────
const bot = new Telegraf(config.botToken);
bot.use(session());
db.getDb();

// ─── Global Error Handler ─────────────────────────────────────
// Without this, Telegraf silently drops all unhandled promise rejections
// in command handlers, causing commands to appear unresponsive.
bot.catch((err, ctx) => {
  const cmd = ctx.message?.text?.split(" ")[0] || "unknown";
  const chat = ctx.chat?.id || "unknown";
  console.error(`[Bot] Unhandled error in command "${cmd}" (chat ${chat}):`, err.message);
  // Attempt to notify the user
  if (ctx.reply) {
    const threadId = ctx.message?.message_thread_id || undefined;
    ctx.reply(`❌ An error occurred. Please try again.\n\nError: ${err.message}`, {
      message_thread_id: threadId
    }).catch(() => {}); // Swallow reply errors
  }
});

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
// In the ops group, /admin routes to the Admin Panel topic handler (topic 15, thread 235)
bot.command("admin", (ctx) => {
  if (isOpsGroup(ctx)) return handleOpsAdmin(ctx);
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

// ─── Phase 4 v3: New Ops Commands ───────────────────────────

bot.command("sla", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsSla(ctx);
});

bot.command("approve", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsApprove(ctx);
});

bot.command("reject", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsReject(ctx);
});

bot.command("recurring", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsRecurring(ctx);
});

bot.command("depends", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsDepends(ctx);
});

bot.command("handover", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsHandover(ctx);
});

bot.command("monthlyreport", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsMonthlyReport(ctx);
});

bot.command("expense", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsExpense(ctx);
});

bot.command("expenses", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsExpenses(ctx);
});

bot.command("occupancy", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsOccupancy(ctx);
});

bot.command("meeting", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsMeeting(ctx);
});

bot.command("gsync", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsGsync(ctx);
});

// ─── Phase 4 v4: New Ops Commands (18 features) ────────────

bot.command("setrole", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsSetRole(ctx);
});

bot.command("roles", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsRoles(ctx);
});

bot.command("audit", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsAudit(ctx);
});

bot.command("verify", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsVerify(ctx);
});

bot.command("onboarding", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsOnboarding(ctx);
});

bot.command("team", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsTeam(ctx);
});

bot.command("performance", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsPerformance(ctx);
});

bot.command("leaderboard", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsLeaderboard(ctx);
});

bot.command("away", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsAway(ctx);
});

bot.command("back", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsBack(ctx);
});

bot.command("availability", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsAvailability(ctx);
});

bot.command("poll", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsPoll(ctx);
});

bot.command("pin", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsPin(ctx);
});

// ─── Phase 4 v5: New Ops Commands (8 features) ─────────────────────────────

bot.command("mlog", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsMlog(ctx);
});

bot.command("workflow", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsWorkflow(ctx);
});

bot.command("template", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsTemplate(ctx);
});

bot.command("trends", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsTrends(ctx);
});

bot.command("weather", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsWeather(ctx);
});

bot.command("clean", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsClean(ctx);
});

bot.command("idea", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsIdea(ctx);
});

bot.command("ideas", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsIdeas(ctx);
});

bot.command("brainstorm", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsBrainstorm(ctx);
});

bot.command("photos", (ctx) => {
  if (!isOpsGroup(ctx)) return;
  return handleOpsPhotos(ctx);
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
    if (userMessage.startsWith("/")) return;

    // Admin topic guard: block non-admins from posting in the Admin Panel topic (thread 235)
    const msgThreadId = ctx.message?.message_thread_id;
    if (msgThreadId === ADMIN_PANEL_THREAD) {
      const blocked = await guardAdminTopic(ctx).catch(() => false);
      if (blocked) return;
    }
    // v4 passive monitoring: sensitive data, topic routing, mentions, check-in
    try {
      await handleV4Passive(ctx);
    } catch (e) {
      console.error("[Bot] v4 passive error:", e.message);
    }

    // v3 passive monitoring: detect follow-up promises
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
        await ctx.reply(t(lang, "error"), { message_thread_id: ctx.message?.message_thread_id || undefined });
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
      return ctx.reply(appMsg, { ...appBtn, message_thread_id: ctx.message?.message_thread_id || undefined });
    }
    if (buttonAction === "action_website") {
      const { Markup } = require("telegraf");
      const webMsg = lang === "ar" ? "\u200F🌐 زر موقعنا:" : "🌐 Visit our website:";
      const webBtn = Markup.inlineKeyboard([
        [Markup.button.url(t(lang, "btnWebsite"), config.websiteUrl)],
      ]);
      return ctx.reply(webMsg, { ...webBtn, message_thread_id: ctx.message?.message_thread_id || undefined });
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
      await ctx.reply(t(lang, "error"), { message_thread_id: ctx.message?.message_thread_id || undefined });
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

// ─── Phase 4 v4: New Member Welcome ──────────────────────────
bot.on("new_chat_members", async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    for (const member of ctx.message.new_chat_members) {
      await handleNewMember(ctx, member);
    }
  } catch (e) {
    console.error("[Bot] New member handler error:", e.message);
  }
});

// ─── Phase 4 v4: Poll Callbacks ─────────────────────────────
bot.action(/^poll_vote_/, async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    await handlePollCallback(ctx);
  } catch (e) {
    console.error("[Bot] Poll callback error:", e.message);
  }
});

bot.action(/^photo_(approve|reject)_(\d+)$/, async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    await handlePhotoReviewCallback(ctx);
  } catch (e) {
    console.error("[Bot] Photo review callback error:", e.message);
  }
});

// ─── Phase 5 v5: Idea Vote Callbacks ────────────────────────
bot.action(/^idea_vote_\d+$/, async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  try {
    await handleIdeaVoteCallback(ctx);
  } catch (e) {
    console.error("[Bot] Idea vote callback error:", e.message);
    await ctx.answerCbQuery("\u274c Error recording vote").catch(() => {});
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

    // Set ops-specific commands for the ops group (v4 — 39 features)
    await bot.telegram.setMyCommands(
      [
        { command: "task",          description: "Add task | إضافة مهمة" },
        { command: "tasks",         description: "View tasks | عرض المهام" },
        { command: "done",          description: "Complete task | إنهاء مهمة" },
        { command: "summary",       description: "All tasks summary | ملخص" },
        { command: "kpi",           description: "KPI dashboard | لوحة الأداء" },
        { command: "sla",           description: "SLA timers | مؤقتات SLA" },
        { command: "recurring",     description: "Recurring tasks | مهام متكررة" },
        { command: "expense",       description: "Log expense | تسجيل مصروف" },
        { command: "expenses",      description: "Expense summary | ملخص المصاريف" },
        { command: "occupancy",     description: "Unit occupancy | إشغال الوحدات" },
        { command: "meeting",       description: "Meeting notes | محضر اجتماع" },
        { command: "handover",      description: "Shift handover | تسليم الوردية" },
        { command: "monthlyreport", description: "Monthly report | تقرير شهري" },
        { command: "property",      description: "Property tracker | متابعة الوحدات" },
        { command: "move",          description: "Move task | نقل مهمة" },
        { command: "remind",        description: "Set reminder | تذكير" },
        { command: "depends",       description: "Task dependency | اعتمادية مهمة" },
        { command: "approve",       description: "Approve request | موافقة" },
        { command: "reject",        description: "Reject request | رفض" },
        { command: "checklist",     description: "Create checklist | قائمة مهام" },
        { command: "gsync",         description: "Google Sheets sync | مزامنة جوجل" },
        { command: "setrole",       description: "Set user role | تعيين دور" },
        { command: "roles",         description: "View roles | عرض الأدوار" },
        { command: "audit",         description: "Audit log | سجل المراجعة" },
        { command: "verify",        description: "Verify member | توثيق عضو" },
        { command: "onboarding",    description: "Onboarding status | حالة التأهيل" },
        { command: "team",          description: "Team directory | دليل الفريق" },
        { command: "performance",   description: "Performance scores | درجات الأداء" },
        { command: "leaderboard",   description: "Team leaderboard | لوحة المتصدرين" },
        { command: "away",          description: "Mark as away | تعيين غياب" },
        { command: "back",          description: "Mark as back | تعيين عودة" },
        { command: "availability",  description: "Team availability | توفر الفريق" },
        { command: "poll",          description: "Create poll | إنشاء استطلاع" },
        { command: "pin",          description: "Pin a summary in topic" },
        { command: "mlog",         description: "Log maintenance" },
        { command: "workflow",     description: "Manage workflows" },
        { command: "template",     description: "Message templates" },
        { command: "trends",       description: "View trends" },
        { command: "weather",      description: "Check weather" },
        { command: "clean",        description: "Cleaning log" },
        { command: "idea",         description: "Submit idea" },
        { command: "ideas",        description: "Idea board" },
        { command: "brainstorm",   description: "Start brainstorm" },
        { command: "photos",       description: "Property photos" },
    ], { scope: { type: "chat", chat_id: OPS_GROUP_ID } });

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

// Initialize ALL database tables BEFORE launching the bot.
// This is critical: if init is deferred to .then(), a 409 conflict
// or any launch error means tables are never created and ALL v4/v5
// commands (roles, onboarding, ideas, etc.) crash with "no such table".
try {
  initV4();
  console.log("[Bot] v4 tables initialized");
} catch (e) {
  console.error("[Bot] v4 init error:", e.message);
}
try {
  initV5Tables();
  console.log("[Bot] v5 tables initialized");
} catch (e) {
  console.error("[Bot] v5 init error:", e.message);
}

setupBot();

// ─── Launch with Robust 409-Conflict Recovery ──────────────
// Strategy:
// 1. Call /close to kill any ghost polling session on Telegram's side
// 2. Delete webhook + drop pending updates
// 3. Wait 10s for Telegram to fully release the polling lock
// 4. Then launch with dropPendingUpdates:true
// 5. Retry INDEFINITELY — NEVER call process.exit()
let schedulerStarted = false;
let launchLock = false;

async function killGhostAndLaunch() {
  if (launchLock) return;
  launchLock = true;

  // Step 1: Force-close any existing bot session on Telegram's servers
  console.log('[Bot] Killing any ghost polling session...');
  try {
    const https = require('https');
    const TOKEN = process.env.BOT_TOKEN || config.botToken;
    await new Promise((resolve) => {
      https.get('https://api.telegram.org/bot' + TOKEN + '/close', (res) => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { console.log('[Bot] /close response:', d.substring(0, 80)); resolve(); });
      }).on('error', (e) => { console.warn('[Bot] /close error:', e.message); resolve(); });
    });
  } catch(e) { console.warn('[Bot] /close warning:', e.message); }

  // Step 2: Delete webhook
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('[Bot] Webhook deleted, pending updates dropped.');
  } catch(e) { console.warn('[Bot] deleteWebhook warning:', e.message); }

  // Step 3: Wait 10s for Telegram to release the polling lock
  console.log('[Bot] Waiting 10s for Telegram to release polling lock...');
  await new Promise(r => setTimeout(r, 10000));

  // Step 4: Launch with retry
  launchWithRetry(1);
}

async function launchWithRetry(attempt) {
  const maxDelay = 60000;
  try {
    console.log('[Bot] Launch attempt ' + attempt + '...');
    await bot.launch({ dropPendingUpdates: true });
    console.log('[Bot] Polling stopped gracefully.');
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const is409 = (err && err.error_code === 409) || msg.includes('409');
    const delay = is409 ? Math.min(5000 * attempt, maxDelay) : Math.min(10000 * attempt, maxDelay);
    if (is409) {
      console.warn('[Bot] 409 Conflict — retrying in ' + (delay/1000) + 's (attempt ' + attempt + ')...');
      // Force-close the ghost again before retrying
      try { await bot.telegram.deleteWebhook({ drop_pending_updates: true }); } catch(e) {}
    } else {
      console.error('[Bot] Launch error (attempt ' + attempt + '):', msg, '— retrying in ' + (delay/1000) + 's');
    }
    // NEVER exit — always retry
    setTimeout(function() { launchLock = false; launchWithRetry(attempt + 1); }, delay);
  }
}

// Start scheduler once bot is connected (poll for botInfo)
function waitForBotAndStartScheduler() {
  if (bot.botInfo && !schedulerStarted) {
    schedulerStarted = true;
    writeHeartbeat();
    console.log('-------------------------------------------');
    console.log('Monthly Key Telegram Bot is RUNNING');
    console.log('Bot Username: @' + bot.botInfo.username);
    console.log('Phase 4: Ops Group v5 — 49 Features');
    console.log('-------------------------------------------');
    startOpsScheduler(bot);
  } else if (!schedulerStarted) {
    setTimeout(waitForBotAndStartScheduler, 1000);
  }
}

killGhostAndLaunch();
waitForBotAndStartScheduler();

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

// ─── HTTP Keepalive Server ────────────────────────────────────
// Railway requires a process to either bind to PORT (web service)
// or run indefinitely (worker). Without this, Node.js exits after
// bot.launch() resolves, killing the bot. This minimal HTTP server
// keeps the process alive and satisfies Railway health checks.
const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: bot.botInfo ? '@' + bot.botInfo.username : 'starting',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => {
  console.log('[Bot] HTTP keepalive server listening on port', PORT);
});
