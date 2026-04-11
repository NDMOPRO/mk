/**
 * Operations Scheduler — v3 (21-Feature)
 * ─────────────────────────────────────────────────────────────
 * Handles all time-based operations for the Daily Ops HQ group:
 *
 *  1. Morning Briefing — 9:00 AM KSA → CEO Update (thread 4)
 *  2. Daily Auto-Report — 9:00 PM KSA → CEO Update (thread 4)
 *  3. Evening Reminder — 6:00 PM KSA → General
 *  4. Escalation Checker — Every 5 min (blockers >24h → CEO Update)
 *  5. Vendor Follow-up Checker — Every 5 min
 *  6. Overdue Task Pinger — Every 60 min
 *  7. Follow-up Checker — Every 1 min
 *  8. Reminder Checker — Every 1 min
 *  9. SLA Checker — Every 5 min (warn at 75%, breach at 100%)
 * 10. Recurring Task Creator — Every 5 min (daily/weekly/monthly)
 *
 * All times are in KSA (UTC+3).
 */

const opsDb = require("./ops-database");
const v4Db = require("./ops-database-v4");
const googleSync = require("./google-sync");
const v5Handlers = require("../handlers/ops-v5");

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
// ═══ Morning Briefing (9 AM KSA) ════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function sendMorningBriefing() {
  if (!bot) return;
  if (alreadySent("morning_briefing")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 6 || min >= 5) return;

  markSent("morning_briefing");

  try {
    const allTasks = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const dueToday = opsDb.getTasksDueToday(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);
    const priorities = opsDb.getPendingTasksByThread(OPS_GROUP_ID, THREAD_PRIORITIES);
    const pendingApprovals = opsDb.getPendingApprovals(OPS_GROUP_ID);
    const occSummary = opsDb.getOccupancySummary(OPS_GROUP_ID);

    const dateStr = ksa.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let msg = `☀️ *Morning Briefing — ${dateStr}*\n\n`;

    if (priorities.length > 0) {
      msg += `📅 *Today's Priorities:*\n`;
      priorities.slice(0, 10).forEach((t, i) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `${i + 1}. ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `⚠️ *Overdue (${overdue.length}):*\n`;
      overdue.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• 🔴 ${t.title}${assignee} (due: ${t.due_date}) [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (dueToday.length > 0) {
      msg += `📌 *Due Today (${dueToday.length}):*\n`;
      dueToday.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (pendingApprovals.length > 0) {
      msg += `📝 *Pending Approvals (${pendingApprovals.length}):*\n`;
      pendingApprovals.slice(0, 3).forEach(a => {
        msg += `• #${a.id}: "${a.request_text.substring(0, 60)}" by ${a.requested_by}\n`;
      });
      msg += "\n";
    }

    msg += `📊 *Status:* ${stats.pending} pending / ${stats.done} completed`;
    if (occSummary.total > 0) {
      const occRate = Math.round((occSummary.occupied / occSummary.total) * 100);
      msg += ` | 🏠 ${occRate}% occupancy`;
    }

    if (allTasks.length === 0 && overdue.length === 0) {
      msg += `\n\n✨ All clear — no pending tasks!`;
    }

    msg += `\n\n💡 Use /summary, /kpi, /handover for details`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Morning briefing sent.");
  } catch (error) {
    console.error("[OpsScheduler] Morning briefing error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Daily Auto-Report (9 PM KSA) ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function sendDailyReport() {
  if (!bot) return;
  if (alreadySent("daily_report")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 18 || min >= 5) return;

  markSent("daily_report");

  try {
    const completedToday = opsDb.getCompletedToday(OPS_GROUP_ID);
    const allPending = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);
    const expSummary = opsDb.getExpenseSummary(OPS_GROUP_ID);

    const dateStr = ksa.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let msg = `📊 *Daily Report — ${dateStr}*\n\n`;

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

    if (allPending.length > 0) {
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

    if (overdue.length > 0) {
      msg += `🔴 *Overdue (${overdue.length}):*\n`;
      overdue.slice(0, 10).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `• ${t.title}${assignee} (due: ${t.due_date})\n`;
      });
      msg += "\n";
    }

    if (expSummary.totalAmount > 0) {
      msg += `💰 *Today's Expenses:* ${expSummary.totalAmount.toLocaleString()} SAR\n\n`;
    }

    msg += `📈 *Totals:* ${stats.done} done / ${stats.pending} pending / ${overdue.length} overdue`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Daily report sent.");
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
// ═══ Escalation Checker ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

const escalatedTasks = new Set();

async function checkEscalations() {
  if (!bot) return;

  try {
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
// ═══ Vendor Follow-up Checker ═══════════════════════════════
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
// ═══ Overdue Task Pinger ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

const pingedOverdueToday = new Map();

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
// ═══ Feature 11: SLA Checker ════════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function checkSlaBreaches() {
  if (!bot) return;

  try {
    const tasksWithSla = opsDb.getTasksWithSla(OPS_GROUP_ID);

    for (const task of tasksWithSla) {
      const createdAt = new Date(task.created_at).getTime();
      const now = Date.now();
      const elapsedHours = (now - createdAt) / (60 * 60 * 1000);
      const slaHours = task.sla_hours;

      // 75% warning
      if (elapsedHours >= slaHours * 0.75 && elapsedHours < slaHours) {
        if (!opsDb.hasSlaAlertBeenSent(task.id, "warning")) {
          opsDb.markSlaAlertSent(task.id, "warning");

          const remaining = Math.round(slaHours - elapsedHours);
          const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
          const msg = `⚠️ *SLA Warning — ${remaining}h remaining*\n\n` +
            `⬜ ${task.title}${assignee}\n` +
            `⏱️ SLA: ${slaHours}h | Elapsed: ${Math.round(elapsedHours)}h\n` +
            `📍 ${task.topic_name || "General"}\n` +
            `🔗 Task #${task.id}\n\n` +
            `_Approaching SLA deadline. Please prioritize._`;

          const sendOpts = { parse_mode: "Markdown" };
          if (task.thread_id) sendOpts.message_thread_id = task.thread_id;

          try {
            await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
            console.log(`[OpsScheduler] SLA warning for task #${task.id}`);
          } catch (err) {
            console.error(`[OpsScheduler] SLA warning error #${task.id}:`, err.message);
          }
        }
      }

      // 100% breach
      if (elapsedHours >= slaHours) {
        if (!opsDb.hasSlaAlertBeenSent(task.id, "breach")) {
          opsDb.markSlaAlertSent(task.id, "breach");

          const overBy = Math.round(elapsedHours - slaHours);
          const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
          const msg = `🔴 *SLA BREACHED — ${task.topic_name || "General"}*\n\n` +
            `⬜ ${task.title}${assignee}\n` +
            `⏱️ SLA: ${slaHours}h | Elapsed: ${Math.round(elapsedHours)}h (+${overBy}h over)\n` +
            `📍 ${task.topic_name || "General"}\n` +
            `🔗 Task #${task.id}\n\n` +
            `_SLA breached. Immediate action required._`;

          // Post to the task's topic
          const sendOpts = { parse_mode: "Markdown" };
          if (task.thread_id) sendOpts.message_thread_id = task.thread_id;
          try {
            await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
          } catch (err) {
            console.error(`[OpsScheduler] SLA breach topic error #${task.id}:`, err.message);
          }

          // Also post to CEO Update
          try {
            await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
              parse_mode: "Markdown",
              message_thread_id: THREAD_CEO_UPDATE,
            });
            console.log(`[OpsScheduler] SLA breach escalated for task #${task.id}`);
          } catch (err) {
            console.error(`[OpsScheduler] SLA breach CEO error #${task.id}:`, err.message);
          }
        }
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] SLA check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 13: Recurring Task Creator ═════════════════════
// ═══════════════════════════════════════════════════════════════

async function processRecurringTasks() {
  if (!bot) return;

  try {
    const recurring = opsDb.getActiveRecurringTasks(OPS_GROUP_ID);
    const ksa = ksaNow();
    const today = todayKSA();
    const dayOfWeek = ksa.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const dayOfMonth = ksa.getUTCDate();

    for (const rec of recurring) {
      // Skip if already created today
      if (rec.last_created === today) continue;

      let shouldCreate = false;

      if (rec.schedule_type === "daily") {
        shouldCreate = true;
      } else if (rec.schedule_type === "weekly") {
        shouldCreate = (dayOfWeek === rec.schedule_value.toLowerCase());
      } else if (rec.schedule_type === "monthly") {
        const targetDay = parseInt(rec.schedule_value, 10);
        shouldCreate = (dayOfMonth === targetDay);
      }

      if (!shouldCreate) continue;

      // Create the task
      try {
        const taskId = opsDb.addTask(rec.chat_id, rec.thread_id, rec.topic_name, rec.title, {
          priority: rec.priority || "normal",
          assignedTo: rec.assigned_to || null,
          propertyTag: rec.property_tag || null,
          createdBy: "Recurring",
        });

        opsDb.updateRecurringLastCreated(rec.id, today);

        // Notify in the topic
        const msg = `🔄 *Recurring Task Created*\n\n⬜ ${rec.title} [#${taskId}]\n📅 ${rec.schedule_type}: ${rec.schedule_value}${rec.assigned_to ? `\n👤 ${rec.assigned_to}` : ""}`;

        const sendOpts = { parse_mode: "Markdown" };
        if (rec.thread_id) sendOpts.message_thread_id = rec.thread_id;

        await bot.telegram.sendMessage(rec.chat_id, msg, sendOpts);
        console.log(`[OpsScheduler] Recurring task created: "${rec.title}" → #${taskId}`);
      } catch (err) {
        console.error(`[OpsScheduler] Recurring task error for ID ${rec.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Recurring task check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 20: Google Sheets & Calendar Daily Sync ════════
// ═══════════════════════════════════════════════════════════════

async function syncToGoogle() {
  if (!googleSync.isConfigured()) return;
  if (alreadySent("google_sync")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // Sync at 9:15 PM KSA (right after daily report at 9 PM)
  if (hour !== 18 || min < 15 || min >= 20) return;

  markSent("google_sync");

  try {
    console.log("[GoogleSync] Starting daily sync...");

    // 1. Gather all data
    const allTasks = opsDb.getDb().prepare(
      "SELECT * FROM tasks WHERE chat_id = ? AND status != 'cancelled' ORDER BY id DESC"
    ).all(OPS_GROUP_ID);

    const weeklyStats = opsDb.getWeeklyStats(OPS_GROUP_ID);
    const monthlyStats = opsDb.getMonthlyStats(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const taskStats = opsDb.getTaskStats(OPS_GROUP_ID);

    // Build KPI row
    const kpiRow = {
      report_date: todayKSA(),
      period: "daily",
      tasks_created: weeklyStats.created || 0,
      tasks_completed: weeklyStats.completed || 0,
      tasks_pending: taskStats.pending || 0,
      tasks_overdue: overdue.length,
      avg_resolution_hours: weeklyStats.avgResolutionHours || 0,
      completion_rate: taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0,
      top_topic: weeklyStats.topTopic || "",
      top_assignee: weeklyStats.topAssignee || "",
    };

    // Gather expenses (current month)
    const expenses = opsDb.getMonthlyExpenses(OPS_GROUP_ID);

    // Gather occupancy
    const occupancy = opsDb.getOccupancy(OPS_GROUP_ID);

    // Tasks with due dates for calendar
    const calendarTasks = allTasks.filter(t => t.due_date);

    // 2. Send to Google Apps Script
    const result = await googleSync.syncAll({
      tasks: allTasks,
      kpis: [kpiRow],
      expenses: expenses,
      occupancy: occupancy,
      calendar_tasks: calendarTasks,
    });

    if (result.success) {
      console.log("[GoogleSync] Daily sync completed:", JSON.stringify(result.results || {}));
    } else {
      console.error("[GoogleSync] Sync failed:", result.error);
    }
  } catch (error) {
    console.error("[GoogleSync] Daily sync error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 34: Priority Auto-Escalation ═══════════════════
// ═══════════════════════════════════════════════════════════════

async function checkPriorityEscalation() {
  if (!bot) return;
  try {
    const staleTasks = v4Db.getStaleHighPriorityTasks(OPS_GROUP_ID, 48);
    for (const task of staleTasks) {
      const key = `priority_esc_${task.id}`;
      if (alreadySent(key)) continue;
      markSent(key);

      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      const hours = Math.round((Date.now() - new Date(task.created_at).getTime()) / 3600000);
      const msg = `🔺 *Priority Auto-Escalation*\n\n` +
        `⬜ ${task.title}${assignee}\n` +
        `⏱️ High priority task pending for ${hours}h\n` +
        `📍 ${task.topic_name || "General"} → Escalated to CEO Update\n` +
        `🔗 Task #${task.id}\n\n` +
        `_High-priority task unresolved for 48+ hours. Requires attention._`;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
          parse_mode: "Markdown",
          message_thread_id: THREAD_CEO_UPDATE,
        });
        console.log(`[OpsScheduler] Priority escalation for task #${task.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Priority escalation error #${task.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Priority escalation check error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 35: End-of-Day Check-in ════════════════════════
// ═══════════════════════════════════════════════════════════════

async function sendCheckinReminder() {
  if (!bot) return;
  if (alreadySent("checkin_reminder")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // 5:00 PM KSA = 14:00 UTC
  if (hour !== 14 || min >= 5) return;

  markSent("checkin_reminder");

  const today = todayKSA();
  const unchecked = v4Db.getUncheckedMembers(OPS_GROUP_ID, today);

  if (unchecked.length === 0) return;

  let msg = `📋 *End-of-Day Check-in Reminder*\n\n`;
  msg += `The following team members haven't posted any updates today:\n\n`;
  for (const m of unchecked) {
    msg += `• ${m.username || m.display_name || "Unknown"}\n`;
  }
  msg += `\n_Please post your end-of-day update in the relevant topics._`;

  try {
    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });
    console.log(`[OpsScheduler] Check-in reminder sent for ${unchecked.length} members`);
  } catch (err) {
    console.error("[OpsScheduler] Check-in reminder error:", err.message);
  }
}

async function flagUncheckedMembers() {
  if (!bot) return;
  if (alreadySent("checkin_flag")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  // 6:00 PM KSA = 15:00 UTC
  if (hour !== 15 || min >= 5) return;

  markSent("checkin_flag");

  const today = todayKSA();
  const unchecked = v4Db.getUncheckedMembers(OPS_GROUP_ID, today);

  for (const m of unchecked) {
    v4Db.flagUnchecked(OPS_GROUP_ID, m.user_id, today);
  }

  if (unchecked.length > 0) {
    console.log(`[OpsScheduler] Flagged ${unchecked.length} unchecked members`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 36: Weekly Team Standup ════════════════════════
// ═══════════════════════════════════════════════════════════════

async function sendWeeklyStandup() {
  if (!bot) return;
  if (alreadySent("weekly_standup")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  const dayOfWeek = ksa.getUTCDay(); // 0 = Sunday
  // Sunday 9:00 AM KSA = Sunday 06:00 UTC
  if (dayOfWeek !== 0 || hour !== 6 || min >= 5) return;

  markSent("weekly_standup");

  try {
    const stats = opsDb.getWeeklyStats(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const leaderboard = v4Db.getLeaderboard(OPS_GROUP_ID);

    let msg = `📊 *Weekly Team Standup — Week Summary*\n\n`;
    msg += `📈 *This Week's Numbers:*\n`;
    msg += `• Tasks Created: ${stats.created || 0}\n`;
    msg += `• Tasks Completed: ${stats.completed || 0}\n`;
    msg += `• Currently Overdue: ${overdue.length}\n`;
    if (stats.avgResolutionHours) msg += `• Avg Resolution: ${stats.avgResolutionHours}h\n`;
    msg += `\n`;

    if (leaderboard.length > 0) {
      msg += `🏆 *Team Performance:*\n`;
      const medals = ["🥇", "🥈", "🥉"];
      leaderboard.slice(0, 5).forEach((entry, i) => {
        const medal = medals[i] || `${i + 1}.`;
        msg += `${medal} ${entry.assigned_to}: ${entry.completed}/${entry.total_tasks} (${entry.completion_rate || 0}%)\n`;
      });
      msg += `\n`;
    }

    if (overdue.length > 0) {
      msg += `🔴 *Overdue Tasks (${overdue.length}):*\n`;
      for (const t of overdue.slice(0, 5)) {
        msg += `• #${t.id}: ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ""}\n`;
      }
      if (overdue.length > 5) msg += `  _...and ${overdue.length - 5} more_\n`;
      msg += `\n`;
    }

    msg += `📋 *This Week's Focus:*\n`;
    msg += `Please reply in this thread with:\n`;
    msg += `1. What you accomplished last week\n`;
    msg += `2. What you're focusing on this week\n`;
    msg += `3. Any blockers or help needed`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });
    console.log("[OpsScheduler] Weekly standup posted");
  } catch (error) {
    console.error("[OpsScheduler] Weekly standup error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 39: Mention Alert Checker ══════════════════════
// ═══════════════════════════════════════════════════════════════

async function checkMentionAlerts() {
  if (!bot) return;
  try {
    const unresponded = v4Db.getUnrespondedMentions(OPS_GROUP_ID, 2);
    for (const mention of unresponded) {
      v4Db.markMentionReminderSent(mention.id);

      const topicName = mention.thread_id ? ({
        4: "Daily CEO Update", 5: "Operations Follow-Up", 6: "Listings & Inventory",
        7: "Bookings & Revenue", 8: "Customer Support", 9: "Website & Tech",
        10: "Payments & Finance", 11: "Marketing & Content", 12: "Legal/Compliance",
        13: "Blockers & Escalations", 14: "Completed Today", 15: "Tomorrow Priorities",
      }[mention.thread_id] || "a topic") : "the group";

      const msg = `🔔 *Mention Reminder*\n\n${mention.mentioned_username}, you were mentioned ${mention.mentioned_by ? `by ${mention.mentioned_by} ` : ""}2+ hours ago in *${topicName}*.\n\nPlease check and respond.`;

      try {
        const sendOpts = { parse_mode: "Markdown" };
        if (mention.thread_id) sendOpts.message_thread_id = mention.thread_id;
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
        console.log(`[OpsScheduler] Mention reminder sent for ${mention.mentioned_username}`);
      } catch (err) {
        console.error(`[OpsScheduler] Mention reminder error:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Mention alert check error:", error.message);
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

    // Every 5 minutes: check escalations, vendor follow-ups, SLA, recurring, mentions
    if (tickCount % 5 === 0) {
      await checkEscalations();
      await checkVendorFollowUps();
      await checkSlaBreaches();
      await processRecurringTasks();
      await checkMentionAlerts();
      await checkPriorityEscalation();
    }

    // Every 60 minutes: ping overdue tasks
    if (tickCount % 60 === 0) {
      await pingOverdueTasks();
    }

    // Daily scheduled messages (checked every tick, deduped)
    await sendMorningBriefing();
    await sendDailyReport();
    await sendEveningReminder();

    // Daily Google Sheets & Calendar sync (after daily report)
    await syncToGoogle();

    // v4 daily scheduled jobs
    await sendCheckinReminder();
    await flagUncheckedMembers();
    await sendWeeklyStandup();

    // v5: Weather alerts (7:00 AM KSA daily)
    await checkDailyWeather();

  } catch (error) {
    console.error("[OpsScheduler] Tick error:", error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ v5: Weather Check (7 AM KSA daily) ═════════════════════
// ═══════════════════════════════════════════════════════════════

const weatherCheckDone = {};
async function checkDailyWeather() {
  if (!bot) return;
  const now = new Date();
  const ksaHour = ((now.getUTCHours() + 3) % 24);
  const ksaMin = now.getUTCMinutes();
  const todayKey = `weather_${now.toISOString().split('T')[0]}`;
  if (ksaHour === 7 && ksaMin < 5 && !weatherCheckDone[todayKey]) {
    weatherCheckDone[todayKey] = true;
    try {
      await v5Handlers.checkAndPostWeatherAlerts(bot);
    } catch (e) {
      console.error('[OpsScheduler] Weather check error:', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Start / Stop ════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function startOpsScheduler(botInstance) {
  bot = botInstance;

  // Initialize the ops database
  opsDb.getDb();

  // Initialize v4 tables
  try {
    v4Db.initV4Tables();
    console.log("[OpsScheduler] v4 tables initialized");
  } catch (e) {
    console.error("[OpsScheduler] v4 init error:", e.message);
  }

  // Initialize v5 tables
  try {
    v5Handlers.initV5();
    console.log("[OpsScheduler] v5 tables initialized");
  } catch (e) {
    console.error("[OpsScheduler] v5 init error:", e.message);
  }

  // Initialize default SLA configs
  try {
    const defaultSla = { 8: 12, 13: 24, 9: 48 }; // support: 12h, blockers: 24h, tech: 48h
    for (const [threadId, hours] of Object.entries(defaultSla)) {
      const existing = opsDb.getSlaForThread(OPS_GROUP_ID, parseInt(threadId));
      if (!existing) {
        const topicNames = {
          8: "05 — Customer Support & Complaints",
          13: "10 — Blockers & Escalations",
          9: "06 — Website & Tech Issues",
        };
        opsDb.setSlaConfig(OPS_GROUP_ID, parseInt(threadId), topicNames[threadId], hours);
      }
    }
  } catch (e) {
    console.error("[OpsScheduler] SLA init error:", e.message);
  }

  // Run every 60 seconds
  schedulerInterval = setInterval(tick, 60 * 1000);

  // Run immediately on start (after a short delay to let bot connect)
  setTimeout(tick, 5000);

  // Log Google sync status
  if (googleSync.isConfigured()) {
    console.log("[OpsScheduler] Google Sync: ENABLED");
  } else {
    console.log("[OpsScheduler] Google Sync: DISABLED (set GOOGLE_APPS_SCRIPT_URL to enable)");
  }

  console.log("[OpsScheduler] Started v4. Schedule:");
  console.log("  • Morning Briefing: 9:00 AM KSA → CEO Update");
  console.log("  • Evening Reminder: 6:00 PM KSA → General");
  console.log("  • Daily Report: 9:00 PM KSA → CEO Update");
  console.log("  • Escalation check: every 5 min");
  console.log("  • Vendor follow-ups: every 5 min");
  console.log("  • SLA check: every 5 min");
  console.log("  • Recurring tasks: every 5 min");
  console.log("  • Overdue pings: every 60 min");
  console.log("  • Reminders/follow-ups: every 1 min");
  console.log("  • Google Sheets/Calendar sync: 9:15 PM KSA daily");
  console.log("  • Check-in reminder: 5:00 PM KSA daily");
  console.log("  • Unchecked flag: 6:00 PM KSA daily");
  console.log("  \u2022 Weekly standup: Sunday 9:00 AM KSA");
  console.log("  \u2022 Mention alerts: every 5 min");
  console.log("  \u2022 Priority auto-escalation: every 5 min");
  console.log("  \u2022 Weather alerts: 7:00 AM KSA daily");
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
