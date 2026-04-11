/**
 * Operations Group Handler — v3 (21-Feature)
 * ─────────────────────────────────────────────────────────────
 * Handles ALL interactions in the Monthly Key Daily Operations HQ group.
 * Chat ID: -1003967447285
 *
 * Original 10 features (v2):
 *  1.  Daily Auto-Reports          2.  Task Assignments & Accountability
 *  3.  KPI Dashboard               4.  Escalation Rules
 *  5.  Tenant/Property Tracking    6.  Photo/Document Logging
 *  7.  Vendor Follow-up            8.  Handoff Between Topics
 *  9.  Morning Briefing           10.  Voice Note Transcription
 *
 * New 11 features (v3):
 *  11. SLA Timers                 12. Approval Workflows
 *  13. Recurring Tasks            14. Task Dependencies
 *  15. Shift Handover             16. Monthly Report
 *  17. Expense Tracker            18. Occupancy Tracker
 *  19. Meeting Notes              20. Google Sheets Sync
 *  21. Calendar Integration
 */

const opsDb = require("../services/ops-database");
const config = require("../config");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ─── Constants ──────────────────────────────────────────────

const OPS_GROUP_ID = -1003967447285;

const THREAD_IDS = {
  RULES: 3, CEO_UPDATE: 4, OPERATIONS: 5, LISTINGS: 6,
  BOOKINGS: 7, SUPPORT: 8, TECH: 9, PAYMENTS: 10,
  MARKETING: 11, LEGAL: 12, BLOCKERS: 13, COMPLETED: 14, PRIORITIES: 15,
};

const TOPIC_SHORTNAMES = {
  rules: THREAD_IDS.RULES, ceo: THREAD_IDS.CEO_UPDATE,
  "ceo-update": THREAD_IDS.CEO_UPDATE, operations: THREAD_IDS.OPERATIONS,
  ops: THREAD_IDS.OPERATIONS, listings: THREAD_IDS.LISTINGS,
  bookings: THREAD_IDS.BOOKINGS, revenue: THREAD_IDS.BOOKINGS,
  support: THREAD_IDS.SUPPORT, tech: THREAD_IDS.TECH,
  payments: THREAD_IDS.PAYMENTS, finance: THREAD_IDS.PAYMENTS,
  marketing: THREAD_IDS.MARKETING, legal: THREAD_IDS.LEGAL,
  blockers: THREAD_IDS.BLOCKERS, escalations: THREAD_IDS.BLOCKERS,
  completed: THREAD_IDS.COMPLETED, priorities: THREAD_IDS.PRIORITIES,
  tomorrow: THREAD_IDS.PRIORITIES,
};

const TOPIC_FULL_NAMES = {
  [THREAD_IDS.RULES]: "00 — Rules & Channel Guide",
  [THREAD_IDS.CEO_UPDATE]: "01 — Daily CEO Update",
  [THREAD_IDS.OPERATIONS]: "02 — Operations Follow-Up",
  [THREAD_IDS.LISTINGS]: "03 — Listings & Inventory",
  [THREAD_IDS.BOOKINGS]: "04 — Bookings & Revenue",
  [THREAD_IDS.SUPPORT]: "05 — Customer Support & Complaints",
  [THREAD_IDS.TECH]: "06 — Website & Tech Issues",
  [THREAD_IDS.PAYMENTS]: "07 — Payments & Finance",
  [THREAD_IDS.MARKETING]: "08 — Marketing & Content",
  [THREAD_IDS.LEGAL]: "09 — Legal / Compliance / Government",
  [THREAD_IDS.BLOCKERS]: "10 — Blockers & Escalations",
  [THREAD_IDS.COMPLETED]: "11 — Completed Today",
  [THREAD_IDS.PRIORITIES]: "12 — Tomorrow Priorities",
};

// Default SLA hours per topic
const DEFAULT_SLA = {
  [THREAD_IDS.SUPPORT]: 12,
  [THREAD_IDS.BLOCKERS]: 24,
  [THREAD_IDS.TECH]: 48,
};

// ─── Conversation Context Memory ────────────────────────────
const conversationMemory = new Map();
const MAX_MEMORY = 20;

function getConversationKey(chatId, threadId) {
  return `${chatId}:${threadId || "general"}`;
}
function getConversationHistory(chatId, threadId) {
  return conversationMemory.get(getConversationKey(chatId, threadId)) || [];
}
function addToConversation(chatId, threadId, role, content) {
  const key = getConversationKey(chatId, threadId);
  const history = conversationMemory.get(key) || [];
  history.push({ role, content });
  if (history.length > MAX_MEMORY) history.splice(0, history.length - MAX_MEMORY);
  conversationMemory.set(key, history);
}

// ─── Utility Functions ──────────────────────────────────────

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

function detectMessageLanguage(text) {
  if (!text) return "en";
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = arabicChars + latinChars;
  if (totalLetters === 0) return "en";
  return arabicChars / totalLetters >= 0.3 ? "ar" : "en";
}

function extractPropertyTag(text) {
  if (!text) return null;
  const match = text.match(/#([a-zA-Z0-9_]+)/);
  return match ? match[1].toLowerCase() : null;
}

function extractAssignee(text) {
  if (!text) return null;
  const match = text.match(/@([a-zA-Z0-9_]+)/);
  return match ? `@${match[1]}` : null;
}

// ─── Topic Map ───────────────────────────────────────────────

const TOPIC_CONTEXT = {
  "00": { name: "Rules & Channel Guide", role: "rules", emoji: "📋" },
  "01": { name: "Daily CEO Update", role: "ceo_update", emoji: "👔" },
  "02": { name: "Operations Follow-Up", role: "operations", emoji: "⚙️" },
  "03": { name: "Listings & Inventory", role: "listings", emoji: "🏠" },
  "04": { name: "Bookings & Revenue", role: "bookings", emoji: "💰" },
  "05": { name: "Customer Support & Complaints", role: "support", emoji: "🎧" },
  "06": { name: "Website & Tech Issues", role: "tech", emoji: "💻" },
  "07": { name: "Payments & Finance", role: "finance", emoji: "💳" },
  "08": { name: "Marketing & Content", role: "marketing", emoji: "📢" },
  "09": { name: "Legal / Compliance / Government", role: "legal", emoji: "⚖️" },
  "10": { name: "Blockers & Escalations", role: "blockers", emoji: "🚨" },
  "11": { name: "Completed Today", role: "completed", emoji: "✅" },
  "12": { name: "Tomorrow Priorities", role: "priorities", emoji: "📅" },
};

const threadTopicMap = {};
for (const [threadId, fullName] of Object.entries(TOPIC_FULL_NAMES)) {
  const tid = parseInt(threadId);
  const prefix = fullName.substring(0, 2);
  const info = TOPIC_CONTEXT[prefix];
  if (info) threadTopicMap[tid] = { name: info.name, role: info.role, emoji: info.emoji };
}

function getTopicInfo(threadId) {
  if (!threadId) return { name: "General", role: "general", emoji: "💬" };
  if (threadTopicMap[threadId]) return threadTopicMap[threadId];
  return { name: `Topic #${threadId}`, role: "general", emoji: "💬" };
}

function registerTopicFromCtx(ctx) {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId || threadTopicMap[threadId]) return;
  const topicCreated = ctx.message?.forum_topic_created;
  if (topicCreated?.name) {
    const name = topicCreated.name;
    threadTopicMap[threadId] = { name, role: getRoleFromName(name), emoji: getEmojiFromName(name) };
  }
}

function getRoleFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("ceo") || lower.includes("daily")) return "ceo_update";
  if (lower.includes("operat")) return "operations";
  if (lower.includes("listing") || lower.includes("inventor")) return "listings";
  if (lower.includes("booking") || lower.includes("revenue")) return "bookings";
  if (lower.includes("support") || lower.includes("complaint")) return "support";
  if (lower.includes("tech") || lower.includes("website")) return "tech";
  if (lower.includes("payment") || lower.includes("finance")) return "finance";
  if (lower.includes("market") || lower.includes("content")) return "marketing";
  if (lower.includes("legal") || lower.includes("compliance")) return "legal";
  if (lower.includes("blocker") || lower.includes("escalat")) return "blockers";
  if (lower.includes("complet")) return "completed";
  if (lower.includes("tomorrow") || lower.includes("priorit")) return "priorities";
  if (lower.includes("rules") || lower.includes("guide")) return "rules";
  return "general";
}

function getEmojiFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("ceo")) return "👔";
  if (lower.includes("operat")) return "⚙️";
  if (lower.includes("listing") || lower.includes("inventor")) return "🏠";
  if (lower.includes("booking") || lower.includes("revenue")) return "💰";
  if (lower.includes("support") || lower.includes("complaint")) return "🎧";
  if (lower.includes("tech") || lower.includes("website")) return "💻";
  if (lower.includes("payment") || lower.includes("finance")) return "💳";
  if (lower.includes("market")) return "📢";
  if (lower.includes("legal")) return "⚖️";
  if (lower.includes("blocker") || lower.includes("escalat")) return "🚨";
  if (lower.includes("complet")) return "✅";
  if (lower.includes("tomorrow") || lower.includes("priorit")) return "📅";
  if (lower.includes("rules")) return "📋";
  return "💬";
}

// ─── Follow-up Detection ─────────────────────────────────────

const FOLLOWUP_PATTERNS = [
  { regex: /\b(will|i'll|i will|gonna|going to)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(tomorrow|tonight|later|this evening|by end of day|eod|by morning)\b/i, delay: "tomorrow_morning" },
  { regex: /\b(will|i'll|i will)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(by\s+\d+\s*(am|pm|:))/i, delay: "today_evening" },
  { regex: /\b(will|i'll|i will)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(in\s+\d+\s*(hour|hr|minute|min))/i, delay: "few_hours" },
  { regex: /\b(will\s+get\s+back|will\s+revert|will\s+respond|will\s+reply)\b/i, delay: "tomorrow_morning" },
  { regex: /\b(checking|looking into|will check|let me check)\b.*\b(and\s+update|and\s+confirm|and\s+let\s+you\s+know)\b/i, delay: "today_evening" },
  { regex: /\b(سأ|سوف|هأ|بكره|بكرة)\b/u, delay: "tomorrow_morning" },
  { regex: /سأ(رد|تابع|أتابع|أرسل|أرد|أراجع|أحدث|أنهي|أكمل)/u, delay: "tomorrow_morning" },
  { regex: /(بكره|بكرة|غداً|غدا|الصبح|الصباح)/u, delay: "tomorrow_morning" },
  { regex: /(المساء|العصر|الليل|بعد\s+قليل|خلال\s+ساعة)/u, delay: "today_evening" },
];

const VENDOR_PATTERNS = [
  { regex: /(\w+)\s+(?:said|promised|confirmed|told us|will come|will deliver|will send|will fix|will install)\b.*\b(tomorrow|tonight|by\s+\w+day|by\s+end\s+of\s+\w+|next\s+week|within\s+\d+\s+days?)/i },
  { regex: /(?:the|our)\s+(\w+)\s+(?:said|promised|confirmed|will)\b/i },
  { regex: /(شركة|مقاول|فني|موبايلي|stc|زين|الكهربائي|السباك)\s+(?:قال|وعد|أكد|سيأتي|سيرسل|سيصلح|سيركب)/u },
];

function detectVendorPromise(text) {
  for (const pattern of VENDOR_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) return { vendorName: match[1] || "Vendor", matched: true };
  }
  return null;
}

function detectFollowUpPromise(text) {
  for (const pattern of FOLLOWUP_PATTERNS) {
    if (pattern.regex.test(text)) return pattern.delay;
  }
  return null;
}

function calculateFollowUpTime(delayType) {
  const now = new Date();
  const ksaOffset = 3 * 60 * 60 * 1000;
  const ksaNow = new Date(now.getTime() + ksaOffset);
  let followUpKSA;
  if (delayType === "tomorrow_morning") {
    followUpKSA = new Date(ksaNow);
    followUpKSA.setDate(followUpKSA.getDate() + 1);
    followUpKSA.setHours(9, 30, 0, 0);
  } else if (delayType === "today_evening") {
    followUpKSA = new Date(ksaNow);
    followUpKSA.setHours(18, 0, 0, 0);
    if (followUpKSA <= ksaNow) { followUpKSA.setDate(followUpKSA.getDate() + 1); followUpKSA.setHours(9, 30, 0, 0); }
  } else if (delayType === "few_hours") {
    followUpKSA = new Date(ksaNow.getTime() + 3 * 60 * 60 * 1000);
  } else {
    followUpKSA = new Date(ksaNow);
    followUpKSA.setDate(followUpKSA.getDate() + 1);
    followUpKSA.setHours(9, 30, 0, 0);
  }
  const followUpUTC = new Date(followUpKSA.getTime() - ksaOffset);
  return followUpUTC.toISOString().replace("T", " ").substring(0, 19);
}

function parseReminderTime(timeStr) {
  const ksaOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const ksaNow = new Date(now.getTime() + ksaOffset);
  const relHour = timeStr.match(/^(\d+)\s*h(ours?)?$/i);
  if (relHour) { return new Date(now.getTime() + parseInt(relHour[1]) * 3600000).toISOString().replace("T", " ").substring(0, 19); }
  const relMin = timeStr.match(/^(\d+)\s*m(in(utes?)?)?$/i);
  if (relMin) { return new Date(now.getTime() + parseInt(relMin[1]) * 60000).toISOString().replace("T", " ").substring(0, 19); }
  const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2] || "0");
    const ampm = (timeMatch[3] || "").toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    const target = new Date(ksaNow);
    target.setHours(hours, mins, 0, 0);
    if (target <= ksaNow) target.setDate(target.getDate() + 1);
    return new Date(target.getTime() - ksaOffset).toISOString().replace("T", " ").substring(0, 19);
  }
  const tomorrowMatch = timeStr.match(/^tomorrow\s*(.*)$/i);
  if (tomorrowMatch) {
    const rest = tomorrowMatch[1].trim() || "9am";
    const inner = parseReminderTime(rest);
    if (inner) { const d = new Date(inner.replace(" ", "T") + "Z"); d.setDate(d.getDate() + 1); return d.toISOString().replace("T", " ").substring(0, 19); }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// ═══ OpenAI Function Calling — Tool Definitions ═══════════════
// ═══════════════════════════════════════════════════════════════

const OPS_TOOLS = [
  { type: "function", function: { name: "create_task", description: "Create a single task/action item.", parameters: { type: "object", properties: { title: { type: "string", description: "Clear, actionable task description." }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, assigned_to: { type: "string", description: "Optional @username." }, due_date: { type: "string", description: "Optional YYYY-MM-DD." }, property_tag: { type: "string", description: "Optional property tag." } }, required: ["title"] } } },
  { type: "function", function: { name: "create_tasks_batch", description: "Create multiple tasks at once.", parameters: { type: "object", properties: { tasks: { type: "array", items: { type: "object", properties: { title: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, assigned_to: { type: "string" }, due_date: { type: "string" }, property_tag: { type: "string" } }, required: ["title"] } } }, required: ["tasks"] } } },
  { type: "function", function: { name: "create_reminder", description: "Set a timed reminder.", parameters: { type: "object", properties: { message: { type: "string" }, time: { type: "string", description: "'9am', '2h', 'tomorrow 9am'" } }, required: ["message", "time"] } } },
  { type: "function", function: { name: "mark_task_done", description: "Mark a task as completed.", parameters: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "list_tasks", description: "List pending tasks in current topic.", parameters: { type: "object", properties: { include_done: { type: "boolean" } } } } },
  { type: "function", function: { name: "get_all_tasks_summary", description: "Summary of all tasks across topics.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "move_task", description: "Move a task to another topic.", parameters: { type: "object", properties: { task_id: { type: "integer" }, target_topic: { type: "string", description: "ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo" } }, required: ["task_id", "target_topic"] } } },
  { type: "function", function: { name: "create_vendor_followup", description: "Track a vendor/contractor promise.", parameters: { type: "object", properties: { vendor_name: { type: "string" }, promise: { type: "string" }, deadline: { type: "string" } }, required: ["vendor_name", "promise", "deadline"] } } },
  // v3 new tools
  { type: "function", function: { name: "add_expense", description: "Record an expense/cost.", parameters: { type: "object", properties: { amount: { type: "number", description: "Amount in SAR." }, description: { type: "string" }, category: { type: "string", description: "maintenance, supplies, utilities, services, other" }, property_tag: { type: "string" } }, required: ["amount", "description"] } } },
  { type: "function", function: { name: "set_occupancy", description: "Update unit/property occupancy status.", parameters: { type: "object", properties: { unit_name: { type: "string", description: "e.g. unit5, villa3" }, status: { type: "string", enum: ["occupied", "vacant", "maintenance"] }, tenant_name: { type: "string" } }, required: ["unit_name", "status"] } } },
  { type: "function", function: { name: "add_dependency", description: "Set task dependency: task is blocked until another task is done.", parameters: { type: "object", properties: { task_id: { type: "integer", description: "The blocked task." }, depends_on: { type: "integer", description: "The blocking task." } }, required: ["task_id", "depends_on"] } } },
];

// ═══════════════════════════════════════════════════════════════
// ═══ Tool Execution ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function executeTool(toolName, args, chatId, threadId, topicInfo, fromUser) {
  try {
    switch (toolName) {
      case "create_task": {
        const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, args.title, {
          priority: args.priority || "normal", assignedTo: args.assigned_to || null,
          dueDate: args.due_date || null, propertyTag: args.property_tag || null, createdBy: fromUser,
        });
        return { success: true, task_id: taskId, title: args.title, priority: args.priority || "normal", assigned_to: args.assigned_to || null, due_date: args.due_date || null, property_tag: args.property_tag || null };
      }
      case "create_tasks_batch": {
        const created = [];
        for (const t of args.tasks) {
          const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, t.title, {
            priority: t.priority || "normal", assignedTo: t.assigned_to || null,
            dueDate: t.due_date || null, propertyTag: t.property_tag || null, createdBy: fromUser,
          });
          created.push({ task_id: taskId, title: t.title, priority: t.priority || "normal", assigned_to: t.assigned_to || null });
        }
        return { success: true, tasks_created: created.length, tasks: created };
      }
      case "create_reminder": {
        const remindAt = parseReminderTime(args.time);
        if (!remindAt) return { success: false, error: `Could not parse time: "${args.time}"` };
        opsDb.addReminder(chatId, threadId, topicInfo.name, args.message, remindAt, fromUser);
        const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 3600000);
        return { success: true, message: args.message, time_ksa: ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" }) };
      }
      case "mark_task_done": {
        const task = opsDb.getTaskById(args.task_id);
        if (!task || task.chat_id !== chatId) return { success: false, error: `Task #${args.task_id} not found.` };
        if (task.status === "done") return { success: false, error: `Task #${args.task_id} already completed.` };
        opsDb.markTaskDone(args.task_id);
        // Check dependencies — notify unblocked tasks
        const dependents = opsDb.getDependentTasks(args.task_id);
        const unblocked = [];
        for (const dep of dependents) {
          if (!opsDb.isTaskBlocked(dep.task_id)) unblocked.push({ task_id: dep.task_id, title: dep.title });
        }
        return { success: true, task_id: args.task_id, title: task.title, unblocked_tasks: unblocked };
      }
      case "list_tasks": {
        const tasks = opsDb.getTasksByThread(chatId, threadId);
        const pending = tasks.filter(t => t.status === "pending");
        const done = tasks.filter(t => t.status === "done");
        return { success: true, pending_count: pending.length, done_count: done.length, pending: pending.map(t => ({ id: t.id, title: t.title, priority: t.priority, assigned_to: t.assigned_to, due_date: t.due_date, property_tag: t.property_tag })), done: args.include_done ? done.slice(0, 10).map(t => ({ id: t.id, title: t.title })) : [] };
      }
      case "get_all_tasks_summary": {
        const allTasks = opsDb.getAllPendingTasks(chatId);
        const stats = opsDb.getTaskStats(chatId);
        const byTopic = {};
        for (const task of allTasks) { const key = task.topic_name || "General"; if (!byTopic[key]) byTopic[key] = []; byTopic[key].push({ id: task.id, title: task.title, priority: task.priority, assigned_to: task.assigned_to }); }
        return { success: true, total_pending: stats.pending, total_done: stats.done, by_topic: byTopic };
      }
      case "move_task": {
        const task = opsDb.getTaskById(args.task_id);
        if (!task || task.chat_id !== chatId) return { success: false, error: `Task #${args.task_id} not found.` };
        const targetThread = TOPIC_SHORTNAMES[args.target_topic?.toLowerCase()];
        if (!targetThread) return { success: false, error: `Unknown topic: "${args.target_topic}".` };
        const targetName = TOPIC_FULL_NAMES[targetThread] || args.target_topic;
        opsDb.transferTask(args.task_id, targetThread, targetName);
        return { success: true, task_id: args.task_id, title: task.title, from_topic: task.topic_name, to_topic: targetName };
      }
      case "create_vendor_followup": {
        const deadlineAt = calculateFollowUpTime(args.deadline === "tomorrow" ? "tomorrow_morning" : "tomorrow_morning");
        opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, args.vendor_name, args.promise, fromUser, deadlineAt);
        return { success: true, vendor: args.vendor_name, promise: args.promise, deadline: deadlineAt };
      }
      case "add_expense": {
        const expId = opsDb.addExpense(chatId, threadId, topicInfo.name, args.amount, args.description, {
          propertyTag: args.property_tag || null, category: args.category || "other", createdBy: fromUser,
        });
        return { success: true, expense_id: expId, amount: args.amount, description: args.description, category: args.category || "other" };
      }
      case "set_occupancy": {
        opsDb.setOccupancy(chatId, args.unit_name, args.status, args.tenant_name || null, fromUser);
        return { success: true, unit: args.unit_name, status: args.status, tenant: args.tenant_name || null };
      }
      case "add_dependency": {
        const t1 = opsDb.getTaskById(args.task_id);
        const t2 = opsDb.getTaskById(args.depends_on);
        if (!t1) return { success: false, error: `Task #${args.task_id} not found.` };
        if (!t2) return { success: false, error: `Task #${args.depends_on} not found.` };
        opsDb.addTaskDependency(args.task_id, args.depends_on);
        return { success: true, task_id: args.task_id, depends_on: args.depends_on, task_title: t1.title, depends_on_title: t2.title };
      }
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`[Ops] Tool execution error (${toolName}):`, error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ System Prompt Builder ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function buildSystemPrompt(topicInfo, msgLang) {
  const langInstruction = msgLang === "ar"
    ? "\n\n⚠️ CRITICAL: The user wrote in Arabic. You MUST reply entirely in Arabic."
    : "\n\n⚠️ CRITICAL: The user wrote in English. You MUST reply entirely in English.";
  const today = new Date().toISOString().split("T")[0];
  return `You are the smart operations assistant for Monthly Key (المفتاح الشهري), a monthly rental platform in Saudi Arabia. You are inside the "Daily Operations HQ" Telegram group, topic: "${topicInfo.name}".

Today: ${today}

## CORE BEHAVIOR — BE AN EXECUTOR, NOT A CHATBOT
1. When you see action items → IMMEDIATELY use tools to create them. Do NOT ask permission.
2. When user says "yes", "create them", "do it" → look at conversation history and CREATE the tasks.
3. Extract #property tags and @assignees from messages automatically.
4. When someone reports a vendor promise → use create_vendor_followup.
5. When someone mentions an expense or cost → use add_expense.
6. When someone mentions unit occupancy → use set_occupancy.

## TOOLS AVAILABLE
- create_task / create_tasks_batch — create tasks with priority, assignee, due_date, property_tag
- create_reminder — set timed reminders
- mark_task_done — complete tasks (also notifies if dependent tasks are unblocked)
- list_tasks / get_all_tasks_summary — show status
- move_task — transfer task to another topic
- create_vendor_followup — track vendor/contractor promises
- add_expense — record expenses (amount in SAR, category, property)
- set_occupancy — update unit status (occupied/vacant/maintenance)
- add_dependency — set task dependency (task X blocked until task Y done)

## RULES
- ❌ Do NOT ask for details already in context
- ❌ Do NOT have back-and-forth about creating tasks
- ✅ Extract property tags (#unit5) and include them
- ✅ Extract @assignees and include them
- ✅ Be concise, use bullet points and task IDs
- ✅ After tool execution, confirm what was done${langInstruction}`;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Original Command Handlers (v2) ═════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsTask(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const title = extractCommandArgs(text, "task");
  if (!title) {
    const lang = detectMessageLanguage(text);
    const msg = lang === "ar"
      ? `⬜ *إضافة مهمة جديدة*\n\nالاستخدام:\n\`/task وصف المهمة @المسؤول #الوحدة\`\n\nمثال:\n\`/task إصلاح التكييف @Mushtaq #unit5\``
      : `⬜ *Add a new task*\n\nUsage:\n\`/task description @assignee #property\`\n\nExample:\n\`/task Fix AC unit @Mushtaq #unit5\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const assignee = extractAssignee(title);
  const propertyTag = extractPropertyTag(title);
  const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, title, { createdBy, assignedTo: assignee, propertyTag });
  const lang = detectMessageLanguage(title);
  const parts = [`✅ *Task #${taskId} created*\n\n⬜ ${escMd(title)}`];
  if (assignee) parts.push(`👤 ${escMd(assignee)}`);
  if (propertyTag) parts.push(`🏠 #${escMd(propertyTag)}`);
  parts.push(`📍 ${escMd(topicInfo.name)}`);
  parts.push(lang === "ar" ? `\nاستخدم /done ${taskId} عند الانتهاء` : `\nUse /done ${taskId} when complete`);
  await ctx.reply(parts.join("\n"), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsChecklist(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "checklist");
  if (!argsText) return ctx.reply(`📋 *Create a checklist*\n\nUsage:\n\`/checklist task 1 | task 2 | task 3\``, { parse_mode: "Markdown", message_thread_id: threadId });
  const items = argsText.split(/\||\n/).map(s => s.trim()).filter(s => s.length > 0);
  if (items.length === 0) return ctx.reply("❌ No tasks found. Use | to separate tasks.", { message_thread_id: threadId });
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const taskIds = [];
  for (const item of items) {
    const id = opsDb.addTask(chatId, threadId, topicInfo.name, item, { createdBy, assignedTo: extractAssignee(item), propertyTag: extractPropertyTag(item) });
    taskIds.push({ id, title: item });
  }
  let reply = `📋 *${taskIds.length} tasks created — ${topicInfo.name}*\n\n`;
  taskIds.forEach(({ id, title }, i) => { reply += `${i + 1}. ⬜ ${title} [#${id}]\n`; });
  reply += `\nUse \`/done [number]\` to complete`;
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsTasks(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const tasks = opsDb.getTasksByThread(chatId, threadId);
  if (tasks.length === 0) return ctx.reply(`${topicInfo.emoji} *${topicInfo.name}*\n\n✨ No tasks in this topic.\n\nAdd one: \`/task description\``, { parse_mode: "Markdown", message_thread_id: threadId });
  const pending = tasks.filter(t => t.status === "pending");
  const done = tasks.filter(t => t.status === "done");
  let reply = `${topicInfo.emoji} *${topicInfo.name}* — Tasks\n\n`;
  if (pending.length > 0) {
    reply += `*⬜ Pending (${pending.length}):*\n`;
    pending.forEach((task, i) => {
      const prio = task.priority === "urgent" ? " 🔴" : task.priority === "high" ? " 🟠" : "";
      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      const prop = task.property_tag ? ` 🏠#${task.property_tag}` : "";
      const due = task.due_date ? ` 📅${task.due_date}` : "";
      const blocked = opsDb.isTaskBlocked(task.id) ? " 🔒" : "";
      reply += `${i + 1}. ⬜ ${task.title}${prio}${assignee}${prop}${due}${blocked} [#${task.id}]\n`;
    });
  }
  if (done.length > 0) {
    reply += `\n*✅ Done (${done.length}):*\n`;
    done.slice(0, 5).forEach(task => { reply += `✅ ~~${task.title}~~ [#${task.id}]\n`; });
    if (done.length > 5) reply += `_... and ${done.length - 5} more_\n`;
  }
  if (pending.length > 0) reply += `\n\`/done [number]\` to complete`;
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsDone(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "done");
  const taskId = parseInt(args, 10);
  if (!taskId || isNaN(taskId)) {
    const tasks = opsDb.getPendingTasksByThread(chatId, threadId);
    if (tasks.length === 0) return ctx.reply("✅ No pending tasks in this topic.", { message_thread_id: threadId });
    let reply = `✅ *Complete a task*\n\nUse: \`/done [task number]\`\n\n*Pending:*\n`;
    tasks.forEach(task => { reply += `⬜ ${task.title} [#${task.id}]\n`; });
    return ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
  }
  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });
  if (task.status === "done") return ctx.reply(`✅ Task #${taskId} already completed.`, { message_thread_id: threadId });
  opsDb.markTaskDone(taskId);
  let reply = `✅ *Task #${taskId} completed!*\n\n~~${task.title}~~\n\n🎉 Well done!`;
  // Feature 14: Check dependencies — notify unblocked tasks
  const dependents = opsDb.getDependentTasks(taskId);
  for (const dep of dependents) {
    if (!opsDb.isTaskBlocked(dep.task_id)) {
      reply += `\n\n🔓 *Unblocked:* Task #${dep.task_id} — ${dep.title}`;
      // Notify in the dependent task's topic
      try {
        if (dep.thread_id && dep.thread_id !== threadId) {
          await ctx.telegram.sendMessage(chatId, `🔓 *Task #${dep.task_id} is now unblocked!*\n\n⬜ ${dep.title}\n\n_Dependency #${taskId} was completed._`, { parse_mode: "Markdown", message_thread_id: dep.thread_id });
        }
      } catch (e) { console.error("[Ops] Dependency notification error:", e.message); }
    }
  }
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsRemind(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "remind");
  if (!argsText) return ctx.reply(`⏰ *Set a reminder*\n\nUsage: \`/remind [time] [message]\`\n\nExamples:\n• \`/remind 9am Team meeting\`\n• \`/remind 2h Follow up\`\n• \`/remind tomorrow 9am Review\``, { parse_mode: "Markdown", message_thread_id: threadId });
  let timeStr, message;
  const tomorrowMatch = argsText.match(/^(tomorrow\s+\S+)\s+(.+)$/i);
  if (tomorrowMatch) { timeStr = tomorrowMatch[1]; message = tomorrowMatch[2]; }
  else { const parts = argsText.split(/\s+/); timeStr = parts[0]; message = parts.slice(1).join(" "); }
  if (!message) return ctx.reply("❌ Please specify a reminder message.", { message_thread_id: threadId });
  const remindAt = parseReminderTime(timeStr);
  if (!remindAt) return ctx.reply(`❌ Could not parse time: \`${timeStr}\``, { parse_mode: "Markdown", message_thread_id: threadId });
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  opsDb.addReminder(chatId, threadId, topicInfo.name, message, remindAt, createdBy);
  const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 3600000);
  const timeDisplay = ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });
  await ctx.reply(`⏰ *Reminder set*\n\n📝 ${message}\n🕐 ${timeDisplay} (Riyadh)`, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsSummary(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const allTasks = opsDb.getAllPendingTasks(chatId);
  if (allTasks.length === 0) return ctx.reply(`📊 *Task Summary*\n\n✨ No pending tasks. Great work!`, { parse_mode: "Markdown", message_thread_id: threadId });
  const byTopic = {};
  for (const task of allTasks) { const key = task.topic_name || "General"; if (!byTopic[key]) byTopic[key] = []; byTopic[key].push(task); }
  const stats = opsDb.getTaskStats(chatId);
  let reply = `📊 *Task Summary*\n📌 ${stats.pending} pending / ${stats.done} done\n\n`;
  for (const [topicName, tasks] of Object.entries(byTopic)) {
    const emoji = getEmojiFromName(topicName);
    reply += `${emoji} *${topicName}* (${tasks.length}):\n`;
    tasks.slice(0, 5).forEach((task, i) => { const assignee = task.assigned_to ? ` → ${task.assigned_to}` : ""; reply += `  ${i + 1}. ⬜ ${task.title}${assignee} [#${task.id}]\n`; });
    if (tasks.length > 5) reply += `  _... and ${tasks.length - 5} more_\n`;
    reply += "\n";
  }
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsKpi(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const weekly = opsDb.getWeeklyStats(chatId);
  const stats = opsDb.getTaskStats(chatId);
  const overdue = opsDb.getOverdueTasks(chatId);
  const completionRate = weekly.created > 0 ? Math.round((weekly.completed / weekly.created) * 100) : 0;
  let reply = `📊 *Weekly KPI Dashboard*\n📅 Last 7 days\n\n`;
  reply += `*Task Metrics:*\n• Created: ${weekly.created}\n• Completed: ${weekly.completed}\n• Completion Rate: ${completionRate}%\n`;
  if (weekly.avgResolutionHours) reply += `• Avg Resolution: ${weekly.avgResolutionHours}h\n`;
  reply += `\n*Current Status:*\n• Total Pending: ${stats.pending}\n• Total Done: ${stats.done}\n• High Priority: ${weekly.highPriorityCount}\n• Overdue: ${overdue.length}\n`;
  if (weekly.pendingByTopic.length > 0) {
    reply += `\n*Busiest Topics (pending):*\n`;
    weekly.pendingByTopic.slice(0, 5).forEach(t => { reply += `• ${t.topic_name || "General"}: ${t.c} tasks\n`; });
  }
  if (overdue.length > 0) {
    reply += `\n*⚠️ Overdue Tasks:*\n`;
    overdue.slice(0, 5).forEach(t => { const assignee = t.assigned_to ? ` → ${t.assigned_to}` : ""; reply += `• #${t.id} ${t.title}${assignee} (due: ${t.due_date})\n`; });
  }
  // Add expense summary
  const expSummary = opsDb.getExpenseSummary(chatId);
  if (expSummary.totalAmount > 0) {
    reply += `\n*💰 Monthly Expenses:* ${expSummary.totalAmount.toLocaleString()} SAR\n`;
    expSummary.byCategory.slice(0, 3).forEach(c => { reply += `  • ${c.category || "other"}: ${c.total.toLocaleString()} SAR (${c.count})\n`; });
  }
  // Add occupancy summary
  const occSummary = opsDb.getOccupancySummary(chatId);
  if (occSummary.total > 0) {
    const occRate = Math.round((occSummary.occupied / occSummary.total) * 100);
    reply += `\n*🏠 Occupancy:* ${occRate}% (${occSummary.occupied}/${occSummary.total})\n`;
    reply += `  • Occupied: ${occSummary.occupied} | Vacant: ${occSummary.vacant} | Maintenance: ${occSummary.maintenance}\n`;
  }
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsProperty(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const tag = extractCommandArgs(text, "property").replace(/^#/, "").toLowerCase().trim();
  if (!tag) return ctx.reply(`🏠 *Property Tracker*\n\nUsage: \`/property unit5\`\n\nShows all tasks, media, and expenses linked to a property.`, { parse_mode: "Markdown", message_thread_id: threadId });
  const tasks = opsDb.getTasksByProperty(chatId, tag);
  const media = opsDb.getMediaByProperty(chatId, tag);
  const expenses = opsDb.getExpensesByProperty(chatId, tag);
  const occupancy = opsDb.getOccupancyByUnit(chatId, tag);
  if (tasks.length === 0 && media.length === 0 && expenses.length === 0 && !occupancy) return ctx.reply(`🏠 *#${tag}*\n\nNo data found for this property.`, { parse_mode: "Markdown", message_thread_id: threadId });
  const pending = tasks.filter(t => t.status === "pending");
  const done = tasks.filter(t => t.status === "done");
  let reply = `🏠 *Property: #${tag}*\n\n`;
  if (occupancy) {
    const statusEmoji = occupancy.status === "occupied" ? "🟢" : occupancy.status === "maintenance" ? "🟡" : "🔴";
    reply += `*Status:* ${statusEmoji} ${occupancy.status}${occupancy.tenant_name ? ` — ${occupancy.tenant_name}` : ""}\n\n`;
  }
  if (pending.length > 0) {
    reply += `*⬜ Pending Tasks (${pending.length}):*\n`;
    pending.forEach(t => { reply += `• #${t.id} ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ""}\n`; });
    reply += "\n";
  }
  if (done.length > 0) {
    reply += `*✅ Completed (${done.length}):*\n`;
    done.slice(0, 5).forEach(t => { reply += `• #${t.id} ~~${t.title}~~\n`; });
    reply += "\n";
  }
  if (expenses.length > 0) {
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    reply += `*💰 Expenses (${expenses.length}): ${totalExp.toLocaleString()} SAR*\n`;
    expenses.slice(0, 5).forEach(e => { reply += `• ${e.amount.toLocaleString()} SAR — ${e.description}\n`; });
    reply += "\n";
  }
  if (media.length > 0) {
    reply += `*📷 Media Files (${media.length}):*\n`;
    media.slice(0, 5).forEach(m => { reply += `• ${m.file_type} from ${m.from_user || "unknown"} (${m.created_at})\n`; });
  }
  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsMove(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "move");
  if (!argsText) return ctx.reply(`🔄 *Move a task to another topic*\n\nUsage: \`/move [task#] [topic]\`\n\nTopics: ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo\n\nExample: \`/move 5 payments\``, { parse_mode: "Markdown", message_thread_id: threadId });
  const parts = argsText.split(/\s+/);
  const taskId = parseInt(parts[0], 10);
  const targetTopic = parts.slice(1).join(" ").toLowerCase();
  if (!taskId || isNaN(taskId)) return ctx.reply("❌ Please specify a valid task number.", { message_thread_id: threadId });
  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });
  const targetThread = TOPIC_SHORTNAMES[targetTopic];
  if (!targetThread) return ctx.reply(`❌ Unknown topic: "${targetTopic}"`, { message_thread_id: threadId });
  const targetName = TOPIC_FULL_NAMES[targetThread] || targetTopic;
  const oldTopic = task.topic_name || "General";
  opsDb.transferTask(taskId, targetThread, targetName);
  await ctx.reply(`🔄 *Task #${taskId} moved*\n\n📤 From: ${oldTopic}\n📥 To: ${targetName}\n\n⬜ ${task.title}`, { parse_mode: "Markdown", message_thread_id: threadId });
  try {
    await ctx.telegram.sendMessage(chatId, `📥 *Task #${taskId} transferred here*\n\n⬜ ${task.title}\n\n📤 From: ${oldTopic}\n👤 ${task.assigned_to || task.created_by || "Unassigned"}`, { parse_mode: "Markdown", message_thread_id: targetThread });
  } catch (e) { console.error("[Ops] Cross-post failed:", e.message); }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 11: SLA Timers (/sla) ══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsSla(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "sla");

  if (!argsText || argsText === "status") {
    // Show current SLA config
    const configs = opsDb.getSlaConfig(chatId);
    if (configs.length === 0) {
      // Initialize defaults
      for (const [tid, hours] of Object.entries(DEFAULT_SLA)) {
        const topicName = TOPIC_FULL_NAMES[parseInt(tid)] || `Topic #${tid}`;
        opsDb.setSlaConfig(chatId, parseInt(tid), topicName, hours);
      }
      return handleOpsSla(ctx);
    }
    let reply = `⏱️ *SLA Configuration*\n\n`;
    for (const c of configs) {
      reply += `• ${c.topic_name || `Thread #${c.thread_id}`}: *${c.sla_hours}h*\n`;
    }
    reply += `\nSet SLA: \`/sla [hours]\` (in current topic)\nExample: \`/sla 12\` — sets 12h SLA for this topic`;
    return ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const hours = parseInt(argsText, 10);
  if (!hours || isNaN(hours) || hours < 1) return ctx.reply("❌ Please specify valid hours. Example: `/sla 12`", { parse_mode: "Markdown", message_thread_id: threadId });
  if (!threadId) return ctx.reply("❌ Use this command inside a topic thread.", { message_thread_id: threadId });

  const topicInfo = getTopicInfo(threadId);
  opsDb.setSlaConfig(chatId, threadId, topicInfo.name, hours);
  await ctx.reply(`⏱️ *SLA set for ${topicInfo.name}*\n\nResolution time limit: *${hours} hours*\n\nTasks exceeding this will trigger warnings.`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 12: Approval Workflows (/approve, /reject) ═════
// ═══════════════════════════════════════════════════════════════

async function handleOpsApprove(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const comment = extractCommandArgs(text, "approve");
  const decidedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  // Must be a reply to a message
  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg) return ctx.reply("❌ Reply to a request message with /approve", { message_thread_id: threadId });

  // Check if there's already an approval for this message
  let approval = opsDb.getApprovalByMessageId(chatId, replyMsg.message_id);
  if (!approval) {
    // Create a new approval from the replied message
    const requestText = replyMsg.text || replyMsg.caption || "Request";
    const requestedBy = replyMsg.from?.username ? `@${replyMsg.from.username}` : replyMsg.from?.first_name || "Unknown";
    const topicInfo = getTopicInfo(threadId);
    const approvalId = opsDb.addApproval(chatId, threadId, topicInfo.name, requestText, requestedBy, replyMsg.message_id);
    approval = opsDb.getApprovalById(approvalId);
  }

  if (approval.status !== "pending") return ctx.reply(`This request was already ${approval.status} by ${approval.decided_by}.`, { message_thread_id: threadId });

  opsDb.decideApproval(approval.id, "approved", decidedBy, comment || null);
  await ctx.reply(`✅ *APPROVED* — Request #${approval.id}\n\n📝 "${approval.request_text.substring(0, 200)}"\n\n👤 Approved by: ${decidedBy}${comment ? `\n💬 ${comment}` : ""}`, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsReject(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const comment = extractCommandArgs(text, "reject");
  const decidedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg) return ctx.reply("❌ Reply to a request message with /reject", { message_thread_id: threadId });

  let approval = opsDb.getApprovalByMessageId(chatId, replyMsg.message_id);
  if (!approval) {
    const requestText = replyMsg.text || replyMsg.caption || "Request";
    const requestedBy = replyMsg.from?.username ? `@${replyMsg.from.username}` : replyMsg.from?.first_name || "Unknown";
    const topicInfo = getTopicInfo(threadId);
    const approvalId = opsDb.addApproval(chatId, threadId, topicInfo.name, requestText, requestedBy, replyMsg.message_id);
    approval = opsDb.getApprovalById(approvalId);
  }

  if (approval.status !== "pending") return ctx.reply(`This request was already ${approval.status} by ${approval.decided_by}.`, { message_thread_id: threadId });

  opsDb.decideApproval(approval.id, "rejected", decidedBy, comment || null);
  await ctx.reply(`❌ *REJECTED* — Request #${approval.id}\n\n📝 "${approval.request_text.substring(0, 200)}"\n\n👤 Rejected by: ${decidedBy}${comment ? `\n💬 ${comment}` : ""}`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 13: Recurring Tasks (/recurring) ═══════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsRecurring(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "recurring");
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (!argsText) {
    return ctx.reply(
      `🔄 *Recurring Tasks*\n\nUsage:\n` +
      `\`/recurring "Task title" every sunday\`\n` +
      `\`/recurring "Task title" every 1st\`\n` +
      `\`/recurring "Task title" every day\`\n` +
      `\`/recurring list\` — show all\n` +
      `\`/recurring delete [id]\` — remove`,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  // /recurring list
  if (argsText.toLowerCase() === "list") {
    const recurring = opsDb.getActiveRecurringTasks(chatId);
    if (recurring.length === 0) return ctx.reply("🔄 No recurring tasks set.", { message_thread_id: threadId });
    let reply = `🔄 *Recurring Tasks*\n\n`;
    recurring.forEach((r, i) => {
      reply += `${i + 1}. *${r.title}*\n   📅 ${r.schedule_type}: ${r.schedule_value}${r.assigned_to ? ` → ${r.assigned_to}` : ""}\n   📍 ${r.topic_name || "General"} [ID: ${r.id}]\n\n`;
    });
    reply += `Delete: \`/recurring delete [id]\``;
    return ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // /recurring delete [id]
  const deleteMatch = argsText.match(/^delete\s+(\d+)$/i);
  if (deleteMatch) {
    const id = parseInt(deleteMatch[1], 10);
    const rec = opsDb.getRecurringTaskById(id);
    if (!rec || rec.chat_id !== chatId) return ctx.reply(`❌ Recurring task #${id} not found.`, { message_thread_id: threadId });
    opsDb.deleteRecurringTask(id);
    return ctx.reply(`🗑️ Recurring task deleted: "${rec.title}"`, { message_thread_id: threadId });
  }

  // Parse: "Task title" every [schedule]
  const parseMatch = argsText.match(/^[""]?(.+?)[""]?\s+every\s+(.+)$/i);
  if (!parseMatch) return ctx.reply("❌ Format: `/recurring \"Task title\" every sunday`", { parse_mode: "Markdown", message_thread_id: threadId });

  const title = parseMatch[1].trim();
  const scheduleStr = parseMatch[2].trim().toLowerCase();

  let scheduleType, scheduleValue;
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  if (days.includes(scheduleStr)) {
    scheduleType = "weekly";
    scheduleValue = scheduleStr;
  } else if (scheduleStr === "day" || scheduleStr === "daily") {
    scheduleType = "daily";
    scheduleValue = "daily";
  } else if (scheduleStr.match(/^(\d{1,2})(st|nd|rd|th)?$/)) {
    scheduleType = "monthly";
    scheduleValue = scheduleStr.replace(/(st|nd|rd|th)$/, "");
  } else {
    return ctx.reply(`❌ Unrecognized schedule: "${scheduleStr}"\n\nExamples: \`every sunday\`, \`every 1st\`, \`every day\``, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const assignee = extractAssignee(title);
  const propertyTag = extractPropertyTag(title);
  const id = opsDb.addRecurringTask(chatId, threadId, topicInfo.name, title, scheduleType, scheduleValue, {
    assignedTo: assignee, propertyTag, createdBy,
  });

  await ctx.reply(`🔄 *Recurring task created* [ID: ${id}]\n\n📝 ${title}\n📅 Every ${scheduleValue}\n📍 ${topicInfo.name}`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 14: Task Dependencies (/depends) ═══════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsDepends(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "depends");

  if (!argsText) return ctx.reply(`🔗 *Task Dependencies*\n\nUsage: \`/depends [task#] on [task#]\`\n\nExample: \`/depends 5 on 3\` — Task #5 is blocked until #3 is done`, { parse_mode: "Markdown", message_thread_id: threadId });

  const match = argsText.match(/^(\d+)\s+on\s+(\d+)$/i);
  if (!match) return ctx.reply("❌ Format: `/depends 5 on 3`", { parse_mode: "Markdown", message_thread_id: threadId });

  const taskId = parseInt(match[1], 10);
  const dependsOnId = parseInt(match[2], 10);

  const task = opsDb.getTaskById(taskId);
  const depTask = opsDb.getTaskById(dependsOnId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });
  if (!depTask || depTask.chat_id !== chatId) return ctx.reply(`❌ Task #${dependsOnId} not found.`, { message_thread_id: threadId });
  if (taskId === dependsOnId) return ctx.reply("❌ A task cannot depend on itself.", { message_thread_id: threadId });

  opsDb.addTaskDependency(taskId, dependsOnId);
  const isBlocked = depTask.status !== "done";
  await ctx.reply(`🔗 *Dependency set*\n\n🔒 Task #${taskId}: ${task.title}\n⬅️ Depends on #${dependsOnId}: ${depTask.title}\n\n${isBlocked ? "🔴 Task #" + taskId + " is currently BLOCKED" : "🟢 Dependency already completed — task is unblocked"}`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 15: Shift Handover (/handover) ═════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsHandover(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;

  // Generate summary of last 8 hours
  const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
  const createdTasks = opsDb.getTasksCreatedSince(chatId, since);
  const completedTasks = opsDb.getTasksCompletedSince(chatId, since);
  const allPending = opsDb.getAllPendingTasks(chatId);
  const overdue = opsDb.getOverdueTasks(chatId);
  const pendingVendors = opsDb.getPendingVendorFollowUps(chatId);
  const pendingApprovals = opsDb.getPendingApprovals(chatId);

  const ksaNow = new Date(Date.now() + 3 * 3600000);
  const timeStr = ksaNow.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });

  let msg = `📋 *Shift Handover — ${timeStr}*\n\n`;

  if (completedTasks.length > 0) {
    msg += `*✅ Completed this shift (${completedTasks.length}):*\n`;
    completedTasks.slice(0, 10).forEach(t => { msg += `• ~~${t.title}~~${t.assigned_to ? ` (${t.assigned_to})` : ""}\n`; });
    msg += "\n";
  }

  if (createdTasks.length > 0) {
    const newPending = createdTasks.filter(t => t.status === "pending");
    if (newPending.length > 0) {
      msg += `*🆕 New tasks created (${newPending.length}):*\n`;
      newPending.slice(0, 10).forEach(t => { msg += `• #${t.id} ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ""}\n`; });
      msg += "\n";
    }
  }

  if (overdue.length > 0) {
    msg += `*🔴 Overdue (${overdue.length}):*\n`;
    overdue.slice(0, 5).forEach(t => { msg += `• #${t.id} ${t.title} (due: ${t.due_date})\n`; });
    msg += "\n";
  }

  if (pendingVendors.length > 0) {
    msg += `*🏢 Pending vendor follow-ups (${pendingVendors.length}):*\n`;
    pendingVendors.slice(0, 5).forEach(v => { msg += `• ${v.vendor_name}: "${v.promise_text.substring(0, 80)}"\n`; });
    msg += "\n";
  }

  if (pendingApprovals.length > 0) {
    msg += `*📝 Pending approvals (${pendingApprovals.length}):*\n`;
    pendingApprovals.slice(0, 5).forEach(a => { msg += `• #${a.id}: "${a.request_text.substring(0, 80)}" by ${a.requested_by}\n`; });
    msg += "\n";
  }

  msg += `*📊 Overall:* ${allPending.length} pending tasks total`;

  await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 16: Monthly Report (/monthlyreport) ════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMonthlyReport(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const monthly = opsDb.getMonthlyStats(chatId);
  const expSummary = opsDb.getExpenseSummary(chatId);
  const occSummary = opsDb.getOccupancySummary(chatId);

  const completionRate = monthly.created > 0 ? Math.round((monthly.completed / monthly.created) * 100) : 0;

  let msg = `📊 *Monthly Report — ${monthly.firstOfMonth}*\n\n`;
  msg += `*Task Metrics:*\n• Created: ${monthly.created}\n• Completed: ${monthly.completed}\n• Completion Rate: ${completionRate}%\n• Currently Overdue: ${monthly.overdue}\n\n`;

  if (monthly.byAssignee.length > 0) {
    msg += `*👥 Team Performance:*\n`;
    monthly.byAssignee.forEach(a => { msg += `• ${a.assigned_to}: ${a.done}/${a.total} done (${a.pending} pending)\n`; });
    msg += "\n";
  }

  if (monthly.byTopic.length > 0) {
    msg += `*📍 Tasks by Topic:*\n`;
    monthly.byTopic.forEach(t => { msg += `• ${t.topic_name || "General"}: ${t.c}\n`; });
    msg += "\n";
  }

  if (expSummary.totalAmount > 0) {
    msg += `*💰 Expenses: ${expSummary.totalAmount.toLocaleString()} SAR*\n`;
    expSummary.byCategory.forEach(c => { msg += `  • ${c.category || "other"}: ${c.total.toLocaleString()} SAR\n`; });
    msg += "\n";
  }

  if (occSummary.total > 0) {
    const occRate = Math.round((occSummary.occupied / occSummary.total) * 100);
    msg += `*🏠 Occupancy: ${occRate}%* (${occSummary.occupied}/${occSummary.total})\n`;
  }

  await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 17: Expense Tracker (/expense, /expenses) ══════
// ═══════════════════════════════════════════════════════════════

async function handleOpsExpense(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "expense");
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (!argsText) return ctx.reply(`💰 *Record an expense*\n\nUsage: \`/expense [amount] [description] #property\`\n\nExamples:\n• \`/expense 500 AC repair #unit5\`\n• \`/expense 1200 Monthly cleaning supplies\`\n\nView all: \`/expenses\``, { parse_mode: "Markdown", message_thread_id: threadId });

  const match = argsText.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return ctx.reply("❌ Format: `/expense 500 AC repair #unit5`", { parse_mode: "Markdown", message_thread_id: threadId });

  const amount = parseFloat(match[1]);
  const description = match[2].trim();
  const propertyTag = extractPropertyTag(description);

  // Detect category
  let category = "other";
  const descLower = description.toLowerCase();
  if (descLower.match(/repair|fix|maintenance|ac|plumb|electric/)) category = "maintenance";
  else if (descLower.match(/clean|suppli|tool|material/)) category = "supplies";
  else if (descLower.match(/electric|water|internet|gas|utility/)) category = "utilities";
  else if (descLower.match(/service|contract|labor|worker/)) category = "services";

  const expId = opsDb.addExpense(chatId, threadId, topicInfo.name, amount, description, { propertyTag, category, createdBy });
  const monthTotal = opsDb.getMonthlyExpenseTotal(chatId);

  await ctx.reply(`💰 *Expense #${expId} recorded*\n\n💵 ${amount.toLocaleString()} SAR\n📝 ${description}\n📂 ${category}${propertyTag ? `\n🏠 #${propertyTag}` : ""}\n\n📊 Monthly total: ${monthTotal.toLocaleString()} SAR`, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsExpenses(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const summary = opsDb.getExpenseSummary(chatId);
  const expenses = opsDb.getMonthlyExpenses(chatId);

  if (expenses.length === 0) return ctx.reply(`💰 *Monthly Expenses*\n\nNo expenses recorded this month.\n\nAdd one: \`/expense 500 AC repair #unit5\``, { parse_mode: "Markdown", message_thread_id: threadId });

  let msg = `💰 *Monthly Expenses — ${summary.totalAmount.toLocaleString()} SAR*\n\n`;

  if (summary.byCategory.length > 0) {
    msg += `*By Category:*\n`;
    summary.byCategory.forEach(c => { msg += `• ${c.category || "other"}: ${c.total.toLocaleString()} SAR (${c.count})\n`; });
    msg += "\n";
  }

  if (summary.byProperty.length > 0) {
    msg += `*By Property:*\n`;
    summary.byProperty.forEach(p => { msg += `• #${p.property_tag}: ${p.total.toLocaleString()} SAR (${p.count})\n`; });
    msg += "\n";
  }

  msg += `*Recent:*\n`;
  expenses.slice(0, 10).forEach(e => { msg += `• ${e.amount.toLocaleString()} SAR — ${e.description}${e.property_tag ? ` #${e.property_tag}` : ""} (${e.created_by})\n`; });

  await ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 18: Occupancy Tracker (/occupancy) ═════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsOccupancy(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "occupancy");
  const updatedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (!argsText) {
    // Show summary
    const units = opsDb.getOccupancy(chatId);
    const summary = opsDb.getOccupancySummary(chatId);
    if (units.length === 0) return ctx.reply(`🏠 *Occupancy Tracker*\n\nNo units registered.\n\nAdd: \`/occupancy unit5 occupied "Tenant Name"\`\n\nStatuses: occupied, vacant, maintenance`, { parse_mode: "Markdown", message_thread_id: threadId });
    const occRate = summary.total > 0 ? Math.round((summary.occupied / summary.total) * 100) : 0;
    let msg = `🏠 *Occupancy — ${occRate}%*\n🟢 ${summary.occupied} occupied | 🔴 ${summary.vacant} vacant | 🟡 ${summary.maintenance} maintenance\n\n`;
    units.forEach(u => {
      const emoji = u.status === "occupied" ? "🟢" : u.status === "maintenance" ? "🟡" : "🔴";
      msg += `${emoji} *${u.unit_name}*: ${u.status}${u.tenant_name ? ` — ${u.tenant_name}` : ""}\n`;
    });
    msg += `\nUpdate: \`/occupancy unit5 occupied "Tenant"\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // Parse: unit_name status "tenant_name"
  const match = argsText.match(/^(\S+)\s+(occupied|vacant|maintenance)(?:\s+[""]?(.+?)[""]?)?$/i);
  if (!match) return ctx.reply("❌ Format: `/occupancy unit5 occupied \"Tenant Name\"`\n\nStatuses: occupied, vacant, maintenance", { parse_mode: "Markdown", message_thread_id: threadId });

  const unitName = match[1].toLowerCase();
  const status = match[2].toLowerCase();
  const tenantName = match[3] || null;

  opsDb.setOccupancy(chatId, unitName, status, tenantName, updatedBy);
  const emoji = status === "occupied" ? "🟢" : status === "maintenance" ? "🟡" : "🔴";
  await ctx.reply(`${emoji} *${unitName}* updated to *${status}*${tenantName ? `\n👤 Tenant: ${tenantName}` : ""}\n\n📊 Updated by ${updatedBy}`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 19: Meeting Notes (/meeting) ═══════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMeeting(ctx, openaiClient) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "meeting").toLowerCase();
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (argsText === "start") {
    const existing = opsDb.getActiveMeeting(chatId, threadId);
    if (existing) return ctx.reply(`📝 A meeting is already active in this topic (started by ${existing.started_by}).\n\nUse \`/meeting end\` to finish it.`, { parse_mode: "Markdown", message_thread_id: threadId });
    const meetingId = opsDb.startMeeting(chatId, threadId, topicInfo.name, fromUser);
    await ctx.reply(`📝 *Meeting started* [#${meetingId}]\n\n📍 ${topicInfo.name}\n👤 Started by: ${fromUser}\n\nAll messages in this topic will be captured.\nUse \`/meeting end\` to generate minutes.`, { parse_mode: "Markdown", message_thread_id: threadId });
    return;
  }

  if (argsText === "end") {
    const meeting = opsDb.getActiveMeeting(chatId, threadId);
    if (!meeting) return ctx.reply("❌ No active meeting in this topic. Start one with `/meeting start`", { parse_mode: "Markdown", message_thread_id: threadId });

    const messages = opsDb.getMeetingMessages(meeting.id);
    if (messages.length === 0) {
      opsDb.endMeeting(meeting.id, "No messages captured.");
      return ctx.reply("📝 Meeting ended. No messages were captured.", { message_thread_id: threadId });
    }

    try { await ctx.sendChatAction("typing"); } catch (e) {}

    // Compile messages
    const transcript = messages.map(m => `${m.from_user}: ${m.message_text}`).join("\n");
    const attendees = [...new Set(messages.map(m => m.from_user))];

    // Use AI to generate meeting minutes
    try {
      const aiMessages = [
        { role: "system", content: `You are a meeting minutes generator. Generate structured meeting minutes from the transcript. Include: 1) Attendees, 2) Key Discussion Points, 3) Decisions Made, 4) Action Items (as a numbered list with assignees if mentioned). Be concise and professional. Reply in the same language as the transcript.` },
        { role: "user", content: `Meeting in topic "${topicInfo.name}" with ${attendees.length} attendees: ${attendees.join(", ")}\n\nTranscript:\n${transcript.substring(0, 3000)}` },
      ];

      const response = await openaiClient.chat.completions.create({
        model: config.aiModel || "gpt-4.1-mini",
        messages: aiMessages,
        max_tokens: 1500,
        temperature: 0.3,
      });

      const minutes = response.choices[0]?.message?.content || "Could not generate minutes.";
      opsDb.endMeeting(meeting.id, minutes);

      await ctx.reply(`📝 *Meeting Minutes — #${meeting.id}*\n📍 ${topicInfo.name}\n⏱️ ${messages.length} messages captured\n\n${minutes}`, { parse_mode: "Markdown", message_thread_id: threadId });

      // Now extract action items and create tasks
      const taskMessages = [
        { role: "system", content: buildSystemPrompt(topicInfo, detectMessageLanguage(transcript)) + "\n\nExtract action items from these meeting minutes and create tasks for each one." },
        { role: "user", content: `Meeting minutes:\n\n${minutes}\n\nCreate tasks for all action items mentioned.` },
      ];

      const taskResponse = await openaiClient.chat.completions.create({
        model: config.aiModel || "gpt-4.1-mini",
        messages: taskMessages,
        tools: OPS_TOOLS,
        tool_choice: "auto",
        max_tokens: 1200,
        temperature: 0.3,
      });

      let assistantMsg = taskResponse.choices[0]?.message;
      let allToolResults = [];
      let loopCount = 0;

      while (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0 && loopCount < 5) {
        loopCount++;
        taskMessages.push(assistantMsg);
        for (const toolCall of assistantMsg.tool_calls) {
          let toolArgs;
          try { toolArgs = JSON.parse(toolCall.function.arguments); } catch (e) { toolArgs = {}; }
          const result = executeTool(toolCall.function.name, toolArgs, chatId, threadId, topicInfo, fromUser);
          allToolResults.push({ tool: toolCall.function.name, result });
          taskMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }
        const nextResp = await openaiClient.chat.completions.create({
          model: config.aiModel || "gpt-4.1-mini", messages: taskMessages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3,
        });
        assistantMsg = nextResp.choices[0]?.message;
      }

      if (allToolResults.length > 0) {
        const summary = buildToolResultsSummary(allToolResults, detectMessageLanguage(transcript));
        if (summary) await ctx.reply(summary, { parse_mode: "Markdown", message_thread_id: threadId });
      }

    } catch (error) {
      console.error("[Ops] Meeting minutes AI error:", error.message);
      opsDb.endMeeting(meeting.id, `Transcript (${messages.length} messages)`);
      await ctx.reply(`📝 Meeting ended. ${messages.length} messages captured.\n\n_Could not generate AI minutes._`, { parse_mode: "Markdown", message_thread_id: threadId });
    }
    return;
  }

  // Default: show status
  const meeting = opsDb.getActiveMeeting(chatId, threadId);
  if (meeting) {
    const msgs = opsDb.getMeetingMessages(meeting.id);
    return ctx.reply(`📝 *Active meeting* [#${meeting.id}]\n\n📍 ${topicInfo.name}\n👤 Started by: ${meeting.started_by}\n💬 ${msgs.length} messages captured\n\nUse \`/meeting end\` to generate minutes.`, { parse_mode: "Markdown", message_thread_id: threadId });
  }
  return ctx.reply(`📝 *Meeting Notes*\n\nNo active meeting.\n\n\`/meeting start\` — begin capturing\n\`/meeting end\` — generate minutes & action items`, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Photo/Document Logging (Feature 6) ═════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMedia(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  let fileId = null, fileType = null;
  if (ctx.message.photo) { fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id; fileType = "photo"; }
  else if (ctx.message.document) { fileId = ctx.message.document.file_id; fileType = "document"; }
  else if (ctx.message.video) { fileId = ctx.message.video.file_id; fileType = "video"; }
  if (!fileId) return;
  const caption = ctx.message.caption || "";
  const propertyTag = extractPropertyTag(caption);
  const pendingTasks = opsDb.getPendingTasksByThread(chatId, threadId);
  let linkedTaskId = null;
  const taskIdMatch = caption.match(/#(\d+)/);
  if (taskIdMatch) linkedTaskId = parseInt(taskIdMatch[1], 10);
  else if (pendingTasks.length > 0) linkedTaskId = pendingTasks[pendingTasks.length - 1].id;
  opsDb.addMediaLog(chatId, threadId, topicInfo.name, fileId, fileType, { caption, fromUser, taskId: linkedTaskId, propertyTag });
  const parts = [`📎 *Logged*`];
  if (propertyTag) parts.push(`🏠 #${propertyTag}`);
  if (linkedTaskId) parts.push(`🔗 Task #${linkedTaskId}`);
  parts.push(`📍 ${topicInfo.name}`);
  await ctx.reply(parts.join(" | "), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Voice Note Transcription (Feature 10) ══════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsVoice(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const voice = ctx.message.voice || ctx.message.audio;
  if (!voice) return;
  try { await ctx.sendChatAction("typing"); } catch (e) {}
  try {
    const file = await ctx.telegram.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    const tmpDir = path.join(__dirname, "..", "..", "data", "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const ext = file.file_path.split(".").pop() || "ogg";
    const tmpFile = path.join(tmpDir, `voice_${Date.now()}.${ext}`);
    await downloadFile(fileUrl, tmpFile);
    const transcription = await transcribeAudio(openaiClient, tmpFile);
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    if (!transcription) return ctx.reply("🎤 Could not transcribe the voice message.", { message_thread_id: threadId });
    const msgLang = detectMessageLanguage(transcription);
    opsDb.addMediaLog(chatId, threadId, topicInfo.name, voice.file_id, "voice", { caption: transcription.substring(0, 500), fromUser });
    await ctx.reply(`${msgLang === "ar" ? "🎤 *تفريغ الرسالة الصوتية*" : "🎤 *Voice Transcription*"}\n👤 ${fromUser}\n\n${transcription}`, { parse_mode: "Markdown", message_thread_id: threadId });
    try { await ctx.sendChatAction("typing"); } catch (e) {}
    const systemPrompt = buildSystemPrompt(topicInfo, msgLang);
    const aiMessages = [
      { role: "system", content: systemPrompt + "\n\nA voice message was just transcribed. Analyze it for action items and CREATE them immediately." },
      { role: "user", content: `${fromUser} sent a voice message:\n\n"${transcription}"\n\nExtract and create any action items.` },
    ];
    const response = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages: aiMessages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
    let assistantMessage = response.choices[0]?.message;
    let allToolResults = [];
    let loopCount = 0;
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && loopCount < 5) {
      loopCount++;
      aiMessages.push(assistantMessage);
      for (const toolCall of assistantMessage.tool_calls) {
        let toolArgs;
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch (e) { toolArgs = {}; }
        const result = executeTool(toolCall.function.name, toolArgs, chatId, threadId, topicInfo, fromUser);
        allToolResults.push({ tool: toolCall.function.name, result });
        aiMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      const nextResponse = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages: aiMessages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
      assistantMessage = nextResponse.choices[0]?.message;
    }
    const aiReply = assistantMessage?.content;
    if (aiReply) {
      try { await ctx.reply(aiReply, { parse_mode: "Markdown", message_thread_id: threadId }); }
      catch (e) { await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId }); }
    } else if (allToolResults.length > 0) {
      const summary = buildToolResultsSummary(allToolResults, msgLang);
      if (summary) await ctx.reply(summary, { parse_mode: "Markdown", message_thread_id: threadId });
    }
  } catch (error) {
    console.error("[Ops] Voice transcription error:", error.message);
    await ctx.reply("🎤 Error processing voice message.", { message_thread_id: threadId });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      response.pipe(file);
      file.on("finish", () => { file.close(resolve); });
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function transcribeAudio(openaiClient, filePath) {
  try {
    const transcription = await openaiClient.audio.transcriptions.create({ file: fs.createReadStream(filePath), model: "whisper-1" });
    return transcription.text;
  } catch (error) {
    console.error("[Ops] Whisper API error:", error.message);
    try { const { execSync } = require("child_process"); return execSync(`manus-speech-to-text "${filePath}"`, { timeout: 60000 }).toString().trim(); }
    catch (e) { console.error("[Ops] Fallback also failed:", e.message); return null; }
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Smart AI Message Handler (with Function Calling) ═════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMessage(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  registerTopicFromCtx(ctx);
  const text = ctx.message.text || "";
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  const followUpDelay = detectFollowUpPromise(text);
  if (followUpDelay) { opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, calculateFollowUpTime(followUpDelay)); }
  const vendorPromise = detectVendorPromise(text);
  if (vendorPromise) { opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, vendorPromise.vendorName, text.substring(0, 200), fromUser, calculateFollowUpTime("tomorrow_morning")); }

  const botUsername = ctx.botInfo?.username || "monthlykey_bot";
  const isMentioned = text.includes(`@${botUsername}`);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;
  if (!isMentioned && !isReplyToBot) return;

  const cleanText = text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();
  try { await ctx.sendChatAction("typing"); } catch (e) {}

  try {
    const msgLang = detectMessageLanguage(cleanText);
    const systemPrompt = buildSystemPrompt(topicInfo, msgLang);
    const history = getConversationHistory(chatId, threadId);
    const messages = [{ role: "system", content: systemPrompt }];
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) messages.push(msg);
    const userContent = cleanText || (msgLang === "ar" ? "مرحباً" : "Hello");
    if (isReplyToBot && ctx.message.reply_to_message?.text) {
      messages.push({ role: "user", content: `[Replying to bot: "${ctx.message.reply_to_message.text.substring(0, 1000)}"]\n\n${fromUser} says: ${userContent}` });
    } else {
      messages.push({ role: "user", content: `${fromUser} says: ${userContent}` });
    }
    addToConversation(chatId, threadId, "user", `${fromUser}: ${userContent}`);

    let response = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
    let assistantMessage = response.choices[0]?.message;
    let allToolResults = [];
    let loopCount = 0;

    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && loopCount < 5) {
      loopCount++;
      try { await ctx.sendChatAction("typing"); } catch (e) {}
      messages.push(assistantMessage);
      for (const toolCall of assistantMessage.tool_calls) {
        let toolArgs;
        try { toolArgs = JSON.parse(toolCall.function.arguments); } catch (e) { toolArgs = {}; }
        console.log(`[Ops] Tool: ${toolCall.function.name}`, JSON.stringify(toolArgs).substring(0, 200));
        const result = executeTool(toolCall.function.name, toolArgs, chatId, threadId, topicInfo, fromUser);
        allToolResults.push({ tool: toolCall.function.name, args: toolArgs, result });
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      response = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
      assistantMessage = response.choices[0]?.message;
    }

    let aiReply = assistantMessage?.content || "";
    if (!aiReply && allToolResults.length > 0) aiReply = buildToolResultsSummary(allToolResults, msgLang);
    if (!aiReply) aiReply = msgLang === "ar" ? "تم." : "Done.";

    if (followUpDelay) {
      const followUpAt = calculateFollowUpTime(followUpDelay);
      const ksaTime = new Date(new Date(followUpAt.replace(" ", "T") + "Z").getTime() + 3 * 3600000);
      const timeDisplay = ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short" });
      aiReply += msgLang === "ar" ? `\n\n📌 _تم تسجيل متابعة لـ ${fromUser} — ${timeDisplay}_` : `\n\n📌 _Follow-up registered for ${fromUser} — ${timeDisplay}_`;
    }
    if (vendorPromise) {
      aiReply += msgLang === "ar" ? `\n\n🏢 _تم تسجيل متابعة مورد: ${vendorPromise.vendorName}_` : `\n\n🏢 _Vendor follow-up tracked: ${vendorPromise.vendorName}_`;
    }

    addToConversation(chatId, threadId, "assistant", aiReply);
    try { await ctx.reply(aiReply, { parse_mode: "Markdown", message_thread_id: threadId }); }
    catch (mdError) { await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId }); }
  } catch (error) {
    console.error("[Ops] AI error:", error.message);
    const errMsg = detectMessageLanguage(cleanText) === "en"
      ? `⚙️ Processing error. Use commands:\n• /task, /tasks, /done, /summary\n• /kpi, /expense, /occupancy\n• /meeting, /recurring, /handover`
      : `⚙️ خطأ. استخدم الأوامر:\n• /task, /tasks, /done, /summary\n• /kpi, /expense, /occupancy\n• /meeting, /recurring, /handover`;
    await ctx.reply(errMsg, { message_thread_id: threadId });
  }
}

// ─── Build tool results summary ─────────────────────────────

function buildToolResultsSummary(toolResults, lang) {
  const lines = [];
  for (const { tool, result } of toolResults) {
    if (!result.success) { lines.push(`❌ ${result.error}`); continue; }
    switch (tool) {
      case "create_task": lines.push(`✅ Task #${result.task_id}: ${result.title}`); break;
      case "create_tasks_batch":
        lines.push(lang === "ar" ? `✅ تم إنشاء ${result.tasks_created} مهام:` : `✅ Created ${result.tasks_created} tasks:`);
        for (const t of result.tasks) { lines.push(`  • #${t.task_id} — ${t.title}${t.priority === "urgent" ? " 🔴" : t.priority === "high" ? " 🟠" : ""}${t.assigned_to ? ` → ${t.assigned_to}` : ""}`); }
        break;
      case "create_reminder": lines.push(`⏰ Reminder: "${result.message}" — ${result.time_ksa}`); break;
      case "mark_task_done":
        lines.push(`✅ Completed #${result.task_id}: ${result.title}`);
        if (result.unblocked_tasks && result.unblocked_tasks.length > 0) {
          for (const u of result.unblocked_tasks) lines.push(`  🔓 Unblocked: #${u.task_id} — ${u.title}`);
        }
        break;
      case "move_task": lines.push(`🔄 Moved #${result.task_id} → ${result.to_topic}`); break;
      case "create_vendor_followup": lines.push(`🏢 Vendor tracked: ${result.vendor} — "${result.promise}"`); break;
      case "add_expense": lines.push(`💰 Expense #${result.expense_id}: ${result.amount} SAR — ${result.description}`); break;
      case "set_occupancy": lines.push(`🏠 ${result.unit}: ${result.status}${result.tenant ? ` — ${result.tenant}` : ""}`); break;
      case "add_dependency": lines.push(`🔗 #${result.task_id} depends on #${result.depends_on}`); break;
      case "list_tasks":
        if (result.pending_count === 0) lines.push("✨ No pending tasks.");
        else { lines.push(`📋 Pending (${result.pending_count}):`); for (const t of result.pending) lines.push(`  • #${t.id} — ${t.title}`); }
        break;
      case "get_all_tasks_summary": lines.push(`📊 ${result.total_pending} pending / ${result.total_done} done`); break;
    }
  }
  return lines.join("\n");
}

// ─── Passive Handler ────────────────────────────────────────

async function handleOpsPassive(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message?.text || "";
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  registerTopicFromCtx(ctx);

  if (text.length > 0) addToConversation(chatId, threadId, "user", `${fromUser}: ${text}`);

  // Capture meeting messages
  const activeMeeting = opsDb.getActiveMeeting(chatId, threadId);
  if (activeMeeting && text.length > 0) {
    opsDb.addMeetingMessage(activeMeeting.id, fromUser, text);
  }

  if (text.length > 5) {
    const followUpDelay = detectFollowUpPromise(text);
    if (followUpDelay) opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, calculateFollowUpTime(followUpDelay));
    const vendorPromise = detectVendorPromise(text);
    if (vendorPromise) opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, vendorPromise.vendorName, text.substring(0, 200), fromUser, calculateFollowUpTime("tomorrow_morning"));
  }
}

// ─── Topic Registration ─────────────────────────────────────

function registerTopicName(threadId, name) {
  if (!threadId || !name) return;
  threadTopicMap[threadId] = { name, role: getRoleFromName(name), emoji: getEmojiFromName(name) };
  console.log(`[Ops] Registered topic: #${threadId} → ${name}`);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 20/21: Google Sync Command ═════════════════════
// ═══════════════════════════════════════════════════════════════

const googleSync = require("../services/google-sync");

async function handleOpsGsync(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const args = (ctx.message?.text || "").replace(/^\/gsync(@\w+)?\s*/, "").trim();

  if (!googleSync.isConfigured()) {
    return ctx.reply(
      "⚠️ *Google Sync not configured*\n\n" +
      "Set the `GOOGLE_APPS_SCRIPT_URL` environment variable in Railway to enable Google Sheets \\& Calendar sync\\.",
      { parse_mode: "MarkdownV2", message_thread_id: threadId }
    );
  }

  if (args === "setup") {
    await ctx.reply("⏳ Setting up Google Sheets & Calendar...", { message_thread_id: threadId });
    try {
      const result = await googleSync.setup();
      if (result.success) {
        return ctx.reply(
          `✅ *Google Integration Ready*\n\n` +
          `📊 Spreadsheet: ${result.spreadsheetUrl || "Created"}\n` +
          `📅 Calendar: ${result.calendarName || "Created"}\n\n` +
          `Data will auto-sync daily at 9:15 PM KSA.`,
          { parse_mode: "Markdown", message_thread_id: threadId }
        );
      } else {
        return ctx.reply(`❌ Setup failed: ${result.error}`, { message_thread_id: threadId });
      }
    } catch (e) {
      return ctx.reply(`❌ Setup error: ${e.message}`, { message_thread_id: threadId });
    }
  }

  if (args === "now" || args === "sync") {
    await ctx.reply("⏳ Syncing all data to Google Sheets & Calendar...", { message_thread_id: threadId });
    try {
      const allTasks = opsDb.getDb().prepare(
        "SELECT * FROM tasks WHERE chat_id = ? AND status != 'cancelled' ORDER BY id DESC"
      ).all(chatId);
      const overdue = opsDb.getOverdueTasks(chatId);
      const taskStats = opsDb.getTaskStats(chatId);
      const weeklyStats = opsDb.getWeeklyStats(chatId);
      const expenses = opsDb.getMonthlyExpenses(chatId);
      const occupancy = opsDb.getOccupancy(chatId);
      const calendarTasks = allTasks.filter(t => t.due_date);

      const kpiRow = {
        report_date: new Date().toISOString().split("T")[0],
        period: "manual_sync",
        tasks_created: weeklyStats.created || 0,
        tasks_completed: weeklyStats.completed || 0,
        tasks_pending: taskStats.pending || 0,
        tasks_overdue: overdue.length,
        avg_resolution_hours: weeklyStats.avgResolutionHours || 0,
        completion_rate: taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0,
        top_topic: weeklyStats.topTopic || "",
        top_assignee: weeklyStats.topAssignee || "",
      };

      const result = await googleSync.syncAll({
        tasks: allTasks,
        kpis: [kpiRow],
        expenses: expenses,
        occupancy: occupancy,
        calendar_tasks: calendarTasks,
      });

      if (result.success) {
        const r = result.results || {};
        let msg = `✅ *Google Sync Complete*\n\n`;
        if (r.tasks) msg += `📊 Tasks: ${r.tasks.count || 0} synced\n`;
        if (r.expenses) msg += `💰 Expenses: ${r.expenses.count || 0} synced\n`;
        if (r.occupancy) msg += `🏠 Occupancy: ${r.occupancy.count || 0} synced\n`;
        if (r.calendar) msg += `📅 Calendar: ${r.calendar.message || "synced"}\n`;
        msg += `📈 KPIs: 1 row added`;
        return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
      } else {
        return ctx.reply(`❌ Sync failed: ${result.error}`, { message_thread_id: threadId });
      }
    } catch (e) {
      return ctx.reply(`❌ Sync error: ${e.message}`, { message_thread_id: threadId });
    }
  }

  if (args === "url" || args === "link") {
    try {
      const result = await googleSync.getSpreadsheetUrl();
      if (result.success) {
        return ctx.reply(`📊 *Google Sheet:*\n${result.url}`, { parse_mode: "Markdown", message_thread_id: threadId });
      }
    } catch (e) {}
    return ctx.reply("⚠️ Could not retrieve spreadsheet URL. Try /gsync setup first.", { message_thread_id: threadId });
  }

  // Default: show help
  return ctx.reply(
    `📊 *Google Sync Commands*\n\n` +
    `/gsync setup — Initialize spreadsheet & calendar\n` +
    `/gsync now — Sync all data immediately\n` +
    `/gsync url — Get spreadsheet link\n\n` +
    `ℹ️ Auto-sync runs daily at 9:15 PM KSA.`,
    { parse_mode: "Markdown", message_thread_id: threadId }
  );
}

// ═══════════════════════════════════════════════════════════════
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Original command handlers
  handleOpsTask, handleOpsChecklist, handleOpsTasks, handleOpsDone,
  handleOpsRemind, handleOpsSummary, handleOpsKpi, handleOpsProperty, handleOpsMove,
  // v3 new command handlers
  handleOpsSla, handleOpsApprove, handleOpsReject,
  handleOpsRecurring, handleOpsDepends, handleOpsHandover,
  handleOpsMonthlyReport, handleOpsExpense, handleOpsExpenses,
  handleOpsOccupancy, handleOpsMeeting, handleOpsGsync,
  // AI message handler
  handleOpsMessage,
  // Media handlers
  handleOpsMedia, handleOpsVoice,
  // Passive handler
  handleOpsPassive,
  // Topic management
  registerTopicName, getTopicInfo,
  // Utilities (used by scheduler)
  detectFollowUpPromise, calculateFollowUpTime, escMd: escMd,
  // Constants (used by scheduler)
  THREAD_IDS, TOPIC_FULL_NAMES, OPS_GROUP_ID, DEFAULT_SLA,
};
