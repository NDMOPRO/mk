/**
 * Operations Scheduler
 * ─────────────────────────────────────────────────────────────
 * Handles all time-based operations for the Daily Ops HQ group:
 *
 * 1. Morning Briefing — 9:00 AM KSA — Summary of pending tasks across all topics
 * 2. Evening Reminder — 6:00 PM KSA — Remind team to update "Completed Today" and "Tomorrow Priorities"
 * 3. Follow-up Checker — Every 5 minutes — Send due follow-up reminders
 * 4. Reminder Checker — Every 5 minutes — Send due manual reminders
 *
 * All times are in KSA (UTC+3).
 */

const opsDb = require("./ops-database");

const OPS_GROUP_ID = -1003967447285;
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

let schedulerInterval = null;
let bot = null;

/**
 * Get current KSA time as a Date object.
 */
function ksaNow() {
  return new Date(Date.now() + KSA_OFFSET_MS);
}

/**
 * Check if we should send the morning briefing (9:00 AM KSA).
 * Returns true if current KSA time is between 9:00 and 9:05 AM.
 */
function isMorningBriefingTime() {
  const ksa = ksaNow();
  return ksa.getUTCHours() === 6 && ksa.getUTCMinutes() < 5; // 9 AM KSA = 6 AM UTC
}

/**
 * Check if we should send the evening reminder (6:00 PM KSA).
 * Returns true if current KSA time is between 6:00 and 6:05 PM.
 */
function isEveningReminderTime() {
  const ksa = ksaNow();
  return ksa.getUTCHours() === 15 && ksa.getUTCMinutes() < 5; // 6 PM KSA = 3 PM UTC
}

// Track what we've already sent today to avoid duplicates
const sentToday = {
  morning: null,  // date string "YYYY-MM-DD"
  evening: null,
};

function todayKSA() {
  const ksa = ksaNow();
  return `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Send the morning briefing to the ops group.
 * Posts in the General topic (no thread_id) or the "01 — Daily CEO Update" topic.
 */
async function sendMorningBriefing() {
  if (!bot) return;

  const today = todayKSA();
  if (sentToday.morning === today) return; // Already sent today
  sentToday.morning = today;

  try {
    const allTasks = opsDb.getAllPendingTasks(OPS_GROUP_ID);
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    const ksa = ksaNow();
    const dateStr = ksa.toLocaleDateString("ar-SA", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let message = `🌅 *صباح الخير — ملخص اليوم*\n`;
    message += `📅 ${dateStr}\n\n`;

    if (allTasks.length === 0) {
      message += `✨ لا توجد مهام معلقة\\. يوم منتج\\!\n\n`;
    } else {
      message += `📌 *المهام المعلقة: ${stats.pending}*\n\n`;

      // Group by topic
      const byTopic = {};
      for (const task of allTasks) {
        const key = task.topic_name || "عام";
        if (!byTopic[key]) byTopic[key] = [];
        byTopic[key].push(task);
      }

      for (const [topicName, tasks] of Object.entries(byTopic)) {
        message += `• *${escMd(topicName)}*: ${tasks.length} مهمة\n`;
        tasks.slice(0, 3).forEach(task => {
          message += `  ⬜ ${escMd(task.title)}\n`;
        });
        if (tasks.length > 3) message += `  _\\.\\.\\. و ${tasks.length - 3} أخرى_\n`;
      }
    }

    message += `\n💡 استخدم /summary للتفاصيل الكاملة`;

    await bot.telegram.sendMessage(OPS_GROUP_ID, message, {
      parse_mode: "MarkdownV2",
    });

    console.log("[OpsScheduler] Morning briefing sent.");
  } catch (error) {
    console.error("[OpsScheduler] Error sending morning briefing:", error.message);
  }
}

/**
 * Send the evening reminder to update "Completed Today" and "Tomorrow Priorities".
 */
async function sendEveningReminder() {
  if (!bot) return;

  const today = todayKSA();
  if (sentToday.evening === today) return;
  sentToday.evening = today;

  try {
    const stats = opsDb.getTaskStats(OPS_GROUP_ID);

    let message = `🌆 *تذكير مسائي*\n\n`;
    message += `قبل نهاية يوم العمل، يرجى تحديث:\n\n`;
    message += `✅ *11 — Completed Today*\n`;
    message += `_ما الذي أنجزتموه اليوم؟_\n\n`;
    message += `📅 *12 — Tomorrow Priorities*\n`;
    message += `_ما هي أولويات الغد؟_\n\n`;

    if (stats.pending > 0) {
      message += `⚠️ لا تزال هناك *${stats.pending} مهمة معلقة*\\. استخدم /summary للمراجعة\\.`;
    } else {
      message += `✨ جميع المهام مكتملة\\. عمل رائع اليوم\\!`;
    }

    await bot.telegram.sendMessage(OPS_GROUP_ID, message, {
      parse_mode: "MarkdownV2",
    });

    console.log("[OpsScheduler] Evening reminder sent.");
  } catch (error) {
    console.error("[OpsScheduler] Error sending evening reminder:", error.message);
  }
}

/**
 * Check for due follow-ups and send them.
 */
async function checkFollowUps() {
  if (!bot) return;

  try {
    const dueFollowUps = opsDb.getDueFollowUps();

    for (const followUp of dueFollowUps) {
      try {
        const topicEmoji = followUp.topic_name ? "📍" : "💬";
        const topicLine = followUp.topic_name ? `\n${topicEmoji} ${escMd(followUp.topic_name)}` : "";

        const message =
          `🔔 *متابعة تلقائية*${topicLine}\n\n` +
          `${escMd(followUp.from_user)} — هل تم التحديث؟\n\n` +
          `_"${escMd(followUp.message_text.substring(0, 100))}${followUp.message_text.length > 100 ? "..." : ""}"_`;

        const sendOptions = {
          parse_mode: "MarkdownV2",
        };
        if (followUp.thread_id) {
          sendOptions.message_thread_id = followUp.thread_id;
        }

        await bot.telegram.sendMessage(followUp.chat_id, message, sendOptions);
        opsDb.markFollowUpSent(followUp.id);
        console.log(`[OpsScheduler] Follow-up sent for ID ${followUp.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Error sending follow-up ${followUp.id}:`, err.message);
        // Mark as sent anyway to avoid infinite retries
        opsDb.markFollowUpSent(followUp.id);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Error checking follow-ups:", error.message);
  }
}

/**
 * Check for due manual reminders and send them.
 */
async function checkReminders() {
  if (!bot) return;

  try {
    const dueReminders = opsDb.getDueReminders();

    for (const reminder of dueReminders) {
      try {
        const topicLine = reminder.topic_name ? `\n📍 ${escMd(reminder.topic_name)}` : "";
        const byLine = reminder.created_by ? `\n👤 ${escMd(reminder.created_by)}` : "";

        const message =
          `⏰ *تذكير*${topicLine}${byLine}\n\n` +
          `${escMd(reminder.message)}`;

        const sendOptions = {
          parse_mode: "MarkdownV2",
        };
        if (reminder.thread_id) {
          sendOptions.message_thread_id = reminder.thread_id;
        }

        await bot.telegram.sendMessage(reminder.chat_id, message, sendOptions);
        opsDb.markReminderSent(reminder.id);
        console.log(`[OpsScheduler] Reminder sent for ID ${reminder.id}`);
      } catch (err) {
        console.error(`[OpsScheduler] Error sending reminder ${reminder.id}:`, err.message);
        opsDb.markReminderSent(reminder.id);
      }
    }
  } catch (error) {
    console.error("[OpsScheduler] Error checking reminders:", error.message);
  }
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

/**
 * Main scheduler tick — runs every minute.
 */
async function tick() {
  try {
    // Check daily scheduled messages
    if (isMorningBriefingTime()) await sendMorningBriefing();
    if (isEveningReminderTime()) await sendEveningReminder();

    // Check follow-ups and reminders every tick (every minute)
    await checkFollowUps();
    await checkReminders();
  } catch (error) {
    console.error("[OpsScheduler] Tick error:", error.message);
  }
}

/**
 * Start the scheduler.
 * @param {Telegraf} botInstance — The Telegraf bot instance
 */
function startOpsScheduler(botInstance) {
  bot = botInstance;

  // Initialize the ops database
  opsDb.getDb();

  // Run every 60 seconds
  schedulerInterval = setInterval(tick, 60 * 1000);

  // Run immediately on start (after a short delay to let bot connect)
  setTimeout(tick, 5000);

  console.log("[OpsScheduler] Started. Morning briefing at 9:00 AM KSA, evening reminder at 6:00 PM KSA.");
}

/**
 * Stop the scheduler.
 */
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
