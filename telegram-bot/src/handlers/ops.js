/**
 * Operations Group Handler — v2 (10-Feature Upgrade)
 * ─────────────────────────────────────────────────────────────
 * Handles ALL interactions in the Monthly Key Daily Operations HQ group.
 * Chat ID: -1003967447285
 *
 * Features:
 *  1.  Daily Auto-Reports (9 PM KSA → CEO Update topic)
 *  2.  Task Assignments & Accountability (@username, overdue pings)
 *  3.  KPI Dashboard (/kpi — weekly stats)
 *  4.  Escalation Rules (24h stale blockers → CEO Update)
 *  5.  Tenant/Property Tracking (#unit5 tags, /property command)
 *  6.  Photo/Document Logging (auto-tag media to topic/task/property)
 *  7.  Vendor Follow-up Automation (detect promises, auto-remind)
 *  8.  Handoff Between Topics (/move taskId topicName)
 *  9.  Morning Briefing (9 AM KSA → CEO Update topic, structured)
 *  10. Voice Note Transcription (download → transcribe → extract tasks)
 *
 *  Plus existing: /task, /checklist, /tasks, /done, /remind, /summary,
 *  Smart AI with OpenAI function calling, conversation memory,
 *  follow-up detection, language detection.
 */

const opsDb = require("../services/ops-database");
const config = require("../config");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ─── Constants ──────────────────────────────────────────────

const OPS_GROUP_ID = -1003967447285;

// Known thread IDs for topics (from user specification)
const THREAD_IDS = {
  RULES: 3,
  CEO_UPDATE: 4,
  OPERATIONS: 5,
  LISTINGS: 6,
  BOOKINGS: 7,
  SUPPORT: 8,
  TECH: 9,
  PAYMENTS: 10,
  MARKETING: 11,
  LEGAL: 12,
  BLOCKERS: 13,
  COMPLETED: 14,
  PRIORITIES: 15,
};

// Reverse map: thread_id → topic short name (for /move command)
const TOPIC_SHORTNAMES = {
  rules: THREAD_IDS.RULES,
  ceo: THREAD_IDS.CEO_UPDATE,
  "ceo-update": THREAD_IDS.CEO_UPDATE,
  operations: THREAD_IDS.OPERATIONS,
  ops: THREAD_IDS.OPERATIONS,
  listings: THREAD_IDS.LISTINGS,
  bookings: THREAD_IDS.BOOKINGS,
  revenue: THREAD_IDS.BOOKINGS,
  support: THREAD_IDS.SUPPORT,
  tech: THREAD_IDS.TECH,
  payments: THREAD_IDS.PAYMENTS,
  finance: THREAD_IDS.PAYMENTS,
  marketing: THREAD_IDS.MARKETING,
  legal: THREAD_IDS.LEGAL,
  blockers: THREAD_IDS.BLOCKERS,
  escalations: THREAD_IDS.BLOCKERS,
  completed: THREAD_IDS.COMPLETED,
  priorities: THREAD_IDS.PRIORITIES,
  tomorrow: THREAD_IDS.PRIORITIES,
};

// Full topic names by thread ID
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

// ─── Conversation Context Memory ────────────────────────────
const conversationMemory = new Map();
const MAX_MEMORY = 20;

function getConversationKey(chatId, threadId) {
  return `${chatId}:${threadId || "general"}`;
}

function getConversationHistory(chatId, threadId) {
  const key = getConversationKey(chatId, threadId);
  return conversationMemory.get(key) || [];
}

function addToConversation(chatId, threadId, role, content) {
  const key = getConversationKey(chatId, threadId);
  const history = conversationMemory.get(key) || [];
  history.push({ role, content });
  if (history.length > MAX_MEMORY) {
    history.splice(0, history.length - MAX_MEMORY);
  }
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

/**
 * Extract #property tags from text (e.g., #unit5, #villa3)
 */
function extractPropertyTag(text) {
  if (!text) return null;
  const match = text.match(/#([a-zA-Z0-9_]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract @username from text for assignment
 */
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

// Pre-populate with known thread IDs
for (const [threadId, fullName] of Object.entries(TOPIC_FULL_NAMES)) {
  const tid = parseInt(threadId);
  const prefix = fullName.substring(0, 2);
  const info = TOPIC_CONTEXT[prefix];
  if (info) {
    threadTopicMap[tid] = { name: info.name, role: info.role, emoji: info.emoji };
  }
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

// ─── Vendor Promise Detection (Feature 7) ───────────────────

const VENDOR_PATTERNS = [
  // English: "Mobily said they'll come tomorrow", "contractor promised by Sunday"
  { regex: /(\w+)\s+(?:said|promised|confirmed|told us|will come|will deliver|will send|will fix|will install)\b.*\b(tomorrow|tonight|by\s+\w+day|by\s+end\s+of\s+\w+|next\s+week|within\s+\d+\s+days?)/i, delay: "vendor_promise" },
  { regex: /(?:the|our)\s+(\w+)\s+(?:said|promised|confirmed|will)\b/i, delay: "vendor_promise" },
  // Arabic vendor patterns
  { regex: /(شركة|مقاول|فني|موبايلي|stc|زين|الكهربائي|السباك)\s+(?:قال|وعد|أكد|سيأتي|سيرسل|سيصلح|سيركب)/u, delay: "vendor_promise" },
];

function detectVendorPromise(text) {
  for (const pattern of VENDOR_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return { vendorName: match[1] || "Vendor", matched: true };
    }
  }
  return null;
}

function detectFollowUpPromise(text) {
  for (const pattern of FOLLOWUP_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.delay;
    }
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
    if (followUpKSA <= ksaNow) {
      followUpKSA.setDate(followUpKSA.getDate() + 1);
      followUpKSA.setHours(9, 30, 0, 0);
    }
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

// ─── Parse /remind time argument ────────────────────────────

function parseReminderTime(timeStr) {
  const ksaOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const ksaNow = new Date(now.getTime() + ksaOffset);

  const relHour = timeStr.match(/^(\d+)\s*h(ours?)?$/i);
  if (relHour) {
    const ms = parseInt(relHour[1]) * 60 * 60 * 1000;
    return new Date(now.getTime() + ms).toISOString().replace("T", " ").substring(0, 19);
  }
  const relMin = timeStr.match(/^(\d+)\s*m(in(utes?)?)?$/i);
  if (relMin) {
    const ms = parseInt(relMin[1]) * 60 * 1000;
    return new Date(now.getTime() + ms).toISOString().replace("T", " ").substring(0, 19);
  }

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
    const utc = new Date(target.getTime() - ksaOffset);
    return utc.toISOString().replace("T", " ").substring(0, 19);
  }

  const tomorrowMatch = timeStr.match(/^tomorrow\s*(.*)$/i);
  if (tomorrowMatch) {
    const rest = tomorrowMatch[1].trim() || "9am";
    const inner = parseReminderTime(rest);
    if (inner) {
      const d = new Date(inner.replace(" ", "T") + "Z");
      d.setDate(d.getDate() + 1);
      return d.toISOString().replace("T", " ").substring(0, 19);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// ═══ OpenAI Function Calling — Tool Definitions ═══════════════
// ═══════════════════════════════════════════════════════════════

const OPS_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a single task/action item in the current topic. Use this when you identify something that needs to be done.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Clear, actionable task description." },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Task priority level." },
          assigned_to: { type: "string", description: "Optional @username of the person responsible." },
          due_date: { type: "string", description: "Optional due date in YYYY-MM-DD format." },
          property_tag: { type: "string", description: "Optional property/unit tag (e.g., 'unit5', 'villa3')." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tasks_batch",
      description: "Create multiple tasks at once. Use when you identify several action items from a conversation.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                assigned_to: { type: "string" },
                due_date: { type: "string" },
                property_tag: { type: "string" },
              },
              required: ["title"],
            },
          },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Set a timed reminder. Use for deadlines, follow-ups, or scheduled check-ins.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The reminder message." },
          time: { type: "string", description: "When to remind: '9am', '18:00', '2h', '30m', 'tomorrow 9am'" },
        },
        required: ["message", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_task_done",
      description: "Mark a task as completed by its task ID number.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "integer", description: "The task ID number." },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List all pending tasks in the current topic.",
      parameters: {
        type: "object",
        properties: {
          include_done: { type: "boolean", description: "Whether to include completed tasks." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_tasks_summary",
      description: "Get a summary of all pending tasks across ALL topics.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "move_task",
      description: "Move/transfer a task to a different topic. Use when a task belongs in another topic.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "integer", description: "The task ID to move." },
          target_topic: { type: "string", description: "Target topic short name: ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo" },
        },
        required: ["task_id", "target_topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_vendor_followup",
      description: "Create a vendor follow-up tracker. Use when a vendor/contractor/service provider has made a promise or commitment.",
      parameters: {
        type: "object",
        properties: {
          vendor_name: { type: "string", description: "Name of the vendor/company." },
          promise: { type: "string", description: "What they promised to do." },
          deadline: { type: "string", description: "When they promised: 'tomorrow', '2h', 'Sunday', 'next week'" },
        },
        required: ["vendor_name", "promise", "deadline"],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// ═══ Tool Execution ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function executeTool(toolName, args, chatId, threadId, topicInfo, fromUser) {
  try {
    switch (toolName) {
      case "create_task": {
        const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, args.title, {
          priority: args.priority || "normal",
          assignedTo: args.assigned_to || null,
          dueDate: args.due_date || null,
          propertyTag: args.property_tag || null,
          createdBy: fromUser,
        });
        return {
          success: true,
          task_id: taskId,
          title: args.title,
          priority: args.priority || "normal",
          assigned_to: args.assigned_to || null,
          due_date: args.due_date || null,
          property_tag: args.property_tag || null,
          message: `Task #${taskId} created: "${args.title}"`,
        };
      }

      case "create_tasks_batch": {
        const created = [];
        for (const t of args.tasks) {
          const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, t.title, {
            priority: t.priority || "normal",
            assignedTo: t.assigned_to || null,
            dueDate: t.due_date || null,
            propertyTag: t.property_tag || null,
            createdBy: fromUser,
          });
          created.push({
            task_id: taskId,
            title: t.title,
            priority: t.priority || "normal",
            assigned_to: t.assigned_to || null,
          });
        }
        return { success: true, tasks_created: created.length, tasks: created };
      }

      case "create_reminder": {
        const remindAt = parseReminderTime(args.time);
        if (!remindAt) {
          return { success: false, error: `Could not parse time: "${args.time}"` };
        }
        opsDb.addReminder(chatId, threadId, topicInfo.name, args.message, remindAt, fromUser);
        const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
        const timeDisplay = ksaTime.toLocaleString("en-US", {
          timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short",
        });
        return { success: true, message: args.message, time_ksa: timeDisplay };
      }

      case "mark_task_done": {
        const task = opsDb.getTaskById(args.task_id);
        if (!task || task.chat_id !== chatId) return { success: false, error: `Task #${args.task_id} not found.` };
        if (task.status === "done") return { success: false, error: `Task #${args.task_id} already completed.` };
        opsDb.markTaskDone(args.task_id);
        return { success: true, task_id: args.task_id, title: task.title };
      }

      case "list_tasks": {
        const tasks = opsDb.getTasksByThread(chatId, threadId);
        const pending = tasks.filter((t) => t.status === "pending");
        const done = tasks.filter((t) => t.status === "done");
        return {
          success: true,
          pending_count: pending.length,
          done_count: done.length,
          pending: pending.map((t) => ({ id: t.id, title: t.title, priority: t.priority, assigned_to: t.assigned_to, due_date: t.due_date, property_tag: t.property_tag })),
          done: args.include_done ? done.slice(0, 10).map((t) => ({ id: t.id, title: t.title })) : [],
        };
      }

      case "get_all_tasks_summary": {
        const allTasks = opsDb.getAllPendingTasks(chatId);
        const stats = opsDb.getTaskStats(chatId);
        const byTopic = {};
        for (const task of allTasks) {
          const key = task.topic_name || "General";
          if (!byTopic[key]) byTopic[key] = [];
          byTopic[key].push({ id: task.id, title: task.title, priority: task.priority, assigned_to: task.assigned_to });
        }
        return { success: true, total_pending: stats.pending, total_done: stats.done, by_topic: byTopic };
      }

      case "move_task": {
        const task = opsDb.getTaskById(args.task_id);
        if (!task || task.chat_id !== chatId) return { success: false, error: `Task #${args.task_id} not found.` };
        const targetThread = TOPIC_SHORTNAMES[args.target_topic?.toLowerCase()];
        if (!targetThread) return { success: false, error: `Unknown topic: "${args.target_topic}". Use: ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo` };
        const targetName = TOPIC_FULL_NAMES[targetThread] || args.target_topic;
        opsDb.transferTask(args.task_id, targetThread, targetName);
        return { success: true, task_id: args.task_id, title: task.title, from_topic: task.topic_name, to_topic: targetName };
      }

      case "create_vendor_followup": {
        const deadlineAt = calculateFollowUpTime(args.deadline === "tomorrow" ? "tomorrow_morning" : "tomorrow_morning");
        opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, args.vendor_name, args.promise, fromUser, deadlineAt);
        return { success: true, vendor: args.vendor_name, promise: args.promise, deadline: deadlineAt };
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
  const langInstruction =
    msgLang === "ar"
      ? "\n\n⚠️ CRITICAL: The user wrote in Arabic. You MUST reply entirely in Arabic."
      : "\n\n⚠️ CRITICAL: The user wrote in English. You MUST reply entirely in English.";

  const today = new Date().toISOString().split("T")[0];

  return `You are the smart operations assistant for Monthly Key (المفتاح الشهري), a monthly rental platform in Saudi Arabia. You are inside the "Daily Operations HQ" Telegram group, topic: "${topicInfo.name}".

Today: ${today}

## CORE BEHAVIOR — BE AN EXECUTOR, NOT A CHATBOT
1. When you see action items → IMMEDIATELY use tools to create them. Do NOT ask "would you like me to create these?"
2. When user says "yes", "create them", "do it" → look at conversation history and CREATE the tasks you previously identified
3. Extract #property tags (e.g., #unit5) and @assignees from messages automatically
4. When someone reports a vendor promise → use create_vendor_followup to track it
5. When someone says to move a task → use move_task tool

## TOOLS AVAILABLE
- create_task / create_tasks_batch — create tasks with priority, assignee, due_date, property_tag
- create_reminder — set timed reminders
- mark_task_done — complete tasks
- list_tasks / get_all_tasks_summary — show status
- move_task — transfer task to another topic (ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo)
- create_vendor_followup — track vendor/contractor promises

## RULES
- ❌ Do NOT ask for details already in context
- ❌ Do NOT have back-and-forth about creating tasks
- ✅ Extract property tags (#unit5) and include them in tasks
- ✅ Extract @assignees and include them in tasks
- ✅ Be concise, use bullet points and task IDs
- ✅ After tool execution, confirm what was done${langInstruction}`;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Command Handlers ════════════════════════════════════════
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

  const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, title, {
    createdBy,
    assignedTo: assignee,
    propertyTag,
  });

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

  if (!argsText) {
    return ctx.reply(
      `📋 *Create a checklist*\n\nUsage:\n\`/checklist task 1 | task 2 | task 3\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const items = argsText.split(/\||\n/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (items.length === 0) {
    return ctx.reply("❌ No tasks found. Use | to separate tasks.", { message_thread_id: threadId });
  }

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const taskIds = [];
  for (const item of items) {
    const id = opsDb.addTask(chatId, threadId, topicInfo.name, item, {
      createdBy,
      assignedTo: extractAssignee(item),
      propertyTag: extractPropertyTag(item),
    });
    taskIds.push({ id, title: item });
  }

  let reply = `📋 *${taskIds.length} tasks created — ${topicInfo.name}*\n\n`;
  taskIds.forEach(({ id, title }, i) => {
    reply += `${i + 1}. ⬜ ${title} [#${id}]\n`;
  });
  reply += `\nUse \`/done [number]\` to complete`;

  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsTasks(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const tasks = opsDb.getTasksByThread(chatId, threadId);

  if (tasks.length === 0) {
    return ctx.reply(`${topicInfo.emoji} *${topicInfo.name}*\n\n✨ No tasks in this topic.\n\nAdd one: \`/task description\``, {
      parse_mode: "Markdown", message_thread_id: threadId,
    });
  }

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done");

  let reply = `${topicInfo.emoji} *${topicInfo.name}* — Tasks\n\n`;
  if (pending.length > 0) {
    reply += `*⬜ Pending (${pending.length}):*\n`;
    pending.forEach((task, i) => {
      const prio = task.priority === "urgent" ? " 🔴" : task.priority === "high" ? " 🟠" : "";
      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      const prop = task.property_tag ? ` 🏠#${task.property_tag}` : "";
      const due = task.due_date ? ` 📅${task.due_date}` : "";
      reply += `${i + 1}. ⬜ ${task.title}${prio}${assignee}${prop}${due} [#${task.id}]\n`;
    });
  }
  if (done.length > 0) {
    reply += `\n*✅ Done (${done.length}):*\n`;
    done.slice(0, 5).forEach((task) => {
      reply += `✅ ~~${task.title}~~ [#${task.id}]\n`;
    });
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
    tasks.forEach((task) => { reply += `⬜ ${task.title} [#${task.id}]\n`; });
    return ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });
  if (task.status === "done") return ctx.reply(`✅ Task #${taskId} already completed.`, { message_thread_id: threadId });

  opsDb.markTaskDone(taskId);
  await ctx.reply(`✅ *Task #${taskId} completed!*\n\n~~${task.title}~~\n\n🎉 Well done!`, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsRemind(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "remind");

  if (!argsText) {
    return ctx.reply(
      `⏰ *Set a reminder*\n\nUsage: \`/remind [time] [message]\`\n\nExamples:\n• \`/remind 9am Team meeting\`\n• \`/remind 2h Follow up with client\`\n• \`/remind tomorrow 9am Review reports\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  let timeStr, message;
  const tomorrowMatch = argsText.match(/^(tomorrow\s+\S+)\s+(.+)$/i);
  if (tomorrowMatch) { timeStr = tomorrowMatch[1]; message = tomorrowMatch[2]; }
  else { const parts = argsText.split(/\s+/); timeStr = parts[0]; message = parts.slice(1).join(" "); }

  if (!message) return ctx.reply("❌ Please specify a reminder message.", { parse_mode: "Markdown", message_thread_id: threadId });

  const remindAt = parseReminderTime(timeStr);
  if (!remindAt) return ctx.reply(`❌ Could not parse time: \`${timeStr}\``, { parse_mode: "Markdown", message_thread_id: threadId });

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  opsDb.addReminder(chatId, threadId, topicInfo.name, message, remindAt, createdBy);

  const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
  const timeDisplay = ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });

  await ctx.reply(`⏰ *Reminder set*\n\n📝 ${message}\n🕐 ${timeDisplay} (Riyadh)`, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsSummary(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const allTasks = opsDb.getAllPendingTasks(chatId);

  if (allTasks.length === 0) {
    return ctx.reply(`📊 *Task Summary*\n\n✨ No pending tasks. Great work!`, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const byTopic = {};
  for (const task of allTasks) {
    const key = task.topic_name || "General";
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(task);
  }

  const stats = opsDb.getTaskStats(chatId);
  let reply = `📊 *Task Summary*\n📌 ${stats.pending} pending / ${stats.done} done\n\n`;
  for (const [topicName, tasks] of Object.entries(byTopic)) {
    const emoji = getEmojiFromName(topicName);
    reply += `${emoji} *${topicName}* (${tasks.length}):\n`;
    tasks.slice(0, 5).forEach((task, i) => {
      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      reply += `  ${i + 1}. ⬜ ${task.title}${assignee} [#${task.id}]\n`;
    });
    if (tasks.length > 5) reply += `  _... and ${tasks.length - 5} more_\n`;
    reply += "\n";
  }

  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Feature 3: KPI Dashboard (/kpi) ────────────────────────

async function handleOpsKpi(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;

  const weekly = opsDb.getWeeklyStats(chatId);
  const stats = opsDb.getTaskStats(chatId);
  const overdue = opsDb.getOverdueTasks(chatId);

  const completionRate = weekly.created > 0 ? Math.round((weekly.completed / weekly.created) * 100) : 0;

  let reply = `📊 *Weekly KPI Dashboard*\n`;
  reply += `📅 Last 7 days\n\n`;
  reply += `*Task Metrics:*\n`;
  reply += `• Created: ${weekly.created}\n`;
  reply += `• Completed: ${weekly.completed}\n`;
  reply += `• Completion Rate: ${completionRate}%\n`;
  if (weekly.avgResolutionHours) {
    reply += `• Avg Resolution: ${weekly.avgResolutionHours}h\n`;
  }
  reply += `\n*Current Status:*\n`;
  reply += `• Total Pending: ${stats.pending}\n`;
  reply += `• Total Done: ${stats.done}\n`;
  reply += `• High Priority: ${weekly.highPriorityCount}\n`;
  reply += `• Overdue: ${overdue.length}\n`;

  if (weekly.pendingByTopic.length > 0) {
    reply += `\n*Busiest Topics (pending):*\n`;
    weekly.pendingByTopic.slice(0, 5).forEach((t) => {
      reply += `• ${t.topic_name || "General"}: ${t.c} tasks\n`;
    });
  }

  if (overdue.length > 0) {
    reply += `\n*⚠️ Overdue Tasks:*\n`;
    overdue.slice(0, 5).forEach((t) => {
      const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
      reply += `• #${t.id} ${t.title}${assignee} (due: ${t.due_date})\n`;
    });
  }

  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Feature 5: Property Tracking (/property) ───────────────

async function handleOpsProperty(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const tag = extractCommandArgs(text, "property").replace(/^#/, "").toLowerCase().trim();

  if (!tag) {
    return ctx.reply(
      `🏠 *Property Tracker*\n\nUsage: \`/property unit5\`\n\nShows all tasks and media linked to a property/unit.`,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const tasks = opsDb.getTasksByProperty(chatId, tag);
  const media = opsDb.getMediaByProperty(chatId, tag);

  if (tasks.length === 0 && media.length === 0) {
    return ctx.reply(`🏠 *#${tag}*\n\nNo tasks or media found for this property.`, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done");

  let reply = `🏠 *Property: #${tag}*\n\n`;

  if (pending.length > 0) {
    reply += `*⬜ Pending Tasks (${pending.length}):*\n`;
    pending.forEach((t) => {
      const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
      reply += `• #${t.id} ${t.title}${assignee}\n`;
    });
    reply += "\n";
  }

  if (done.length > 0) {
    reply += `*✅ Completed (${done.length}):*\n`;
    done.slice(0, 5).forEach((t) => { reply += `• #${t.id} ~~${t.title}~~\n`; });
    reply += "\n";
  }

  if (media.length > 0) {
    reply += `*📷 Media Files (${media.length}):*\n`;
    media.slice(0, 5).forEach((m) => {
      reply += `• ${m.file_type} from ${m.from_user || "unknown"} (${m.created_at})\n`;
    });
  }

  await ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Feature 8: Handoff Between Topics (/move) ──────────────

async function handleOpsMove(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "move");

  if (!argsText) {
    return ctx.reply(
      `🔄 *Move a task to another topic*\n\nUsage: \`/move [task#] [topic]\`\n\nTopics: ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo\n\nExample: \`/move 5 payments\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const parts = argsText.split(/\s+/);
  const taskId = parseInt(parts[0], 10);
  const targetTopic = parts.slice(1).join(" ").toLowerCase();

  if (!taskId || isNaN(taskId)) return ctx.reply("❌ Please specify a valid task number.", { message_thread_id: threadId });

  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });

  const targetThread = TOPIC_SHORTNAMES[targetTopic];
  if (!targetThread) {
    return ctx.reply(`❌ Unknown topic: "${targetTopic}"\n\nValid: ops, listings, bookings, support, tech, payments, marketing, legal, blockers, completed, priorities, ceo`, { message_thread_id: threadId });
  }

  const targetName = TOPIC_FULL_NAMES[targetThread] || targetTopic;
  const oldTopic = task.topic_name || "General";
  opsDb.transferTask(taskId, targetThread, targetName);

  // Post in original topic
  await ctx.reply(`🔄 *Task #${taskId} moved*\n\n📤 From: ${oldTopic}\n📥 To: ${targetName}\n\n⬜ ${task.title}`, { parse_mode: "Markdown", message_thread_id: threadId });

  // Cross-post to new topic
  try {
    await ctx.telegram.sendMessage(chatId, `📥 *Task #${taskId} transferred here*\n\n⬜ ${task.title}\n\n📤 From: ${oldTopic}\n👤 ${task.assigned_to || task.created_by || "Unassigned"}`, {
      parse_mode: "Markdown",
      message_thread_id: targetThread,
    });
  } catch (e) {
    console.error("[Ops] Cross-post failed:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 6: Photo/Document Logging ═══════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsMedia(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  let fileId = null;
  let fileType = null;

  if (ctx.message.photo) {
    // Get highest resolution photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    fileType = "photo";
  } else if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    fileType = "document";
  } else if (ctx.message.video) {
    fileId = ctx.message.video.file_id;
    fileType = "video";
  }

  if (!fileId) return;

  const caption = ctx.message.caption || "";
  const propertyTag = extractPropertyTag(caption);

  // Find the most recent pending task in this thread to auto-link
  const pendingTasks = opsDb.getPendingTasksByThread(chatId, threadId);
  let linkedTaskId = null;

  // If caption mentions a task ID like #5, link to that
  const taskIdMatch = caption.match(/#(\d+)/);
  if (taskIdMatch) {
    linkedTaskId = parseInt(taskIdMatch[1], 10);
  } else if (pendingTasks.length > 0) {
    // Auto-link to most recent pending task
    linkedTaskId = pendingTasks[pendingTasks.length - 1].id;
  }

  opsDb.addMediaLog(chatId, threadId, topicInfo.name, fileId, fileType, {
    caption,
    fromUser,
    taskId: linkedTaskId,
    propertyTag,
  });

  // Send a subtle confirmation
  const parts = [`📎 *Logged*`];
  if (propertyTag) parts.push(`🏠 #${propertyTag}`);
  if (linkedTaskId) parts.push(`🔗 Task #${linkedTaskId}`);
  parts.push(`📍 ${topicInfo.name}`);

  await ctx.reply(parts.join(" | "), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 10: Voice Note Transcription ════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsVoice(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  const voice = ctx.message.voice || ctx.message.audio;
  if (!voice) return;

  // Show typing
  try { await ctx.sendChatAction("typing"); } catch (e) {}

  try {
    // Get file info from Telegram
    const file = await ctx.telegram.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;

    // Download the file
    const tmpDir = path.join(__dirname, "..", "..", "data", "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const ext = file.file_path.split(".").pop() || "ogg";
    const tmpFile = path.join(tmpDir, `voice_${Date.now()}.${ext}`);

    await downloadFile(fileUrl, tmpFile);

    // Transcribe using OpenAI Whisper API
    const transcription = await transcribeAudio(openaiClient, tmpFile);

    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch (e) {}

    if (!transcription) {
      return ctx.reply("🎤 Could not transcribe the voice message.", { message_thread_id: threadId });
    }

    const msgLang = detectMessageLanguage(transcription);

    // Log the media
    opsDb.addMediaLog(chatId, threadId, topicInfo.name, voice.file_id, "voice", {
      caption: transcription.substring(0, 500),
      fromUser,
    });

    // Send transcription
    const header = msgLang === "ar" ? "🎤 *تفريغ الرسالة الصوتية*" : "🎤 *Voice Transcription*";
    await ctx.reply(`${header}\n👤 ${fromUser}\n\n${transcription}`, {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });

    // Now use AI to extract action items from the transcription
    try { await ctx.sendChatAction("typing"); } catch (e) {}

    const systemPrompt = buildSystemPrompt(topicInfo, msgLang);
    const aiMessages = [
      { role: "system", content: systemPrompt + "\n\nA voice message was just transcribed. Analyze it for action items, tasks, and commitments. If you find any, CREATE them immediately using your tools. Be proactive." },
      { role: "user", content: `${fromUser} sent a voice message. Transcription:\n\n"${transcription}"\n\nExtract and create any action items, tasks, or follow-ups from this voice message.` },
    ];

    const response = await openaiClient.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages: aiMessages,
      tools: OPS_TOOLS,
      tool_choice: "auto",
      max_tokens: 1200,
      temperature: 0.3,
    });

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
      const nextResponse = await openaiClient.chat.completions.create({
        model: config.aiModel || "gpt-4.1-mini",
        messages: aiMessages,
        tools: OPS_TOOLS,
        tool_choice: "auto",
        max_tokens: 1200,
        temperature: 0.3,
      });
      assistantMessage = nextResponse.choices[0]?.message;
    }

    const aiReply = assistantMessage?.content;
    if (aiReply) {
      try {
        await ctx.reply(aiReply, { parse_mode: "Markdown", message_thread_id: threadId });
      } catch (e) {
        await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId });
      }
    } else if (allToolResults.length > 0) {
      const summary = buildToolResultsSummary(allToolResults, msgLang);
      if (summary) await ctx.reply(summary, { parse_mode: "Markdown", message_thread_id: threadId });
    }

  } catch (error) {
    console.error("[Ops] Voice transcription error:", error.message);
    await ctx.reply("🎤 Error processing voice message. Please try again.", { message_thread_id: threadId });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on("finish", () => { file.close(resolve); });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function transcribeAudio(openaiClient, filePath) {
  try {
    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });
    return transcription.text;
  } catch (error) {
    console.error("[Ops] Whisper API error:", error.message);
    // Fallback: try manus-speech-to-text if available
    try {
      const { execSync } = require("child_process");
      const result = execSync(`manus-speech-to-text "${filePath}"`, { timeout: 60000 }).toString().trim();
      return result;
    } catch (e) {
      console.error("[Ops] manus-speech-to-text fallback also failed:", e.message);
      return null;
    }
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

  // Check for follow-up promise
  const followUpDelay = detectFollowUpPromise(text);
  if (followUpDelay) {
    const followUpAt = calculateFollowUpTime(followUpDelay);
    opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, followUpAt);
  }

  // Feature 7: Check for vendor promises
  const vendorPromise = detectVendorPromise(text);
  if (vendorPromise) {
    const deadlineAt = calculateFollowUpTime("tomorrow_morning");
    opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, vendorPromise.vendorName, text.substring(0, 200), fromUser, deadlineAt);
    console.log(`[Ops] Vendor follow-up detected: ${vendorPromise.vendorName}`);
  }

  // Only send AI response if bot was mentioned or replied to
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

    // Add recent conversation history
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) messages.push(msg);

    const userContent = cleanText || (msgLang === "ar" ? "مرحباً" : "Hello");

    // If replying to bot, include the original message as context
    if (isReplyToBot && ctx.message.reply_to_message?.text) {
      const repliedText = ctx.message.reply_to_message.text;
      messages.push({
        role: "user",
        content: `[Replying to bot's message: "${repliedText.substring(0, 1000)}"]\n\n${fromUser} says: ${userContent}`,
      });
    } else {
      messages.push({ role: "user", content: `${fromUser} says: ${userContent}` });
    }

    addToConversation(chatId, threadId, "user", `${fromUser}: ${userContent}`);

    // Call OpenAI with function calling
    let response = await openaiClient.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages,
      tools: OPS_TOOLS,
      tool_choice: "auto",
      max_tokens: 1200,
      temperature: 0.3,
    });

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

      response = await openaiClient.chat.completions.create({
        model: config.aiModel || "gpt-4.1-mini",
        messages,
        tools: OPS_TOOLS,
        tool_choice: "auto",
        max_tokens: 1200,
        temperature: 0.3,
      });
      assistantMessage = response.choices[0]?.message;
    }

    let aiReply = assistantMessage?.content || "";
    if (!aiReply && allToolResults.length > 0) {
      aiReply = buildToolResultsSummary(allToolResults, msgLang);
    }
    if (!aiReply) aiReply = msgLang === "ar" ? "تم." : "Done.";

    // Add follow-up note
    if (followUpDelay) {
      const followUpAt = calculateFollowUpTime(followUpDelay);
      const ksaTime = new Date(new Date(followUpAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
      const timeDisplay = ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short" });
      aiReply += msgLang === "ar"
        ? `\n\n📌 _تم تسجيل متابعة لـ ${fromUser} — ${timeDisplay}_`
        : `\n\n📌 _Follow-up registered for ${fromUser} — ${timeDisplay}_`;
    }

    // Add vendor follow-up note
    if (vendorPromise) {
      aiReply += msgLang === "ar"
        ? `\n\n🏢 _تم تسجيل متابعة مورد: ${vendorPromise.vendorName}_`
        : `\n\n🏢 _Vendor follow-up tracked: ${vendorPromise.vendorName}_`;
    }

    addToConversation(chatId, threadId, "assistant", aiReply);

    try {
      await ctx.reply(aiReply, { parse_mode: "Markdown", message_thread_id: threadId });
    } catch (mdError) {
      await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId });
    }
  } catch (error) {
    console.error("[Ops] AI error:", error.message);
    const errMsg = detectMessageLanguage(cleanText) === "en"
      ? `⚙️ Processing error. Use commands:\n• /task [desc]\n• /tasks\n• /done [#]\n• /summary\n• /kpi\n• /property [tag]\n• /move [#] [topic]`
      : `⚙️ خطأ. استخدم الأوامر:\n• /task [وصف]\n• /tasks\n• /done [رقم]\n• /summary\n• /kpi\n• /property [وحدة]\n• /move [رقم] [موضوع]`;
    await ctx.reply(errMsg, { message_thread_id: threadId });
  }
}

// ─── Build tool results summary ─────────────────────────────

function buildToolResultsSummary(toolResults, lang) {
  const lines = [];
  for (const { tool, result } of toolResults) {
    if (!result.success) { lines.push(`❌ ${result.error}`); continue; }
    switch (tool) {
      case "create_task":
        lines.push(`✅ Task #${result.task_id}: ${result.title}`);
        break;
      case "create_tasks_batch":
        lines.push(lang === "ar" ? `✅ تم إنشاء ${result.tasks_created} مهام:` : `✅ Created ${result.tasks_created} tasks:`);
        for (const t of result.tasks) {
          const prio = t.priority === "urgent" ? " 🔴" : t.priority === "high" ? " 🟠" : "";
          const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
          lines.push(`  • #${t.task_id} — ${t.title}${prio}${assignee}`);
        }
        break;
      case "create_reminder":
        lines.push(`⏰ Reminder: "${result.message}" — ${result.time_ksa}`);
        break;
      case "mark_task_done":
        lines.push(`✅ Completed #${result.task_id}: ${result.title}`);
        break;
      case "move_task":
        lines.push(`🔄 Moved #${result.task_id} → ${result.to_topic}`);
        break;
      case "create_vendor_followup":
        lines.push(`🏢 Vendor tracked: ${result.vendor} — "${result.promise}"`);
        break;
      case "list_tasks":
        if (result.pending_count === 0) { lines.push("✨ No pending tasks."); }
        else {
          lines.push(`📋 Pending (${result.pending_count}):`);
          for (const t of result.pending) lines.push(`  • #${t.id} — ${t.title}`);
        }
        break;
      case "get_all_tasks_summary":
        lines.push(`📊 ${result.total_pending} pending / ${result.total_done} done`);
        break;
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

  if (text.length > 0) {
    addToConversation(chatId, threadId, "user", `${fromUser}: ${text}`);
  }

  if (text.length > 5) {
    const followUpDelay = detectFollowUpPromise(text);
    if (followUpDelay) {
      const followUpAt = calculateFollowUpTime(followUpDelay);
      opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, followUpAt);
    }

    // Feature 7: Passive vendor promise detection
    const vendorPromise = detectVendorPromise(text);
    if (vendorPromise) {
      const deadlineAt = calculateFollowUpTime("tomorrow_morning");
      opsDb.addVendorFollowUp(chatId, threadId, topicInfo.name, vendorPromise.vendorName, text.substring(0, 200), fromUser, deadlineAt);
      console.log(`[Ops] Vendor follow-up detected passively: ${vendorPromise.vendorName}`);
    }
  }
}

// ─── Topic Registration ─────────────────────────────────────

function registerTopicName(threadId, name) {
  if (!threadId || !name) return;
  threadTopicMap[threadId] = { name, role: getRoleFromName(name), emoji: getEmojiFromName(name) };
  console.log(`[Ops] Registered topic: #${threadId} → ${name}`);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Command handlers
  handleOpsTask,
  handleOpsChecklist,
  handleOpsTasks,
  handleOpsDone,
  handleOpsRemind,
  handleOpsSummary,
  handleOpsKpi,
  handleOpsProperty,
  handleOpsMove,
  // AI message handler
  handleOpsMessage,
  // Media handlers
  handleOpsMedia,
  handleOpsVoice,
  // Passive handler
  handleOpsPassive,
  // Topic management
  registerTopicName,
  getTopicInfo,
  // Utilities (used by scheduler)
  detectFollowUpPromise,
  calculateFollowUpTime,
  escMd: escMd,
  // Constants (used by scheduler)
  THREAD_IDS,
  TOPIC_FULL_NAMES,
  OPS_GROUP_ID,
};
