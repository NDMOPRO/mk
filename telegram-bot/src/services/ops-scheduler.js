/**
 * Operations Scheduler — v5 Bilingual (EN+AR)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * All automated messages are bilingual (English first, Arabic second).
 * Improved visual design with consistent emoji patterns and dividers.
 *
 * Schedule (KSA = UTC+3):
 *  1. Weather Alerts — 7:00 AM KSA
 *  2. Morning Briefing — 9:00 AM KSA → CEO Update (thread 4)
 *  3. Check-in Reminder — 5:00 PM KSA → CEO Update
 *  4. Evening Reminder — 6:00 PM KSA → CEO Update (thread 4)
 *  5. Unchecked Flag — 6:00 PM KSA
 *  6. Daily Report — 9:00 PM KSA → CEO Update (thread 4)
 *  7. Google Sync — 9:15 PM KSA
 *  8. Weekly Standup — Sunday 9:00 AM KSA
 *  9. Escalation Checker — every 5 min
 * 10. Vendor Follow-ups — every 5 min
 * 11. SLA Checker — every 5 min
 * 12. Recurring Tasks — every 5 min
 * 13. Mention Alerts — every 5 min
 * 14. Priority Escalation — every 5 min
 * 15. Overdue Pings — every 60 min
 * 16. Reminders/Follow-ups — every 1 min
 */

const opsDb = require("./ops-database");
const v4Db = require("./ops-database-v4");
const googleSync = require("./google-sync");
const v5Handlers = require("../handlers/ops-v5");

let bot = null;
let schedulerInterval = null;

const OPS_GROUP_ID = -1003967447285;
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;

const THREAD_CEO_UPDATE = 4;
const THREAD_BLOCKERS = 13;
const THREAD_COMPLETED = 14;
const THREAD_PRIORITIES = 15;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ Utilities ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

function todayKSA() {
  const ksa = ksaNow();
  return `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;
}

function alreadySent(reportType) {
  const today = todayKSA();
  return opsDb.hasReportBeenSent(OPS_GROUP_ID, today, reportType);
}

function markSent(reportType) {
  const today = todayKSA();
  opsDb.markReportSent(OPS_GROUP_ID, today, reportType);
}

const DIV = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 1. Morning Briefing (9 AM KSA) ━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendMorningBriefing() {
  if (!bot) return;
  if (alreadySent("morning_briefing")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 9 || min >= 5) return;  // 9 AM KSA

  markSent("morning_briefing");

  try {
    const allTasks = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const dueToday = opsDb.getTasksDueToday(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);
    const priorities = opsDb.getPendingTasksByThread(OPS_GROUP_ID, THREAD_PRIORITIES);
    let pendingApprovals = [];
    try { pendingApprovals = opsDb.getPendingApprovals(OPS_GROUP_ID); } catch (e) {}
    let occSummary = { total: 0, occupied: 0 };
    try { occSummary = opsDb.getOccupancySummary(OPS_GROUP_ID); } catch (e) {}

    const dateEN = ksa.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const dateAR = ksa.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── English Section ──
    let msg = `☀️ *Morning Briefing | الإحاطة الصباحية*\n`;
    msg += `📅 ${dateEN}\n`;
    msg += `${DIV}\n\n`;

    if (priorities.length > 0) {
      msg += `📋 *Today's Priorities:*\n`;
      priorities.slice(0, 10).forEach((t, i) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `  ${i + 1}. ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `🔴 *Overdue (${overdue.length}):*\n`;
      overdue.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} _(due: ${t.due_date})_ [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (dueToday.length > 0) {
      msg += `📌 *Due Today (${dueToday.length}):*\n`;
      dueToday.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (pendingApprovals.length > 0) {
      msg += `📝 *Pending Approvals (${pendingApprovals.length}):*\n`;
      pendingApprovals.slice(0, 3).forEach(a => {
        msg += `  • #${a.id}: "${a.request_text.substring(0, 50)}" by ${a.requested_by}\n`;
      });
      msg += "\n";
    }

    msg += `📊 *Status:* ⏳ ${stats.pending} pending  ✅ ${stats.done} completed`;
    if (occSummary.total > 0) {
      const occRate = Math.round((occSummary.occupied / occSummary.total) * 100);
      msg += `  🏠 ${occRate}% occupancy`;
    }

    if (allTasks.length === 0 && overdue.length === 0) {
      msg += `\n\n✨ All clear — no pending tasks!`;
    }

    msg += `\n\n💡 /summary  /kpi  /handover`;

    // ── Arabic Section ──
    msg += `\n\n${DIV}\n`;
    msg += `📅 ${dateAR}\n\n`;

    if (priorities.length > 0) {
      msg += `📋 *أولويات اليوم:*\n`;
      priorities.slice(0, 10).forEach((t, i) => {
        const assignee = t.assigned_to ? ` ← ${t.assigned_to}` : "";
        msg += `  ${i + 1}. ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `🔴 *متأخرة (${overdue.length}):*\n`;
      overdue.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` ← ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} _(${t.due_date})_ [#${t.id}]\n`;
      });
      msg += "\n";
    }

    if (dueToday.length > 0) {
      msg += `📌 *مستحقة اليوم (${dueToday.length}):*\n`;
      dueToday.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` ← ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} [#${t.id}]\n`;
      });
      msg += "\n";
    }

    msg += `📊 *الحالة:* ⏳ ${stats.pending} معلقة  ✅ ${stats.done} مكتملة`;

    if (allTasks.length === 0 && overdue.length === 0) {
      msg += `\n\n✨ لا توجد مهام معلقة!`;
    }

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Morning briefing sent (bilingual).");
  } catch (error) {
    console.error("[OpsScheduler] Morning briefing error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 2. Daily Auto-Report (9 PM KSA) ━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendDailyReport() {
  if (!bot) return;
  if (alreadySent("daily_report")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 21 || min >= 5) return;  // 9 PM KSA

  markSent("daily_report");

  try {
    const completedToday = opsDb.getCompletedToday(OPS_GROUP_ID);
    const allPending = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);
    let expSummary = { totalAmount: 0 };
    try { expSummary = opsDb.getExpenseSummary(OPS_GROUP_ID); } catch (e) {}

    const dateEN = ksa.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const dateAR = ksa.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── English Section ──
    let msg = `📊 *Daily Report | التقرير اليومي*\n`;
    msg += `📅 ${dateEN}\n`;
    msg += `${DIV}\n\n`;

    if (completedToday.length > 0) {
      msg += `✅ *Completed Today (${completedToday.length}):*\n`;
      completedToday.slice(0, 12).forEach((t) => {
        const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
        msg += `  • ~~${t.title}~~${assignee}\n`;
      });
      if (completedToday.length > 12) msg += `  _... and ${completedToday.length - 12} more_\n`;
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
      msg += `⏳ *Still Pending (${allPending.length}):*\n`;
      for (const [topic, tasks] of Object.entries(byTopic)) {
        msg += `  📁 ${topic}: ${tasks.length} tasks\n`;
      }
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `🔴 *Overdue (${overdue.length}):*\n`;
      overdue.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} _(due: ${t.due_date})_\n`;
      });
      msg += "\n";
    }

    if (expSummary.totalAmount > 0) {
      msg += `💰 *Today's Expenses:* ${expSummary.totalAmount.toLocaleString()} SAR\n\n`;
    }

    msg += `📈 *Summary:* ✅ ${stats.done} done  ⏳ ${stats.pending} pending  🔴 ${overdue.length} overdue`;

    // ── Arabic Section ──
    msg += `\n\n${DIV}\n`;
    msg += `📅 ${dateAR}\n\n`;

    if (completedToday.length > 0) {
      msg += `✅ *المنجز اليوم (${completedToday.length}):*\n`;
      completedToday.slice(0, 12).forEach((t) => {
        const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
        msg += `  • ~~${t.title}~~${assignee}\n`;
      });
      msg += "\n";
    } else {
      msg += `✅ *المنجز اليوم:* لا شيء\n\n`;
    }

    if (allPending.length > 0) {
      msg += `⏳ *لا تزال معلقة (${allPending.length}):*\n`;
      const byTopic = {};
      for (const t of allPending) {
        const key = t.topic_name || "عام";
        if (!byTopic[key]) byTopic[key] = [];
        byTopic[key].push(t);
      }
      for (const [topic, tasks] of Object.entries(byTopic)) {
        msg += `  📁 ${topic}: ${tasks.length} مهمة\n`;
      }
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `🔴 *متأخرة (${overdue.length}):*\n`;
      overdue.slice(0, 8).forEach((t) => {
        const assignee = t.assigned_to ? ` ← ${t.assigned_to}` : "";
        msg += `  • ${t.title}${assignee} _(${t.due_date})_\n`;
      });
      msg += "\n";
    }

    msg += `📈 *الملخص:* ✅ ${stats.done} مكتملة  ⏳ ${stats.pending} معلقة  🔴 ${overdue.length} متأخرة`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });

    console.log("[OpsScheduler] Daily report sent (bilingual).");
  } catch (error) {
    console.error("[OpsScheduler] Daily report error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 3. Evening Reminder (6 PM KSA) ━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendEveningReminder() {
  if (!bot) return;
  if (alreadySent("evening_reminder")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 18 || min >= 5) return;  // 6 PM KSA

  markSent("evening_reminder");

  try {
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    let msg = `🌆 *Evening Reminder | تذكير مسائي*\n`;
    msg += `${DIV}\n\n`;

    msg += `Before end of day, please update:\n\n`;
    msg += `  ✅ *11 — Completed Today | المنجز اليوم*\n`;
    msg += `  _What did you accomplish today?_\n\n`;
    msg += `  📌 *12 — Tomorrow Priorities | أولويات الغد*\n`;
    msg += `  _What are tomorrow's priorities?_\n\n`;

    if (stats.pending > 0) {
      msg += `⚠️ There are still *${stats.pending} pending tasks*. Use /summary to review.\n`;
    } else {
      msg += `✨ All tasks completed. Great work today!\n`;
    }

    msg += `\n${DIV}\n\n`;

    msg += `قبل نهاية اليوم، يرجى التحديث:\n\n`;
    msg += `  ✅ *11 — المنجز اليوم*\n`;
    msg += `  _ماذا أنجزت اليوم؟_\n\n`;
    msg += `  📌 *12 — أولويات الغد*\n`;
    msg += `  _ما هي أولويات الغد؟_\n\n`;

    if (stats.pending > 0) {
      msg += `⚠️ لا تزال هناك *${stats.pending} مهمة معلقة*. استخدم /summary للمراجعة.`;
    } else {
      msg += `✨ جميع المهام مكتملة. عمل رائع اليوم!`;
    }

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
      disable_notification: true,
    });

    console.log("[OpsScheduler] Evening reminder sent (bilingual) → CEO Update thread.");
  } catch (error) {
    console.error("[OpsScheduler] Evening reminder error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 4. Escalation Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

      let msg = `🚨 *ESCALATION | تصعيد*\n`;
      msg += `${DIV}\n\n`;
      msg += `*Blocker Unresolved >24h*\n`;
      msg += `  ⬜ ${task.title}${assignee}\n`;
      msg += `  ⏰ Created ${hoursOld}h ago\n`;
      msg += `  📍 10 — Blockers & Escalations\n`;
      msg += `  🔗 Task #${task.id}\n\n`;
      msg += `  ⚠️ _This blocker needs immediate attention._\n`;
      msg += `\n${DIV}\n\n`;
      msg += `*عائق لم يُحل منذ أكثر من 24 ساعة*\n`;
      msg += `  ⬜ ${task.title}${assignee}\n`;
      msg += `  ⏰ منذ ${hoursOld} ساعة\n`;
      msg += `  📍 10 — العوائق والتصعيد\n`;
      msg += `  🔗 مهمة #${task.id}\n\n`;
      msg += `  ⚠️ _هذا العائق يحتاج اهتمام فوري._`;

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 5. Vendor Follow-up Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkVendorFollowUps() {
  if (!bot) return;

  try {
    const overdueVendors = opsDb.getOverdueVendorFollowUps(OPS_GROUP_ID);

    for (const v of overdueVendors) {
      let msg = `🔔 *Vendor Follow-up | متابعة مورد*\n`;
      msg += `${DIV}\n\n`;
      msg += `*EN:* No update received from *${v.vendor_name}*\n`;
      msg += `  📋 ${v.description}\n`;
      msg += `  ⏰ Expected by: ${v.expected_date}\n`;
      msg += `  📍 ${v.topic_name || "Operations"}\n\n`;
      msg += `${DIV}\n\n`;
      msg += `*AR:* لم يتم استلام تحديث من *${v.vendor_name}*\n`;
      msg += `  📋 ${v.description}\n`;
      msg += `  ⏰ الموعد المتوقع: ${v.expected_date}\n`;
      msg += `  📍 ${v.topic_name || "العمليات"}`;

      const sendOpts = { parse_mode: "Markdown" };
      if (v.thread_id) sendOpts.message_thread_id = v.thread_id;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
        opsDb.markVendorFollowUpNotified(v.id);
        console.log(`[OpsScheduler] Vendor follow-up sent for: ${v.vendor_name}`);
      } catch (err) {
        console.error(`[OpsScheduler] Vendor follow-up error:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Vendor follow-up check error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 6. Overdue Task Pinger ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const pingedTasks = new Set();

async function pingOverdueTasks() {
  if (!bot) return;

  try {
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);

    for (const task of overdue) {
      if (!task.assigned_to) continue;
      const key = `${task.id}_${todayKSA()}`;
      if (pingedTasks.has(key)) continue;
      pingedTasks.add(key);

      let msg = `⏰ *Overdue Reminder | تذكير بالتأخر*\n`;
      msg += `${DIV}\n\n`;
      msg += `${task.assigned_to}, task #${task.id} is overdue:\n`;
      msg += `  ⬜ ${task.title}\n`;
      msg += `  📅 Due: ${task.due_date}\n`;
      msg += `  📍 ${task.topic_name || "General"}\n\n`;
      msg += `${DIV}\n\n`;
      msg += `${task.assigned_to}، المهمة #${task.id} متأخرة:\n`;
      msg += `  ⬜ ${task.title}\n`;
      msg += `  📅 الاستحقاق: ${task.due_date}\n`;
      msg += `  📍 ${task.topic_name || "عام"}`;

      const sendOpts = { parse_mode: "Markdown" };
      if (task.thread_id) sendOpts.message_thread_id = task.thread_id;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
      } catch (err) {
        console.error(`[OpsScheduler] Overdue ping error #${task.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Overdue ping error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 7. Follow-up Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkFollowUps() {
  if (!bot) return;

  try {
    const due = opsDb.getDueFollowUps(OPS_GROUP_ID);

    for (const fu of due) {
      let msg = `🔔 *Follow-up | متابعة*\n`;
      msg += `${DIV}\n\n`;
      msg += `📋 ${fu.note}\n`;
      if (fu.task_id) msg += `🔗 Task #${fu.task_id}\n`;
      msg += `\n${DIV}\n\n`;
      msg += `📋 ${fu.note}\n`;
      if (fu.task_id) msg += `🔗 مهمة #${fu.task_id}`;

      const sendOpts = { parse_mode: "Markdown" };
      if (fu.thread_id) sendOpts.message_thread_id = fu.thread_id;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
        opsDb.markFollowUpDone(fu.id);
      } catch (err) {
        console.error(`[OpsScheduler] Follow-up error:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Follow-up check error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 8. Reminder Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkReminders() {
  if (!bot) return;

  try {
    const due = opsDb.getDueReminders(OPS_GROUP_ID);

    for (const r of due) {
      let msg = `⏰ *Reminder | تذكير*\n`;
      msg += `${DIV}\n\n`;
      msg += `📋 ${r.message}\n`;
      msg += `\n${DIV}\n\n`;
      msg += `📋 ${r.message}`;

      const sendOpts = { parse_mode: "Markdown" };
      if (r.thread_id) sendOpts.message_thread_id = r.thread_id;

      try {
        await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
        opsDb.markReminderDone(r.id);
      } catch (err) {
        console.error(`[OpsScheduler] Reminder error:`, err.message);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Reminder check error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 9. SLA Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const slaWarned = new Set();
const slaBreached = new Set();

async function checkSlaBreaches() {
  if (!bot) return;

  try {
    const slaConfigs = opsDb.getAllSlaConfigs(OPS_GROUP_ID);

    for (const sla of slaConfigs) {
      const slaHours = sla.resolution_hours;
      const tasks = opsDb.getPendingTasksByThread(OPS_GROUP_ID, sla.thread_id);

      for (const task of tasks) {
        const createdAt = new Date(task.created_at).getTime();
        const elapsedHours = (Date.now() - createdAt) / (60 * 60 * 1000);
        const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";

        // 75% warning
        if (elapsedHours >= slaHours * 0.75 && elapsedHours < slaHours && !slaWarned.has(task.id)) {
          slaWarned.add(task.id);
          const remaining = Math.round(slaHours - elapsedHours);

          let msg = `🟡 *SLA Warning | تحذير SLA*\n`;
          msg += `${DIV}\n\n`;
          msg += `*EN:* Task approaching SLA deadline\n`;
          msg += `  ⬜ ${task.title}${assignee}\n`;
          msg += `  ⏱️ SLA: ${slaHours}h | Remaining: ~${remaining}h\n`;
          msg += `  📍 ${sla.topic_name}\n`;
          msg += `  🔗 Task #${task.id}\n\n`;
          msg += `${DIV}\n\n`;
          msg += `*AR:* المهمة تقترب من الموعد النهائي\n`;
          msg += `  ⬜ ${task.title}${assignee}\n`;
          msg += `  ⏱️ SLA: ${slaHours} ساعة | المتبقي: ~${remaining} ساعة\n`;
          msg += `  🔗 مهمة #${task.id}`;

          const sendOpts = { parse_mode: "Markdown" };
          if (task.thread_id) sendOpts.message_thread_id = task.thread_id;
          try {
            await bot.telegram.sendMessage(OPS_GROUP_ID, msg, sendOpts);
          } catch (err) {
            console.error(`[OpsScheduler] SLA warning error #${task.id}:`, err.message);
          }
        }

        // 100% breach
        if (elapsedHours >= slaHours && !slaBreached.has(task.id)) {
          slaBreached.add(task.id);
          const overBy = Math.round(elapsedHours - slaHours);

          let msg = `🔴 *SLA BREACHED | تجاوز SLA*\n`;
          msg += `${DIV}\n\n`;
          msg += `*EN:* SLA deadline exceeded\n`;
          msg += `  ⬜ ${task.title}${assignee}\n`;
          msg += `  ⏱️ SLA: ${slaHours}h | Elapsed: ${Math.round(elapsedHours)}h (+${overBy}h over)\n`;
          msg += `  📍 ${sla.topic_name}\n`;
          msg += `  🔗 Task #${task.id}\n\n`;
          msg += `  ⚠️ _SLA breached. Immediate action required._\n`;
          msg += `\n${DIV}\n\n`;
          msg += `*AR:* تم تجاوز الموعد النهائي\n`;
          msg += `  ⬜ ${task.title}${assignee}\n`;
          msg += `  ⏱️ SLA: ${slaHours} ساعة | المنقضي: ${Math.round(elapsedHours)} ساعة (+${overBy} ساعة)\n`;
          msg += `  🔗 مهمة #${task.id}\n\n`;
          msg += `  ⚠️ _تم تجاوز SLA. مطلوب إجراء فوري._`;

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 10. Recurring Task Creator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processRecurringTasks() {
  if (!bot) return;

  try {
    const recurring = opsDb.getActiveRecurringTasks(OPS_GROUP_ID);
    const ksa = ksaNow();
    const today = todayKSA();
    const dayOfWeek = ksa.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const dayOfMonth = ksa.getUTCDate();

    for (const rec of recurring) {
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

      try {
        const taskId = opsDb.addTask(rec.chat_id, rec.thread_id, rec.topic_name, rec.title, {
          priority: rec.priority || "normal",
          assignedTo: rec.assigned_to || null,
          propertyTag: rec.property_tag || null,
          createdBy: "Recurring",
        });

        opsDb.updateRecurringLastCreated(rec.id, today);

        let msg = `🔄 *Recurring Task | مهمة متكررة*\n`;
        msg += `${DIV}\n\n`;
        msg += `  ⬜ ${rec.title} [#${taskId}]\n`;
        msg += `  📅 ${rec.schedule_type}: ${rec.schedule_value}`;
        if (rec.assigned_to) msg += `\n  👤 ${rec.assigned_to}`;
        msg += `\n\n${DIV}\n\n`;
        msg += `  ⬜ ${rec.title} [#${taskId}]\n`;
        msg += `  📅 ${rec.schedule_type === "daily" ? "يومي" : rec.schedule_type === "weekly" ? "أسبوعي" : "شهري"}: ${rec.schedule_value}`;
        if (rec.assigned_to) msg += `\n  👤 ${rec.assigned_to}`;

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 11. Google Sheets & Calendar Sync ━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function syncToGoogle() {
  if (!googleSync.isConfigured()) return;
  if (alreadySent("google_sync")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 21 || min < 15 || min >= 20) return;  // 9:15 PM KSA

  markSent("google_sync");

  try {
    console.log("[GoogleSync] Starting daily sync...");

    const allTasks = opsDb.getDb().prepare(
      "SELECT * FROM tasks WHERE chat_id = ? AND status != 'cancelled' ORDER BY id DESC"
    ).all(OPS_GROUP_ID);

    const weeklyStats = opsDb.getWeeklyStats(OPS_GROUP_ID);
    const monthlyStats = opsDb.getMonthlyStats(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const taskStats = opsDb.getTaskStats(OPS_GROUP_ID);

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

    let expenses = [];
    try { expenses = opsDb.getMonthlyExpenses(OPS_GROUP_ID); } catch (e) {}
    let occupancy = [];
    try { occupancy = opsDb.getOccupancy(OPS_GROUP_ID); } catch (e) {}

    const calendarTasks = allTasks.filter(t => t.due_date);

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 12. Priority Auto-Escalation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

      let msg = `🔺 *Priority Escalation | تصعيد أولوية*\n`;
      msg += `${DIV}\n\n`;
      msg += `*EN:* High priority task pending ${hours}h+\n`;
      msg += `  ⬜ ${task.title}${assignee}\n`;
      msg += `  📍 ${task.topic_name || "General"} → CEO Update\n`;
      msg += `  🔗 Task #${task.id}\n\n`;
      msg += `${DIV}\n\n`;
      msg += `*AR:* مهمة عالية الأولوية معلقة منذ ${hours}+ ساعة\n`;
      msg += `  ⬜ ${task.title}${assignee}\n`;
      msg += `  📍 ${task.topic_name || "عام"} → تحديث المدير\n`;
      msg += `  🔗 مهمة #${task.id}`;

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 13. End-of-Day Check-in ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendCheckinReminder() {
  if (!bot) return;
  if (alreadySent("checkin_reminder")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  if (hour !== 17 || min >= 5) return;  // 5 PM KSA

  markSent("checkin_reminder");

  const today = todayKSA();
  let unchecked = [];
  try { unchecked = v4Db.getUncheckedMembers(OPS_GROUP_ID, today); } catch (e) {}

  if (unchecked.length === 0) return;

  let msg = `📋 *Check-in Reminder | تذكير بالتسجيل*\n`;
  msg += `${DIV}\n\n`;
  msg += `*EN:* The following team members haven't posted updates today:\n`;
  for (const m of unchecked) {
    msg += `  • ${m.username || m.display_name || "Unknown"}\n`;
  }
  msg += `\n_Please post your end-of-day update._\n`;
  msg += `\n${DIV}\n\n`;
  msg += `*AR:* أعضاء الفريق التالية أسماؤهم لم يقدموا تحديثات اليوم:\n`;
  for (const m of unchecked) {
    msg += `  • ${m.username || m.display_name || "غير معروف"}\n`;
  }
  msg += `\n_يرجى نشر تحديث نهاية اليوم._`;

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
  if (hour !== 18 || min >= 5) return;  // 6 PM KSA

  markSent("checkin_flag");

  const today = todayKSA();
  let unchecked = [];
  try { unchecked = v4Db.getUncheckedMembers(OPS_GROUP_ID, today); } catch (e) {}

  for (const m of unchecked) {
    try { v4Db.flagUnchecked(OPS_GROUP_ID, m.user_id, today); } catch (e) {}
  }

  if (unchecked.length > 0) {
    console.log(`[OpsScheduler] Flagged ${unchecked.length} unchecked members`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 13. Weekly CEO Message ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendWeeklyCeoMessage() {
  if (!bot) return;
  if (alreadySent("weekly_ceo")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  const dayOfWeek = ksa.getUTCDay();
  if (dayOfWeek !== 0 || hour !== 9 || min >= 5) return;  // Sunday 9 AM KSA

  markSent("weekly_ceo");

  try {
    const stats = opsDb.getWeeklyStats(OPS_GROUP_ID);
    const monthly = opsDb.getMonthlyStats(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    const completionRate = stats.created > 0 ? Math.round((stats.completed / stats.created) * 100) : 0;

    let msg = `👑 *Weekly CEO Report | التقرير الأسبوعي للرئيس التنفيذي*\n`;
    msg += `${DIV}\n\n`;
    msg += `📊 *Week Summary:*\n`;
    msg += `  • Created: ${stats.created || 0}\n`;
    msg += `  • Completed: ${stats.completed || 0}\n`;
    msg += `  • Completion Rate: ${completionRate}%\n`;
    msg += `  • Overdue: ${overdue.length}\n`;
    if (stats.avgResolutionHours) msg += `  • Avg Resolution: ${stats.avgResolutionHours}h\n`;
    msg += `\n${DIV}\n\n`;
    msg += `📊 *ملخص الأسبوع:*\n`;
    msg += `  • المنشأة: ${stats.created || 0}\n`;
    msg += `  • المكتملة: ${stats.completed || 0}\n`;
    msg += `  • معدل الإنجاز: ${completionRate}%\n`;
    msg += `  • المتأخرة: ${overdue.length}\n`;
    if (stats.avgResolutionHours) msg += `  • متوسط وقت الحل: ${stats.avgResolutionHours} ساعة\n`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });
    console.log("[OpsScheduler] Weekly CEO message posted");
  } catch (error) {
    console.error("[OpsScheduler] Weekly CEO message error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 14. Weekly Team Standup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendWeeklyStandup() {
  if (!bot) return;
  if (alreadySent("weekly_standup")) return;

  const ksa = ksaNow();
  const hour = ksa.getUTCHours();
  const min = ksa.getUTCMinutes();
  const dayOfWeek = ksa.getUTCDay();
  if (dayOfWeek !== 0 || hour !== 9 || min >= 5) return;  // Sunday 9 AM KSA

  markSent("weekly_standup");

  try {
    const stats = opsDb.getWeeklyStats(OPS_GROUP_ID);
    const overdue = opsDb.getOverdueTasks(OPS_GROUP_ID);
    let leaderboard = [];
    try { leaderboard = v4Db.getLeaderboard(OPS_GROUP_ID); } catch (e) {}

    // ── English Section ──
    let msg = `📊 *Weekly Standup | الاجتماع الأسبوعي*\n`;
    msg += `${DIV}\n\n`;

    msg += `📈 *This Week's Numbers:*\n`;
    msg += `  • Tasks Created: ${stats.created || 0}\n`;
    msg += `  • Tasks Completed: ${stats.completed || 0}\n`;
    msg += `  • Currently Overdue: ${overdue.length}\n`;
    if (stats.avgResolutionHours) msg += `  • Avg Resolution: ${stats.avgResolutionHours}h\n`;
    msg += "\n";

    if (leaderboard.length > 0) {
      msg += `🏆 *Team Performance:*\n`;
      const medals = ["🥇", "🥈", "🥉"];
      leaderboard.slice(0, 5).forEach((entry, i) => {
        const medal = medals[i] || `  ${i + 1}.`;
        msg += `${medal} ${entry.assigned_to}: ${entry.completed}/${entry.total_tasks} (${entry.completion_rate || 0}%)\n`;
      });
      msg += "\n";
    }

    if (overdue.length > 0) {
      msg += `🔴 *Overdue (${overdue.length}):*\n`;
      for (const t of overdue.slice(0, 5)) {
        msg += `  • #${t.id}: ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ""}\n`;
      }
      if (overdue.length > 5) msg += `  _...and ${overdue.length - 5} more_\n`;
      msg += "\n";
    }

    msg += `📋 *This Week's Focus:*\n`;
    msg += `Please reply with:\n`;
    msg += `  1. What you accomplished last week\n`;
    msg += `  2. What you're focusing on this week\n`;
    msg += `  3. Any blockers or help needed\n`;

    // ── Arabic Section ──
    msg += `\n${DIV}\n\n`;

    msg += `📈 *أرقام هذا الأسبوع:*\n`;
    msg += `  • المهام المنشأة: ${stats.created || 0}\n`;
    msg += `  • المهام المكتملة: ${stats.completed || 0}\n`;
    msg += `  • المتأخرة حالياً: ${overdue.length}\n`;
    if (stats.avgResolutionHours) msg += `  • متوسط وقت الحل: ${stats.avgResolutionHours} ساعة\n`;
    msg += "\n";

    if (leaderboard.length > 0) {
      msg += `🏆 *أداء الفريق:*\n`;
      const medals = ["🥇", "🥈", "🥉"];
      leaderboard.slice(0, 5).forEach((entry, i) => {
        const medal = medals[i] || `  ${i + 1}.`;
        msg += `${medal} ${entry.assigned_to}: ${entry.completed}/${entry.total_tasks} (${entry.completion_rate || 0}%)\n`;
      });
      msg += "\n";
    }

    msg += `📋 *تركيز هذا الأسبوع:*\n`;
    msg += `يرجى الرد بـ:\n`;
    msg += `  1. ما أنجزته الأسبوع الماضي\n`;
    msg += `  2. ما ستركز عليه هذا الأسبوع\n`;
    msg += `  3. أي عوائق أو مساعدة مطلوبة`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, msg, {
      parse_mode: "Markdown",
      message_thread_id: THREAD_CEO_UPDATE,
    });
    console.log("[OpsScheduler] Weekly standup posted (bilingual)");
  } catch (error) {
    console.error("[OpsScheduler] Weekly standup error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 15. Mention Alert Checker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function checkMentionAlerts() {
  if (!bot) return;
  try {
    const unresponded = v4Db.getUnrespondedMentions(OPS_GROUP_ID, 2);
    for (const mention of unresponded) {
      v4Db.markMentionReminderSent(mention.id);

      const topicNames = {
        4: "CEO Update", 5: "Operations", 6: "Listings",
        7: "Bookings", 8: "Support", 9: "Tech Issues",
        10: "Payments", 11: "Marketing", 12: "Legal",
        13: "Blockers", 14: "Completed", 15: "Priorities",
        102: "Ideas", 103: "Photos",
      };
      const topicName = topicNames[mention.thread_id] || "the group";

      let msg = `🔔 *Mention Alert | تنبيه إشارة*\n`;
      msg += `${DIV}\n\n`;
      msg += `${mention.mentioned_username}, you were mentioned`;
      if (mention.mentioned_by) msg += ` by ${mention.mentioned_by}`;
      msg += ` 2+ hours ago in *${topicName}*.\n`;
      msg += `Please check and respond.\n\n`;
      msg += `${DIV}\n\n`;
      msg += `${mention.mentioned_username}، تمت الإشارة إليك`;
      if (mention.mentioned_by) msg += ` بواسطة ${mention.mentioned_by}`;
      msg += ` منذ أكثر من ساعتين في *${topicName}*.\n`;
      msg += `يرجى المراجعة والرد.`;

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 16. Weather Check (7 AM KSA) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const weatherCheckDone = {};
async function checkDailyWeather() {
  if (!bot) return;
  const now = new Date();
  const ksaHour = ((now.getUTCHours() + 3) % 24);
  const ksaMin = now.getUTCMinutes();
  const todayKey = `weather_${now.toISOString().split("T")[0]}`;
  if (ksaHour === 7 && ksaMin < 5 && !weatherCheckDone[todayKey]) {
    weatherCheckDone[todayKey] = true;
    try {
      await v5Handlers.checkAndPostWeatherAlerts(bot);
    } catch (e) {
      console.error("[OpsScheduler] Weather check error:", e.message);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ Main Tick ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let tickCount = 0;

async function tick() {
  try {
    tickCount++;

    // Every tick (1 minute): reminders and follow-ups
    await checkFollowUps();
    await checkReminders();

    // Every 5 minutes: escalations, vendor, SLA, recurring, mentions, priority
    if (tickCount % 5 === 0) {
      await checkEscalations();
      await checkVendorFollowUps();
      await checkSlaBreaches();
      await processRecurringTasks();
      await checkMentionAlerts();
      await checkPriorityEscalation();
    }

    // Every 60 minutes: overdue pings
    if (tickCount % 60 === 0) {
      await pingOverdueTasks();
    }

    // Daily scheduled messages (checked every tick, deduped)
    await sendMorningBriefing();
    await sendDailyReport();
    await sendEveningReminder();
    await syncToGoogle();
    await sendCheckinReminder();
    await flagUncheckedMembers();
    await sendWeeklyCeoMessage();
    await sendWeeklyStandup();
    await checkDailyWeather();

  } catch (error) {
    console.error("[OpsScheduler] Tick error:", error.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ Start / Stop ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
    const defaultSla = { 8: 12, 13: 24, 9: 48 };
    for (const [threadId, hours] of Object.entries(defaultSla)) {
      const existing = opsDb.getSlaForThread(OPS_GROUP_ID, parseInt(threadId));
      if (!existing) {
        const topicNames = {
          8: "05 — Support | دعم العملاء",
          13: "10 — Blockers | العوائق والتصعيد",
          9: "06 — Tech Issues | المشاكل التقنية",
        };
        opsDb.setSlaConfig(OPS_GROUP_ID, parseInt(threadId), topicNames[threadId], hours);
      }
    }
  } catch (e) {
    console.error("[OpsScheduler] SLA init error:", e.message);
  }

  // Run every 60 seconds
  schedulerInterval = setInterval(tick, 60 * 1000);

  // Run immediately on start (after a short delay)
  setTimeout(tick, 5000);

  // Log Google sync status
  if (googleSync.isConfigured()) {
    console.log("[OpsScheduler] Google Sync: ENABLED");
  } else {
    console.log("[OpsScheduler] Google Sync: DISABLED (set GOOGLE_APPS_SCRIPT_URL)");
  }

  console.log("[OpsScheduler] Started v5 Bilingual. Schedule:");
  console.log("  ☀️ Morning Briefing: 9:00 AM KSA → CEO Update");
  console.log("  🌤️ Weather Alerts: 7:00 AM KSA → Operations");
  console.log("  📋 Check-in Reminder: 5:00 PM KSA → CEO Update");
  console.log("  🌆 Evening Reminder: 6:00 PM KSA → CEO Update");
  console.log("  📊 Daily Report: 9:00 PM KSA → CEO Update");
  console.log("  👑 Weekly CEO Message: Sunday 9:00 AM KSA");
  console.log("  📊 Weekly Standup: Sunday 9:00 AM KSA");
  console.log("  📊 Google Sync: 9:15 PM KSA daily");
  console.log("  🚨 Escalation/SLA/Vendor/Mentions: every 5 min");
  console.log("  ⏰ Overdue pings: every 60 min");
  console.log("  🔔 Reminders/Follow-ups: every 1 min");
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
