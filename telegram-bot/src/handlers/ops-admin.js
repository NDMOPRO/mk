/**
 * ops-admin.js — Admin Panel Handler for Daily Operations HQ
 *
 * Topic: "15 — Admin Panel | لوحة الإدارة 🔐"
 * Thread ID: 235
 *
 * Only the root administrator (identified by ADMIN_IDS or ADMIN_USERNAME env vars)
 * can use commands in this topic. All other users get a restriction message.
 *
 * Available subcommands:
 *   /admin config          — View bot configuration (non-sensitive)
 *   /admin logs [n]        — View last N audit log entries (default 20)
 *   /admin audit [user]    — View audit trail (all or by username)
 *   /admin roles           — View all team role assignments
 *   /admin setrole @u Role — Set a team member's role
 *   /admin schedule        — View all scheduled jobs & next run times
 *   /admin stats           — View bot usage statistics
 *   /admin db              — View database table sizes
 *   /admin env             — View non-sensitive environment variables
 *   /admin broadcast t msg — Send a message to a specific topic thread
 *   /admin test [cmd]      — Echo a command back (safe test)
 *   /admin help            — Show this command list
 */

"use strict";

const config = require("../config");
const opsDb = require("../services/ops-database");
const v4Db = require("../services/ops-database-v4");

// ─── Constants ──────────────────────────────────────────────
const OPS_GROUP_ID = -1003967447285;
const ADMIN_PANEL_THREAD = 235;

// All topic thread IDs for the broadcast subcommand
const TOPIC_THREADS = {
  rules: 3, ceo: 4, operations: 5, listings: 6,
  bookings: 7, support: 8, tech: 9, payments: 10,
  marketing: 11, legal: 12, blockers: 13, completed: 14,
  priorities: 15, admin: 235,
};

// Scheduled jobs metadata (for the /admin schedule subcommand)
const SCHEDULED_JOBS = [
  { name: "weather_alerts",     label: "☀️ Weather Alerts",         schedule: "7:00 AM KSA daily" },
  { name: "morning_briefing",   label: "🌅 Morning Briefing",       schedule: "9:00 AM KSA daily → CEO Update" },
  { name: "checkin_reminder",   label: "📋 Check-in Reminder",      schedule: "5:00 PM KSA daily → CEO Update" },
  { name: "evening_reminder",   label: "🌆 Evening Reminder",       schedule: "6:00 PM KSA daily → General" },
  { name: "unchecked_flag",     label: "🚩 Unchecked Flag",         schedule: "6:00 PM KSA daily" },
  { name: "daily_report",       label: "📊 Daily Report",           schedule: "9:00 PM KSA daily → CEO Update" },
  { name: "google_sync",        label: "🔄 Google Sync",            schedule: "9:15 PM KSA daily" },
  { name: "weekly_ceo",         label: "👑 Weekly CEO Message",     schedule: "Sunday 9:00 AM KSA" },
  { name: "weekly_standup",     label: "📋 Weekly Standup",         schedule: "Sunday 9:00 AM KSA" },
  { name: "escalation_check",   label: "🚨 Escalation Checker",     schedule: "Every 5 minutes" },
  { name: "vendor_followups",   label: "📞 Vendor Follow-ups",      schedule: "Every 5 minutes" },
  { name: "sla_checker",        label: "⏱️ SLA Checker",            schedule: "Every 5 minutes" },
  { name: "recurring_tasks",    label: "🔁 Recurring Tasks",        schedule: "Every 5 minutes" },
  { name: "mention_alerts",     label: "🔔 Mention Alerts",         schedule: "Every 5 minutes" },
  { name: "priority_escalation",label: "📌 Priority Escalation",    schedule: "Every 5 minutes" },
  { name: "overdue_pings",      label: "⏰ Overdue Pings",          schedule: "Every 60 minutes" },
  { name: "reminders",          label: "🔔 Reminders & Follow-ups", schedule: "Every 1 minute" },
];

// ─── Admin Check ─────────────────────────────────────────────

/**
 * Returns true if the user is a root administrator.
 * Checks (in order):
 *   1. ADMIN_IDS env var — comma-separated Telegram user IDs
 *   2. ADMIN_USERNAME env var — comma-separated Telegram usernames (without @)
 *      e.g. "Monthlykey,hobart2007"
 *   3. ROOT_ADMIN_ID env var — single numeric Telegram user ID (legacy)
 */
function isRootAdmin(ctx) {
  const userId = ctx.from?.id;
  const username = (ctx.from?.username || "").toLowerCase();

  // 1. Check ADMIN_IDS (comma-separated numeric user IDs)
  if (config.adminIds && config.adminIds.length > 0) {
    if (config.adminIds.includes(userId)) return true;
  }

  // 2. Check ADMIN_USERNAME (comma-separated usernames, case-insensitive)
  //    Supports both single value ("Monthlykey") and multiple ("Monthlykey,hobart2007")
  if (config.adminUsername) {
    const adminUsernames = config.adminUsername
      .split(",")
      .map(u => u.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);
    if (username && adminUsernames.includes(username)) return true;
  }

  // 3. Check ROOT_ADMIN_ID env var (additional safety net)
  const rootId = parseInt(process.env.ROOT_ADMIN_ID || "0", 10);
  if (rootId && userId === rootId) return true;

  return false;
}

// ─── Utility ─────────────────────────────────────────────────

function extractArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function getBilingualText(en, ar) {
  return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Passive Guard ───────────────────────────────────────────

/**
 * Called for ANY message in the Admin Panel topic.
 * If the sender is not the root admin, reply with the restriction message.
 * Returns true if the message was blocked, false if it should proceed.
 */
async function guardAdminTopic(ctx) {
  const threadId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id;
  if (threadId !== ADMIN_PANEL_THREAD) return false; // Not in admin topic — don't block

  if (isRootAdmin(ctx)) return false; // Admin — allow through

  // Non-admin in admin topic — block and warn
  const en = "🔐 *This topic is restricted to administrators only.*";
  const ar = "🔐 *هذا الموضوع مقيد للمسؤولين فقط.*";
  try {
    await ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: ADMIN_PANEL_THREAD,
    });
  } catch (e) {
    // Silently ignore if we can't reply
  }
  return true; // Blocked
}

// ─── Main Handler ────────────────────────────────────────────

async function handleOpsAdmin(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const user = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

    // Admin check
    if (!isRootAdmin(ctx)) {
      const en = "🔐 *This topic is restricted to administrators only.*\n\nYour user ID has not been added to ADMIN\\_IDS.";
      const ar = "🔐 *هذا الموضوع مقيد للمسؤولين فقط.*\n\nلم يتم إضافة معرف المستخدم الخاص بك إلى ADMIN\\_IDS.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    const args = extractArgs(ctx.message.text, "admin");
    const [subCmd, ...rest] = args.split(/\s+/);
    const sub = (subCmd || "help").toLowerCase();

    // ─── help ───
    if (!sub || sub === "help") {
      const en = [
        "🔐 *Admin Panel — Command Reference*",
        "",
        "`/admin config` — Bot configuration (non-sensitive)",
        "`/admin logs [n]` — Last N audit log entries (default 20)",
        "`/admin audit [@user]` — Audit trail (all or by user)",
        "`/admin roles` — All team role assignments",
        "`/admin setrole @user Role` — Set a team member role",
        "`/admin schedule` — Scheduled jobs & next run times",
        "`/admin stats` — Bot usage statistics",
        "`/admin db` — Database table sizes",
        "`/admin env` — Non-sensitive environment variables",
        "`/admin broadcast [topic] [msg]` — Send to a topic",
        "`/admin test [text]` — Echo test (safe)",
      ].join("\n");
      const ar = [
        "🔐 *لوحة الإدارة — مرجع الأوامر*",
        "",
        "`/admin config` — إعدادات البوت (غير حساسة)",
        "`/admin logs [n]` — آخر N سجلات التدقيق (افتراضي 20)",
        "`/admin audit [@user]` — سجل التدقيق (الكل أو بمستخدم)",
        "`/admin roles` — جميع أدوار الفريق",
        "`/admin setrole @user Role` — تعيين دور لعضو",
        "`/admin schedule` — المهام المجدولة وأوقات التشغيل",
        "`/admin stats` — إحصائيات استخدام البوت",
        "`/admin db` — أحجام جداول قاعدة البيانات",
        "`/admin env` — متغيرات البيئة غير الحساسة",
        "`/admin broadcast [topic] [msg]` — إرسال لموضوع",
        "`/admin test [نص]` — اختبار الصدى (آمن)",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── config ───
    if (sub === "config") {
      const safeConfig = {
        aiModel: config.aiModel || "gpt-4.1-mini",
        apiBaseUrl: config.apiBaseUrl,
        webappUrl: config.webappUrl,
        websiteUrl: config.websiteUrl,
        channelCheckInterval: config.channelCheckInterval,
        adminIdsCount: (config.adminIds || []).length,
        adminUsernameSet: !!config.adminUsername,
        channelIdSet: !!config.channelId,
        paymentProviderSet: !!config.paymentProviderToken,
        openaiKeySet: !!config.openaiApiKey,
        botTokenSet: !!config.botToken,
      };
      const lines = Object.entries(safeConfig).map(([k, v]) => `• \`${k}\`: \`${v}\``).join("\n");
      const en = `⚙️ *Bot Configuration*\n\n${lines}`;
      const ar = `⚙️ *إعدادات البوت*\n\n${lines}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── logs [n] ───
    if (sub === "logs") {
      const limit = parseInt(rest[0] || "20", 10) || 20;
      const logs = v4Db.getAuditLog(chatId, Math.min(limit, 50));
      if (!logs || logs.length === 0) {
        const en = "📋 No audit log entries found.";
        const ar = "📋 لا توجد سجلات تدقيق.";
        return ctx.reply(getBilingualText(en, ar), { message_thread_id: threadId });
      }
      const lines = logs.map(l => {
        const ts = l.created_at ? new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", hour12: false }) : "?";
        return `• [${ts}] \`${l.action_type}\` by ${l.username || l.user_id} — ${(l.details || "").substring(0, 80)}`;
      }).join("\n");
      const en = `📋 *Last ${logs.length} Audit Log Entries*\n\n${lines}`;
      const ar = `📋 *آخر ${logs.length} سجل تدقيق*\n\n${lines}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── audit [@user] ───
    if (sub === "audit") {
      const targetUser = rest[0] ? rest[0].replace(/^@/, "") : null;
      const logs = targetUser
        ? v4Db.getAuditLogByUser(chatId, `@${targetUser}`, 30)
        : v4Db.getAuditLog(chatId, 30);
      if (!logs || logs.length === 0) {
        const en = `📋 No audit entries found${targetUser ? ` for @${escMd(targetUser)}` : ""}.`;
        const ar = `📋 لا توجد سجلات تدقيق${targetUser ? ` لـ @${escMd(targetUser)}` : ""}.`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const lines = logs.map(l => {
        const ts = l.created_at ? new Date(l.created_at).toLocaleString("en-GB", { timeZone: "Asia/Riyadh", hour12: false }) : "?";
        return `• [${ts}] \`${l.action_type}\` — ${l.username || l.user_id}: ${(l.details || "").substring(0, 80)}`;
      }).join("\n");
      const header = targetUser ? `Audit Trail for @${escMd(targetUser)}` : "Full Audit Trail";
      const headerAr = targetUser ? `سجل التدقيق لـ @${escMd(targetUser)}` : "سجل التدقيق الكامل";
      const en = `🔍 *${header}* (${logs.length} entries)\n\n${lines}`;
      const ar = `🔍 *${headerAr}* (${logs.length} سجل)\n\n${lines}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── roles ───
    if (sub === "roles") {
      const roles = v4Db.getAllRoles(chatId);
      if (!roles || roles.length === 0) {
        const en = "👥 No roles assigned yet. Use `/setrole @user Role` to assign roles.";
        const ar = "👥 لم يتم تعيين أدوار بعد. استخدم `/setrole @user Role` لتعيين الأدوار.";
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const roleEmoji = { ceo: "👑", manager: "👔", staff: "👤" };
      const lines = roles.map(r => {
        const emoji = roleEmoji[r.role] || "👤";
        const ts = r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GB") : "?";
        return `${emoji} @${escMd(r.username || r.display_name)} — *${r.role.toUpperCase()}* (set ${ts} by ${r.set_by || "?"})`;
      }).join("\n");
      const en = `👥 *Team Role Assignments* (${roles.length} members)\n\n${lines}`;
      const ar = `👥 *أدوار الفريق* (${roles.length} أعضاء)\n\n${lines}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── setrole @user Role ───
    if (sub === "setrole") {
      const targetRaw = rest[0] || "";
      const roleRaw = rest[1] || "";
      if (!targetRaw || !roleRaw) {
        const en = "❌ Usage: `/admin setrole @username Role`\nValid roles: CEO, Manager, Staff";
        const ar = "❌ الاستخدام: `/admin setrole @username Role`\nالأدوار: CEO, Manager, Staff";
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const targetUsername = targetRaw.replace(/^@/, "");
      const roleNorm = normalizeRole(roleRaw);
      if (!roleNorm) {
        const en = `❌ Unknown role: \`${roleRaw}\`\nValid roles: CEO, Manager, Staff`;
        const ar = `❌ دور غير معروف: \`${roleRaw}\`\nالأدوار الصحيحة: CEO, Manager, Staff`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const teamMember = v4Db.getTeamMemberByUsername(chatId, `@${targetUsername}`);
      const targetUserId = teamMember ? teamMember.user_id : 0;
      v4Db.setRole(chatId, targetUserId, `@${targetUsername}`, targetUsername, roleNorm.toLowerCase(), user);
      // Log to audit
      v4Db.addAuditLog(chatId, ctx.from.id, user, "setrole", "user", targetUserId || 0,
        `Set role of @${targetUsername} to ${roleNorm} via admin panel`, threadId);
      const en = `✅ *Role updated*\n\n👤 @${escMd(targetUsername)} is now *${roleNorm}*\n🔐 Set by: ${user}`;
      const ar = `✅ *تم تحديث الدور*\n\n👤 @${escMd(targetUsername)} الآن هو *${roleNorm}*\n🔐 تم التعيين بواسطة: ${user}`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── schedule ───
    if (sub === "schedule") {
      const lines = SCHEDULED_JOBS.map(j => `• ${j.label}\n  ⏰ ${j.schedule}`).join("\n");
      const en = `📅 *Scheduled Jobs (${SCHEDULED_JOBS.length} total)*\n\n${lines}\n\n_All times in KSA (UTC+3). Scheduler runs every 60 seconds._`;
      const ar = `📅 *المهام المجدولة (${SCHEDULED_JOBS.length} مهمة)*\n\n${lines}\n\n_جميع الأوقات بتوقيت السعودية (UTC+3). يعمل المجدول كل 60 ثانية._`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── stats ───
    if (sub === "stats") {
      try {
        const d = opsDb.getDb();
        const taskCount = d.prepare("SELECT COUNT(*) as n FROM tasks WHERE chat_id = ?").get(chatId)?.n || 0;
        const doneCount = d.prepare("SELECT COUNT(*) as n FROM tasks WHERE chat_id = ? AND status = 'done'").get(chatId)?.n || 0;
        const reminderCount = d.prepare("SELECT COUNT(*) as n FROM reminders WHERE chat_id = ?").get(chatId)?.n || 0;
        const expenseCount = d.prepare("SELECT COUNT(*) as n FROM expenses WHERE chat_id = ?").get(chatId)?.n || 0;
        const meetingCount = d.prepare("SELECT COUNT(*) as n FROM meetings WHERE chat_id = ?").get(chatId)?.n || 0;
        const approvalCount = d.prepare("SELECT COUNT(*) as n FROM approvals WHERE chat_id = ?").get(chatId)?.n || 0;
        const memberCount = v4Db.getTeamMembers(chatId)?.length || 0;
        const roleCount = v4Db.getAllRoles(chatId)?.length || 0;
        const auditCount = d.prepare("SELECT COUNT(*) as n FROM audit_log WHERE chat_id = ?").get(chatId)?.n || 0;

        const en = [
          "📊 *Bot Usage Statistics*",
          "",
          `📝 Tasks: *${taskCount}* total, *${doneCount}* done`,
          `🔔 Reminders: *${reminderCount}*`,
          `💰 Expenses: *${expenseCount}*`,
          `📋 Meetings: *${meetingCount}*`,
          `✅ Approvals: *${approvalCount}*`,
          `👥 Team Members: *${memberCount}*`,
          `🎭 Role Assignments: *${roleCount}*`,
          `🔍 Audit Log Entries: *${auditCount}*`,
        ].join("\n");
        const ar = [
          "📊 *إحصائيات استخدام البوت*",
          "",
          `📝 المهام: *${taskCount}* إجمالي، *${doneCount}* منجزة`,
          `🔔 التذكيرات: *${reminderCount}*`,
          `💰 المصروفات: *${expenseCount}*`,
          `📋 الاجتماعات: *${meetingCount}*`,
          `✅ الموافقات: *${approvalCount}*`,
          `👥 أعضاء الفريق: *${memberCount}*`,
          `🎭 تعيينات الأدوار: *${roleCount}*`,
          `🔍 سجلات التدقيق: *${auditCount}*`,
        ].join("\n");
        return ctx.reply(getBilingualText(en, ar), {
          parse_mode: "Markdown",
          message_thread_id: threadId,
        });
      } catch (e) {
        return ctx.reply(`❌ Stats error: ${e.message}`, { message_thread_id: threadId });
      }
    }

    // ─── db ───
    if (sub === "db") {
      try {
        const d = opsDb.getDb();
        const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        const lines = tables.map(t => {
          const count = d.prepare(`SELECT COUNT(*) as n FROM "${t.name}"`).get()?.n || 0;
          return `• \`${t.name}\`: ${count} rows`;
        }).join("\n");
        const en = `🗄️ *Database Tables* (${tables.length} tables)\n\n${lines}`;
        const ar = `🗄️ *جداول قاعدة البيانات* (${tables.length} جدول)\n\n${lines}`;
        return ctx.reply(getBilingualText(en, ar), {
          parse_mode: "Markdown",
          message_thread_id: threadId,
        });
      } catch (e) {
        return ctx.reply(`❌ DB error: ${e.message}`, { message_thread_id: threadId });
      }
    }

    // ─── env ───
    if (sub === "env") {
      const safeKeys = [
        "NODE_ENV", "API_BASE_URL", "WEBAPP_URL", "WEBSITE_URL",
        "CHANNEL_CHECK_INTERVAL", "PORT", "RAILWAY_ENVIRONMENT",
        "RAILWAY_SERVICE_NAME", "RAILWAY_PROJECT_NAME",
      ];
      const lines = safeKeys
        .filter(k => process.env[k])
        .map(k => `• \`${k}\`: \`${process.env[k]}\``)
        .join("\n") || "• No public env vars found.";
      const en = `🌍 *Environment Variables (non-sensitive)*\n\n${lines}`;
      const ar = `🌍 *متغيرات البيئة (غير حساسة)*\n\n${lines}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── broadcast [topic] [message] ───
    if (sub === "broadcast") {
      const topicName = (rest[0] || "").toLowerCase();
      const message = rest.slice(1).join(" ").trim();
      if (!topicName || !message) {
        const topicList = Object.keys(TOPIC_THREADS).join(", ");
        const en = `❌ Usage: \`/admin broadcast [topic] [message]\`\nTopics: ${topicList}`;
        const ar = `❌ الاستخدام: \`/admin broadcast [topic] [message]\`\nالمواضيع: ${topicList}`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const targetThread = TOPIC_THREADS[topicName];
      if (!targetThread) {
        const en = `❌ Unknown topic: \`${topicName}\``;
        const ar = `❌ موضوع غير معروف: \`${topicName}\``;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      await ctx.telegram.sendMessage(OPS_GROUP_ID, `📢 *Admin Broadcast*\n\n${message}`, {
        parse_mode: "Markdown",
        message_thread_id: targetThread,
      });
      v4Db.addAuditLog(chatId, ctx.from.id, user, "broadcast", "topic", targetThread,
        `Broadcast to ${topicName}: ${message.substring(0, 100)}`, threadId);
      const en = `✅ *Broadcast sent* to \`${topicName}\` (thread ${targetThread})`;
      const ar = `✅ *تم إرسال البث* إلى \`${topicName}\` (موضوع ${targetThread})`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── test ───
    if (sub === "test") {
      const testText = rest.join(" ") || "(empty)";
      const en = `🧪 *Test Echo*\n\nInput: \`${escMd(testText)}\`\nAdmin: ${escMd(user)}\nThread: ${threadId}\nChat: ${chatId}\nTimestamp: ${new Date().toISOString()}`;
      const ar = `🧪 *اختبار الصدى*\n\nالإدخال: \`${escMd(testText)}\`\nالمسؤول: ${escMd(user)}\nالموضوع: ${threadId}\nالدردشة: ${chatId}\nالوقت: ${new Date().toISOString()}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    }

    // ─── Unknown subcommand ───
    const en = `❌ Unknown subcommand: \`${sub}\`\n\nType \`/admin help\` for the command list.`;
    const ar = `❌ أمر غير معروف: \`${sub}\`\n\nاكتب \`/admin help\` لعرض قائمة الأوامر.`;
    return ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });

  } catch (e) {
    console.error("[handleOpsAdmin] Error:", e.message, e.stack);
    await ctx.reply(`❌ Admin panel error: ${e.message}`, {
      message_thread_id: threadId,
    }).catch(() => {});
  }
}

// ─── Role Normalizer (reused from ops-v4.js) ─────────────────

function normalizeRole(input) {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  if (s === "ceo")     return "CEO";
  if (s === "manager") return "Manager";
  if (s === "staff")   return "Staff";
  const managerTypos = ["manger", "maneger", "mangaer", "mangger", "managar",
    "managr", "manaer", "maanger", "mnager", "manegr", "manageer", "manaager"];
  if (managerTypos.includes(s)) return "Manager";
  const staffTypos = ["staf", "staaf", "stff", "satff", "sttaf", "stafg"];
  if (staffTypos.includes(s)) return "Staff";
  const ceoTypos = ["coo", "c.e.o", "c.o.o", "ceo."];
  if (ceoTypos.includes(s)) return "CEO";
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[a.length][b.length];
  }
  for (const [label, canonical] of [["CEO", "ceo"], ["Manager", "manager"], ["Staff", "staff"]]) {
    if (levenshtein(s, canonical) <= 2) return label;
  }
  return null;
}

// ─── Exports ─────────────────────────────────────────────────

module.exports = {
  handleOpsAdmin,
  guardAdminTopic,
  isRootAdmin,
  ADMIN_PANEL_THREAD,
};
