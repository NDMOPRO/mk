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
 *  - Smart topic-aware responses when @mentioned
 *  - Auto follow-up detection ("will update tomorrow", etc.)
 */

const opsDb = require("../services/ops-database");
const config = require("../config");

// ─── Utility: extract args from /command or /command@botname ──

/**
 * Extract the arguments from a command message, handling both:
 *   /task description
 *   /task@monthlykey_bot description
 * Returns the text after the command (and optional @mention), trimmed.
 */
function extractCommandArgs(text, command) {
  if (!text) return "";
  // Match /command or /command@anything at the start, case-insensitive
  const re = new RegExp(`^\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

// ─── Topic Map ───────────────────────────────────────────────
// Maps Telegram thread IDs to topic names.
// These are populated dynamically as the bot sees messages in each topic.
// We also maintain a static name map for the known topics.
const TOPIC_NAMES = {
  // thread_id → name (will be populated from forum topic names seen in messages)
  // Fallback names based on the group structure
};

// Known topic names by their numeric IDs (filled in as we see messages)
// We detect topic name from ctx.message.reply_to_message?.forum_topic_created?.name
// or from ctx.message.forum_topic_created?.name

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

// Runtime map: thread_id (number) → topic info
const threadTopicMap = {};

/**
 * Get topic info for a given thread_id.
 * Returns { name, role, emoji } or a default.
 */
function getTopicInfo(threadId) {
  if (!threadId) return { name: "General", role: "general", emoji: "💬" };
  if (threadTopicMap[threadId]) return threadTopicMap[threadId];
  // Try to match by number prefix in the known names
  return { name: `Topic #${threadId}`, role: "general", emoji: "💬" };
}

/**
 * Register a topic name from a message context.
 * Telegram sends forum_topic_created for new topics, but we can also
 * infer from the reply_to_message.
 */
function registerTopicFromCtx(ctx) {
  const threadId = ctx.message?.message_thread_id;
  if (!threadId || threadTopicMap[threadId]) return;

  // Try to get topic name from the message itself
  const topicCreated = ctx.message?.forum_topic_created;
  if (topicCreated?.name) {
    const name = topicCreated.name;
    threadTopicMap[threadId] = { name, role: getRoleFromName(name), emoji: getEmojiFromName(name) };
    return;
  }

  // Try to match from known topic names by number prefix
  // e.g., "02 — Operations Follow-Up" → prefix "02"
  for (const [prefix, info] of Object.entries(TOPIC_CONTEXT)) {
    // We'll populate this when we see the topic name in messages
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
  // English patterns
  { regex: /\b(will|i'll|i will|gonna|going to)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(tomorrow|tonight|later|this evening|by end of day|eod|by morning)\b/i, delay: "tomorrow_morning" },
  { regex: /\b(will|i'll|i will)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(by\s+\d+\s*(am|pm|:))/i, delay: "today_evening" },
  { regex: /\b(will|i'll|i will)\s+(update|do|send|check|follow|complete|finish|handle|fix|review|share)\b.*\b(in\s+\d+\s*(hour|hr|minute|min))/i, delay: "few_hours" },
  { regex: /\b(will\s+get\s+back|will\s+revert|will\s+respond|will\s+reply)\b/i, delay: "tomorrow_morning" },
  { regex: /\b(checking|looking into|will check|let me check)\b.*\b(and\s+update|and\s+confirm|and\s+let\s+you\s+know)\b/i, delay: "today_evening" },
  // Arabic patterns
  { regex: /\b(سأ|سوف|هأ|بكره|بكرة)\b/u, delay: "tomorrow_morning" },
  { regex: /سأ(رد|تابع|أتابع|أرسل|أرد|أراجع|أحدث|أنهي|أكمل)/u, delay: "tomorrow_morning" },
  { regex: /(بكره|بكرة|غداً|غدا|الصبح|الصباح)/u, delay: "tomorrow_morning" },
  { regex: /(المساء|العصر|الليل|بعد\s+قليل|خلال\s+ساعة)/u, delay: "today_evening" },
];

/**
 * Detect if a message contains a follow-up promise.
 * Returns the delay type or null.
 */
function detectFollowUpPromise(text) {
  for (const pattern of FOLLOWUP_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.delay;
    }
  }
  return null;
}

/**
 * Calculate the follow-up datetime based on delay type.
 * All times are in KSA (UTC+3).
 */
function calculateFollowUpTime(delayType) {
  const now = new Date();
  // KSA is UTC+3
  const ksaOffset = 3 * 60 * 60 * 1000;
  const ksaNow = new Date(now.getTime() + ksaOffset);

  let followUpKSA;

  if (delayType === "tomorrow_morning") {
    // Next day at 9:30 AM KSA
    followUpKSA = new Date(ksaNow);
    followUpKSA.setDate(followUpKSA.getDate() + 1);
    followUpKSA.setHours(9, 30, 0, 0);
  } else if (delayType === "today_evening") {
    // Today at 6:00 PM KSA (if already past 6 PM, use tomorrow 9:30 AM)
    followUpKSA = new Date(ksaNow);
    followUpKSA.setHours(18, 0, 0, 0);
    if (followUpKSA <= ksaNow) {
      followUpKSA.setDate(followUpKSA.getDate() + 1);
      followUpKSA.setHours(9, 30, 0, 0);
    }
  } else if (delayType === "few_hours") {
    // 3 hours from now
    followUpKSA = new Date(ksaNow.getTime() + 3 * 60 * 60 * 1000);
  } else {
    // Default: tomorrow morning
    followUpKSA = new Date(ksaNow);
    followUpKSA.setDate(followUpKSA.getDate() + 1);
    followUpKSA.setHours(9, 30, 0, 0);
  }

  // Convert back to UTC for storage
  const followUpUTC = new Date(followUpKSA.getTime() - ksaOffset);
  return followUpUTC.toISOString().replace("T", " ").substring(0, 19);
}

// ─── Parse /remind time argument ────────────────────────────

/**
 * Parse a time string like "9am", "18:00", "2h", "30m", "tomorrow 9am"
 * Returns a UTC ISO datetime string or null.
 */
function parseReminderTime(timeStr) {
  const ksaOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const ksaNow = new Date(now.getTime() + ksaOffset);

  // Relative: "2h", "30m", "2hours", "30minutes"
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

  // Absolute today: "9am", "9:30am", "18:00", "6pm"
  const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2] || "0");
    const ampm = (timeMatch[3] || "").toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    const target = new Date(ksaNow);
    target.setHours(hours, mins, 0, 0);
    if (target <= ksaNow) target.setDate(target.getDate() + 1); // next day if past

    const utc = new Date(target.getTime() - ksaOffset);
    return utc.toISOString().replace("T", " ").substring(0, 19);
  }

  // "tomorrow [time]"
  const tomorrowMatch = timeStr.match(/^tomorrow\s*(.*)$/i);
  if (tomorrowMatch) {
    const rest = tomorrowMatch[1].trim() || "9am";
    const inner = parseReminderTime(rest);
    if (inner) {
      // Add 24h to whatever was parsed
      const d = new Date(inner.replace(" ", "T") + "Z");
      d.setDate(d.getDate() + 1);
      return d.toISOString().replace("T", " ").substring(0, 19);
    }
  }

  return null;
}

// ─── Format task list ────────────────────────────────────────

function formatTaskList(tasks, topicInfo, showDone = false) {
  const pending = tasks.filter(t => t.status === "pending");
  const done    = tasks.filter(t => t.status === "done");

  if (pending.length === 0 && done.length === 0) {
    return `${topicInfo.emoji} *${topicInfo.name}*\n\n✨ لا توجد مهام حالياً.`;
  }

  let text = `${topicInfo.emoji} *${topicInfo.name}* — المهام\n\n`;

  if (pending.length > 0) {
    text += `*⬜ قيد التنفيذ (${pending.length}):*\n`;
    pending.forEach((task, i) => {
      const priority = task.priority === "urgent" ? " 🔴" : task.priority === "high" ? " 🟠" : "";
      const assignee = task.assigned_to ? ` → ${task.assigned_to}` : "";
      const due = task.due_date ? ` 📅 ${task.due_date}` : "";
      text += `${i + 1}\\. ⬜ ${escMd(task.title)}${priority}${assignee}${due} \\[#${task.id}\\]\n`;
    });
  }

  if (showDone && done.length > 0) {
    text += `\n*✅ مكتملة (${done.length}):*\n`;
    done.slice(0, 5).forEach((task) => {
      text += `✅ ~~${escMd(task.title)}~~ \\[#${task.id}\\]\n`;
    });
  }

  return text;
}

function escMd(text) {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Language Detection ─────────────────────────────────────

/**
 * Detect whether a message is primarily Arabic or English.
 * Returns 'ar' if more than 30% of letter characters are Arabic script,
 * otherwise returns 'en'.
 */
function detectMessageLanguage(text) {
  if (!text) return 'en';
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars  = (text.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = arabicChars + latinChars;
  if (totalLetters === 0) return 'en';
  return (arabicChars / totalLetters) >= 0.3 ? 'ar' : 'en';
}

// ─── Smart topic-aware AI response ──────────────────────────

function getTopicSystemPrompt(topicInfo) {
  const base = `You are the operations assistant for Monthly Key (المفتاح الشهري), a monthly rental platform in Saudi Arabia. You are operating inside the internal Daily Operations HQ group on Telegram. You are context-aware of the current topic: "${topicInfo.name}".

Always respond in the same language the user wrote in (Arabic or English). Be concise, practical, and action-oriented. Do NOT give generic customer service replies. Focus on operational tasks, follow-ups, and actionable next steps.`;

  // Language-specific override appended per-call — see handleOpsMessage

  const rolePrompts = {
    ceo_update: `${base}\n\nYou are in the CEO Daily Update topic. Help summarize key metrics, flag blockers, and structure daily updates. Ask about: bookings today, revenue, operational issues, and tomorrow's priorities.`,
    operations: `${base}\n\nYou are in the Operations Follow-Up topic. Help track operational tasks, follow up on pending items, and ensure nothing falls through the cracks. Suggest creating tasks with /task if something needs tracking.`,
    listings: `${base}\n\nYou are in the Listings & Inventory topic. Help manage property listings, track new properties being added, and flag inventory issues. Suggest /task for any listing action items.`,
    bookings: `${base}\n\nYou are in the Bookings & Revenue topic. Help track bookings, revenue figures, and payment status. Suggest /task for any booking follow-up needed.`,
    support: `${base}\n\nYou are in the Customer Support & Complaints topic. Help track customer issues, suggest resolutions, and ensure complaints are followed up. Use /task to create follow-up items for unresolved issues.`,
    tech: `${base}\n\nYou are in the Website & Tech Issues topic. Help track technical bugs, website issues, and development tasks. Suggest /task for any tech items that need tracking.`,
    finance: `${base}\n\nYou are in the Payments & Finance topic. Help track payment issues, pending transactions, and financial follow-ups. Suggest /task for any finance action items.`,
    marketing: `${base}\n\nYou are in the Marketing & Content topic. Help with content planning, marketing tasks, and campaign tracking. Suggest /task for any marketing action items.`,
    legal: `${base}\n\nYou are in the Legal / Compliance / Government topic. Help track legal tasks, compliance requirements, and government-related follow-ups. Suggest /task for any legal action items.`,
    blockers: `${base}\n\nYou are in the Blockers & Escalations topic. This is for urgent issues that need immediate attention. Help identify the blocker, suggest solutions, and escalate appropriately. Always suggest /task to track resolution.`,
    completed: `${base}\n\nYou are in the Completed Today topic. Help summarize what was accomplished, celebrate wins, and suggest moving items to Tomorrow Priorities if needed.`,
    priorities: `${base}\n\nYou are in the Tomorrow Priorities topic. Help structure tomorrow's priorities, ensure they are specific and actionable, and suggest /task to track them.`,
    general: `${base}\n\nYou are in a general operations topic. Help with any operational questions and suggest appropriate task management commands.`,
  };

  return rolePrompts[topicInfo.role] || rolePrompts.general;
}

// ─── Command Handlers ────────────────────────────────────────

/**
 * /task [description] — Add a single task in the current topic
 */
async function handleOpsTask(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  // Extract task title from command args (handles /task and /task@botname)
  const text = ctx.message.text || "";
  const title = extractCommandArgs(text, "task");

  if (!title) {
    return ctx.reply(
      `⬜ *إضافة مهمة جديدة*\n\nالاستخدام:\n\`/task وصف المهمة\`\n\nمثال:\n\`/task التواصل مع شركة موبايلي للحصول على عرض سعر\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, title, { createdBy });

  await ctx.reply(
    `✅ *تم إضافة المهمة #${taskId}*\n\n⬜ ${escMd(title)}\n\n📍 ${escMd(topicInfo.name)}\n\nاستخدم /done ${taskId} عند الانتهاء`,
    { parse_mode: "MarkdownV2", message_thread_id: threadId }
  );
}

/**
 * /checklist item1 | item2 | item3
 * Or: /checklist "item1" "item2" "item3"
 */
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

  // Split by | or newline
  const items = argsText
    .split(/\||\n/)
    .map(s => s.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(s => s.length > 0);

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

/**
 * /tasks — List all pending tasks in the current topic
 */
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

  const pending = tasks.filter(t => t.status === "pending");
  const done    = tasks.filter(t => t.status === "done");

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

/**
 * /done [task_number] — Mark a task as complete
 */
async function handleOpsDone(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "done");
  const taskId = parseInt(args, 10);

  if (!taskId || isNaN(taskId)) {
    // Show pending tasks for this thread so user can pick
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

/**
 * /remind [time] [message]
 * Examples:
 *   /remind 9am اجتماع مع الفريق
 *   /remind 2h متابعة العميل
 *   /remind tomorrow 9am مراجعة التقارير
 */
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

  // Parse: first word(s) are time, rest is message
  // Handle "tomorrow 9am" as two-word time
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

  // Show the time in KSA
  const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 60 * 60 * 1000);
  const timeDisplay = ksaTime.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });

  await ctx.reply(
    `⏰ *تم تعيين التذكير*\n\n📝 ${escMd(message)}\n🕐 ${escMd(timeDisplay)} \\(توقيت الرياض\\)`,
    { parse_mode: "MarkdownV2", message_thread_id: threadId }
  );
}

/**
 * /summary — Summary of all pending tasks across all topics
 */
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

  // Group by topic
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

// ─── Smart Group Message Handler ─────────────────────────────

/**
 * Handle a regular text message in the ops group.
 * Called when bot is @mentioned or replied to.
 * Uses topic-aware AI response.
 */
async function handleOpsMessage(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  // Register topic if we haven't seen it before
  registerTopicFromCtx(ctx);

  // Detect follow-up promise in the message
  const text = ctx.message.text || "";
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  // Check for follow-up promise in ALL messages (not just @mentions)
  const followUpDelay = detectFollowUpPromise(text);
  if (followUpDelay) {
    const followUpAt = calculateFollowUpTime(followUpDelay);
    opsDb.addFollowUp(chatId, threadId, topicInfo.name, text, fromUser, followUpAt);
    // Don't send a reply for follow-up detection unless bot was mentioned
  }

  // Only send AI response if bot was mentioned or replied to
  const botUsername = ctx.botInfo?.username || "monthlykey_bot";
  const isMentioned = text.includes(`@${botUsername}`);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;

  if (!isMentioned && !isReplyToBot) {
    // Still detect follow-ups silently
    return;
  }

  // Strip the @mention from the message for cleaner AI input
  const cleanText = text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();

  // Show typing
  try { await ctx.sendChatAction("typing"); } catch (e) {}

  try {
    const msgLang = detectMessageLanguage(cleanText);
    const langInstruction = msgLang === 'ar'
      ? '\n\n⚠️ IMPORTANT: The user wrote in Arabic. You MUST reply entirely in Arabic. Do not use any English words or sentences.'
      : '\n\n⚠️ IMPORTANT: The user wrote in English. You MUST reply entirely in English. Do not use any Arabic words or sentences.';

    const basePrompt = getTopicSystemPrompt(topicInfo);
    const systemPrompt = basePrompt + langInstruction;

    const response = await openaiClient.chat.completions.create({
      model: config.aiModel || "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: cleanText || (msgLang === 'ar' ? 'مرحباً، كيف يمكنك مساعدتي؟' : 'Hello, how can you help me?') },
      ],
      max_tokens: 600,
      temperature: 0.5,
    });

    const aiReply = response.choices[0]?.message?.content || "لم أتمكن من الإجابة.";

    // Add follow-up confirmation if we detected a promise
    let finalReply = aiReply;
    if (followUpDelay) {
      const ksaOffset = 3 * 60 * 60 * 1000;
      const followUpAt = calculateFollowUpTime(followUpDelay);
      const ksaTime = new Date(new Date(followUpAt.replace(" ", "T") + "Z").getTime() + ksaOffset);
      const timeDisplay = ksaTime.toLocaleString("ar-SA", {
        timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short"
      });
      // Follow-up note in the same language as the message
      if (msgLang === 'ar') {
        finalReply += `\n\n📌 _تم تسجيل متابعة تلقائية لـ ${fromUser} — سيتم التذكير ${timeDisplay}_`;
      } else {
        finalReply += `\n\n📌 _Auto follow-up registered for ${fromUser} — reminder set for ${timeDisplay}_`;
      }
    }

    await ctx.reply(finalReply, {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });
  } catch (error) {
    console.error("[Ops] AI error:", error.message);
    const errMsg = (detectMessageLanguage(cleanText) === 'en')
      ? `⚙️ Processing error. You can use commands directly:\n• /task [description]\n• /tasks\n• /done [number]\n• /summary`
      : `⚙️ حدث خطأ في المعالجة. يمكنك استخدام الأوامر مباشرة:\n• /task [مهمة]\n• /tasks\n• /done [رقم]\n• /summary`;
    await ctx.reply(errMsg, { message_thread_id: threadId });
  }
}

/**
 * Handle any message in the ops group (for passive follow-up detection).
 * This is called for ALL messages, not just @mentions.
 */
async function handleOpsPassive(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message?.text || "";
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  // Register topic name if we see it for the first time
  registerTopicFromCtx(ctx);

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

/**
 * Register a topic name when the bot sees a forum_topic_created event.
 */
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
