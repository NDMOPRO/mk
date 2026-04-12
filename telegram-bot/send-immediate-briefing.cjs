/**
 * Immediate Morning Briefing + Per-Employee Task Distribution
 * Sends the real morning briefing NOW to CEO Update topic (thread 4)
 * and sends Mushtaq his personal task list.
 */
const { Telegraf } = require("telegraf");
const Database = require("better-sqlite3");
const path = require("path");

const TOKEN = "8729034252:AAFzfZIDrquCNjoI1lrZKVCh6x9iH9hZL84";
const CHAT_ID = -1003967447285;
const THREAD_CEO_UPDATE = 4;
const THREAD_PRIORITIES = 15;
const THREAD_BLOCKERS = 13;
const THREAD_MARKETING = 11;
const DIV = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

const bot = new Telegraf(TOKEN);
const DB_PATH = path.join(__dirname, "data", "ops.db");
const db = new Database(DB_PATH);

function getAllPendingTasks() {
  return db.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' ORDER BY 
    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, id ASC`).all(CHAT_ID);
}

function getOverdueTasks() {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?`).all(CHAT_ID, today);
}

function getTasksDueToday() {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date = ?`).all(CHAT_ID, today);
}

function getTaskStats() {
  const pending = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending'`).get(CHAT_ID).c;
  const done = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done'`).get(CHAT_ID).c;
  return { pending, done };
}

function getTasksByAssignee(name) {
  return db.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND assigned_to LIKE ? ORDER BY 
    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, id ASC`).all(CHAT_ID, `%${name}%`);
}

const priorityEmoji = { urgent: "🔴", high: "🟠", normal: "🟡" };

async function sendMorningBriefing() {
  const allTasks = getAllPendingTasks();
  const overdue = getOverdueTasks();
  const dueToday = getTasksDueToday();
  const stats = getTaskStats();

  // Group by assignee
  const byAssignee = {};
  for (const t of allTasks) {
    const key = t.assigned_to || "Unassigned";
    if (!byAssignee[key]) byAssignee[key] = [];
    byAssignee[key].push(t);
  }

  // Group by topic
  const byTopic = {};
  for (const t of allTasks) {
    const key = t.topic_name || "General";
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(t);
  }

  const now = new Date();
  const dateEN = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });
  const dateAR = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" });

  // ── English Section ──
  let msg = `☀️ <b>Morning Briefing | الإحاطة الصباحية</b>\n`;
  msg += `📅 ${dateEN}\n`;
  msg += `${DIV}\n\n`;

  msg += `📊 <b>Task Overview:</b>\n`;
  msg += `  ⏳ Pending: <b>${stats.pending}</b>   ✅ Completed: <b>${stats.done}</b>   🔴 Overdue: <b>${overdue.length}</b>\n\n`;

  if (overdue.length > 0) {
    msg += `🔴 <b>OVERDUE — Immediate Action Required (${overdue.length}):</b>\n`;
    overdue.forEach((t) => {
      const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
      msg += `  ${priorityEmoji[t.priority] || "🟡"} ${t.title}${assignee}\n     📁 ${t.topic_name || "General"} | Due: ${t.due_date}\n`;
    });
    msg += "\n";
  }

  if (dueToday.length > 0) {
    msg += `📌 <b>Due Today (${dueToday.length}):</b>\n`;
    dueToday.forEach((t) => {
      const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
      msg += `  ${priorityEmoji[t.priority] || "🟡"} ${t.title}${assignee}\n`;
    });
    msg += "\n";
  }

  if (Object.keys(byAssignee).length > 0) {
    msg += `👤 <b>Tasks by Team Member:</b>\n`;
    for (const [assignee, tasks] of Object.entries(byAssignee)) {
      msg += `\n  <b>${assignee}</b> (${tasks.length} task${tasks.length > 1 ? "s" : ""}):\n`;
      tasks.forEach((t) => {
        const due = t.due_date ? ` | Due: ${t.due_date}` : "";
        msg += `    ${priorityEmoji[t.priority] || "🟡"} [#${t.id}] ${t.title}${due}\n`;
      });
    }
    msg += "\n";
  }

  msg += `💡 <b>Commands:</b> /tasks  /done #ID  /remind #ID  /summary  /kpi\n`;

  // ── Arabic Section ──
  msg += `\n${DIV}\n`;
  msg += `📅 ${dateAR}\n\n`;

  msg += `📊 <b>نظرة عامة على المهام:</b>\n`;
  msg += `  ⏳ معلقة: <b>${stats.pending}</b>   ✅ مكتملة: <b>${stats.done}</b>   🔴 متأخرة: <b>${overdue.length}</b>\n\n`;

  if (overdue.length > 0) {
    msg += `🔴 <b>متأخرة — تتطلب إجراءً فورياً (${overdue.length}):</b>\n`;
    overdue.forEach((t) => {
      const assignee = t.assigned_to ? ` ← ${t.assigned_to}` : "";
      msg += `  ${priorityEmoji[t.priority] || "🟡"} ${t.title}${assignee}\n     📁 ${t.topic_name || "عام"} | الاستحقاق: ${t.due_date}\n`;
    });
    msg += "\n";
  }

  if (Object.keys(byAssignee).length > 0) {
    msg += `👤 <b>المهام حسب عضو الفريق:</b>\n`;
    for (const [assignee, tasks] of Object.entries(byAssignee)) {
      msg += `\n  <b>${assignee}</b> (${tasks.length} مهمة):\n`;
      tasks.forEach((t) => {
        const due = t.due_date ? ` | الاستحقاق: ${t.due_date}` : "";
        msg += `    ${priorityEmoji[t.priority] || "🟡"} [#${t.id}] ${t.title}${due}\n`;
      });
    }
    msg += "\n";
  }

  msg += `💡 <b>الأوامر:</b> /tasks  /done #ID  /remind #ID  /summary  /kpi`;

  const result = await bot.telegram.sendMessage(CHAT_ID, msg, {
    parse_mode: "HTML",
    message_thread_id: THREAD_CEO_UPDATE,
    disable_notification: false,
  });
  console.log(`✅ Morning briefing sent → Message ID: ${result.message_id}`);
  return result;
}

async function sendMushtaqPersonalBriefing() {
  const tasks = getTasksByAssignee("Mushtaq");
  if (tasks.length === 0) {
    console.log("No pending tasks for Mushtaq.");
    return;
  }

  let msg = `👤 <b>Personal Task Brief — Mushtaq Ibn Muhammad</b>\n`;
  msg += `<b>Operational Manager | مدير العمليات</b>\n`;
  msg += `${DIV}\n\n`;
  msg += `You have <b>${tasks.length} active tasks</b> assigned to you:\n\n`;

  tasks.forEach((t, i) => {
    const due = t.due_date ? `\n     📅 Deadline: <b>${t.due_date}</b>` : "";
    const topic = t.topic_name ? `\n     📁 Topic: ${t.topic_name}` : "";
    msg += `${i + 1}. ${priorityEmoji[t.priority] || "🟡"} <b>[#${t.id}] ${t.title}</b>${due}${topic}\n\n`;
  });

  msg += `${DIV}\n\n`;
  msg += `👤 <b>ملخص مهام — مشتاق ابن محمد</b>\n`;
  msg += `<b>مدير العمليات</b>\n\n`;
  msg += `لديك <b>${tasks.length} مهمة نشطة</b> مسندة إليك:\n\n`;

  tasks.forEach((t, i) => {
    const due = t.due_date ? `\n     📅 الموعد النهائي: <b>${t.due_date}</b>` : "";
    const topic = t.topic_name ? `\n     📁 الموضوع: ${t.topic_name}` : "";
    msg += `${i + 1}. ${priorityEmoji[t.priority] || "🟡"} <b>[#${t.id}] ${t.title}</b>${due}${topic}\n\n`;
  });

  msg += `💡 لتحديث حالة مهمة: /done #${tasks[0].id}  أو  /update #${tasks[0].id} in progress`;

  // Send to the Priorities topic where Mushtaq is most active
  const result = await bot.telegram.sendMessage(CHAT_ID, msg, {
    parse_mode: "HTML",
    message_thread_id: THREAD_PRIORITIES,
    disable_notification: false,
  });
  console.log(`✅ Mushtaq personal briefing sent → Message ID: ${result.message_id}`);
  return result;
}

async function main() {
  console.log("=== Sending Immediate Morning Briefing ===");
  console.log("Checking database tasks...");
  const tasks = getAllPendingTasks();
  console.log(`Found ${tasks.length} pending tasks in database.`);
  tasks.forEach(t => console.log(`  [#${t.id}] ${t.title} | ${t.priority} | ${t.assigned_to} | due: ${t.due_date || 'none'}`));
  console.log("");

  await sendMorningBriefing();
  await new Promise(r => setTimeout(r, 2000));
  await sendMushtaqPersonalBriefing();

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
