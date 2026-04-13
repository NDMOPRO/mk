/**
 * Monthly Key Telegram Bot — Main Entry Point
 * Built for Monthly Key (المفتاح الشهري)
 *
 * Phase 1: Search, AI Chat, Notifications, Mini App
 * Phase 2: Booking System, Payment Integration, Property Alerts
 * Phase 3: Admin Dashboard, Channel Auto-Posting, Multi-language, Enhanced Inline
 * Phase 4: Operations Group — Tasks, Checklists, Follow-ups, Daily Reminders
 *
 * ─── Transport: WEBHOOK MODE ─────────────────────────────────
 * Uses Express + Telegraf webhook for permanent stability on Railway.
 * Polling mode would exit when the long-poll resolves; webhook mode
 * keeps the Express HTTP server alive indefinitely.
 *
 * ─── Context Routing ─────────────────────────────────────────
 * OPS_GROUP_ID (-1003967447285) → Operations management mode
 * All other chats                → Public bot mode (property search, AI, etc.)
 *
 * ─── Stability Layer (v6) ────────────────────────────────────
 * - Global uncaught exception / unhandled rejection handlers
 * - All handlers wrapped in safeHandler / safeCallback
 * - Health monitoring with self-ping and webhook verification
 * - Graceful shutdown with DB cleanup
 * - Structured logging with timestamps
 */

// ─── Global Process Error Handlers ──────────────────────────
// These MUST be registered before anything else to catch startup errors.
// They log errors but do NOT crash the process.
process.on('uncaughtException', (err) => {
  try {
    const log = require('./utils/logger');
    log.error('Process', 'UNCAUGHT EXCEPTION (process kept alive)', {
      error: err.message,
      stack: (err.stack || '').split('\n').slice(0, 5).join(' → '),
    });
  } catch (_) {
    console.error('[FATAL] Uncaught Exception:', err);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  try {
    const log = require('./utils/logger');
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack || '').split('\n').slice(0, 5).join(' → ') : '';
    log.error('Process', 'UNHANDLED REJECTION (process kept alive)', {
      error: msg,
      stack,
    });
  } catch (_) {
    console.error('[FATAL] Unhandled Rejection:', reason);
  }
});

const { Telegraf, session } = require("telegraf");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ─── Utilities ──────────────────────────────────────────────
const log = require("./utils/logger");
const { safeHandler, safeCallback, getLastMessageTime } = require("./utils/resilience");
const healthMonitor = require("./utils/health");

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
  handleDoneCallback,
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

// Meeting Management System
const {
  handleScheduleMeeting,
  handleListMeetings,
  handleMeetingNotes,
  handleCancelMeeting,
} = require("./handlers/meetings");

// v5 Database Init
const { initV5Tables } = require("./services/ops-database-v5");
// Admin Panel handler (topic 15, thread 235)
const { handleOpsAdmin, guardAdminTopic, ADMIN_PANEL_THREAD } = require("./handlers/ops-admin");

// Appointment Scheduling System
const {
  handleAppointment,
  handleAppointments,
  handleCancelAppointment,
} = require("./handlers/appointments");

// WhatsApp Business API Integration
const {
  handleWhatsApp,
  registerWhatsAppWebhook,
  handleTelegramReplyToWhatsApp,
} = require("./handlers/whatsapp");
const whatsappService = require("./services/whatsapp");

// Silent Activity Logger + Smart Photo-Task Matcher
const activityLogger = require("./services/activity-logger");

// Contact Management System
const {
  handleAddContact,
  handleEditContact,
  handleDeleteContact,
  handleContacts,
  handleContactSearch,
  handleContactTextInput,
  hasActiveSession: hasActiveContactSession,
  setContactsTopicThread,
  getOrCreateContactsTopic,
  postOrEnsurePinnedGuide,
  postCEOAnnouncement,
} = require("./handlers/contacts");

// Smart Hybrid Translation System
const translationService = require("./services/translation");
const { handleTranslate } = require("./handlers/translate");

// AI Operations Consultant
const consultant = require("./services/consultant");
const { handleConsultant } = require("./handlers/consultant");

// Team Management (addmember, removemember, editmember, team display)
const {
  handleTeam: handleTeamManage,
  handleAddMember,
  handleRemoveMember,
  handleEditMember,
} = require("./handlers/team-manage");
const { loadFromDatabase: loadTeamFromDb } = require("./team-members");

// ─── Ops Group ID ─────────────────────────────────────────────
const OPS_GROUP_ID = -1003967447285;

function isOpsGroup(ctx) {
  return ctx.chat?.id === OPS_GROUP_ID;
}

// ─── Initialize Bot ───────────────────────────────────────────
const bot = new Telegraf(config.botToken);
bot.use(session());

// Initialize public database
try {
  db.getDb();
  log.info('Boot', 'Public database initialized');
} catch (e) {
  log.error('Boot', 'Public database init failed (non-fatal)', { error: e.message });
}

// ─── Global Error Handler (Telegraf) ─────────────────────────
bot.catch((err, ctx) => {
  const cmd = ctx.message?.text?.split(" ")[0] || "unknown";
  const chat = ctx.chat?.id || "unknown";
  const userId = ctx.from?.id || "unknown";
  log.error('Bot', `Unhandled error in command "${cmd}"`, {
    chatId: chat,
    userId,
    error: err.message,
    stack: (err.stack || '').split('\n').slice(0, 3).join(' → '),
  });
  // Never send error replies in the ops group — only in private chats
  const isPrivate = ctx.chat?.type === 'private';
  if (isPrivate && ctx.reply) {
    ctx.reply(`❌ An error occurred. Please try again.`).catch(() => {});
  }
});

// ─── Command Handlers ─────────────────────────────────────────
// Ops commands are registered globally but gated by isOpsGroup() inside.
// Public commands are ignored in the ops group.

// /start — only in private chats
bot.start(safeHandler('cmd:start', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleStart(ctx);
}));

// /help — only in private chats
bot.help(safeHandler('cmd:help', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleHelp(ctx);
}));

// /search — only in private chats
bot.command("search", safeHandler('cmd:search', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleSearch(ctx);
}));

bot.command("language", safeHandler('cmd:language', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleLanguage(ctx);
}));

bot.command("notifications", safeHandler('cmd:notifications', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleNotifications(ctx);
}));

// Phase 2: Booking commands (private only)
bot.command("book", safeHandler('cmd:book', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleBook(ctx);
}));
bot.command("mybookings", safeHandler('cmd:mybookings', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleMyBookings(ctx);
}));

// Phase 2: Alert commands (private only)
bot.command("alerts", safeHandler('cmd:alerts', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleAlerts(ctx);
}));
bot.command("subscribe", safeHandler('cmd:subscribe', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleSubscribe(ctx);
}));
bot.command("unsubscribe", safeHandler('cmd:unsubscribe', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleUnsubscribe(ctx);
}));

// Phase 3: Admin commands
bot.command("admin", safeHandler('cmd:admin', (ctx) => {
  if (isOpsGroup(ctx)) return handleOpsAdmin(ctx);
  return handleAdminLogin(ctx);
}));
bot.command("stats", safeHandler('cmd:stats', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleStats(ctx);
}));
bot.command("broadcast", safeHandler('cmd:broadcast', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleBroadcast(ctx);
}));
bot.command("manage_bookings", safeHandler('cmd:manage_bookings', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleManageBookings(ctx);
}));
bot.command("manage_listings", safeHandler('cmd:manage_listings', (ctx) => {
  if (isOpsGroup(ctx)) return;
  return handleManageListings(ctx);
}));

// ─── Phase 4: Ops Group Commands ─────────────────────────────

bot.command("task",          safeHandler('ops:task',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsTask(ctx); }));
bot.command("checklist",     safeHandler('ops:checklist',     (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsChecklist(ctx); }));
bot.command("tasks",         safeHandler('ops:tasks',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsTasks(ctx); }));
bot.command("done",          safeHandler('ops:done',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsDone(ctx); }));
bot.command("remind",        safeHandler('ops:remind',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsRemind(ctx); }));
bot.command("summary",       safeHandler('ops:summary',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsSummary(ctx); }));
bot.command("kpi",           safeHandler('ops:kpi',           (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsKpi(ctx); }));
bot.command("property",      safeHandler('ops:property',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsProperty(ctx); }));
bot.command("move",          safeHandler('ops:move',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsMove(ctx); }));

// Phase 4 v3
bot.command("sla",           safeHandler('ops:sla',           (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsSla(ctx); }));
bot.command("approve",       safeHandler('ops:approve',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsApprove(ctx); }));
bot.command("reject",        safeHandler('ops:reject',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsReject(ctx); }));
bot.command("recurring",     safeHandler('ops:recurring',     (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsRecurring(ctx); }));
bot.command("depends",       safeHandler('ops:depends',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsDepends(ctx); }));
bot.command("handover",      safeHandler('ops:handover',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsHandover(ctx); }));
bot.command("monthlyreport", safeHandler('ops:monthlyreport', (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsMonthlyReport(ctx); }));
bot.command("expense",       safeHandler('ops:expense',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsExpense(ctx); }));
bot.command("expenses",      safeHandler('ops:expenses',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsExpenses(ctx); }));
bot.command("occupancy",     safeHandler('ops:occupancy',     (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsOccupancy(ctx); }));
bot.command("meeting",       safeHandler('ops:meeting',       (ctx) => {
  if (!isOpsGroup(ctx)) return;
  // Route: /meeting start|end|note|status → existing real-time handler
  // Route: /meeting "Title" ... or /meeting with scheduling args → new scheduler
  const text = (ctx.message.text || "").replace(/^\/meeting(?:@\S+)?\s*/, "").trim();
  const isRealtime = /^(start|end|note|status)\b/i.test(text);
  if (isRealtime || !text) {
    return handleOpsMeeting(ctx);
  }
  return handleScheduleMeeting(ctx);
}));
bot.command("meetings",      safeHandler('ops:meetings',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleListMeetings(ctx); }));
bot.command("notes",         safeHandler('ops:notes',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleMeetingNotes(ctx); }));
bot.command("cancel_meeting", safeHandler('ops:cancel_meeting', (ctx) => { if (!isOpsGroup(ctx)) return; return handleCancelMeeting(ctx); }));
bot.command("gsync",         safeHandler('ops:gsync',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsGsync(ctx); }));

// Phase 4 v4
bot.command("setrole",       safeHandler('ops:setrole',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsSetRole(ctx); }));
bot.command("roles",         safeHandler('ops:roles',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsRoles(ctx); }));
bot.command("audit",         safeHandler('ops:audit',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsAudit(ctx); }));
bot.command("verify",        safeHandler('ops:verify',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsVerify(ctx); }));
bot.command("onboarding",    safeHandler('ops:onboarding',    (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsOnboarding(ctx); }));
bot.command("team",          safeHandler('ops:team',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleTeamManage(ctx); }));
bot.command("performance",   safeHandler('ops:performance',   (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsPerformance(ctx); }));
bot.command("leaderboard",   safeHandler('ops:leaderboard',   (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsLeaderboard(ctx); }));
bot.command("away",          safeHandler('ops:away',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsAway(ctx); }));
bot.command("back",          safeHandler('ops:back',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsBack(ctx); }));
bot.command("availability",  safeHandler('ops:availability',  (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsAvailability(ctx); }));
bot.command("poll",          safeHandler('ops:poll',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsPoll(ctx); }));
bot.command("pin",           safeHandler('ops:pin',           (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsPin(ctx); }));

// Phase 4 v5
bot.command("mlog",          safeHandler('ops:mlog',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsMlog(ctx); }));
bot.command("workflow",      safeHandler('ops:workflow',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsWorkflow(ctx); }));
bot.command("template",      safeHandler('ops:template',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsTemplate(ctx); }));
bot.command("trends",        safeHandler('ops:trends',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsTrends(ctx); }));
bot.command("weather",       safeHandler('ops:weather',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsWeather(ctx); }));
bot.command("clean",         safeHandler('ops:clean',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsClean(ctx); }));
bot.command("idea",          safeHandler('ops:idea',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsIdea(ctx); }));
bot.command("ideas",         safeHandler('ops:ideas',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsIdeas(ctx); }));
bot.command("brainstorm",    safeHandler('ops:brainstorm',    (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsBrainstorm(ctx); }));
bot.command("photos",        safeHandler('ops:photos',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleOpsPhotos(ctx); }));

// Phase 6: Appointment Scheduling System
bot.command("appointment",       safeHandler('ops:appointment',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleAppointment(ctx); }));
bot.command("appointments",      safeHandler('ops:appointments',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleAppointments(ctx); }));
bot.command("cancel_appointment", safeHandler('ops:cancel_appointment', (ctx) => { if (!isOpsGroup(ctx)) return; return handleCancelAppointment(ctx); }));

// Phase 6: WhatsApp Business API Integration
bot.command("whatsapp",          safeHandler('ops:whatsapp',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleWhatsApp(ctx); }));

// Contact Management System
bot.command("addcontact",        safeHandler('ops:addcontact',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleAddContact(ctx); }));
bot.command("contacts",          safeHandler('ops:contacts',          (ctx) => { if (!isOpsGroup(ctx)) return; return handleContacts(ctx); }));
bot.command("contact",           safeHandler('ops:contact',           (ctx) => { if (!isOpsGroup(ctx)) return; return handleContactSearch(ctx); }));
bot.command("deletecontact",     safeHandler('ops:deletecontact',     (ctx) => { if (!isOpsGroup(ctx)) return; return handleDeleteContact(ctx); }));
bot.command("editcontact",       safeHandler('ops:editcontact',       (ctx) => { if (!isOpsGroup(ctx)) return; return handleEditContact(ctx); }));

// Smart Hybrid Translation System
bot.command("translate",         safeHandler('ops:translate',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleTranslate(ctx); }));

// AI Operations Consultant
bot.command("consultant",        safeHandler('ops:consultant',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleConsultant(ctx); }));

// Team Management — override /team with clean bilingual display, add /addmember etc.
bot.command("addmember",         safeHandler('ops:addmember',         (ctx) => { if (!isOpsGroup(ctx)) return; return handleAddMember(ctx); }));
bot.command("removemember",      safeHandler('ops:removemember',      (ctx) => { if (!isOpsGroup(ctx)) return; return handleRemoveMember(ctx); }));
bot.command("editmember",        safeHandler('ops:editmember',        (ctx) => { if (!isOpsGroup(ctx)) return; return handleEditMember(ctx); }));

// ─── Text Message Handler ───────────────────────────────────────
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

bot.on("text", safeHandler('on:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  const isPrivate = chatType === "private";
  const userMessage = ctx.message.text || "";

  // ── Phase 4: Ops Group ───────────────────────────────────────
  if (isOpsGroup(ctx)) {
    // Skip slash commands here — they are handled by bot.command() above.
    if (userMessage.startsWith("/")) return;

    // ── Silent activity logging (never replies) ────────────────
    try { activityLogger.logTextActivity(ctx); } catch (e) {}

    // ── Contact Management: conversational flow routing ─────
    if (hasActiveContactSession(ctx)) {
      try {
        const handled = await handleContactTextInput(ctx, bot);
        if (handled) return;
      } catch (e) {
        log.error('Bot', 'Contact text input error', { error: e.message });
      }
    }

    // Admin topic guard: block non-admins from posting in the Admin Panel topic (thread 235)
    const msgThreadId = ctx.message?.message_thread_id;
    if (msgThreadId === ADMIN_PANEL_THREAD) {
      const blocked = await guardAdminTopic(ctx).catch(() => false);
      if (blocked) return;

      // WhatsApp reply bridge: if replying to a forwarded WhatsApp message, send back via WhatsApp
      if (ctx.message.reply_to_message) {
        try {
          const handled = await handleTelegramReplyToWhatsApp(ctx);
          if (handled) return;
        } catch (e) {
          log.error('Bot', 'WhatsApp reply bridge error', { error: e.message });
        }
      }
    }
    // v4 passive monitoring: sensitive data, topic routing, mentions, check-in
    try {
      await handleV4Passive(ctx);
    } catch (e) {
      log.error('Bot', 'v4 passive error', { error: e.message });
    }

    // v3 passive monitoring: detect follow-up promises
    try {
      await handleOpsPassive(ctx);
    } catch (e) {
      log.error('Bot', 'v3 passive error', { error: e.message });
    }

    // Active AI response: only when @mentioned or replying to bot
    const botUsername = bot.botInfo?.username || "monthlykey_bot";
    const isMentioned = userMessage.includes(`@${botUsername}`);
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === bot.botInfo?.id;

    if (isMentioned || isReplyToBot) {
      try {
        await handleOpsMessage(ctx, ai.getOpenAIClient());
      } catch (e) {
        log.error('Bot', 'Ops AI message error', { error: e.message });
      }
    }

    // Smart auto-translation: runs LAST, after all other handlers
    try {
      const result = await translationService.processAutoTranslation(userMessage, ctx);
      if (result.shouldTranslate && result.translation) {
        const threadId = ctx.message?.message_thread_id;
        await ctx.reply(
          `\uD83D\uDD04 "${result.translation}"`,
          {
            ...(threadId ? { message_thread_id: threadId } : {}),
            reply_to_message_id: ctx.message.message_id,
          }
        );
      }
    } catch (e) {
      log.error('Bot', 'Auto-translation error', { error: e.message });
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
    log.error('Bot', 'Error in text handler AI response', { error: error.message, chatId });
    try {
      await ctx.reply(t(lang, "error"), { message_thread_id: ctx.message?.message_thread_id || undefined });
    } catch (e) {
      log.error('Bot', 'Could not send error reply', { error: e.message });
    }
  }
}));

// ─── Phase 4: Ops Group — Photo/Document Logging (Feature 6) ──
bot.on(["photo", "document", "video"], safeHandler('on:media', async (ctx) => {
  if (!isOpsGroup(ctx)) return;

  // Silent activity logging + smart photo-task matching (never replies)
  if (ctx.message?.photo) {
    try { activityLogger.logPhotoActivity(ctx); } catch (e) {}
  } else {
    try { activityLogger.logDocumentActivity(ctx); } catch (e) {}
  }

  await handleOpsMedia(ctx);

  // Smart auto-translation for photo/document captions
  const caption = ctx.message?.caption || "";
  if (caption) {
    try {
      const result = await translationService.processAutoTranslation(caption, ctx);
      if (result.shouldTranslate && result.translation) {
        const threadId = ctx.message?.message_thread_id;
        await ctx.reply(
          `\uD83D\uDD04 "${result.translation}"`,
          {
            ...(threadId ? { message_thread_id: threadId } : {}),
            reply_to_message_id: ctx.message.message_id,
          }
        );
      }
    } catch (e) {
      log.error('Bot', 'Auto-translation (caption) error', { error: e.message });
    }
  }
}));

// ─── Phase 4: Ops Group — Voice Note Transcription (Feature 10) ─
bot.on(["voice", "audio"], safeHandler('on:voice', async (ctx) => {
  if (!isOpsGroup(ctx)) return;

  // Silent activity logging (never replies)
  try { activityLogger.logVoiceActivity(ctx); } catch (e) {}

  await handleOpsVoice(ctx, ai.getOpenAIClient());
}));

// ─── Phase 4 v4: New Member Welcome ──────────────────────────
bot.on("new_chat_members", safeHandler('on:new_member', async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  for (const member of ctx.message.new_chat_members) {
    await handleNewMember(ctx, member);
  }
}));

// ─── Phase 4 v4: Poll Callbacks ─────────────────────────────
bot.action(/^poll_vote_/, safeCallback('cb:poll_vote', async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  await handlePollCallback(ctx);
}));

bot.action(/^photo_(approve|reject)_(\d+)$/, safeCallback('cb:photo_review', async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  await handlePhotoReviewCallback(ctx);
}));

// ─── Phase 5 v5: Idea Vote Callbacks ────────────────────────
bot.action(/^idea_vote_\d+$/, safeCallback('cb:idea_vote', async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  await handleIdeaVoteCallback(ctx);
}));

// ─── Task Done Callbacks (inline buttons) ────────────────────
bot.action(/^done_\d+$/, safeCallback('cb:done_task', async (ctx) => {
  if (!isOpsGroup(ctx)) return;
  await handleDoneCallback(ctx);
}));

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
        { command: "meeting",       description: "Schedule/manage meeting | جدولة اجتماع" },
        { command: "meetings",      description: "List meetings | عرض الاجتماعات" },
        { command: "notes",         description: "Meeting notes | محضر اجتماع" },
        { command: "cancel_meeting", description: "Cancel meeting | إلغاء اجتماع" },
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
        { command: "onboarding",    description: "Onboarding guide | دليل الانضمام" },
        { command: "team",          description: "Team directory | دليل الفريق" },
        { command: "performance",   description: "Performance scores | درجات الأداء" },
        { command: "leaderboard",   description: "Team leaderboard | لوحة المتصدرين" },
        { command: "away",          description: "Mark as away | تعيين غياب" },
        { command: "back",          description: "Mark as back | تعيين عودة" },
        { command: "availability",  description: "Team availability | توفر الفريق" },
        { command: "poll",          description: "Create poll | إنشاء استطلاع" },
        { command: "pin",           description: "Pin a summary in topic" },
        { command: "mlog",          description: "Log maintenance" },
        { command: "workflow",      description: "Manage workflows" },
        { command: "template",      description: "Message templates" },
        { command: "trends",        description: "View trends" },
        { command: "weather",       description: "Check weather" },
        { command: "clean",         description: "Cleaning log" },
        { command: "idea",          description: "Submit idea" },
        { command: "ideas",         description: "Idea board" },
        { command: "brainstorm",    description: "Start brainstorm" },
        { command: "photos",        description: "Property photos" },
        { command: "addcontact",    description: "Add contact | إضافة جهة اتصال" },
        { command: "contacts",      description: "List contacts | جهات الاتصال" },
        { command: "contact",       description: "Search contacts | بحث جهات اتصال" },
        { command: "editcontact",   description: "Edit contact | تعديل جهة اتصال" },
        { command: "deletecontact", description: "Delete contact | حذف جهة اتصال" },
        { command: "translate",      description: "Translate message | ترجمة رسالة" },
        { command: "consultant",     description: "AI consultant report | تقرير المستشار" },
        { command: "addmember",      description: "Add team member | إضافة عضو" },
        { command: "removemember",   description: "Remove team member | إزالة عضو" },
        { command: "editmember",     description: "Edit team member role | تعديل دور" },
      ], { scope: { type: "chat", chat_id: OPS_GROUP_ID } }
    );

    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Monthly Key 🔑",
        web_app: { url: config.webappUrl },
      },
    });

    log.info('Bot', 'Commands and Menu Button configured');
    log.info('Bot', `Mini App URL: ${config.webappUrl}`);
    log.info('Bot', `Ops Group ID: ${OPS_GROUP_ID}`);

    if (config.adminIds.length > 0) {
      log.info('Bot', `Admin IDs: ${config.adminIds.join(", ")}`);
    }

    initChannelPosting(bot);
  } catch (error) {
    log.error('Bot', 'Error setting up commands/menu', { error: error.message });
  }
}

// ─── Initialize DB Tables ─────────────────────────────────────
// Must happen BEFORE the bot starts handling updates.
let v4Ready = false;
let v5Ready = false;

try {
  initV4();
  v4Ready = true;
  log.info('Boot', 'v4 tables initialized');
} catch (e) {
  log.error('Boot', 'v4 init error', { error: e.message });
}
try {
  initV5Tables();
  v5Ready = true;
  log.info('Boot', 'v5 tables initialized');
} catch (e) {
  log.error('Boot', 'v5 init error', { error: e.message });
}

// ─── WEBHOOK MODE ─────────────────────────────────────────────
// Railway keeps Express web servers alive permanently.
// Telegram pushes updates to our HTTPS endpoint — no polling needed.
// This eliminates the "polling process exits" problem entirely.

const PORT = process.env.PORT || 3000;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN || "telegram-bot-production-87a1.up.railway.app";
const WEBHOOK_PATH   = `/webhook/${config.botToken}`;
const WEBHOOK_URL    = `https://${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // For Twilio WhatsApp webhook

// ─── Request timeout middleware ──────────────────────────────
// Ensure webhook requests don't hang forever
app.use((req, res, next) => {
  // Set a 25-second timeout for all requests
  req.setTimeout(25000);
  res.setTimeout(25000);
  next();
});

// ─── Health check endpoint — enhanced with detailed status ──
app.get("/", (req, res) => {
  const errorStats = log.getErrorStats();
  const lastMsg = getLastMessageTime();
  res.json({
    status: "ok",
    mode: "webhook",
    bot: bot.botInfo ? "@" + bot.botInfo.username : "starting",
    uptime: Math.round(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    lastMessageProcessed: lastMsg ? new Date(lastMsg).toISOString() : null,
    lastMessageAgo: lastMsg ? Math.round((Date.now() - lastMsg) / 1000) + 's' : null,
    errors: {
      total: errorStats.totalErrors,
      recent: errorStats.recentErrors,
    },
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    subsystems: {
      v4: v4Ready,
      v5: v5Ready,
      webhook: WEBHOOK_URL,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  const errorStats = log.getErrorStats();
  const lastMsg = getLastMessageTime();
  res.json({
    status: "ok",
    mode: "webhook",
    bot: bot.botInfo ? "@" + bot.botInfo.username : "starting",
    uptime: Math.round(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    lastMessageProcessed: lastMsg ? new Date(lastMsg).toISOString() : null,
    lastMessageAgo: lastMsg ? Math.round((Date.now() - lastMsg) / 1000) + 's' : null,
    errors: {
      total: errorStats.totalErrors,
      recent: errorStats.recentErrors,
    },
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    subsystems: {
      v4: v4Ready,
      v5: v5Ready,
      webhook: WEBHOOK_URL,
    },
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ─── Webhook endpoint — return 200 quickly, process in background ──
app.post(WEBHOOK_PATH, (req, res) => {
  // Immediately acknowledge receipt to Telegram
  // This prevents Telegram from retrying if processing takes time
  res.status(200).json({ ok: true });

  // Process the update in the background
  try {
    bot.handleUpdate(req.body).catch((err) => {
      log.error('Webhook', 'Error processing update in background', {
        error: err.message,
        updateId: req.body?.update_id,
      });
    });
  } catch (err) {
    log.error('Webhook', 'Sync error handling update', {
      error: err.message,
      updateId: req.body?.update_id,
    });
  }
});

// ─── Start Express + Register Webhook ────────────────────────
async function startWebhook() {
  log.startupBanner({ port: PORT });

  // 1. Fetch bot info first (needed by handlers that reference bot.botInfo)
  try {
    bot.botInfo = await bot.telegram.getMe();
    log.info('Boot', `Connected as @${bot.botInfo.username}`);
  } catch (e) {
    log.error('Boot', 'getMe failed — will retry in 10s', { error: e.message });
    // Retry once after delay
    await new Promise(r => setTimeout(r, 10000));
    try {
      bot.botInfo = await bot.telegram.getMe();
      log.info('Boot', `Connected as @${bot.botInfo.username} (retry)`);
    } catch (e2) {
      log.error('Boot', 'getMe retry also failed', { error: e2.message });
    }
  }

  // 2. Register webhook with Telegram (with verification)
  try {
    // First check current webhook status
    const currentInfo = await bot.telegram.getWebhookInfo();
    if (currentInfo.url === WEBHOOK_URL) {
      log.info('Boot', 'Webhook already correctly registered', { url: WEBHOOK_URL });
    } else {
      log.info('Boot', 'Registering webhook...', {
        current: currentInfo.url || '(none)',
        target: WEBHOOK_URL,
      });
      await bot.telegram.setWebhook(WEBHOOK_URL, {
        drop_pending_updates: true,
        allowed_updates: [
          "message", "edited_message", "callback_query",
          "inline_query", "chosen_inline_result",
          "chat_member", "my_chat_member",
        ],
      });
      log.info('Boot', `Webhook registered: ${WEBHOOK_URL}`);
    }

    // Verify webhook was set correctly
    const verifyInfo = await bot.telegram.getWebhookInfo();
    if (verifyInfo.url === WEBHOOK_URL) {
      log.info('Boot', 'Webhook verified OK');
    } else {
      log.warn('Boot', 'Webhook verification mismatch', {
        expected: WEBHOOK_URL,
        actual: verifyInfo.url,
      });
    }
  } catch (e) {
    log.error('Boot', 'setWebhook failed', { error: e.message });
  }

  // 3. Start Express server
  app.listen(PORT, () => {
    log.info('Boot', `HTTP server listening on port ${PORT}`);
  });

  // 4. Run one-time setup (commands, menu button, channel posting)
  await setupBot();

  // 5. Load extended team members from database (merges with hardcoded registry)
  try {
    loadTeamFromDb();
    log.info('Boot', 'Team registry loaded (hardcoded + database members)');
  } catch (e) {
    log.error('Boot', 'Team registry load error (non-fatal)', { error: e.message });
  }

  // 5a. Start the ops scheduler (cron jobs: morning briefing, check-ins, daily report)
  startOpsScheduler(bot);

  // 5b. Register WhatsApp webhook endpoint
  registerWhatsAppWebhook(app, bot);
  if (whatsappService.isConfigured()) {
    log.info('Boot', 'WhatsApp integration: ENABLED');
  } else {
    log.info('Boot', 'WhatsApp integration: DISABLED (set TWILIO_* env vars to enable)');
  }

  // 5c. Initialize Contacts topic + post pinned guide + CEO announcement
  try {
    // Check env var first, then try to create
    if (process.env.CONTACTS_TOPIC_THREAD_ID) {
      setContactsTopicThread(parseInt(process.env.CONTACTS_TOPIC_THREAD_ID));
      log.info('Boot', `Contacts topic: thread ${process.env.CONTACTS_TOPIC_THREAD_ID} (from env)`);
    } else {
      const threadId = await getOrCreateContactsTopic(bot);
      if (threadId) {
        log.info('Boot', `Contacts topic: thread ${threadId} (created/cached)`);
      } else {
        log.info('Boot', 'Contacts topic: will use General topic (fallback)');
      }
    }

    // Post and pin the guide in the Contacts topic (idempotent — skips if already posted)
    await postOrEnsurePinnedGuide(bot);

    // Post one-time CEO announcement in the CEO Update topic (idempotent — skips if already sent)
    await postCEOAnnouncement(bot);
  } catch (e) {
    log.error('Boot', 'Contacts topic init error', { error: e.message });
  }

  // 6. Start health monitor (self-ping + webhook verification)
  healthMonitor.init(bot, WEBHOOK_URL, PORT);

  // 7. Log system readiness
  log.systemReady({
    'Express Server': true,
    'Webhook': true,
    'Bot Info': !!bot.botInfo,
    'Public DB': true,
    'Ops DB v4': v4Ready,
    'Ops DB v5': v5Ready,
    'Scheduler': true,
    'Health Monitor': true,
    'Channel Posting': true,
    'WhatsApp/Twilio': whatsappService.isConfigured(),
    'Contacts System': true,
    'AI Consultant': true,
    'Team Management': true,
  });

  // 8. Trigger one-time demo consultant report on first deploy
  try {
    const opsDb = require('./services/ops-database');
    const demoSent = opsDb.getBotState('consultant_demo_sent');
    if (!demoSent) {
      log.info('Boot', 'Triggering one-time consultant demo report...');
      opsDb.setBotState('consultant_demo_sent', 'true');
      // Run async — don't block startup
      consultant.generateTodayReport(bot).then(result => {
        if (result.success) {
          log.info('Boot', `Consultant demo report posted (msg ${result.messageId})`);
        } else {
          log.error('Boot', `Consultant demo report failed: ${result.error}`);
        }
      }).catch(e => {
        log.error('Boot', 'Consultant demo report error', { error: e.message });
      });
    }
  } catch (e) {
    log.error('Boot', 'Consultant demo init error', { error: e.message });
  }

  writeHeartbeat();
}

startWebhook().catch((err) => {
  log.error('Boot', 'Fatal startup error', { error: err.message, stack: err.stack });
  // Don't exit immediately — give logs time to flush
  setTimeout(() => process.exit(1), 2000);
});

// ─── Graceful Shutdown ──────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info('Shutdown', `Received ${signal} — starting graceful shutdown...`);

  // 1. Stop accepting new updates
  try {
    healthMonitor.stop();
    log.info('Shutdown', 'Health monitor stopped');
  } catch (e) {
    log.warn('Shutdown', 'Error stopping health monitor', { error: e.message });
  }

  // 2. Stop channel posting
  try {
    stopChannelPosting();
    log.info('Shutdown', 'Channel posting stopped');
  } catch (e) {
    log.warn('Shutdown', 'Error stopping channel posting', { error: e.message });
  }

  // 3. Stop scheduler
  try {
    stopOpsScheduler();
    log.info('Shutdown', 'Ops scheduler stopped');
  } catch (e) {
    log.warn('Shutdown', 'Error stopping scheduler', { error: e.message });
  }

  // 4. Close database connections
  try {
    const publicDb = db.getDb();
    if (publicDb && publicDb.open) {
      publicDb.close();
      log.info('Shutdown', 'Public database closed');
    }
  } catch (e) {
    log.warn('Shutdown', 'Error closing public database', { error: e.message });
  }

  try {
    const opsDb = require("./services/ops-database");
    const opsDbInstance = opsDb.getDb();
    if (opsDbInstance && opsDbInstance.open) {
      opsDbInstance.close();
      log.info('Shutdown', 'Ops database closed');
    }
  } catch (e) {
    log.warn('Shutdown', 'Error closing ops database', { error: e.message });
  }

  try {
    const opsDbV5 = require("./services/ops-database-v5");
    // v5 uses its own getDb() — try to close it
    if (typeof opsDbV5.closeDb === 'function') {
      opsDbV5.closeDb();
      log.info('Shutdown', 'Ops v5 database closed');
    }
  } catch (e) {
    log.warn('Shutdown', 'Error closing ops v5 database', { error: e.message });
  }

  log.info('Shutdown', 'Graceful shutdown complete. Exiting.');

  // Give logs time to flush
  setTimeout(() => process.exit(0), 1000);
}

process.once("SIGINT", () => gracefulShutdown('SIGINT'));
process.once("SIGTERM", () => gracefulShutdown('SIGTERM'));
