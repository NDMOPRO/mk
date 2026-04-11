/**
 * Operations Group Handler
 * ─────────────────────────────────────────────────────────────
 * Handles ALL interactions in the Monthly Key Daily Operations HQ group.
 * Chat ID: -1003967447285
 *
 * This module is COMPLETELY SEPARATE from the public bot features.
 * It is only invoked when ctx.chat.id === OPS_GROUP_ID.
 *
 * Features:
 *  - /task [description]   — Add a task in the current topic
 *  - /checklist item1 | item2 | item3   — Add multiple tasks at once
 *  - /tasks                — List pending tasks in current topic
 *  - /done [task#]         — Mark task as complete
 *  - /remind [time] [msg]  — Set a reminder
 *  - /summary              — Summary of all pending tasks across all topics
 *  - Smart AI with FUNCTION CALLING — auto-creates tasks, reminders, etc.
 *  - Conversation context memory — remembers recent messages per thread
 *  - Auto follow-up detection ("will update tomorrow", etc.)
 */

const opsDb = require("../services/ops-database");
const config = require("../config");

// ─── Conversation Context Memory ────────────────────────────
// Stores recent messages per thread so the AI remembers what it said.
// Key: `${chatId}:${threadId}` → Array of { role, content } (max 20 messages)
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
  // Keep only last MAX_MEMORY messages
  if (history.length > MAX_MEMORY) {
    history.splice(0, history.length - MAX_MEMORY);
  }
  conversationMemory.set(key, history);
}

// ─── Utility: extract args from /command or /command@botname ──

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
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
    return;
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

// ─── Markdown Escaping ──────────────────────────────────────

function escMd(text) {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Language Detection ─────────────────────────────────────

function detectMessageLanguage(text) {
  if (!text) return "en";
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = arabicChars + latinChars;
  if (totalLetters === 0) return "en";
  return arabicChars / totalLetters >= 0.3 ? "ar" : "en";
}

// ═══════════════════════════════════════════════════════════════
// ═══ OpenAI Function Calling — Tool Definitions ═══════════════
// ═══════════════════════════════════════════════════════════════

const OPS_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a single task/action item in the current topic. Use this when you identify something that needs to be done, tracked, or followed up on.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Clear, actionable task description. Be specific.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
            description: "Task priority level. Use 'urgent' for blockers, 'high' for time-sensitive items.",
          },
          assigned_to: {
            type: "string",
            description: "Optional @username or name of the person responsible. Leave empty if not clear.",
          },
          due_date: {
            type: "string",
            description: "Optional due date in YYYY-MM-DD format. Use today's date for urgent items.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tasks_batch",
      description: "Create multiple tasks at once. Use this when you identify several action items from a conversation or update. This is more efficient than calling create_task multiple times.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            description: "Array of tasks to create",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Clear, actionable task description",
                },
                priority: {
                  type: "string",
                  enum: ["low", "normal", "high", "urgent"],
                },
                assigned_to: { type: "string" },
                due_date: { type: "string" },
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
      description: "Set a timed reminder that will be sent to the group at the specified time. Use for deadlines, follow-ups, or scheduled check-ins.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The reminder message to send when the time comes",
          },
          time: {
            type: "string",
            description: "When to send the reminder. Accepts: '9am', '18:00', '2h' (2 hours from now), '30m', 'tomorrow 9am'",
          },
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
          task_id: {
            type: "integer",
            description: "The task ID number (e.g., from #123)",
          },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List all pending tasks in the current topic. Use when someone asks about pending tasks, what needs to be done, or wants a status update.",
      parameters: {
        type: "object",
        properties: {
          include_done: {
            type: "boolean",
            description: "Whether to include completed tasks. Default false.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_tasks_summary",
      description: "Get a summary of all pending tasks across ALL topics. Use when someone asks for a global overview or daily summary.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// ═══ Tool Execution Functions ═════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function executeTool(toolName, args, chatId, threadId, topicInfo, fromUser) {
  try {
    switch (toolName) {
      case "create_task": {
        const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, args.title, {
          priority: args.priority || "normal",
          assignedTo: args.assigned_to || null,
          dueDate: args.due_date || null,
          createdBy: fromUser,
        });
        const task = opsDb.getTaskById(taskId);
        return {
          success: true,
          task_id: taskId,
          title: args.title,
          priority: args.priority || "normal",
          assigned_to: args.assigned_to || null,
          due_date: args.due_date || null,
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
            createdBy: fromUser,
          });
          created.push({
            task_id: taskId,
            title: t.title,
            priority: t.priority || "normal",
            assigned_to: t.assigned_to || null,
            due_date: t.due_date || null,
          });
        }
        return {
          success: true,
          tasks_created: created.length,
          tasks: created,
          message: `Created ${created.length} tasks successfully.`,
        };
      }

      case "create_reminder": {
        const remindAt = parseReminderTime(args.time);
        if (!remindAt) {
          return {
            success: false,
            error: `Could not parse time: "${args.time}". Use formats like 9am, 18:00, 2h, 30m, tomorrow 9am.`,
          };
        }
        opsDb.addReminder(chatId, threadId, topicInfo.name, args.message, remindAt, fromUser);
        const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
        const timeDisplay = ksaTime.toLocaleString("en-US", {
          timeZone: "Asia/Riyadh",
          hour: "2-digit",
          minute: "2-digit",
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        return {
          success: true,
          message: args.message,
          remind_at: timeDisplay,
          time_ksa: timeDisplay,
        };
      }

      case "mark_task_done": {
        const task = opsDb.getTaskById(args.task_id);
        if (!task || task.chat_id !== chatId) {
          return { success: false, error: `Task #${args.task_id} not found.` };
        }
        if (task.status === "done") {
          return { success: false, error: `Task #${args.task_id} is already completed.` };
        }
        opsDb.markTaskDone(args.task_id);
        return {
          success: true,
          task_id: args.task_id,
          title: task.title,
          message: `Task #${args.task_id} marked as done: "${task.title}"`,
        };
      }

      case "list_tasks": {
        const tasks = opsDb.getTasksByThread(chatId, threadId);
        const pending = tasks.filter((t) => t.status === "pending");
        const done = tasks.filter((t) => t.status === "done");

        if (pending.length === 0 && done.length === 0) {
          return { success: true, pending: [], done: [], message: "No tasks in this topic." };
        }

        const result = {
          success: true,
          pending_count: pending.length,
          done_count: done.length,
          pending: pending.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            assigned_to: t.assigned_to,
            due_date: t.due_date,
          })),
          done: args.include_done
            ? done.slice(0, 10).map((t) => ({ id: t.id, title: t.title }))
            : [],
        };
        return result;
      }

      case "get_all_tasks_summary": {
        const allTasks = opsDb.getAllPendingTasks(chatId);
        const stats = opsDb.getTaskStats(chatId);

        const byTopic = {};
        for (const task of allTasks) {
          const key = task.topic_name || "General";
          if (!byTopic[key]) byTopic[key] = [];
          byTopic[key].push({
            id: task.id,
            title: task.title,
            priority: task.priority,
            assigned_to: task.assigned_to,
          });
        }

        return {
          success: true,
          total_pending: stats.pending,
          total_done: stats.done,
          by_topic: byTopic,
        };
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
      ? "\n\n⚠️ CRITICAL: The user wrote in Arabic. You MUST reply entirely in Arabic. Do not use English."
      : "\n\n⚠️ CRITICAL: The user wrote in English. You MUST reply entirely in English. Do not use Arabic.";

  const today = new Date().toISOString().split("T")[0];

  return `You are the smart operations assistant for Monthly Key (المفتاح الشهري), a monthly rental platform in Saudi Arabia. You are inside the internal "Daily Operations HQ" Telegram group, in the topic: "${topicInfo.name}".

Today's date: ${today}

## YOUR CORE BEHAVIOR — BE ACTION-ORIENTED, NOT CONVERSATIONAL

You are an EXECUTOR, not a chatbot. When you see action items, tasks, or things that need to be done:
1. **IMMEDIATELY use your tools to create them** — do NOT just list them and ask "would you like me to create these?"
2. **Extract tasks from context** — when someone posts an update with issues, action items, or to-dos, create tasks for ALL of them automatically
3. **When the user says "yes", "create them", "do it", "go ahead", "create task reminders", etc.** — look at your previous messages in the conversation, find the action items you mentioned, and CREATE THEM using create_tasks_batch. Do NOT ask for details again.
4. **Be proactive** — if the conversation implies something needs tracking, create a task for it
5. **Always confirm what you DID** — after creating tasks/reminders, show a clean summary of what was created with task IDs

## TOOL USAGE RULES
- Use create_tasks_batch when there are 2+ action items (more efficient than individual calls)
- Use create_task for a single item
- Use create_reminder for time-sensitive follow-ups
- Use mark_task_done when someone reports completing something
- Use list_tasks to show current status
- Use get_all_tasks_summary for cross-topic overviews
- You can call MULTIPLE tools in a single response when needed

## WHAT NOT TO DO
- ❌ Do NOT say "Would you like me to create tasks for these?" — just CREATE them
- ❌ Do NOT ask for task details when the context already has them
- ❌ Do NOT have back-and-forth conversations about creating tasks
- ❌ Do NOT give generic advice — take ACTION
- ❌ Do NOT repeat information the user already told you

## RESPONSE STYLE
- Be concise and structured
- Use bullet points and task references (#ID)
- After executing tools, give a brief confirmation summary
- If you created tasks, show them in a clean list with their IDs${langInstruction}`;
}

// ─── Command Handlers ────────────────────────────────────────

async function handleOpsTask(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  const text = ctx.message.text || "";
  const title = extractCommandArgs(text, "task");

  if (!title) {
    const lang = detectMessageLanguage(text);
    const msg =
      lang === "ar"
        ? `⬜ *إضافة مهمة جديدة*\n\nالاستخدام:\n\`/task وصف المهمة\`\n\nمثال:\n\`/task التواصل مع شركة موبايلي للحصول على عرض سعر\``
        : `⬜ *Add a new task*\n\nUsage:\n\`/task task description\`\n\nExample:\n\`/task Contact Mobily for a price quote\``;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, title, { createdBy });

  const lang = detectMessageLanguage(title);
  const reply =
    lang === "ar"
      ? `✅ *تم إضافة المهمة #${taskId}*\n\n⬜ ${escMd(title)}\n\n📍 ${escMd(topicInfo.name)}\n\nاستخدم /done ${taskId} عند الانتهاء`
      : `✅ *Task #${taskId} created*\n\n⬜ ${escMd(title)}\n\n📍 ${escMd(topicInfo.name)}\n\nUse /done ${taskId} when complete`;

  await ctx.reply(reply, { parse_mode: "MarkdownV2", message_thread_id: threadId });
}

async function handleOpsChecklist(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "checklist");

  if (!argsText) {
    return ctx.reply(
      `📋 *إنشاء قائمة مهام*\n\nالاستخدام:\n\`/checklist مهمة 1 | مهمة 2 | مهمة 3\`\n\nمثال:\n\`/checklist تجهيز الإنترنت في مزرعة | الحصول على عرض سعر من موبايلي | جدولة زيارة الموقع\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const items = argsText
    .split(/\||\n/)
    .map((s) => s.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter((s) => s.length > 0);

  if (items.length === 0) {
    return ctx.reply("❌ لم يتم العثور على مهام. استخدم | للفصل بين المهام.", { message_thread_id: threadId });
  }

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const taskIds = [];

  for (const item of items) {
    const id = opsDb.addTask(chatId, threadId, topicInfo.name, item, { createdBy });
    taskIds.push({ id, title: item });
  }

  let reply = `📋 *قائمة المهام الجديدة — ${escMd(topicInfo.name)}*\n\n`;
  taskIds.forEach(({ id, title }, i) => {
    reply += `${i + 1}\\. ⬜ ${escMd(title)} \\[#${id}\\]\n`;
  });
  reply += `\n✏️ استخدم \`/done [رقم المهمة]\` عند الانتهاء`;

  await ctx.reply(reply, { parse_mode: "MarkdownV2", message_thread_id: threadId });
}

async function handleOpsTasks(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  const tasks = opsDb.getTasksByThread(chatId, threadId);

  if (tasks.length === 0) {
    return ctx.reply(
      `${topicInfo.emoji} *${escMd(topicInfo.name)}*\n\n✨ لا توجد مهام في هذا الموضوع\\.\n\nأضف مهمة جديدة:\n\`/task وصف المهمة\``,
      { parse_mode: "MarkdownV2", message_thread_id: threadId }
    );
  }

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done");

  let reply = `${topicInfo.emoji} *${escMd(topicInfo.name)}* — المهام\n\n`;

  if (pending.length > 0) {
    reply += `*⬜ قيد التنفيذ \\(${pending.length}\\):*\n`;
    pending.forEach((task, i) => {
      const priority = task.priority === "urgent" ? " 🔴" : task.priority === "high" ? " 🟠" : "";
      const assignee = task.assigned_to ? ` → ${escMd(task.assigned_to)}` : "";
      reply += `${i + 1}\\. ⬜ ${escMd(task.title)}${priority}${assignee} \\[\\#${task.id}\\]\n`;
    });
  }

  if (done.length > 0) {
    reply += `\n*✅ مكتملة \\(${done.length}\\):*\n`;
    done.slice(0, 5).forEach((task) => {
      reply += `✅ ${escMd(task.title)} \\[\\#${task.id}\\]\n`;
    });
    if (done.length > 5) reply += `_\\.\\.\\. و ${done.length - 5} أخرى_\n`;
  }

  if (pending.length > 0) {
    reply += `\n✏️ \`/done [رقم]\` للإنهاء`;
  }

  await ctx.reply(reply, { parse_mode: "MarkdownV2", message_thread_id: threadId });
}

async function handleOpsDone(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "done");
  const taskId = parseInt(args, 10);

  if (!taskId || isNaN(taskId)) {
    const tasks = opsDb.getPendingTasksByThread(chatId, threadId);
    if (tasks.length === 0) {
      return ctx.reply("✅ لا توجد مهام معلقة في هذا الموضوع.", { message_thread_id: threadId });
    }
    let reply = `✅ *إنهاء مهمة*\n\nاستخدم: \`/done [رقم المهمة]\`\n\n*المهام المعلقة:*\n`;
    tasks.forEach((task, i) => {
      reply += `${i + 1}. ⬜ ${task.title} [#${task.id}]\n`;
    });
    return ctx.reply(reply, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) {
    return ctx.reply(`❌ لم يتم العثور على المهمة #${taskId}.`, { message_thread_id: threadId });
  }
  if (task.status === "done") {
    return ctx.reply(`✅ المهمة #${taskId} مكتملة بالفعل.`, { message_thread_id: threadId });
  }

  opsDb.markTaskDone(taskId);

  await ctx.reply(
    `✅ *تم إنهاء المهمة #${taskId}*\n\n~~${escMd(task.title)}~~\n\n🎉 أحسنت\\!`,
    { parse_mode: "MarkdownV2", message_thread_id: threadId }
  );
}

async function handleOpsRemind(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "remind");

  if (!argsText) {
    return ctx.reply(
      `⏰ *تعيين تذكير*\n\nالاستخدام:\n\`/remind [الوقت] [الرسالة]\`\n\nأمثلة:\n• \`/remind 9am اجتماع مع الفريق\`\n• \`/remind 2h متابعة العميل\`\n• \`/remind tomorrow 9am مراجعة التقارير\`\n• \`/remind 18:00 تحديث تقرير اليوم\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  let timeStr, message;
  const tomorrowMatch = argsText.match(/^(tomorrow\s+\S+)\s+(.+)$/i);
  if (tomorrowMatch) {
    timeStr = tomorrowMatch[1];
    message = tomorrowMatch[2];
  } else {
    const parts = argsText.split(/\s+/);
    timeStr = parts[0];
    message = parts.slice(1).join(" ");
  }

  if (!message) {
    return ctx.reply("❌ يرجى تحديد رسالة التذكير.\n\nمثال: `/remind 9am اجتماع مع الفريق`", {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });
  }

  const remindAt = parseReminderTime(timeStr);
  if (!remindAt) {
    return ctx.reply(
      `❌ لم أتمكن من فهم الوقت: \`${timeStr}\`\n\nاستخدم: \`9am\`, \`18:00\`, \`2h\`, \`30m\`, \`tomorrow 9am\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  opsDb.addReminder(chatId, threadId, topicInfo.name, message, remindAt, createdBy);

  const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
  const timeDisplay = ksaTime.toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  await ctx.reply(
    `⏰ *تم تعيين التذكير*\n\n📝 ${escMd(message)}\n🕐 ${escMd(timeDisplay)} \\(توقيت الرياض\\)`,
    { parse_mode: "MarkdownV2", message_thread_id: threadId }
  );
}

async function handleOpsSummary(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;

  const allTasks = opsDb.getAllPendingTasks(chatId);

  if (allTasks.length === 0) {
    return ctx.reply(
      `📊 *ملخص المهام*\n\n✨ لا توجد مهام معلقة في أي موضوع\\. عمل رائع\\!`,
      { parse_mode: "MarkdownV2", message_thread_id: threadId }
    );
  }

  const byTopic = {};
  for (const task of allTasks) {
    const key = task.topic_name || "General";
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(task);
  }

  const stats = opsDb.getTaskStats(chatId);
  let reply = `📊 *ملخص المهام المعلقة*\n`;
  reply += `📌 إجمالي: ${stats.pending} معلقة / ${stats.done} مكتملة\n\n`;

  for (const [topicName, tasks] of Object.entries(byTopic)) {
    const emoji = getEmojiFromName(topicName);
    reply += `${emoji} *${escMd(topicName)}* \\(${tasks.length}\\):\n`;
    tasks.slice(0, 5).forEach((task, i) => {
      reply += `  ${i + 1}\\. ⬜ ${escMd(task.title)} \\[\\#${task.id}\\]\n`;
    });
    if (tasks.length > 5) reply += `  _\\.\\.\\. و ${tasks.length - 5} أخرى_\n`;
    reply += "\n";
  }

  await ctx.reply(reply, { parse_mode: "MarkdownV2", message_thread_id: threadId });
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

  // Only send AI response if bot was mentioned or replied to
  const botUsername = ctx.botInfo?.username || "monthlykey_bot";
  const isMentioned = text.includes(`@${botUsername}`);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;

  if (!isMentioned && !isReplyToBot) {
    return;
  }

  // Strip the @mention
  const cleanText = text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();

  // Show typing
  try {
    await ctx.sendChatAction("typing");
  } catch (e) {}

  try {
    const msgLang = detectMessageLanguage(cleanText);
    const systemPrompt = buildSystemPrompt(topicInfo, msgLang);

    // Build messages with conversation history
    const history = getConversationHistory(chatId, threadId);
    const messages = [{ role: "system", content: systemPrompt }];

    // Add recent conversation history (last 10 messages for context)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push(msg);
    }

    // Add the current user message
    const userContent = cleanText || (msgLang === "ar" ? "مرحباً" : "Hello");

    // If replying to a bot message, include the original bot message as context
    if (isReplyToBot && ctx.message.reply_to_message?.text) {
      const repliedText = ctx.message.reply_to_message.text;
      messages.push({
        role: "user",
        content: `[Replying to the bot's previous message: "${repliedText.substring(0, 1000)}"]\n\nUser says: ${userContent}`,
      });
    } else {
      messages.push({ role: "user", content: `${fromUser} says: ${userContent}` });
    }

    // Store user message in memory
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
    const MAX_LOOPS = 5;

    // Process tool calls in a loop (AI may call multiple tools)
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && loopCount < MAX_LOOPS) {
      loopCount++;

      // Show typing while processing tools
      try {
        await ctx.sendChatAction("typing");
      } catch (e) {}

      // Add assistant message with tool calls to the conversation
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs;
        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          toolArgs = {};
        }

        console.log(`[Ops] Executing tool: ${toolName}`, JSON.stringify(toolArgs).substring(0, 200));

        const result = executeTool(toolName, toolArgs, chatId, threadId, topicInfo, fromUser);
        allToolResults.push({ tool: toolName, args: toolArgs, result });

        // Add tool result to messages for the next AI call
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Call AI again with tool results so it can generate a response
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

    // Get the final text response
    let aiReply = assistantMessage?.content || "";

    // If AI returned no text but executed tools, build a summary
    if (!aiReply && allToolResults.length > 0) {
      aiReply = buildToolResultsSummary(allToolResults, msgLang);
    }

    // Fallback
    if (!aiReply) {
      aiReply = msgLang === "ar" ? "تم." : "Done.";
    }

    // Add follow-up note if detected
    if (followUpDelay) {
      const ksaOffset = 3 * 60 * 60 * 1000;
      const followUpAt = calculateFollowUpTime(followUpDelay);
      const ksaTime = new Date(new Date(followUpAt.replace(" ", "T") + "Z").getTime() + ksaOffset);
      const timeDisplay = ksaTime.toLocaleString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      });
      if (msgLang === "ar") {
        aiReply += `\n\n📌 _تم تسجيل متابعة تلقائية لـ ${fromUser} — سيتم التذكير ${timeDisplay}_`;
      } else {
        aiReply += `\n\n📌 _Auto follow-up registered for ${fromUser} — reminder set for ${timeDisplay}_`;
      }
    }

    // Store assistant reply in memory
    addToConversation(chatId, threadId, "assistant", aiReply);

    // Send the reply
    try {
      await ctx.reply(aiReply, {
        parse_mode: "Markdown",
        message_thread_id: threadId,
      });
    } catch (mdError) {
      // If Markdown fails, send as plain text
      console.warn("[Ops] Markdown parse failed, sending as plain text");
      await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), {
        message_thread_id: threadId,
      });
    }
  } catch (error) {
    console.error("[Ops] AI error:", error.message);
    const errMsg =
      detectMessageLanguage(cleanText) === "en"
        ? `⚙️ Processing error. You can use commands directly:\n• /task [description]\n• /tasks\n• /done [number]\n• /summary`
        : `⚙️ حدث خطأ في المعالجة. يمكنك استخدام الأوامر مباشرة:\n• /task [مهمة]\n• /tasks\n• /done [رقم]\n• /summary`;
    await ctx.reply(errMsg, { message_thread_id: threadId });
  }
}

// ─── Build a summary when AI returns no text after tool calls ──

function buildToolResultsSummary(toolResults, lang) {
  const lines = [];

  for (const { tool, result } of toolResults) {
    if (!result.success) {
      lines.push(lang === "ar" ? `❌ خطأ: ${result.error}` : `❌ Error: ${result.error}`);
      continue;
    }

    switch (tool) {
      case "create_task":
        lines.push(
          lang === "ar"
            ? `✅ تم إنشاء المهمة #${result.task_id}: ${result.title}`
            : `✅ Created task #${result.task_id}: ${result.title}`
        );
        break;

      case "create_tasks_batch":
        if (lang === "ar") {
          lines.push(`✅ تم إنشاء ${result.tasks_created} مهام:`);
          for (const t of result.tasks) {
            const prio = t.priority === "urgent" ? " 🔴" : t.priority === "high" ? " 🟠" : "";
            const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
            lines.push(`  • #${t.task_id} — ${t.title}${prio}${assignee}`);
          }
        } else {
          lines.push(`✅ Created ${result.tasks_created} tasks:`);
          for (const t of result.tasks) {
            const prio = t.priority === "urgent" ? " 🔴" : t.priority === "high" ? " 🟠" : "";
            const assignee = t.assigned_to ? ` → ${t.assigned_to}` : "";
            lines.push(`  • #${t.task_id} — ${t.title}${prio}${assignee}`);
          }
        }
        break;

      case "create_reminder":
        lines.push(
          lang === "ar"
            ? `⏰ تم تعيين تذكير: "${result.message}" — ${result.time_ksa}`
            : `⏰ Reminder set: "${result.message}" — ${result.time_ksa}`
        );
        break;

      case "mark_task_done":
        lines.push(
          lang === "ar"
            ? `✅ تم إنهاء المهمة #${result.task_id}: ${result.title}`
            : `✅ Completed task #${result.task_id}: ${result.title}`
        );
        break;

      case "list_tasks":
        if (result.pending_count === 0) {
          lines.push(lang === "ar" ? "✨ لا توجد مهام معلقة." : "✨ No pending tasks.");
        } else {
          lines.push(
            lang === "ar"
              ? `📋 المهام المعلقة (${result.pending_count}):`
              : `📋 Pending tasks (${result.pending_count}):`
          );
          for (const t of result.pending) {
            const prio = t.priority === "urgent" ? " 🔴" : t.priority === "high" ? " 🟠" : "";
            lines.push(`  • #${t.id} — ${t.title}${prio}`);
          }
        }
        break;

      case "get_all_tasks_summary":
        lines.push(
          lang === "ar"
            ? `📊 ملخص: ${result.total_pending} معلقة / ${result.total_done} مكتملة`
            : `📊 Summary: ${result.total_pending} pending / ${result.total_done} done`
        );
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

  // Store all messages in conversation memory for context
  if (text.length > 0) {
    addToConversation(chatId, threadId, "user", `${fromUser}: ${text}`);
  }

  // Detect follow-up promises silently
  if (text.length > 5) {
    const followUpDelay = detectFollowUpPromise(text);
    if (followUpDelay) {
      const followUpAt = calculateFollowUpTime(followUpDelay);
      opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, followUpAt);
      console.log(`[Ops] Follow-up detected from ${fromUser} in ${topicInfo.name}, due: ${followUpAt}`);
    }
  }
}

// ─── Topic Registration ─────────────────────────────────────

function registerTopicName(threadId, name) {
  if (!threadId || !name) return;
  threadTopicMap[threadId] = {
    name,
    role: getRoleFromName(name),
    emoji: getEmojiFromName(name),
  };
  console.log(`[Ops] Registered topic: #${threadId} → ${name}`);
}

module.exports = {
  handleOpsTask,
  handleOpsChecklist,
  handleOpsTasks,
  handleOpsDone,
  handleOpsRemind,
  handleOpsSummary,
  handleOpsMessage,
  handleOpsPassive,
  registerTopicName,
  getTopicInfo,
  detectFollowUpPromise,
  calculateFollowUpTime,
};
