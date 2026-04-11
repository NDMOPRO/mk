/**
 * Operations Scheduler — v2 (10-Feature Upgrade)
 * ─────────────────────────────────────────────────────────────
 * Handles all time-based operations for the Daily Ops HQ group:
 *
 * 1. Morning Briefing — 9:00 AM KSA → "01 — Daily CEO Update" (thread 4)
 *    Structured: today's priorities, overdue items, tasks due today, reminders
 *
 * 2. Daily Auto-Report — 9:00 PM KSA → "01 — Daily CEO Update" (thread 4)
 *    What was completed, what's pending, what's overdue
 *
 * 3. Evening Reminder — 6:00 PM KSA → General
 *    Remind team to update "Completed Today" and "Tomorrow Priorities"
 *
 * 4. Escalation Checker — Every 5 minutes
 *    If a task in "10 — Blockers" (thread 13) is >24h old → post to CEO Update
 *
 * 5. Vendor Follow-up Checker — Every 5 minutes
 *    If vendor deadline passed with no update → post follow-up in same topic
 *
 * 6. Overdue Task Pinger — Every hour
 *    If a task is overdue and has an assignee → ping them in the topic
 *
 * 7. Follow-up Checker — Every minute — Send due follow-up reminders
 * 8. Reminder Checker — Every minute — Send due manual reminders
 *
 * All times are in KSA (UTC+3).
 */

const opsDb = require("./ops-database");

let bot = null;
let schedulerInterval = null;

const OPS_GROUP_ID = -1003967447285;
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;

// Thread IDs
const THREAD_CEO_UPDATE = 4;
const THREAD_BLOCKERS = 13;
const THREAD_COMPLETED = 14;
const THREAD_PRIORITIES = 15;

// ─── Time Utilities ─────────────────────────────────────────

function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

function todayKSA() {
  const ksa = ksaNow();
  return `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Deduplication ──────────────────────────────────────────

function alreadySent(reportType) {
  const today = todayKSA();
  return opsDb.hasReportBeenSent(OPS_GROUP_ID, today, reportType);
}

function markSent(reportType) {
  const today = todayKSA();
  opsDb.markReportSent(OPS_GROUP_ID, today, reportType);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 9: Morning Briefing (9 AM KSA) ═════════════════
// ═══════════════════════════════════════════════════════════════

async function sendMorningBriefing() {
  if (!bot) return;
  if (alreadySent("morning_briefing")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // 9 AM KSA = 6 AM UTC
  if (hour !== 6 || min >= 5) return;

  markSent("morning_briefing");

  try {
    const allTasks = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const dueToday = opsDb.getTasksDueToday(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    // Get tomorrow priorities (tasks in thread 15)
    const priorities = opsDb.getPendingTasksByThread(OPS_GROUP_ID, THREAD_PRIORITIES);

    const dateStr = ksa.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let msg = `☀️ *Morning Briefing — ${dateStr}*\n\n`;

    // Today's priorities
    if (priorities.length > 0) {
      msg += `📅 *Today's Priorities* (from Tomorrow Priorities):\n`;
      priorities.slice(0, 10).forEach((t, i) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `${i + 1}. ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    // Overdue items
    if (overdue.length > 0) {
      msg += `⚠️ *Overdue Tasks (${overdue.length}):*\n`;
      overdue.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• 🔴 ${t.title}${assignee} (due: ${t.due_date}) [#${t.id}]\n`;
      });
      msg += "\n";
    }

    // Due today
    if (dueToday.length > 0) {
      msg += `📌 *Due Today (${dueToday.length}):*\n`;
      dueToday.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    // Summary stats
    msg += `📊 *Status:* ${stats.pending} pending / ${stats.done} completed total\n`;

    if (allTasks.length === 0 && overdue.length === 0) {
      msg += `\n✨ All clear — no pending tasks!\n`;
    }

    msg += `\n💡 Use /summary for full details`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Morning briefing sent to CEO Update topic.");
  } catch (error) {
    console.error("[OpsScheduler] Morning briefing error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 1: Daily Auto-Report (9 PM KSA) ════════════════
// ═══════════════════════════════════════════════════════════════

async function sendDailyReport() {
  if (!bot) return;
  if (alreadySent("daily_report")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // 9 PM KSA = 6 PM UTC (18:00)
  if (hour !== 18 || min >= 5) return;

  markSent("daily_report");

  try {
    const completedToday = opsDb.getCompletedToday(OPS_GROUP_ID);
    const allPending = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    const dateStr = ksa.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let msg = `📊 *Daily Report — ${dateStr}*\n\n`;

    // Completed today
    if (completedToday.length > 0) {
      msg += `✅ *Completed Today (${completedToday.length}):*\n`;
      completedToday.slice(0, 15).forEach((t) => {
        const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
        msg += `• ~~${t.title}~~${assignee}\n`;
      });
      if (completedToday.length > 15) msg += `_... and ${completedToday.length - 15} more_\n`;
      msg += "\n";
    } else {
      msg += `✅ *Completed Today:* None\n\n`;
    }

    // Still pending
    if (allPending.length > 0) {
      // Group by topic
      const byTopic = {};
      for (const t of allPending) {
        const key = t.topic_name || "General";
        if (!byTopic[key]) byTopic[key] = [];
        byTopic[key].push(t);
      }

      msg += `⬜ *Still Pending (${allPending.length}):*\n`;
      for (const [topic, tasks] of Object.entries(byTopic)) {
        msg += `  _${topic}:_ ${tasks.length} tasks\n`;
      }
      msg += "\n";
    }

    // Overdue
    if (overdue.length > 0) {
      msg += `🔴 *Overdue (${overdue.length}):*\n`;
      overdue.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• ${t.title}${assignee} (due: ${t.due_date})\n`;
      });
      msg += "\n";
    }

    // Summary line
    msg += `📈 *Totals:* ${stats.done} done / ${stats.pending} pending / ${overdue.length} overdue`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Daily report sent to CEO Update topic.");
  } catch (error) {
    console.error("[OpsScheduler] Daily report error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Evening Reminder (6 PM KSA) ════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function sendEveningReminder() {
  if (!bot) return;
  if (alreadySent("evening_reminder")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // 6 PM KSA = 3 PM UTC (15:00)
  if (hour !== 15 || min >= 5) return;

  markSent("evening_reminder");

  try {
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    let msg = `🌆 *Evening Reminder*\n\n`;
    msg += `Before end of day, please update:\n\n`;
    msg += `✅ *11 — Completed Today*\n`;
    msg += `_What did you accomplish today?_\n\n`;
    msg += `📅 *12 — Tomorrow Priorities*\n`;
    msg += `_What are tomorrow's priorities?_\n\n`;

    if (stats.pending > 0) {
      msg += `⚠️ There are still *${stats.pending} pending tasks*. Use /summary to review.`;
    } else {
      msg += `✨ All tasks completed. Great work today!`;
    }

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
    });

    console.log("[OpsScheduler] Evening reminder sent.");
  } catch (error) {
    console.error("[OpsScheduler] Evening reminder error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 4: Escalation Checker ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

// Track which tasks we've already escalated to avoid spam
const escalatedTasks = new Set();

async function checkEscalations() {
  if (!bot) return;

  try {
    // Get tasks in Blockers topic that are >24h old
    const staleBlockers = opsDb.getStaleBlockers(OPS_GROUP_ID, THREAD_BLOCKERS, 24);

    for (const task of staleBlockers) {
      if (escalatedTasks.has(task.id)) continue;
      escalatedTasks.add(task.id);

      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      const hoursOld = Math.round((Date.now() - new Date(task.created_at).getTime()) / (60 * 60 * 1000));

      const msg = `🚨 *ESCALATION — Blocker Unresolved >24h*\n\n` +
        `⬜ ${task.title}${assignee}\n` +
        `⏰ Created ${hoursOld}h ago\n` +
        `📍 10 — Blockers & Escalations\n` +
        `🔗 Task #${task.id}\n\n` +
        `_This blocker needs immediate attention._`;

      await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
        parse_mode: "Markdown",
        message_thread_id: THREAD_CEO_UPDATE,
      });

      console.log(`[OpsScheduler] Escalated blocker task #${task.id}`);
    }
  } catch (error) {
    console.error("[OpsScheduler] Escalation check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 7: Vendor Follow-up Checker ═════════════════════
// ═══════════════════════════════════════════════════════════════

async function checkVendorFollowUps() {
  if (!bot) return;

  try {
    const dueVendors = opsDb.getDueVendorFollowUps();

    for (const v of dueVendors) {
      try {
        const msg = `🏢 *Vendor Follow-Up — No Update Received*\n\n` +
          `🔧 *${v.vendor_name}*\n` +
          `📝 "${v.promise_text.substring(0, 200)}"\n` +
          `👤 Reported by: ${v.from_user || "Unknown"}\n` +
          `📍 ${v.topic_name || "General"}\n\n` +
          `_Deadline passed. Has this been resolved?_`;

        const sendOpts = { parse_mode: "Markdown" };
        if (v.thread_id) sendOpts.message_thread_id = v.thread_id;

        await bot.telegram.sendMessage(v.chat_id, msg, sendOpts);
        opsDb.markVendorFollowUpSent(v.id);
        console.log(`[OpsScheduler] Vendor follow-up sent for ID ${v.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Vendor follow-up error ${v.id}:`, err.message);
        opsDb.markVendorFollowUpSent(v.id);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Vendor follow-up check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 2: Overdue Task Pinger ══════════════════════════
// ═══════════════════════════════════════════════════════════════

// Track which overdue tasks we've pinged today
const pingedOverdueToday = new Map(); // taskId → date string

async function pingOverdueTasks() {
  if (!bot) return;

  const today = todayKSA();

  try {
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);

    for (const task of overdue) {
      if (!task.assigned_to) continue;

      const pingKey = `${task.id}`;
      if (pingedOverdueToday.get(pingKey) === today) continue;
      pingedOverdueToday.set(pingKey, today);

      const msg = `⏰ *Overdue Task Reminder*\n\n` +
        `${task.assigned_to} — this task is overdue:\n\n` +
        `⬜ ${task.title}\n` +
        `📅 Due: ${task.due_date}\n` +
        `📍 ${task.topic_name || "General"}\n\n` +
        `Use /done ${task.id} when complete.`;

      const sendOpts = { parse_mode: "Markdown" };
      if (task.thread_id) sendOpts.message_thread_id = task.thread_id;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
        console.log(`[OpsScheduler] Pinged ${task.assigned_to} for overdue task #${task.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Overdue ping error for #${task.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Overdue pinger error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Follow-up & Reminder Checkers ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function checkFollowUps() {
  if (!bot) return;

  try {
    const dueFollowUps = opsDb.getDueFollowUps();

    for (const followUp of dueFollowUps) {
      try {
        const msg = `🔔 *Follow-Up Reminder*\n` +
          (followUp.topic_name ? `📍 ${followUp.topic_name}\n\n` : "\n") +
          `${followUp.from_user} — any update?\n\n` +
          `_"${followUp.message_text.substring(0, 150)}${followUp.message_text.length > 150 ? "..." : ""}"_`;

        const sendOpts = { parse_mode: "Markdown" };
        if (followUp.thread_id) sendOpts.message_thread_id = followUp.thread_id;

        await bot.telegram.sendMessage(followUp.chat_id, msg, sendOpts);
        opsDb.markFollowUpSent(followUp.id);
        console.log(`[OpsScheduler] Follow-up sent for ID ${followUp.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Follow-up error ${followUp.id}:`, err.message);
        opsDb.markFollowUpSent(followUp.id);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Follow-up check error:", error.message);
  }
}

async function checkReminders() {
  if (!bot) return;

  try {
    const dueReminders = opsDb.getDueReminders();

    for (const reminder of dueReminders) {
      try {
        const msg = `⏰ *Reminder*\n` +
          (reminder.topic_name ? `📍 ${reminder.topic_name}\n` : "") +
          (reminder.created_by ? `👤 ${reminder.created_by}\n\n` : "\n") +
          `${reminder.message}`;

        const sendOpts = { parse_mode: "Markdown" };
        if (reminder.thread_id) sendOpts.message_thread_id = reminder.thread_id;

        await bot.telegram.sendMessage(reminder.chat_id, msg, sendOpts);
        opsDb.markReminderSent(reminder.id);
        console.log(`[OpsScheduler] Reminder sent for ID ${reminder.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Reminder error ${reminder.id}:`, err.message);
        opsDb.markReminderSent(reminder.id);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Reminder check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Main Scheduler Tick ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

let tickCount = 0;

async function tick() {
  try {
    tickCount++;

    // Every tick (1 minute): check reminders and follow-ups
    await checkFollowUps();
    await checkReminders();

    // Every 5 minutes: check escalations and vendor follow-ups
    if (tickCount % 5 === 0) {
      await checkEscalations();
      await checkVendorFollowUps();
    }

    // Every 60 minutes: ping overdue tasks
    if (tickCount % 60 === 0) {
      await pingOverdueTasks();
    }

    // Daily scheduled messages (checked every tick, deduped)
    await sendMorningBriefing();
    await sendDailyReport();
    await sendEveningReminder();

  } catch (error) {
    console.error("[OpsScheduler] Tick error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Start / Stop ════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function startOpsScheduler(botInstance) {
  bot = botInstance;

  // Initialize the ops database
  opsDb.getDb();

  // Run every 60 seconds
  schedulerInterval = setInterval(tick, 60 * 1000);

  // Run immediately on start (after a short delay to let bot connect)
  setTimeout(tick, 5000);

  console.log("[OpsScheduler] Started v2. Schedule:");
  console.log("  • Morning Briefing: 9:00 AM KSA → CEO Update topic");
  console.log("  • Evening Reminder: 6:00 PM KSA → General");
  console.log("  • Daily Report: 9:00 PM KSA → CEO Update topic");
  console.log("  • Escalation check: every 5 min");
  console.log("  • Vendor follow-ups: every 5 min");
  console.log("  • Overdue pings: every 60 min");
  console.log("  • Reminders/follow-ups: every 1 min");
}

function stopOpsScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  console.log("[OpsScheduler] Stopped.");
}

module.exports = {
  startOpsScheduler,
  stopOpsScheduler,
};
