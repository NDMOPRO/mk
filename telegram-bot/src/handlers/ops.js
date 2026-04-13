/**
 * Operations Group Handler — v3 (21-Feature)
 * ─────────────────────────────────────────────────────────────
 * Handles ALL interactions in the Monthly Key Daily Operations HQ group.
 * Chat ID: -1003967447285
 *
 * All features now BILINGUAL (English + Arabic) with improved design.
 */

const opsDb = require("../services/ops-database");
const v4Db = require("../services/ops-database-v4");
const v5Db = require("../services/ops-database-v5");
const googleSync = require("../services/google-sync");
const config = require("../config");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Team members registry & deduplication
const { resolveTeamMember, getDisplayName, getDisplayNameAr, normalizeAssignee, getTeamDirectory } = require("../team-members");
const { findDuplicateTask } = require("../dedup");

// v5 handlers
const {
  handleOpsMlog, handleOpsWorkflow, handleOpsTemplate, handleOpsTrends, handleOpsWeather, handleOpsClean,
  handleOpsIdea, handleOpsIdeas, handleOpsBrainstorm, handleOpsPhotos, handlePhotoReviewCallback,
  handleIdeaVoteCallback
} = require("./ops-v5");

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
  [THREAD_IDS.RULES]: "00 — Rules & Guide | القواعد والدليل 📋",
  [THREAD_IDS.CEO_UPDATE]: "01 — CEO Update | تحديث المدير التنفيذي 📊",
  [THREAD_IDS.OPERATIONS]: "02 — Operations | المتابعة التشغيلية 🔧",
  [THREAD_IDS.LISTINGS]: "03 — Listings | العقارات والمخزون 🏠",
  [THREAD_IDS.BOOKINGS]: "04 — Bookings & Revenue | الحجوزات والإيرادات 💰",
  [THREAD_IDS.SUPPORT]: "05 — Support | دعم العملاء 🎧",
  [THREAD_IDS.TECH]: "06 — Tech Issues | المشاكل التقنية 💻",
  [THREAD_IDS.PAYMENTS]: "07 — Payments | المدفوعات والمالية 💳",
  [THREAD_IDS.MARKETING]: "08 — Marketing | التسويق والمحتوى 📣",
  [THREAD_IDS.LEGAL]: "09 — Legal | القانونية والامتثال ⚖️",
  [THREAD_IDS.BLOCKERS]: "10 — Blockers | العوائق والتصعيد 🚨",
  [THREAD_IDS.COMPLETED]: "11 — Completed | المنجز اليوم ✅",
  [THREAD_IDS.PRIORITIES]: "12 — Priorities | أولويات الغد 📌",
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
  // Markdown v1 only needs _ * ` [ escaped
  return String(text).replace(/([_*`\[])/g, "\\$1");
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

function getBilingualText(en, ar) {
  return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
}

// ─── Topic Map ───────────────────────────────────────────────

const TOPIC_CONTEXT = {
  "00": { name: "Rules & Guide", arName: "القواعد والدليل", role: "rules", emoji: "📋" },
  "01": { name: "Daily CEO Update", arName: "تحديث المدير التنفيذي", role: "ceo_update", emoji: "👔" },
  "02": { name: "Operations", arName: "المتابعة التشغيلية", role: "operations", emoji: "🔧" },
  "03": { name: "Listings & Inventory", arName: "العقارات والمخزون", role: "listings", emoji: "🏠" },
  "04": { name: "Bookings & Revenue", arName: "الحجوزات والإيرادات", role: "bookings", emoji: "💰" },
  "05": { name: "Customer Support", arName: "دعم العملاء", role: "support", emoji: "🎧" },
  "06": { name: "Tech Issues", arName: "المشاكل التقنية", role: "tech", emoji: "💻" },
  "07": { name: "Payments & Finance", arName: "المدفوعات والمالية", role: "finance", emoji: "💳" },
  "08": { name: "Marketing & Content", arName: "التسويق والمحتوى", role: "marketing", emoji: "📣" },
  "09": { name: "Legal", arName: "القانونية والامتثال", role: "legal", emoji: "⚖️" },
  "10": { name: "Blockers & Escalations", arName: "العوائق والتصعيد", role: "blockers", emoji: "🚨" },
  "11": { name: "Completed Today", arName: "المنجز اليوم", role: "completed", emoji: "✅" },
  "12": { name: "Tomorrow Priorities", arName: "أولويات الغد", role: "priorities", emoji: "📅" },
};

const threadTopicMap = {};
for (const [threadId, fullName] of Object.entries(TOPIC_FULL_NAMES)) {
  const tid = parseInt(threadId);
  const prefix = fullName.substring(0, 2);
  const info = TOPIC_CONTEXT[prefix];
  if (info) threadTopicMap[tid] = { name: info.name, arName: info.arName, role: info.role, emoji: info.emoji };
}

function getTopicInfo(threadId) {
  if (!threadId) return { name: "General", arName: "عام", role: "general", emoji: "💬" };
  if (threadTopicMap[threadId]) return threadTopicMap[threadId];
  return { name: `Topic #${threadId}`, arName: `موضوع #${threadId}`, role: "general", emoji: "💬" };
}

// ─── Command Handlers ──────────────────────────────────────

async function handleOpsTask(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "task");

  if (!argsText) {
    const en = `📌 *Create a task*\n\nUsage: \`/task [description] @assignee #property\``;
    const ar = `📌 *إنشاء مهمة*\n\nالاستخدام: \`/task [الوصف] @المسؤول #العقار\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const rawCreatedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const createdBy = getDisplayName(rawCreatedBy) !== rawCreatedBy ? `${getDisplayName(rawCreatedBy)} (${rawCreatedBy})` : rawCreatedBy;
  const rawAssignee = extractAssignee(argsText);
  const assignedTo = normalizeAssignee(rawAssignee);
  const propertyTag = extractPropertyTag(argsText);
  const cleanTitle = argsText.replace(/@[a-zA-Z0-9_]+/g, "").replace(/#[a-zA-Z0-9_]+/g, "").trim();

  // ─── Deduplication Check ─────────────────────────────────
  const pendingTasks = opsDb.getAllPendingTasks(chatId);
  const duplicate = findDuplicateTask(pendingTasks, cleanTitle, assignedTo || rawAssignee);

  if (duplicate) {
    const dupAssignee = duplicate.assigned_to || "Unassigned";
    const en = `⚠️ *Similar task already exists*\n\n📋 Task #${duplicate.id}: ${safeTxt(duplicate.title)}\n👤 Assigned to: ${dupAssignee}\n📊 Status: ${duplicate.status}\n\n💡 Use \`/done ${duplicate.id}\` to complete it, or create with a different description if this is truly a separate task.`;
    const ar = `⚠️ *توجد مهمة مشابهة بالفعل*\n\n📋 المهمة #${duplicate.id}: ${safeTxt(duplicate.title)}\n👤 المسؤول: ${dupAssignee}\n📊 الحالة: ${duplicate.status}\n\n💡 استخدم \`/done ${duplicate.id}\` لإكمالها، أو أنشئ بوصف مختلف إذا كانت مهمة مختلفة فعلاً.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const taskId = opsDb.addTask(chatId, threadId, topicInfo.name, cleanTitle, { createdBy, assignedTo, propertyTag });

  const displayAssignee = assignedTo || rawAssignee;
  const displayAssigneeAr = rawAssignee ? getDisplayNameAr(rawAssignee) : null;
  const en = `✅ *Task #${taskId} created*\n\n📝 ${cleanTitle}\n👤 Created by: ${createdBy}${displayAssignee ? `\n👤 Assigned to: ${displayAssignee}` : ""}${propertyTag ? `\n🏠 Property: #${propertyTag}` : ""}`;
  const ar = `✅ *تم إنشاء المهمة #${taskId}*\n\n📝 ${cleanTitle}\n👤 بواسطة: ${createdBy}${displayAssigneeAr ? `\n👤 المسؤول: ${displayAssigneeAr}` : (displayAssignee ? `\n👤 المسؤول: ${displayAssignee}` : "")}${propertyTag ? `\n🏠 العقار: #${propertyTag}` : ""}`;
  
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsChecklist(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "checklist");

  if (!argsText) {
    const en = `📋 *Create a checklist*\n\nUsage: \`/checklist task 1 | task 2 | task 3\``;
    const ar = `📋 *إنشاء قائمة مهام*\n\nالاستخدام: \`/checklist مهمة 1 | مهمة 2 | مهمة 3\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const items = argsText.split(/\||\n/).map(s => s.trim()).filter(s => s.length > 0);
  if (items.length === 0) return ctx.reply("❌ No tasks found / لم يتم العثور على مهام", { message_thread_id: threadId });

  const rawCreatedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const createdBy = normalizeAssignee(rawCreatedBy) || rawCreatedBy;
  const pendingTasks = opsDb.getAllPendingTasks(chatId);
  const taskIds = [];
  const skippedDuplicates = [];
  for (const item of items) {
    const rawAssignee = extractAssignee(item);
    const assignedTo = normalizeAssignee(rawAssignee);
    const cleanItem = item.replace(/@[a-zA-Z0-9_]+/g, "").replace(/#[a-zA-Z0-9_]+/g, "").trim();
    // Dedup check
    const duplicate = findDuplicateTask(pendingTasks, cleanItem, assignedTo || rawAssignee);
    if (duplicate) {
      skippedDuplicates.push({ title: cleanItem, existingId: duplicate.id, existingTitle: duplicate.title });
    } else {
      const id = opsDb.addTask(chatId, threadId, topicInfo.name, cleanItem, { createdBy, assignedTo, propertyTag: extractPropertyTag(item) });
      taskIds.push({ id, title: cleanItem });
      // Add to pending list for subsequent dedup checks within this batch
      pendingTasks.push({ id, title: cleanItem, assigned_to: assignedTo, status: "pending" });
    }
  }

  let en = `📋 *${taskIds.length} tasks created — ${topicInfo.name}*\n\n`;
  let ar = `📋 *تم إنشاء ${taskIds.length} مهام — ${topicInfo.arName}*\n\n`;
  
  taskIds.forEach(({ id, title }, i) => { 
    en += `${i + 1}. ⬜ ${title} [#${id}]\n`; 
    ar += `${i + 1}. ⬜ ${title} [#${id}]\n`;
  });

  if (skippedDuplicates.length > 0) {
    en += `\n⚠️ *${skippedDuplicates.length} duplicate(s) skipped:*\n`;
    ar += `\n⚠️ *تم تخطي ${skippedDuplicates.length} مهمة مكررة:*\n`;
    skippedDuplicates.forEach(d => {
      en += `• "${safeTxt(d.title)}" → already exists as #${d.existingId}: ${d.existingTitle}\n`;
      ar += `• "${safeTxt(d.title)}" → موجودة كـ #${d.existingId}: ${d.existingTitle}\n`;
    });
  }

  const enFooter = `\nUse \`/done [number]\` to complete`;
  const arFooter = `\nاستخدم \`/done [الرقم]\` للإتمام`;
  
  await ctx.reply(getBilingualText(en + enFooter, ar + arFooter), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsTasks(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;

  // Strip Markdown special chars from user-entered text to prevent parse errors
  function safeTxt(s) { return String(s || "").replace(/[_*`\[\]]/g, ""); }

  // Send with Markdown, fall back to plain text if Telegram rejects it
  async function safeSend(text, opts) {
    try {
      await ctx.reply(text, { parse_mode: "Markdown", ...opts });
    } catch (mdErr) {
      console.error("[handleOpsTasks] Markdown send failed, retrying plain:", mdErr.message);
      const plain = text.replace(/[*_`]/g, "");
      try {
        await ctx.reply(plain, { ...opts, parse_mode: undefined });
      } catch (plainErr) {
        console.error("[handleOpsTasks] Plain send also failed:", plainErr.message);
      }
    }
  }

  try {
    const tasks = opsDb.getTasksByThread(chatId, threadId);

    if (tasks.length === 0) {
      const msg = `${topicInfo.emoji} *${topicInfo.name}*\n\n\u2728 No tasks in this topic.\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n${topicInfo.emoji} *${topicInfo.arName}*\n\n\u2728 \u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0647\u0627\u0645 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0636\u0648\u0639.`;
      return safeSend(msg, { message_thread_id: threadId || undefined });
    }

    const pending = tasks.filter(t => t.status === "pending");
    const done = tasks.filter(t => t.status === "done");

    // Build lines — use safeTxt on all user-entered content
    const lines = [];
    lines.push(`${topicInfo.emoji} *${topicInfo.name}* \u2014 Tasks | \u0627\u0644\u0645\u0647\u0627\u0645`);
    lines.push("");

    if (pending.length > 0) {
      lines.push(`*\u2b1c Pending / \u0642\u064a\u062f \u0627\u0644\u062a\u0646\u0641\u064a\u0630 (${pending.length}):*`);
      pending.forEach((task, i) => {
        const prio = task.priority === "urgent" ? " \ud83d\udd34" : task.priority === "high" ? " \ud83d\udfe0" : "";
        const assignee = task.assigned_to ? ` \u2192 ${safeTxt(task.assigned_to)}` : "";
        const prop = task.property_tag ? ` \ud83c\udfe0${safeTxt(task.property_tag)}` : "";
        const due = task.due_date ? ` \ud83d\udcc5${task.due_date}` : "";
        lines.push(`${i + 1}. \u2b1c ${safeTxt(task.title)}${prio}${assignee}${prop}${due} [#${task.id}]`);
      });
    }

    if (done.length > 0) {
      lines.push("");
      lines.push(`*\u2705 Done / \u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629 (${done.length}):*`);
      done.slice(0, 5).forEach(task => {
        lines.push(`\u2705 ${safeTxt(task.title)} [#${task.id}]`);
      });
      if (done.length > 5) lines.push(`... and ${done.length - 5} more`);
    }

    if (pending.length > 0) {
      lines.push("");
      lines.push("`/done [number]` to complete a task");
    }

    // Split into chunks of max 4000 chars to stay under Telegram's 4096 limit
    const MAX_LEN = 4000;
    let chunk = "";
    const chunks = [];
    for (const line of lines) {
      const addition = (chunk ? "\n" : "") + line;
      if (chunk.length + addition.length > MAX_LEN) {
        if (chunk) chunks.push(chunk);
        chunk = line;
      } else {
        chunk += addition;
      }
    }
    if (chunk) chunks.push(chunk);

    for (const c of chunks) {
      await safeSend(c, { message_thread_id: threadId || undefined });
    }

  } catch (e) {
    console.error("[handleOpsTasks] Fatal error:", e.message, e.stack);
    try {
      await ctx.reply(`\u274c Error loading tasks: ${e.message}`, { message_thread_id: threadId || undefined });
    } catch (_) {}
  }
}

async function handleOpsDone(ctx) {
  const { Markup } = require("telegraf");
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "done");

  // Fix 2: Parse task ID — try parseInt first, then scan for #N pattern
  let taskId = parseInt(args, 10);
  if (!taskId || isNaN(taskId)) {
    const hashMatch = args.match(/#(\d+)/);
    if (hashMatch) taskId = parseInt(hashMatch[1], 10);
  }

  // Fix 4 & 5: If still no valid taskId, show pending tasks with inline buttons (same topic only)
  if (!taskId || isNaN(taskId)) {
    const tasks = opsDb.getPendingTasksByThread(chatId, threadId);
    if (tasks.length === 0) {
      const en = "✅ No pending tasks in this topic.";
      const ar = "✅ لا توجد مهام معلقة في هذا الموضوع.";
      return ctx.reply(getBilingualText(en, ar), { message_thread_id: threadId || undefined });
    }

    let en = `✅ *Complete a task*\n\n*Pending:*\n`;
    let ar = `✅ *إكمال مهمة*\n\n*المعلقة:*\n`;
    const buttons = [];
    tasks.forEach(task => {
      const line = `⬜ ${safeTxt(task.title)} [#${task.id}]\n`;
      en += line; ar += line;
      buttons.push([Markup.button.callback(`✅ Done #${task.id}: ${safeTxt(task.title).substring(0, 30)}`, `done_${task.id}`)]);
    });
    try {
      return await ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (e) {
      console.error("[handleOpsDone] List send error:", e.message);
      const plain = getBilingualText(en, ar).replace(/[*_`]/g, "");
      return ctx.reply(plain, { message_thread_id: threadId || undefined, ...Markup.inlineKeyboard(buttons) }).catch(err => console.error("[handleOpsDone] Plain fallback failed:", err.message));
    }
  }

  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found / المهمة غير موجودة`, { message_thread_id: threadId || undefined });
  if (task.status === "done") return ctx.reply(`✅ Task #${taskId} already completed / المهمة مكتملة بالفعل`, { message_thread_id: threadId || undefined });

  opsDb.markTaskDone(taskId);

  let en = `✅ *Task #${taskId} completed!*\n\n✅ ${safeTxt(task.title)}\n\n🎉 Well done!`;
  let ar = `✅ *تم إكمال المهمة #${taskId}!*\n\n✅ ${safeTxt(task.title)}\n\n🎉 عمل رائع!`;

  const dependents = opsDb.getDependentTasks(taskId);
  for (const dep of dependents) {
    if (!opsDb.isTaskBlocked(dep.task_id)) {
      en += `\n\n🔓 *Unblocked:* Task #${dep.task_id} — ${safeTxt(dep.title)}`;
      ar += `\n\n🔓 *تم فتح:* المهمة #${dep.task_id} — ${safeTxt(dep.title)}`;
    }
  }

  try {
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || undefined });
  } catch (e) {
    console.error("[handleOpsDone] Complete send error:", e.message);
    const plain = getBilingualText(en, ar).replace(/[*_`]/g, "");
    await ctx.reply(plain, { message_thread_id: threadId || undefined }).catch(err => console.error("[handleOpsDone] Plain fallback failed:", err.message));
  }
}

/**
 * Callback handler for done_TASKID inline buttons
 */
async function handleDoneCallback(ctx) {
  try {
    const data = ctx.callbackQuery.data;
    const match = data.match(/^done_(\d+)$/);
    if (!match) return ctx.answerCbQuery("❌ Invalid action");

    const taskId = parseInt(match[1], 10);
    const chatId = ctx.chat.id;
    const task = opsDb.getTaskById(taskId);

    if (!task || task.chat_id !== chatId) {
      return ctx.answerCbQuery("❌ Task not found");
    }
    if (task.status === "done") {
      return ctx.answerCbQuery("✅ Already completed");
    }

    opsDb.markTaskDone(taskId);

    const en = `✅ *Task #${taskId} completed!*\n\n✅ ${safeTxt(task.title)}\n\n🎉 Well done!`;
    const ar = `✅ *تم إكمال المهمة #${taskId}!*\n\n✅ ${safeTxt(task.title)}\n\n🎉 عمل رائع!`;

    await ctx.answerCbQuery(`✅ Task #${taskId} done!`);
    await ctx.editMessageText(getBilingualText(en, ar), { parse_mode: "Markdown" });
  } catch (e) {
    console.error("[handleDoneCallback] Error:", e.message);
    await ctx.answerCbQuery("❌ Error completing task").catch(() => {});
  }
}

async function handleOpsRemind(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "remind");

  if (!argsText) {
    const en = `⏰ *Set a reminder*\n\nUsage: \`/remind [time] [message]\`\n\nExamples:\n• \`/remind 9am Team meeting\`\n• \`/remind 2h Follow up\`\n• \`/remind tomorrow 9am Review\``;
    const ar = `⏰ *ضبط تذكير*\n\nالاستخدام: \`/remind [الوقت] [الرسالة]\`\n\nأمثلة:\n• \`/remind 9am اجتماع الفريق\`\n• \`/remind 2h متابعة\`\n• \`/remind tomorrow 9am مراجعة\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let timeStr, message;
  const tomorrowMatch = argsText.match(/^(tomorrow\s+\S+)\s+(.+)$/i);
  if (tomorrowMatch) { timeStr = tomorrowMatch[1]; message = tomorrowMatch[2]; }
  else { const parts = argsText.split(/\s+/); timeStr = parts[0]; message = parts.slice(1).join(" "); }

  if (!message) return ctx.reply("❌ Please specify a message / يرجى تحديد رسالة التذكير", { message_thread_id: threadId });

  const remindAt = parseReminderTime(timeStr);
  if (!remindAt) return ctx.reply(`❌ Could not parse time / لم يتم فهم الوقت: \`${timeStr}\``, { parse_mode: "Markdown", message_thread_id: threadId });

  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  opsDb.addReminder(chatId, threadId, topicInfo.name, message, remindAt, createdBy);

  const ksaTime = new Date(new Date(remindAt.replace(" ", "T") + "Z").getTime() + 3 * 3600000);
  const timeDisplay = ksaTime.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });

  const en = `⏰ *Reminder set*\n\n📝 ${message}\n🕐 ${timeDisplay} (Riyadh)`;
  const ar = `⏰ *تم ضبط التذكير*\n\n📝 ${message}\n🕐 ${timeDisplay} (الرياض)`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsSummary(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const allTasks = opsDb.getAllPendingTasks(chatId);
    if (allTasks.length === 0) {
      return ctx.reply(
        `📊 Task Summary\n\n✨ No pending tasks. Great work!\n━━━━━━━━━━━━━━\n📊 ملخص المهام\n\n✨ لا توجد مهام معلقة. عمل رائع!`,
        { message_thread_id: threadId || undefined }
      );
    }
    const byTopic = {};
    for (const task of allTasks) {
      const key = safeTxt(task.topic_name || "General");
      if (!byTopic[key]) byTopic[key] = [];
      byTopic[key].push(task);
    }
    const stats = opsDb.getTaskStats(chatId);
    let lines = [];
    lines.push(`📊 Task Summary`);
    lines.push(`📌 ${stats.pending} pending / ${stats.done} done`);
    lines.push(`━━━━━━━━━━━━━━`);
    lines.push(`📊 ملخص المهام`);
    lines.push(`📌 ${stats.pending} معلقة / ${stats.done} مكتملة`);
    lines.push(``);
    for (const [topicName, tasks] of Object.entries(byTopic)) {
      const emoji = getEmojiFromName(topicName);
      lines.push(`${emoji} ${topicName} (${tasks.length}):`);
      tasks.slice(0, 5).forEach((task, i) => {
        const assignee = task.assigned_to ? ` → ${safeTxt(task.assigned_to)}` : "";
        lines.push(`  ${i + 1}. ⬜ ${safeTxt(task.title)}${assignee} [#${task.id}]`);
      });
      if (tasks.length > 5) lines.push(`  ... and ${tasks.length - 5} more`);
      lines.push(``);
    }
    const msg = lines.join("\n");
    // Split if too long
    const chunks = [];
    let current = "";
    for (const line of lines) {
      if (current.length + line.length + 1 > 3800) {
        chunks.push(current);
        current = line;
      } else {
        current += (current ? "\n" : "") + line;
      }
    }
    if (current) chunks.push(current);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { message_thread_id: threadId || undefined });
    }
  } catch (e) {
    console.error("[handleOpsSummary] CRASH:", e.message, e.stack);
    try {
      await ctx.reply(`❌ Summary error: ${e.message}`, { message_thread_id: threadId || undefined });
    } catch (_) {}
  }
}

async function handleOpsKpi(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const weekly = opsDb.getWeeklyStats(chatId);
  const stats = opsDb.getTaskStats(chatId);
  const overdue = opsDb.getOverdueTasks(chatId);
  const completionRate = weekly.created > 0 ? Math.round((weekly.completed / weekly.created) * 100) : 0;

  let en = `📊 *Weekly KPI Dashboard*\n📅 Last 7 days\n\n`;
  let ar = `📊 *لوحة مؤشرات الأداء الأسبوعية*\n📅 آخر 7 أيام\n\n`;

  const metricsEn = `*Task Metrics:*\n• Created: ${weekly.created}\n• Completed: ${weekly.completed}\n• Completion Rate: ${completionRate}%\n${weekly.avgResolutionHours ? `• Avg Resolution: ${weekly.avgResolutionHours}h\n` : ""}`;
  const metricsAr = `*مقاييس المهام:*\n• المنشأة: ${weekly.created}\n• المكتملة: ${weekly.completed}\n• معدل الإنجاز: ${completionRate}%\n${weekly.avgResolutionHours ? `• متوسط وقت الإنجاز: ${weekly.avgResolutionHours} ساعة\n` : ""}`;

  const statusEn = `\n*Current Status:*\n• Total Pending: ${stats.pending}\n• Total Done: ${stats.done}\n• High Priority: ${weekly.highPriorityCount}\n• Overdue: ${overdue.length}\n`;
  const statusAr = `\n*الحالة الحالية:*\n• إجمالي المعلقة: ${stats.pending}\n• إجمالي المكتملة: ${stats.done}\n• أولوية عالية: ${weekly.highPriorityCount}\n• المتأخرة: ${overdue.length}\n`;

  en += metricsEn + statusEn;
  ar += metricsAr + statusAr;

  if (weekly.pendingByTopic.length > 0) {
    en += `\n*Busiest Topics (pending):*\n`;
    ar += `\n*أكثر المواضيع انشغالاً (معلقة):*\n`;
    weekly.pendingByTopic.slice(0, 5).forEach(t => { 
      const line = `• ${t.topic_name || "General"}: ${t.c} tasks\n`;
      en += line; ar += line;
    });
  }

  if (overdue.length > 0) {
    en += `\n*⚠️ Overdue Tasks:*\n`;
    ar += `\n*⚠️ مهام متأخرة:*\n`;
    overdue.slice(0, 5).forEach(t => { 
      const assignee = t.assigned_to ? ` → ${safeTxt(t.title)}` : ""; 
      const line = `• #${t.id} ${safeTxt(t.title)}${assignee} (due: ${t.due_date})\n`;
      en += line; ar += line;
    });
  }

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsProperty(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const tag = extractCommandArgs(text, "property").replace(/^#/, "").toLowerCase().trim();

  if (!tag) {
    const en = `🏠 *Property Tracker*\n\nUsage: \`/property unit5\`\n\nShows all tasks, media, and expenses linked to a property.`;
    const ar = `🏠 *متتبع العقار*\n\nالاستخدام: \`/property unit5\`\n\nيعرض جميع المهام والوسائط والمصاريف المرتبطة بالعقار.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const tasks = opsDb.getTasksByProperty(chatId, tag);
  const media = opsDb.getMediaByProperty(chatId, tag);
  const expenses = opsDb.getExpensesByProperty(chatId, tag);
  const occupancy = opsDb.getOccupancyByUnit(chatId, tag);

  if (tasks.length === 0 && media.length === 0 && expenses.length === 0 && !occupancy) {
    const en = `🏠 *#${tag}*\n\nNo data found for this property.`;
    const ar = `🏠 *#${tag}*\n\nلم يتم العثور على بيانات لهذا العقار.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const pending = tasks.filter(t => t.status === "pending");
  const done = tasks.filter(t => t.status === "done");

  let en = `🏠 *Property: #${tag}*\n\n`;
  let ar = `🏠 *العقار: #${tag}*\n\n`;

  if (occupancy) {
    const statusEmoji = occupancy.status === "occupied" ? "🟢" : occupancy.status === "maintenance" ? "🟡" : "🔴";
    en += `*Status:* ${statusEmoji} ${occupancy.status}${occupancy.tenant_name ? ` — ${occupancy.tenant_name}` : ""}\n\n`;
    ar += `*الحالة:* ${statusEmoji} ${occupancy.status}${occupancy.tenant_name ? ` — ${occupancy.tenant_name}` : ""}\n\n`;
  }

  if (pending.length > 0) {
    en += `*⬜ Pending Tasks (${pending.length}):*\n`;
    ar += `*⬜ المهام المعلقة (${pending.length}):*\n`;
    pending.forEach(t => { 
      const line = `• #${t.id} ${safeTxt(t.title)}${t.assigned_to ? ` → ${safeTxt(t.title)}` : ""}\n`;
      en += line; ar += line;
    });
    en += "\n"; ar += "\n";
  }

  if (done.length > 0) {
    en += `*✅ Completed (${done.length}):*\n`;
    ar += `*✅ المكتملة (${done.length}):*\n`;
    done.slice(0, 5).forEach(t => { 
      const line = `• #${t.id} ✅ ${safeTxt(t.title)}\n`;
      en += line; ar += line;
    });
    en += "\n"; ar += "\n";
  }

  if (expenses.length > 0) {
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    en += `*💰 Total Expenses:* ${totalExp.toLocaleString()} SAR\n`;
    ar += `*💰 إجمالي المصاريف:* ${totalExp.toLocaleString()} ريال\n`;
  }

  try {
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || undefined });
  } catch (e) {
    console.error("[handleOpsProperty] Send error:", e.message);
    const plain = getBilingualText(en, ar).replace(/[*_`]/g, "");
    await ctx.reply(plain, { message_thread_id: threadId || undefined }).catch(err => console.error("[handleOpsProperty] Plain fallback failed:", err.message));
  }
}

async function handleOpsMove(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "move");

  if (!argsText) {
    const en = `🔄 *Move a task to another topic*\n\nUsage: \`/move [task#] [topic_name]\`\n\nTopics: ceo, ops, listings, bookings, support, tech, payments, marketing, legal, blockers`;
    const ar = `🔄 *نقل مهمة إلى موضوع آخر*\n\nالاستخدام: \`/move [رقم المهمة] [اسم الموضوع]\`\n\nالمواضيع: ceo, ops, listings, bookings, support, tech, payments, marketing, legal, blockers`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const match = argsText.match(/^(\d+)\s+(\S+)$/i);
  if (!match) return ctx.reply("❌ Format: `/move 5 tech`", { message_thread_id: threadId });

  const taskId = parseInt(match[1], 10);
  const targetTopic = match[2].toLowerCase();
  const targetThreadId = TOPIC_SHORTNAMES[targetTopic];

  if (!targetThreadId) return ctx.reply(`❌ Unknown topic: \`${targetTopic}\``, { parse_mode: "Markdown", message_thread_id: threadId });

  const task = opsDb.getTaskById(taskId);
  if (!task || task.chat_id !== chatId) return ctx.reply(`❌ Task #${taskId} not found.`, { message_thread_id: threadId });

  const targetInfo = getTopicInfo(targetThreadId);
  opsDb.moveTask(taskId, targetThreadId, targetInfo.name);

  const en = `🔄 *Task #${taskId} moved*\n\n📝 ${safeTxt(task.title)}\n📍 To: ${targetInfo.name}`;
  const ar = `🔄 *تم نقل المهمة #${taskId}*\n\n📝 ${safeTxt(task.title)}\n📍 إلى: ${targetInfo.arName}`;

  try {
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || undefined });
  } catch (e) {
    console.error("[handleOpsMove] Send error:", e.message);
    const plain = getBilingualText(en, ar).replace(/[*_`]/g, "");
    await ctx.reply(plain, { message_thread_id: threadId || undefined }).catch(() => {});
  }

  // Cross-post notification in the new topic
  try {
    const notifyEn = `📥 *Task moved to this topic*\n\n⬜ ${safeTxt(task.title)} [#${taskId}]\n👤 Assigned: ${task.assigned_to || "None"}`;
    const notifyAr = `📥 *تم نقل مهمة لهذا الموضوع*\n\n⬜ ${safeTxt(task.title)} [#${taskId}]\n👤 المسؤول: ${task.assigned_to || "لا يوجد"}`;
    await ctx.telegram.sendMessage(chatId, getBilingualText(notifyEn, notifyAr), { parse_mode: "Markdown", message_thread_id: targetThreadId });
  } catch (e) { console.error("[Ops] Move notification error:", e.message); }
}

async function handleOpsHandover(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;

  const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
  const createdTasks = opsDb.getTasksCreatedSince(chatId, since);
  const completedTasks = opsDb.getTasksCompletedSince(chatId, since);
  const allPending = opsDb.getAllPendingTasks(chatId);
  const overdue = opsDb.getOverdueTasks(chatId);

  const ksaNow = new Date(Date.now() + 3 * 3600000);
  const timeStr = ksaNow.toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short" });

  let en = `📋 *Shift Handover — ${timeStr}*\n\n`;
  let ar = `📋 *تسليم المناوبة — ${timeStr}*\n\n`;

  if (completedTasks.length > 0) {
    en += `*✅ Completed this shift (${completedTasks.length}):*\n`;
    ar += `*✅ المكتملة في هذه المناوبة (${completedTasks.length}):*\n`;
    completedTasks.slice(0, 10).forEach(t => { 
      const line = `• ✅ ${safeTxt(t.title)}${t.assigned_to ? ` (${safeTxt(t.title)})` : ""}\n`;
      en += line; ar += line;
    });
    en += "\n"; ar += "\n";
  }

  if (createdTasks.length > 0) {
    const newPending = createdTasks.filter(t => t.status === "pending");
    if (newPending.length > 0) {
      en += `*🆕 New tasks created (${newPending.length}):*\n`;
      ar += `*🆕 مهام جديدة منشأة (${newPending.length}):*\n`;
      newPending.slice(0, 10).forEach(t => { 
        const line = `• #${t.id} ${safeTxt(t.title)}${t.assigned_to ? ` → ${safeTxt(t.title)}` : ""}\n`;
        en += line; ar += line;
      });
      en += "\n"; ar += "\n";
    }
  }

  if (overdue.length > 0) {
    en += `*🔴 Overdue (${overdue.length}):*\n`;
    ar += `*🔴 المتأخرة (${overdue.length}):*\n`;
    overdue.slice(0, 5).forEach(t => { 
      const line = `• #${t.id} ${safeTxt(t.title)} (due: ${t.due_date})\n`;
      en += line; ar += line;
    });
    en += "\n"; ar += "\n";
  }

  en += `*📊 Overall:* ${allPending.length} pending tasks total`;
  ar += `*📊 الإجمالي:* ${allPending.length} مهمة معلقة في المجمل`;

  try {
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || undefined });
  } catch (e) {
    console.error("[handleOpsHandover] Send error:", e.message);
    const plain = getBilingualText(en, ar).replace(/[*_`]/g, "");
    await ctx.reply(plain, { message_thread_id: threadId || undefined }).catch(err => console.error("[handleOpsHandover] Plain fallback failed:", err.message));
  }
}

async function handleOpsMonthlyReport(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const monthly = opsDb.getMonthlyStats(chatId);
  const expSummary = opsDb.getExpenseSummary(chatId);
  const occSummary = opsDb.getOccupancySummary(chatId);

  const completionRate = monthly.created > 0 ? Math.round((monthly.completed / monthly.created) * 100) : 0;

  let en = `📊 *Monthly Report — ${monthly.firstOfMonth}*\n\n`;
  let ar = `📊 *التقرير الشهري — ${monthly.firstOfMonth}*\n\n`;

  en += `*Task Metrics:*\n• Created: ${monthly.created}\n• Completed: ${monthly.completed}\n• Completion Rate: ${completionRate}%\n• Currently Overdue: ${monthly.overdue}\n\n`;
  ar += `*مقاييس المهام:*\n• المنشأة: ${monthly.created}\n• المكتملة: ${monthly.completed}\n• معدل الإنجاز: ${completionRate}%\n• المتأخرة حالياً: ${monthly.overdue}\n\n`;

  if (monthly.byAssignee.length > 0) {
    en += `*👥 Team Performance:*\n`;
    ar += `*👥 أداء الفريق:*\n`;
    monthly.byAssignee.forEach(a => { 
      const line = `• ${safeTxt(a.title)}: ${a.done}/${a.total} done (${a.pending} pending)\n`;
      en += line; ar += line;
    });
    en += "\n"; ar += "\n";
  }

  if (expSummary.totalAmount > 0) {
    en += `*💰 Expenses: ${expSummary.totalAmount.toLocaleString()} SAR*\n`;
    ar += `*💰 المصاريف: ${expSummary.totalAmount.toLocaleString()} ريال*\n`;
  }

  if (occSummary.total > 0) {
    const occRate = Math.round((occSummary.occupied / occSummary.total) * 100);
    en += `*🏠 Occupancy: ${occRate}%* (${occSummary.occupied}/${occSummary.total})\n`;
    ar += `*🏠 الإشغال: ${occRate}%* (${occSummary.occupied}/${occSummary.total})\n`;
  }

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsExpense(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "expense");
  const createdBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (!argsText) {
    const en = `💰 *Record an expense*\n\nUsage: \`/expense [amount] [description] #property\``;
    const ar = `💰 *تسجيل مصروف*\n\nالاستخدام: \`/expense [المبلغ] [الوصف] #العقار\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const match = argsText.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return ctx.reply("❌ Format: `/expense 500 AC repair #unit5`", { message_thread_id: threadId });

  const amount = parseFloat(match[1]);
  const description = match[2].trim();
  const propertyTag = extractPropertyTag(description);

  let category = "other";
  const descLower = description.toLowerCase();
  if (descLower.match(/repair|fix|maintenance|ac|plumb|electric/)) category = "maintenance";
  else if (descLower.match(/clean|suppli|tool|material/)) category = "supplies";
  else if (descLower.match(/electric|water|internet|gas|utility/)) category = "utilities";
  else if (descLower.match(/service|contract|labor|worker/)) category = "services";

  const expId = opsDb.addExpense(chatId, threadId, topicInfo.name, amount, description, { propertyTag, category, createdBy });
  const monthTotal = opsDb.getMonthlyExpenseTotal(chatId);

  const en = `💰 *Expense #${expId} recorded*\n\n💵 ${amount.toLocaleString()} SAR\n📝 ${description}\n📂 ${category}${propertyTag ? `\n🏠 #${propertyTag}` : ""}\n\n📊 Monthly total: ${monthTotal.toLocaleString()} SAR`;
  const ar = `💰 *تم تسجيل المصروف #${expId}*\n\n💵 ${amount.toLocaleString()} ريال\n📝 ${description}\n📂 ${category}${propertyTag ? `\n🏠 #${propertyTag}` : ""}\n\n📊 إجمالي الشهر: ${monthTotal.toLocaleString()} ريال`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsOccupancy(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const argsText = extractCommandArgs(text, "occupancy");
  const updatedBy = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";

  if (!argsText) {
    const units = opsDb.getOccupancy(chatId);
    const summary = opsDb.getOccupancySummary(chatId);
    if (units.length === 0) {
      const en = `🏠 *Occupancy Tracker*\n\nNo units registered. Add: \`/occupancy unit5 occupied "Tenant"\``;
      const ar = `🏠 *متتبع الإشغال*\n\nلا توجد وحدات مسجلة. أضف: \`/occupancy unit5 occupied "المستأجر"\``;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }
    const occRate = summary.total > 0 ? Math.round((summary.occupied / summary.total) * 100) : 0;
    let en = `🏠 *Occupancy — ${occRate}%*\n🟢 ${summary.occupied} occupied | 🔴 ${summary.vacant} vacant | 🟡 ${summary.maintenance} maintenance\n\n`;
    let ar = `🏠 *الإشغال — ${occRate}%*\n🟢 ${summary.occupied} مشغول | 🔴 ${summary.vacant} شاغر | 🟡 ${summary.maintenance} صيانة\n\n`;
    units.forEach(u => {
      const emoji = u.status === "occupied" ? "🟢" : u.status === "maintenance" ? "🟡" : "🔴";
      const line = `${emoji} *${u.unit_name}*: ${u.status}${u.tenant_name ? ` — ${u.tenant_name}` : ""}\n`;
      en += line; ar += line;
    });
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const match = argsText.match(/^(\S+)\s+(occupied|vacant|maintenance)(?:\s+[""]?(.+?)[""]?)?$/i);
  if (!match) return ctx.reply("❌ Format: `/occupancy unit5 occupied \"Tenant Name\"`", { message_thread_id: threadId });

  const unitName = match[1].toLowerCase();
  const status = match[2].toLowerCase();
  const tenantName = match[3] || null;

  opsDb.setOccupancy(chatId, unitName, status, tenantName, updatedBy);
  const emoji = status === "occupied" ? "🟢" : status === "maintenance" ? "🟡" : "🔴";

  const en = `🏠 *Occupancy updated*\n\n${emoji} *${unitName}* set to ${status}${tenantName ? `\n👤 Tenant: ${tenantName}` : ""}`;
  const ar = `🏠 *تم تحديث الإشغال*\n\n${emoji} *${unitName}* تم تعيينه كـ ${status}${tenantName ? `\n👤 المستأجر: ${tenantName}` : ""}`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsExpenses(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const summary = opsDb.getExpenseSummary(chatId);
  let en = `💰 *Expense Summary*\n\nTotal this month: ${summary.totalAmount.toLocaleString()} SAR\n\n`;
  let ar = `💰 *ملخص المصاريف*\n\nالإجمالي هذا الشهر: ${summary.totalAmount.toLocaleString()} ريال\n\n`;
  if (summary.byCategory.length > 0) {
    en += `*By Category:*\n`; ar += `*حسب الفئة:*\n`;
    summary.byCategory.forEach(c => {
      en += `• ${c.category}: ${c.total.toLocaleString()} SAR (${c.count})\n`;
      ar += `• ${c.category}: ${c.total.toLocaleString()} ريال (${c.count})\n`;
    });
  }
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsSla(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "sla");
  if (!args) {
    const configs = opsDb.getSlaConfig(chatId);
    let en = `⏱ *SLA Configurations*\n\n`;
    let ar = `⏱ *إعدادات اتفاقية مستوى الخدمة*\n\n`;
    configs.forEach(c => {
      en += `• ${c.topic_name}: ${c.sla_hours}h\n`;
      ar += `• ${c.topic_name}: ${c.sla_hours} ساعة\n`;
    });
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }
  const match = args.match(/^(\d+)$/);
  if (match) {
    const hours = parseInt(match[1]);
    const topicInfo = getTopicInfo(threadId);
    opsDb.setSlaConfig(chatId, threadId, topicInfo.name, hours);
    return ctx.reply(`✅ SLA set to ${hours}h for ${topicInfo.name}`, { message_thread_id: threadId });
  }
}

async function handleOpsApprove(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "approve");
  const id = parseInt(args);
  if (isNaN(id)) return ctx.reply("❌ Usage: /approve [id]", { message_thread_id: threadId });
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  opsDb.decideApproval(id, "approved", user, "Approved via command");
  ctx.reply(`✅ Approval #${id} approved by ${user}`, { message_thread_id: threadId });
}

async function handleOpsReject(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "reject");
  const id = parseInt(args);
  if (isNaN(id)) return ctx.reply("❌ Usage: /reject [id]", { message_thread_id: threadId });
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  opsDb.decideApproval(id, "rejected", user, "Rejected via command");
  ctx.reply(`❌ Approval #${id} rejected by ${user}`, { message_thread_id: threadId });
}

async function handleOpsDepends(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const args = extractCommandArgs(ctx.message.text, "depends");
  const match = args.match(/^(\d+)\s+(\d+)$/);
  if (!match) return ctx.reply("❌ Usage: /depends [task_id] [depends_on_id]", { message_thread_id: threadId });
  opsDb.addTaskDependency(parseInt(match[1]), parseInt(match[2]));
  ctx.reply(`✅ Task #${match[1]} now depends on #${match[2]}`, { message_thread_id: threadId });
}

async function handleOpsRecurring(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const args = extractCommandArgs(ctx.message.text, "recurring");
  if (!args) {
    const tasks = opsDb.getActiveRecurringTasks(chatId);
    let msg = "🔄 *Recurring Tasks*\n\n";
    tasks.forEach(t => msg += `• #${t.id}: ${safeTxt(t.title)} (${t.schedule_type} ${t.schedule_value})\n`);
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }
}

async function handleOpsMeeting(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const topicInfo = getTopicInfo(threadId);
    const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const args = extractCommandArgs(ctx.message.text, "meeting");

    // ─── No args: show usage ───
    if (!args) {
      const en = `📝 *Meeting Manager*\n\nSubcommands:\n• \`/meeting start\` — start a new meeting\n• \`/meeting end [summary]\` — end the active meeting\n• \`/meeting note [text]\` — add a note to the active meeting\n• \`/meeting status\` — show active meeting details`;
      const ar = `📝 *إدارة الاجتماعات*\n\nالأوامر:\n• \`/meeting start\` — بدء اجتماع جديد\n• \`/meeting end [ملخص]\` — إنهاء الاجتماع الحالي\n• \`/meeting note [نص]\` — إضافة ملاحظة للاجتماع الحالي\n• \`/meeting status\` — عرض تفاصيل الاجتماع الحالي`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── start ───
    if (args === "start") {
      const id = opsDb.startMeeting(chatId, threadId, topicInfo.name, user);
      const en = `🚀 *Meeting started!*\n\n📝 Meeting #${id}\n📍 ${topicInfo.name}\n👤 Started by: ${user}\n\nUse \`/meeting note [text]\` to add notes\nUse \`/meeting end [summary]\` when done`;
      const ar = `🚀 *بدأ الاجتماع!*\n\n📝 اجتماع #${id}\n📍 ${topicInfo.arName}\n👤 بدأ بواسطة: ${user}\n\nاستخدم \`/meeting note [نص]\` لإضافة ملاحظات\nاستخدم \`/meeting end [ملخص]\` عند الانتهاء`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── end [optional summary] ───
    if (args === "end" || args.startsWith("end ")) {
      const active = opsDb.getActiveMeeting(chatId, threadId);
      if (!active) {
        const en = `❌ No active meeting in this topic.\nUse \`/meeting start\` to begin one.`;
        const ar = `❌ لا يوجد اجتماع نشط في هذا الموضوع.\nاستخدم \`/meeting start\` لبدء اجتماع.`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const summary = args.replace(/^end\s*/i, "").trim();
      opsDb.endMeeting(active.id, summary || null);

      // Fetch notes count
      const notes = opsDb.getMeetingMessages(active.id);
      const startedAt = active.started_at ? new Date(active.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "?";

      const en = `🏁 *Meeting ended!*\n\n📝 Meeting #${active.id}\n📍 ${topicInfo.name}\n⏰ Started: ${startedAt}\n📎 Notes captured: ${notes.length}${summary ? `\n📌 Summary: ${summary}` : ""}`;
      const ar = `🏁 *انتهى الاجتماع!*\n\n📝 اجتماع #${active.id}\n📍 ${topicInfo.arName}\n⏰ بدأ: ${startedAt}\n📎 الملاحظات: ${notes.length}${summary ? `\n📌 الملخص: ${summary}` : ""}`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── note [text] ───
    if (args.startsWith("note")) {
      const noteText = args.replace(/^note\s*/i, "").trim();
      if (!noteText) {
        const en = `❌ Please provide note text.\nUsage: \`/meeting note Your note here\``;
        const ar = `❌ يرجى تقديم نص الملاحظة.\nالاستخدام: \`/meeting note ملاحظتك هنا\``;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const active = opsDb.getActiveMeeting(chatId, threadId);
      if (!active) {
        const en = `❌ No active meeting. Start one with \`/meeting start\``;
        const ar = `❌ لا يوجد اجتماع نشط. ابدأ باستخدام \`/meeting start\``;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      opsDb.addMeetingMessage(active.id, user, noteText);
      const notes = opsDb.getMeetingMessages(active.id);
      const en = `✅ *Note added* (${notes.length} total)\n\n📝 ${noteText}\n👤 ${user}`;
      const ar = `✅ *تمت إضافة الملاحظة* (المجموع: ${notes.length})\n\n📝 ${noteText}\n👤 ${user}`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── status ───
    if (args === "status") {
      const active = opsDb.getActiveMeeting(chatId, threadId);
      if (!active) {
        const en = `ℹ️ No active meeting in this topic.\nUse \`/meeting start\` to begin one.`;
        const ar = `ℹ️ لا يوجد اجتماع نشط في هذا الموضوع.\nاستخدم \`/meeting start\` للبدء.`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const notes = opsDb.getMeetingMessages(active.id);
      const startedAt = active.started_at ? new Date(active.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "?";
      let en = `📊 *Active Meeting Status*\n\n📝 Meeting #${active.id}\n📍 ${topicInfo.name}\n👤 Started by: ${active.started_by}\n⏰ Started: ${startedAt}\n📎 Notes: ${notes.length}`;
      let ar = `📊 *حالة الاجتماع النشط*\n\n📝 اجتماع #${active.id}\n📍 ${topicInfo.arName}\n👤 بدأ بواسطة: ${active.started_by}\n⏰ بدأ: ${startedAt}\n📎 الملاحظات: ${notes.length}`;
      if (notes.length > 0) {
        en += `\n\n*Recent notes:*`;
        ar += `\n\n*آخر الملاحظات:*`;
        notes.slice(-3).forEach(n => { en += `\n• ${n.message_text} (${n.from_user})`; ar += `\n• ${n.message_text} (${n.from_user})`; });
      }
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── Unknown subcommand ───
    const en = `❌ Unknown subcommand: \`${args.split(" ")[0]}\`\n\nValid: \`start\`, \`end\`, \`note\`, \`status\``;
    const ar = `❌ أمر غير معروف: \`${args.split(" ")[0]}\`\n\nالصحيح: \`start\`، \`end\`، \`note\`، \`status\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });

  } catch (e) {
    console.error("[handleOpsMeeting] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsGsync(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  try {
    // 1. Send initial status message
    const statusMsg = await ctx.reply("🔄 *Syncing to Google Sheets...*\nGathering data from local database...", { 
      parse_mode: "Markdown",
      message_thread_id: threadId 
    });

    // 2. Check if Google Sync is configured
    if (!googleSync.isConfigured()) {
      const en = "❌ *Google Sync Not Configured*\n\nThe `GOOGLE_APPS_SCRIPT_URL` environment variable is missing. Please set it in Railway to enable this feature.";
      const ar = "❌ *مزامنة جوجل غير مفعلة*\n\nمتغير البيئة `GOOGLE_APPS_SCRIPT_URL` مفقود. يرجى ضبطه في Railway لتفعيل هذه الميزة.";
      return ctx.telegram.editMessageText(chatId, statusMsg.message_id, null, getBilingualText(en, ar), { parse_mode: "Markdown" });
    }

    // 3. Gather data for sync
    const tasks = opsDb.getAllTasksForSync(chatId);
    const expenses = opsDb.getMonthlyExpenses(chatId);
    const occupancy = opsDb.getOccupancy(chatId);

    // 4. Perform the sync
    const result = await googleSync.syncAll({
      tasks,
      expenses,
      occupancy,
      timestamp: new Date().toISOString()
    });

    if (result && result.success) {
      // 5. Calculate summary statistics
      const taskCounts = tasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});

      const assigneeCounts = tasks.reduce((acc, t) => {
        const a = t.assigned_to || "Unassigned";
        acc[a] = (acc[a] || 0) + 1;
        return acc;
      }, {});

      // Sort assignees by count
      const topAssignees = Object.entries(assigneeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // 6. Build bilingual summary
      const enSummary = [
        "✅ *Google Sheets Sync Complete*",
        "",
        "📊 *Export Summary:*",
        `• *Tasks:* ${tasks.length} total`,
        `  - Pending: ${taskCounts.pending || 0}`,
        `  - Done: ${taskCounts.done || 0}`,
        `• *Expenses:* ${expenses.length} records this month`,
        `• *Occupancy:* ${occupancy.length} units updated`,
        "",
        "👤 *Top Assignees:*",
        ...topAssignees.map(([name, count]) => `• ${name}: ${count} tasks`),
        "",
        `🔗 [Open Spreadsheet](${result.url || "https://docs.google.com/spreadsheets"})`
      ].join("\n");

      const arSummary = [
        "✅ *اكتملت المزامنة مع جداول بيانات جوجل*",
        "",
        "📊 *ملخص التصدير:*",
        `• *المهام:* ${tasks.length} إجمالي`,
        `  - قيد التنفيذ: ${taskCounts.pending || 0}`,
        `  - مكتملة: ${taskCounts.done || 0}`,
        `• *المصاريف:* ${expenses.length} سجلات هذا الشهر`,
        `• *الإشغال:* تم تحديث ${occupancy.length} وحدات`,
        "",
        "👤 *أبرز المسؤولين:*",
        ...topAssignees.map(([name, count]) => `• ${name}: ${count} مهام`),
        "",
        `🔗 [افتح جدول البيانات](${result.url || "https://docs.google.com/spreadsheets"})`
      ].join("\n");

      await ctx.telegram.editMessageText(chatId, statusMsg.message_id, null, getBilingualText(enSummary, arSummary), { 
        parse_mode: "Markdown",
        disable_web_page_preview: true
      });
    } else {
      // Handle sync failure
      const errorDetail = result?.error || "Unknown service error";
      const enErr = `❌ *Sync Failed*\n\nGoogle service returned an error: \`${errorDetail}\`\n\nPlease check if the Apps Script is correctly published and accessible.`;
      const arErr = `❌ *فشلت المزامنة*\n\nأبلغت خدمة جوجل عن خطأ: \`${errorDetail}\`\n\nيرجى التأكد من نشر Apps Script بشكل صحيح وإمكانية الوصول إليه.`;
      
      await ctx.telegram.editMessageText(chatId, statusMsg.message_id, null, getBilingualText(enErr, arErr), { parse_mode: "Markdown" });
    }

  } catch (e) {
    console.error("[handleOpsGsync] Error:", e.message);
    const enErr = `❌ *System Error during Sync*\n\nError: \`${e.message}\``;
    const arErr = `❌ *خطأ في النظام أثناء المزامنة*\n\nالخطأ: \`${e.message}\``;
    await ctx.reply(getBilingualText(enErr, arErr), { 
      parse_mode: "Markdown",
      message_thread_id: threadId 
    }).catch(() => {});
  }
}

// Pre-filter patterns — messages matching these are NEVER sent to AI
const IGNORE_PATTERNS = [
  /^(ok|okay|noted|sure|yes|no|done|تم|نعم|لا|شكراً|شكرا|ثانكس|thanks|thank you|👍|👌|✅|🙏|حسناً|حسنا|موافق|تمام|ماشي|ايوه|ايوا|يسلمو|يعطيك العافية|عافية|جيد|good|great|perfect|nice|cool|wow|هلا|هلو|hi|hello|السلام عليكم|وعليكم السلام|صباح الخير|مساء الخير|صباح النور|مساء النور|كيف الحال|بخير|الحمد لله)$/i,
];

async function handleOpsPassive(ctx) {
  const userMessage = ctx.message?.text;
  if (!userMessage || userMessage.startsWith("/")) return;

  // Hard pre-filters — skip before even calling AI
  const trimmed = userMessage.trim();

  // 1. Ignore very short messages (less than 15 chars)
  if (trimmed.length < 15) return;

  // 2. Ignore simple acknowledgments, greetings, reactions
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(trimmed)) return;
  }

  // 3. Ignore messages that are only emojis or punctuation
  const textOnly = trimmed.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\s.,!?،؟]/gu, "");
  if (textOnly.length < 5) return;

  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const rawFromUser = ctx.from?.first_name || ctx.from?.username || "Unknown";
  const rawUsername = ctx.from?.username ? `@${ctx.from.username}` : rawFromUser;
  // Resolve to real name if known team member
  const fromUser = getDisplayName(rawUsername) !== rawUsername ? getDisplayName(rawUsername) : rawFromUser;
  const username = rawUsername;

  try {
    const ai = require("../services/ai");
    
    // Store this message in conversation memory (before AI analysis)
    opsDb.storeConversationMessage(chatId, threadId, fromUser, userMessage);
    
    // Retrieve recent conversation history for context (last 20 messages)
    const history = opsDb.getConversationHistory(chatId, threadId, 20);
    
    const analysis = await ai.analyzeOpsMessage(userMessage, fromUser, history);

    if (!analysis || !analysis.actionable) return;

    console.log(`[AI-Ops] Actionable message from ${fromUser}:`, analysis.category);

    const data = analysis.data || {};
    let resultText = "";

    if (analysis.category === "new_task") {
      const taskTitle = data.title || userMessage.substring(0, 50);
      const rawAssignee = data.assignee || fromUser;
      const assignedTo = normalizeAssignee(rawAssignee);
      const createdByNorm = normalizeAssignee(username) || username;

      // ─── Deduplication Check ─────────────────────────────
      const pendingTasks = opsDb.getAllPendingTasks(chatId);
      const duplicate = findDuplicateTask(pendingTasks, taskTitle, assignedTo || rawAssignee);

      if (duplicate) {
        const dupAssignee = duplicate.assigned_to || "Unassigned";
        const enDup = `\u26a0\ufe0f *Similar task already exists*\n\n\ud83d\udccb Task #${duplicate.id}: ${safeTxt(duplicate.title)}\n\ud83d\udc64 Assigned to: ${dupAssignee}\n\ud83d\udcca Status: ${duplicate.status}`;
        const arDup = `\u26a0\ufe0f *\u062a\u0648\u062c\u062f \u0645\u0647\u0645\u0629 \u0645\u0634\u0627\u0628\u0647\u0629 \u0628\u0627\u0644\u0641\u0639\u0644*\n\n\ud83d\udccb \u0627\u0644\u0645\u0647\u0645\u0629 #${duplicate.id}: ${safeTxt(duplicate.title)}\n\ud83d\udc64 \u0627\u0644\u0645\u0633\u0624\u0648\u0644: ${dupAssignee}\n\ud83d\udcca \u0627\u0644\u062d\u0627\u0644\u0629: ${duplicate.status}`;
        resultText = getBilingualText(enDup, arDup);
      } else {
        const taskId = opsDb.addTask(
          chatId, 
          threadId, 
          getTopicInfo(threadId).name, 
          taskTitle,
          {
            description: data.description || userMessage,
            priority: data.priority || "normal",
            assignedTo: assignedTo,
            dueDate: data.due_date || null,
            createdBy: createdByNorm
          }
        );
        resultText = `${analysis.reply_en} [#${taskId}]\n${analysis.reply_ar} [#${taskId}]`;
      }
    } 
    else if (analysis.category === "status_update" || analysis.category === "completion") {
      const taskId = data.task_id;
      const isDone = analysis.category === "completion";
      
      if (taskId) {
        if (isDone) opsDb.markTaskDone(taskId);
        // Status updates (in progress) are just acknowledged as there is no specific 'update' field in the schema
        resultText = `${analysis.reply_en}\n${analysis.reply_ar}`;
      } else {
        // Try to find task by title if no ID
        const pending = opsDb.getAllPendingTasks(chatId);
        const bestMatch = pending.find(t => 
          t.title.toLowerCase().includes((data.title || "").toLowerCase()) || 
          (data.title || "").toLowerCase().includes(t.title.toLowerCase())
        );
        
        if (bestMatch) {
          if (isDone) opsDb.markTaskDone(bestMatch.id);
          resultText = `${analysis.reply_en} [#${bestMatch.id}]\n${analysis.reply_ar} [#${bestMatch.id}]`;
        } else {
          // Just acknowledge if no specific task found
          resultText = `${analysis.reply_en}\n${analysis.reply_ar}`;
        }
      }
    }

    if (resultText) {
      // Reply to the original message so the response is clearly attributed
      const replyOpts = {
        message_thread_id: threadId,
        reply_to_message_id: ctx.message.message_id,
        parse_mode: "Markdown",
      };
      try {
        await ctx.reply(resultText, replyOpts);
      } catch (mdErr) {
        // Markdown parse failed (e.g. special chars in task title) — fall back to plain text
        console.warn("[AI-Ops] Markdown reply failed, retrying as plain text:", mdErr.message);
        const plainOpts = { message_thread_id: threadId, reply_to_message_id: ctx.message.message_id };
        await ctx.reply(resultText.replace(/[_*`\[\]]/g, ""), plainOpts).catch(e2 => {
          console.error("[AI-Ops] Plain text reply also failed:", e2.message);
        });
      }
    }
  } catch (error) {
    console.error("[AI-Ops] Error in handleOpsPassive:", error.message);
  }
}

async function registerTopicName(ctx) {
  // Logic to register thread names
}

async function handleOpsVoice(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const rawFromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const fromUser = getDisplayName(rawFromUser) !== rawFromUser ? `${getDisplayName(rawFromUser)} (${rawFromUser})` : rawFromUser;
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

    if (!transcription) return ctx.reply("🎤 Could not transcribe / تعذر تفريغ الصوت", { message_thread_id: threadId });

    const msgLang = detectMessageLanguage(transcription);
    opsDb.addMediaLog(chatId, threadId, topicInfo.name, voice.file_id, "voice", { caption: transcription.substring(0, 500), fromUser });

    const headerEn = `🎤 *Voice Transcription*`;
    const headerAr = `🎤 *تفريغ الرسالة الصوتية*`;
    await ctx.reply(`${getBilingualText(headerEn, headerAr)}\n👤 ${fromUser}\n\n${transcription}`, { parse_mode: "Markdown", message_thread_id: threadId });

    const systemPrompt = buildSystemPrompt(topicInfo, msgLang);
    const aiMessages = [
      { role: "system", content: systemPrompt + "\n\nA voice message was just transcribed. Analyze it for action items and CREATE them immediately." },
      { role: "user", content: `${fromUser} sent a voice message:\n\n"${transcription}"\n\nExtract and create any action items.` },
    ];

    let response = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages: aiMessages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
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
    await ctx.reply("🎤 Error processing voice message / خطأ في معالجة الصوت", { message_thread_id: threadId });
  }
}

async function handleOpsMessage(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const rawFromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  // Resolve to real name if known team member
  const fromUser = getDisplayName(rawFromUser) !== rawFromUser ? `${getDisplayName(rawFromUser)} (${rawFromUser})` : rawFromUser;
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
  const msgLang = detectMessageLanguage(text);

  if (!text || text.length < 3) return;

  try { await ctx.sendChatAction("typing"); } catch (e) {}

  const systemPrompt = buildSystemPrompt(topicInfo, msgLang);
  const aiMessages = [{ role: "system", content: systemPrompt }];
  const history = getConversationHistory(chatId, threadId);
  history.forEach(msg => aiMessages.push(msg));

  if (isReplyToBot && ctx.message.reply_to_message.text) {
    aiMessages.push({ role: "assistant", content: ctx.message.reply_to_message.text });
  }

  aiMessages.push({ role: "user", content: `${fromUser}: ${text}` });

  try {
    let response = await openaiClient.chat.completions.create({ model: config.aiModel || "gpt-4.1-mini", messages: aiMessages, tools: OPS_TOOLS, tool_choice: "auto", max_tokens: 1200, temperature: 0.3 });
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
      addToConversation(chatId, threadId, "user", `${fromUser}: ${text}`);
      addToConversation(chatId, threadId, "assistant", aiReply);
      try { await ctx.reply(aiReply, { parse_mode: "Markdown", message_thread_id: threadId }); }
      catch (e) { await ctx.reply(aiReply.replace(/[_*`\[\]]/g, ""), { message_thread_id: threadId }); }
    } else if (allToolResults.length > 0) {
      const summary = buildToolResultsSummary(allToolResults, msgLang);
      if (summary) await ctx.reply(summary, { parse_mode: "Markdown", message_thread_id: threadId });
    }
  } catch (error) {
    console.error("[Ops] AI Error:", error.message);
    const en = "⚠️ I encountered an error. Please try again later.";
    const ar = "⚠️ واجهت خطأ. يرجى المحاولة مرة أخرى لاحقاً.";
    await ctx.reply(getBilingualText(en, ar), { message_thread_id: threadId });
  }
}

// ─── AI Tool Definitions & Execution ────────────────────────

const OPS_TOOLS = [
  { type: "function", function: { name: "create_task", description: "Creates a single task with priority, assignee, and property tag.", parameters: { type: "object", properties: { title: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"] }, assigned_to: { type: "string" }, property_tag: { type: "string" }, due_date: { type: "string" } }, required: ["title"] } } },
  { type: "function", function: { name: "create_tasks_batch", description: "Creates multiple tasks at once.", parameters: { type: "object", properties: { tasks: { type: "array", items: { type: "object", properties: { title: { type: "string" }, priority: { type: "string" }, assigned_to: { type: "string" }, property_tag: { type: "string" }, due_date: { type: "string" } }, required: ["title"] } } }, required: ["tasks"] } } },
  { type: "function", function: { name: "create_reminder", description: "Sets a timed reminder (e.g., 'in 2 hours', 'tomorrow 9am').", parameters: { type: "object", properties: { message: { type: "string" }, time: { type: "string" } }, required: ["message", "time"] } } },
  { type: "function", function: { name: "mark_task_done", description: "Marks a task as complete by ID.", parameters: { type: "object", properties: { task_id: { type: "number" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "move_task", description: "Moves a task to a different topic thread.", parameters: { type: "object", properties: { task_id: { type: "number" }, target_topic: { type: "string", enum: ["ceo", "ops", "listings", "bookings", "support", "tech", "payments", "marketing", "legal", "blockers"] } }, required: ["task_id", "target_topic"] } } },
  { type: "function", function: { name: "log_maintenance", description: "Logs maintenance work and costs for a property.", parameters: { type: "object", properties: { unit_id: { type: "string" }, description: { type: "string" }, cost: { type: "number" } }, required: ["unit_id", "description"] } } },
  { type: "function", function: { name: "log_cleaning", description: "Logs a cleaning session (checkin/checkout/deep).", parameters: { type: "object", properties: { unit_id: { type: "string" }, type: { type: "string", enum: ["checkin", "checkout", "deep"] }, cleaner: { type: "string" } }, required: ["unit_id", "type"] } } },
  { type: "function", function: { name: "record_expense", description: "Records a financial expense.", parameters: { type: "object", properties: { amount: { type: "number" }, description: { type: "string" }, property_tag: { type: "string" } }, required: ["amount", "description"] } } },
];

function executeTool(name, args, chatId, threadId, topicInfo, fromUser) {
  try {
    if (name === "create_task") {
      const resolvedAssignee = normalizeAssignee(args.assigned_to);
      // Deduplication check
      const pendingTasks = opsDb.getAllPendingTasks(chatId);
      const duplicate = findDuplicateTask(pendingTasks, args.title, resolvedAssignee || args.assigned_to);
      if (duplicate) {
        return { status: "duplicate", existing_task_id: duplicate.id, existing_title: duplicate.title, message: `Similar task #${duplicate.id} already exists: ${safeTxt(duplicate.title)}` };
      }
      const id = opsDb.addTask(chatId, threadId, topicInfo.name, args.title, { createdBy: normalizeAssignee(fromUser) || "AI", assignedTo: resolvedAssignee, priority: args.priority, propertyTag: args.property_tag, dueDate: args.due_date });
      return { status: "success", task_id: id, title: args.title };
    }
    if (name === "create_tasks_batch") {
      const pendingTasks = opsDb.getAllPendingTasks(chatId);
      const results = [];
      for (const t of args.tasks) {
        const resolvedAssignee = normalizeAssignee(t.assigned_to);
        const duplicate = findDuplicateTask(pendingTasks, t.title, resolvedAssignee || t.assigned_to);
        if (duplicate) {
          results.push({ status: "duplicate", existing_task_id: duplicate.id, title: t.title });
        } else {
          const id = opsDb.addTask(chatId, threadId, topicInfo.name, t.title, { createdBy: normalizeAssignee(fromUser) || "AI", assignedTo: resolvedAssignee, priority: t.priority, propertyTag: t.property_tag, dueDate: t.due_date });
          results.push({ status: "created", task_id: id, title: t.title });
          // Add to pending list so subsequent tasks in the batch also check against it
          pendingTasks.push({ id, title: t.title, assigned_to: resolvedAssignee, status: "pending" });
        }
      }
      const created = results.filter(r => r.status === "created");
      const duplicates = results.filter(r => r.status === "duplicate");
      return { status: "success", count: created.length, task_ids: created.map(r => r.task_id), duplicates_skipped: duplicates.length, details: results };
    }
    if (name === "create_reminder") {
      const remindAt = parseReminderTime(args.time);
      if (!remindAt) return { status: "error", message: "Invalid time format" };
      opsDb.addReminder(chatId, threadId, topicInfo.name, args.message, remindAt, "AI");
      return { status: "success", message: args.message, time: remindAt };
    }
    if (name === "mark_task_done") {
      opsDb.markTaskDone(args.task_id);
      return { status: "success", task_id: args.task_id };
    }
    if (name === "move_task") {
      const targetThreadId = THREAD_IDS[args.target_topic.toUpperCase()];
      if (!targetThreadId) return { status: "error", message: "Invalid topic" };
      const targetInfo = getTopicInfo(targetThreadId);
      opsDb.moveTask(args.task_id, targetThreadId, targetInfo.name);
      return { status: "success", task_id: args.task_id, target: targetInfo.name };
    }
    if (name === "log_maintenance") {
      const id = v5Db.addMaintenanceLog(chatId, args.unit_id, args.description, args.cost || 0, fromUser, topicInfo.name, threadId);
      return { status: "success", log_id: id, unit: args.unit_id };
    }
    if (name === "log_cleaning") {
      const id = v5Db.addCleaningLog(chatId, args.unit_id, args.type, args.cleaner || fromUser, "AI Logged", threadId);
      return { status: "success", log_id: id, unit: args.unit_id, type: args.type };
    }
    if (name === "record_expense") {
      const id = opsDb.addExpense(chatId, threadId, topicInfo.name, args.amount, args.description, { propertyTag: args.property_tag, createdBy: "AI" });
      return { status: "success", expense_id: id, amount: args.amount };
    }
  } catch (e) { return { status: "error", message: e.message }; }
  return { status: "error", message: "Unknown tool" };
}

function buildToolResultsSummary(results, lang) {
  if (results.length === 0) return "";
  let en = `✅ *AI Action Summary*\n\n`;
  let ar = `✅ *ملخص إجراءات الذكاء الاصطناعي*\n\n`;
  results.forEach(r => {
    if (r.tool === "create_task") {
      if (r.result.status === "duplicate") {
        en += `• ⚠️ Similar task already exists: #${r.result.existing_task_id} — ${r.result.existing_title}\n`;
        ar += `• ⚠️ مهمة مشابهة موجودة: #${r.result.existing_task_id} — ${r.result.existing_title}\n`;
      } else {
        en += `• Task #${r.result.task_id} created\n`; ar += `• تم إنشاء المهمة #${r.result.task_id}\n`;
      }
    }
    if (r.tool === "create_tasks_batch") {
      en += `• ${r.result.count} tasks created\n`; ar += `• تم إنشاء ${r.result.count} مهام\n`;
      if (r.result.duplicates_skipped > 0) {
        en += `• ⚠️ ${r.result.duplicates_skipped} duplicate(s) skipped\n`; ar += `• ⚠️ تم تخطي ${r.result.duplicates_skipped} مهمة مكررة\n`;
      }
    }
    if (r.tool === "create_reminder") { en += `• Reminder set for ${r.result.time}\n`; ar += `• تم ضبط تذكير في ${r.result.time}\n`; }
    if (r.tool === "mark_task_done") { en += `• Task #${r.result.task_id} completed\n`; ar += `• تم إكمال المهمة #${r.result.task_id}\n`; }
    if (r.tool === "log_maintenance") { en += `• Maintenance logged for #${r.result.unit}\n`; ar += `• تم تسجيل صيانة للعقار #${r.result.unit}\n`; }
    if (r.tool === "log_cleaning") { en += `• ${r.result.type} cleaning logged for #${r.result.unit}\n`; ar += `• تم تسجيل تنظيف ${r.result.type} للعقار #${r.result.unit}\n`; }
  });
  return getBilingualText(en, ar);
}

function buildSystemPrompt(topicInfo, lang) {
  const time = new Date(Date.now() + 3 * 3600000).toLocaleString("en-US", { timeZone: "Asia/Riyadh" });
  const teamDir = getTeamDirectory();
  const prompt = `You are the **Monthly Key Operations Intelligence (MKOI)**, an elite AI assistant managing the HQ Operations for Monthly Key in Riyadh.

### CURRENT CONTEXT
- **Time:** ${time} (KSA)
- **Current Topic:** ${topicInfo.name} (${topicInfo.emoji})
- **Your Role in this Topic:** ${topicInfo.role}

### TEAM DIRECTORY
Always use real names when addressing team members. Map usernames to names:
${teamDir}

When a team member sends a message, address them by their real name. For example, if @SAQ198 sends a message, address them as "Saad Al Qasem". If @Mushtaq sends a message, address them as "Mushtaq".

### YOUR CAPABILITIES & CORE DIRECTIVES
1. **Full Context Awareness:** You remember everything discussed in this thread. Use the conversation history to provide continuity.
2. **Proactive Management:** DO NOT wait for permission. If you detect a need for a task, reminder, maintenance log, or cleaning session, **USE YOUR TOOLS IMMEDIATELY**.
3. **Task Intelligence:** When creating tasks, automatically infer priority (low/medium/high/urgent), property tags (#unit5), and assignees from context. ALWAYS use real names for assignees (e.g., "Mushtaq" not "@Mushtaq", "Saad Al Qasem" not "@SAQ198").
4. **Bilingual Excellence:** Respond **entirely** in ${lang === "ar" ? "Arabic" : "English"} as detected.
5. **Tone:** Professional, high-efficiency, executive-level assistant.

### DUPLICATE PREVENTION
- Before creating a task, the system will automatically check for similar existing tasks.
- If the create_task tool returns status "duplicate", inform the user about the existing task instead of creating a new one.
- Do NOT create tasks that are semantically identical to existing pending tasks (e.g., "Visit uniform shop for staff uniforms" and "Visit uniform shop to prepare staff uniforms" are the SAME task).

### OPERATIONS ARCHITECTURE (All 49 Features)
You have full authority over:
- **Task Management:** Creation, Batching, Moving, Dependencies, Recurring tasks.
- **Facility Ops:** Maintenance logs (mlog), Cleaning sessions, Property photo approvals.
- **Team Ops:** Roles, Onboarding, Performance, Availability, Check-ins.
- **Financial Ops:** Expense tracking, Occupancy monitoring, Revenue reporting.
- **Strategy:** Idea brainstorming, Weekly CEO updates, Daily briefings.

### INTERACTION RULES
- If a user says "I will do X", create a task for them.
- If a user mentions a problem in a unit, log maintenance and create a follow-up task.
- If a user mentions a cleaning is done, log the cleaning session.
- Always confirm your actions briefly with IDs where applicable.
- When responding to Top Management or CEO, be extra respectful and prioritize their requests.

\u26a0\ufe0f **STRICT:** Use the provided tools for all operational actions. Your goal is to keep the operation running perfectly without manual intervention.`;
  return prompt;
}

// ─── Helper Functions ───────────────────────────────────────

function getEmojiFromName(name) {
  const n = name.toLowerCase();
  if (n.includes("rule") || n.includes("guide")) return "📋";
  if (n.includes("ceo") || n.includes("update")) return "📊";
  if (n.includes("operation") || n.includes("ops")) return "🔧";
  if (n.includes("listing") || n.includes("inventory")) return "🏠";
  if (n.includes("booking") || n.includes("revenue")) return "💰";
  if (n.includes("support") || n.includes("complaint")) return "🎧";
  if (n.includes("tech") || n.includes("issue")) return "💻";
  if (n.includes("payment") || n.includes("finance")) return "💳";
  if (n.includes("marketing") || n.includes("content")) return "📣";
  if (n.includes("legal") || n.includes("compliance")) return "⚖️";
  if (n.includes("blocker") || n.includes("escalation")) return "🚨";
  if (n.includes("complete")) return "✅";
  if (n.includes("priority") || n.includes("tomorrow")) return "📌";
  return "💬";
}

function parseReminderTime(str) {
  if (!str) return null;
  const now = new Date();
  const ksaNow = new Date(now.getTime() + 3 * 3600000);
  const s = str.toLowerCase().trim();
  let target = new Date(ksaNow);

  if (s.match(/^(\d+)([hm])$/)) {
    const m = s.match(/^(\d+)([hm])$/);
    const val = parseInt(m[1]);
    if (m[2] === "h") target.setHours(target.getHours() + val);
    else target.setMinutes(target.getMinutes() + val);
  } else if (s.match(/^(\d{1,2})([ap]m)$/)) {
    const m = s.match(/^(\d{1,2})([ap]m)$/);
    let h = parseInt(m[1]);
    if (m[2] === "pm" && h < 12) h += 12;
    if (m[2] === "am" && h === 12) h = 0;
    target.setHours(h, 0, 0, 0);
    if (target < ksaNow) target.setDate(target.getDate() + 1);
  } else if (s.startsWith("tomorrow")) {
    target.setDate(target.getDate() + 1);
    const timePart = s.replace("tomorrow", "").trim();
    if (timePart.match(/^(\d{1,2})([ap]m)$/)) {
      const m = timePart.match(/^(\d{1,2})([ap]m)$/);
      let h = parseInt(m[1]);
      if (m[2] === "pm" && h < 12) h += 12;
      if (m[2] === "am" && h === 12) h = 0;
      target.setHours(h, 0, 0, 0);
    } else { target.setHours(9, 0, 0, 0); }
  } else { return null; }

  const utcDate = new Date(target.getTime() - 3 * 3600000);
  return utcDate.toISOString().replace("T", " ").substring(0, 19);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function transcribeAudio(openai, filePath) {
  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });
    return response.text;
  } catch (e) { console.error("[Whisper] Error:", e.message); return null; }
}

async function handleOpsMedia(ctx, openaiClient) {
  const threadId = ctx.message?.message_thread_id || null;
  const topicInfo = getTopicInfo(threadId);
  const chatId = ctx.chat.id;
  const rawFromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const fromUser = getDisplayName(rawFromUser) !== rawFromUser ? `${getDisplayName(rawFromUser)} (${rawFromUser})` : rawFromUser;
  const photo = ctx.message.photo;
  if (!photo) return;

  const fileId = photo[photo.length - 1].file_id;
  const caption = ctx.message.caption || "";
  const propertyTag = extractPropertyTag(caption);

  opsDb.addMediaLog(chatId, threadId, topicInfo.name, fileId, "photo", { caption, fromUser, propertyTag });

  if (threadId === 10 || threadId === 103) {
    if (threadId === 10) {
      try {
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
        const aiMessages = [
          { role: "system", content: "You are a receipt scanner. Extract amount, store name, and items. Reply in bilingual EN+AR format." },
          { role: "user", content: [ { type: "text", text: "Extract details from this receipt:" }, { type: "image_url", image_url: { url: fileUrl } } ] }
        ];
        const response = await openaiClient.chat.completions.create({ model: "gpt-4.1-mini", messages: aiMessages, max_tokens: 500 });
        const analysis = response.choices[0]?.message?.content;
        if (analysis) await ctx.reply(analysis, { parse_mode: "Markdown", message_thread_id: threadId, reply_to_message_id: ctx.message.message_id });
      } catch (e) { console.error("[Receipt] Error:", e.message); }
    } else if (threadId === 103) {
      await handleOpsPhotos(ctx);
    }
  }
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  handleOpsTask, handleOpsChecklist, handleOpsTasks, handleOpsDone, handleDoneCallback,
  handleOpsRemind, handleOpsSummary, handleOpsKpi, handleOpsProperty,
  handleOpsMove, handleOpsHandover, handleOpsMonthlyReport, handleOpsExpense,
  handleOpsExpenses,
  handleOpsOccupancy, handleOpsSla,
  handleOpsApprove,
  handleOpsReject,
  handleOpsDepends,
  handleOpsVoice, handleOpsMessage, handleOpsMedia,
  handleOpsMlog, handleOpsWorkflow, handleOpsTemplate, handleOpsTrends, handleOpsWeather, handleOpsClean,
  handleOpsIdea, handleOpsIdeas, handleOpsBrainstorm, handleOpsPhotos, handlePhotoReviewCallback,
  handleIdeaVoteCallback,
  handleOpsGsync, handleOpsRecurring, handleOpsMeeting, handleOpsPassive, registerTopicName,
};
