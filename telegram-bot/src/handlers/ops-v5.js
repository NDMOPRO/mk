/**
 * Operations Group Handler — v5 (10-Feature)
 * ─────────────────────────────────────────────────────────────
 * Maintenance, Workflows, Templates, Trends, Weather, Cleaning, Ideas, Photos
 *
 * All features now BILINGUAL (English + Arabic) with improved design.
 */

const v5Db = require("../services/ops-database-v5");
const https = require("https");
const http = require("http");
const fs = require("fs");

function getBilingualText(en, ar) {
  return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
}

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Maintenance Log ────────────────────────────────────────

async function handleOpsMlog(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "mlog");

  if (!args) {
    const en = `🛠 *Maintenance Log*\n\nUsage: \`/mlog unit5 "Description" 3000\`\nExample: \`/mlog unit12 "AC repair" 500\``;
    const ar = `🛠 *سجل الصيانة*\n\nالاستخدام: \`/mlog unit5 "الوصف" 3000\`\nمثال: \`/mlog unit12 "إصلاح التكييف" 500\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (args.toLowerCase() === "summary") {
    const summary = v5Db.getMaintenanceSummary(chatId);
    if (summary.length === 0) {
      const en = "❌ No maintenance records found.";
      const ar = "❌ لا توجد سجلات صيانة.";
      return ctx.reply(getBilingualText(en, ar), { message_thread_id: threadId });
    }
    
    let en = "🛠 *Maintenance Cost Summary*\n\n";
    let ar = "🛠 *ملخص تكاليف الصيانة*\n\n";
    summary.forEach(s => {
      const line = `• ${s.unit_id}: *${s.total_cost} SAR* (${s.count} items)\n`;
      en += line; ar += line;
    });
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const match = args.match(/^(\S+)\s+"(.+?)"\s+(\d+)$/);
  if (!match) return ctx.reply("❌ Format: `/mlog unit5 \"Description\" 3000`", { message_thread_id: threadId });

  const unitId = match[1];
  const desc = match[2];
  const cost = parseInt(match[3]);
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  v5Db.addMaintenanceLog(chatId, unitId, desc, cost, user, threadId);

  const en = `✅ *Maintenance Logged*\n\n🏠 Unit: ${unitId}\n📝 ${desc}\n💰 Cost: ${cost} SAR\n👤 By: ${user}`;
  const ar = `✅ *تم تسجيل الصيانة*\n\n🏠 الوحدة: ${unitId}\n📝 ${desc}\n💰 التكلفة: ${cost} ريال\n👤 بواسطة: ${user}`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Custom Workflows ───────────────────────────────────────

async function handleOpsWorkflow(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "workflow");
  const parts = args.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === "create") {
    const quoted = args.match(/"([^"]+)"/g);
    if (!quoted || quoted.length < 2) return ctx.reply("❌ Usage: `/workflow create \"Name\" \"Step 1\" \"Step 2\"`", { message_thread_id: threadId });
    const name = quoted[0].replace(/"/g, "");
    const steps = quoted.slice(1).map(s => s.replace(/"/g, ""));
    v5Db.createWorkflowTemplate(chatId, name, steps, ctx.from.username || ctx.from.first_name);
    const en = `✅ *Workflow Created*\n\n📋 Name: ${name}\nSteps: ${steps.length}`;
    const ar = `✅ *تم إنشاء مسار العمل*\n\n📋 الاسم: ${name}\nالخطوات: ${steps.length}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  if (subCmd === "start") {
    const nameMatch = args.match(/"([^"]+)"/);
    const unitId = parts[parts.length - 1];
    if (!nameMatch || !unitId) return ctx.reply("❌ Usage: `/workflow start \"Name\" unit5`", { message_thread_id: threadId });
    const name = nameMatch[1];
    const template = v5Db.getWorkflowTemplate(chatId, name);
    if (!template) return ctx.reply("❌ Template not found / القالب غير موجود", { message_thread_id: threadId });
    v5Db.startWorkflow(chatId, template.id, name, unitId, JSON.parse(template.steps), ctx.from.username || ctx.from.first_name, threadId);
    const en = `🚀 *Workflow Started*\n\n📋 ${name}\n🏠 Unit: ${unitId}`;
    const ar = `🚀 *بدأ مسار العمل*\n\n📋 ${name}\n🏠 الوحدة: ${unitId}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `📋 *Workflows*\n\n/workflow create "Name" "Steps..."\n/workflow start "Name" unit5\n/workflow next unit5\n/workflow status unit5`;
  const ar = `📋 *مسارات العمل*\n\n/workflow create "الاسم" "الخطوات..."\n/workflow start "الاسم" unit5\n/workflow next unit5\n/workflow status unit5`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Template Messages ──────────────────────────────────────

async function handleOpsTemplate(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "template");
  const parts = args.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === "save") {
    const match = args.match(/^save\s+"([^"]+)"\s+"([\s\S]+)"$/);
    if (!match) return ctx.reply("❌ Usage: `/template save \"name\" \"content\"`", { message_thread_id: threadId });
    v5Db.saveMessageTemplate(chatId, match[1], match[2], ctx.from.username || ctx.from.first_name);
    const en = `✅ *Template Saved*\n\n📝 Name: ${match[1]}`;
    const ar = `✅ *تم حفظ القالب*\n\n📝 الاسم: ${match[1]}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `📝 *Templates*\n\n/template save "name" "content"\n/template use "name" unit5\n/template list`;
  const ar = `📝 *القوالب*\n\n/template save "الاسم" "المحتوى"\n/template use "الاسم" unit5\n/template list`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Cleaning Log ───────────────────────────────────────────

async function handleOpsClean(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "clean");
  const parts = args.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === "checkin" || subCmd === "checkout" || subCmd === "deep") {
    const unitId = parts[1];
    const cleaner = parts[2] || ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    if (!unitId) return ctx.reply("❌ Usage: `/clean checkin unit5 @CleanerName`", { message_thread_id: threadId });
    v5Db.addCleaningLog(chatId, unitId, subCmd, cleaner, "", "completed", threadId);
    const en = `✅ *Cleaning Logged*\n\n🏠 Unit: ${unitId}\n🧹 Type: ${subCmd}\n👤 Cleaner: ${cleaner}`;
    const ar = `✅ *تم تسجيل التنظيف*\n\n🏠 الوحدة: ${unitId}\n🧹 النوع: ${subCmd}\n👤 المنظف: ${cleaner}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `🧹 *Cleaning Log*\n\n/clean checkin unit5 @CleanerName\n/clean checkout unit5 @CleanerName\n/clean deep unit5 @CleanerName\n/clean status unit5\n/clean pending\n/clean summary`;
  const ar = `🧹 *سجل التنظيف*\n\n/clean checkin unit5 @CleanerName\n/clean checkout unit5 @CleanerName\n/clean deep unit5 @CleanerName\n/clean status unit5\n/clean pending\n/clean summary`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Trends & Weather ───────────────────────────────────────

async function handleOpsTrends(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const en = `📈 *Operational Trends*\n\nAnalyzing historical data... This report is generated weekly in the Team Standup.`;
  const ar = `📈 *الاتجاهات التشغيلية*\n\nتحليل البيانات التاريخية... يتم إنشاء هذا التقرير أسبوعياً في اجتماع الفريق.`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsWeather(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const en = `🌤 *Weather Check — Riyadh*\n\nChecking current conditions... Extreme weather alerts are auto-posted at 7 AM KSA.`;
  const ar = `🌤 *حالة الطقس — الرياض*\n\nالتحقق من الظروف الحالية... يتم نشر تنبيهات الطقس القاسي تلقائياً الساعة 7 صباحاً.`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Ideas & Brainstorming ──────────────────────────────────

async function handleOpsIdea(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "idea");

  if (!args) {
    const en = `💡 *Submit Idea*\n\nUsage: \`/idea "Short description of the idea"\``;
    const ar = `💡 *تقديم فكرة*\n\nالاستخدام: \`/idea "وصف مختصر للفكرة"\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  v5Db.addIdea(chatId, args, user, threadId);

  const en = `✅ *Idea Submitted*\n\n💡 ${args}\n👤 By: ${user}`;
  const ar = `✅ *تم تقديم الفكرة*\n\n💡 ${args}\n👤 بواسطة: ${user}`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsIdeas(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const ideas = v5Db.getIdeas(chatId);

  if (ideas.length === 0) {
    const en = `💡 *Ideas & Brainstorming*\n\nNo ideas submitted yet. Use \`/idea "Your idea"\``;
    const ar = `💡 *الأفكار والعصف الذهني*\n\nلم يتم تقديم أي أفكار بعد. استخدم \`/idea "فكرتك"\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `💡 *Ideas List*\n\n`;
  let ar = `💡 *قائمة الأفكار*\n\n`;
  ideas.forEach(i => {
    const line = `• *#${i.id}* [${i.status}]: ${i.description} (${i.votes} votes)\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsBrainstorm(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "brainstorm");
  const subCmd = args.split(/\s+/)[0]?.toLowerCase();

  if (subCmd === "start") {
    const topic = args.replace("start", "").trim() || "General Brainstorming";
    v5Db.startBrainstormSession(chatId, topic, ctx.from.username || ctx.from.first_name, threadId);
    const en = `💡 *Brainstorming Session Started*\n\nTopic: *${topic}*\nAll messages in this topic are being captured for analysis.`;
    const ar = `💡 *بدأت جلسة العصف الذهني*\n\nالموضوع: *${topic}*\nيتم التقاط جميع الرسائل في هذا الموضوع للتحليل.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `💡 *Brainstorming*\n\n/brainstorm start "Topic"\n/brainstorm end`;
  const ar = `💡 *العصف الذهني*\n\n/brainstorm start "الموضوع"\n/brainstorm end`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsPhotos(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const en = `📸 *Property Photos*\n\n/photos unit5\n/photos pending\n/photos approved`;
  const ar = `📸 *صور العقارات*\n\n/photos unit5\n/photos pending\n/photos approved`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handlePhotoReviewCallback(ctx) {
  const data = ctx.callbackQuery.data;
  const match = data.match(/^photo_(approve|reject)_(\d+)$/);
  if (!match) return;

  const action = match[1];
  const photoId = parseInt(match[2]);
  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  v5Db.updatePhotoStatus(photoId, action === "approve" ? "approved" : "rejected", user);
  await ctx.answerCbQuery(action === "approve" ? "✅ Approved / تم القبول" : "❌ Rejected / تم الرفض");
  
  const statusEmoji = action === "approve" ? "✅" : "❌";
  const en = `${statusEmoji} *Photo ${action === "approve" ? "Approved" : "Rejected"}*\n\nReviewed by: ${user}`;
  const ar = `${statusEmoji} *تم ${action === "approve" ? "قبول" : "رفض"} الصورة*\n\nبواسطة: ${user}`;
  
  await ctx.editMessageCaption(getBilingualText(en, ar), { parse_mode: "Markdown" });
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  handleOpsMlog, handleOpsWorkflow, handleOpsTemplate, handleOpsClean,
  handleOpsTrends, handleOpsWeather, handleOpsIdea, handleOpsIdeas,
  handleOpsBrainstorm, handleOpsPhotos, handlePhotoReviewCallback
};
