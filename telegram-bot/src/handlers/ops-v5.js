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
  // Markdown v1 only needs _ * ` [ escaped
  return String(text).replace(/([_*`\[])/g, "\\$1");
}

// ─── Maintenance Log ────────────────────────────────────────

async function handleOpsMlog(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsMlog] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Custom Workflows ───────────────────────────────────────

async function handleOpsWorkflow(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsWorkflow] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Template Messages ───────────────────────────────────────
async function handleOpsTemplate(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "template");
  const parts = args.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === "save") {
    const match = args.match(/^save\s+"([^"]+)"\s+"([\s\S]+)"$/);
    if (!match) return ctx.reply("❌ Usage: `/template save \"name\" \"content\"`", { message_thread_id: threadId });
    v5Db.saveTemplate(chatId, match[1], match[2], ctx.from.username || ctx.from.first_name);
    const en = `✅ *Template Saved*\n\n📝 Name: ${match[1]}`;
    const ar = `✅ *تم حفظ القالب*\n\n📝 الاسم: ${match[1]}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `📝 *Templates*\n\n/template save "name" "content"\n/template use "name" unit5\n/template list`;
  const ar = `📝 *القوالب*\n\n/template save "الاسم" "المحتوى"\n/template use "الاسم" unit5\n/template list`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsTemplate] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Cleaning Log ───────────────────────────────────────────

async function handleOpsClean(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "clean");
  const parts = args.split(/\s+/);
  const subCmd = parts[0]?.toLowerCase();

  if (subCmd === "checkin" || subCmd === "checkout" || subCmd === "deep") {
    const unitId = parts[1];
    const cleaner = parts[2] || ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    if (!unitId) return ctx.reply("❌ Usage: `/clean checkin unit5 @CleanerName`", { message_thread_id: threadId });
    v5Db.addCleaningLog(chatId, unitId, subCmd, cleaner, "", threadId);
    const en = `✅ *Cleaning Logged*\n\n🏠 Unit: ${unitId}\n🧹 Type: ${subCmd}\n👤 Cleaner: ${cleaner}`;
    const ar = `✅ *تم تسجيل التنظيف*\n\n🏠 الوحدة: ${unitId}\n🧹 النوع: ${subCmd}\n👤 المنظف: ${cleaner}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `🧹 *Cleaning Log*\n\n/clean checkin unit5 @CleanerName\n/clean checkout unit5 @CleanerName\n/clean deep unit5 @CleanerName\n/clean status unit5\n/clean pending\n/clean summary`;
  const ar = `🧹 *سجل التنظيف*\n\n/clean checkin unit5 @CleanerName\n/clean checkout unit5 @CleanerName\n/clean deep unit5 @CleanerName\n/clean status unit5\n/clean pending\n/clean summary`;
  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsClean] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Trends & Weather ───────────────────────────────────────

async function handleOpsTrends(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const en = `📈 *Operational Trends*\n\nAnalyzing historical data... This report is generated weekly in the Team Standup.`;
    const ar = `📈 *الاتجاهات التشغيلية*\n\nتحليل البيانات التاريخية... يتم إنشاء هذا التقرير أسبوعياً في اجتماع الفريق.`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsTrends] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsWeather(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const en = `🌤 *Weather Check — Riyadh*\n\nChecking current conditions... Extreme weather alerts are auto-posted at 7 AM KSA.`;
    const ar = `🌤 *حالة الطقس — الرياض*\n\nالتحقق من الظروف الحالية... يتم نشر تنبيهات الطقس القاسي تلقائياً الساعة 7 صباحاً.`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsWeather] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Ideas & Brainstorming ──────────────────────────────────

async function handleOpsIdea(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "idea");

    if (!args) {
      const en = `💡 *Submit Idea*\n\nUsage:\n• \`/idea Your idea description\` — submit a new idea\n• \`/idea vote [id]\` — vote on an idea (e.g. \`/idea vote 3\`)\n• \`/ideas\` — view all ideas with vote buttons`;
      const ar = `💡 *تقديم فكرة*\n\nالاستخدام:\n• \`/idea وصف الفكرة\` — تقديم فكرة جديدة\n• \`/idea vote [رقم]\` — التصويت على فكرة (مثال: \`/idea vote 3\`)\n• \`/ideas\` — عرض جميع الأفكار مع أزرار التصويت`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── Vote subcommand: /idea vote [id] ───
    const voteMatch = args.match(/^vote\s+(\d+)$/i);
    if (voteMatch) {
      const ideaId = parseInt(voteMatch[1]);
      const idea = v5Db.getIdeaById(ideaId);
      if (!idea) {
        const en = `❌ Idea #${ideaId} not found. Use /ideas to see all ideas.`;
        const ar = `❌ الفكرة #${ideaId} غير موجودة. استخدم /ideas لعرض جميع الأفكار.`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const result = v5Db.voteIdea(ideaId, ctx.from.id);
      if (result.alreadyVoted) {
        const en = `ℹ️ You already voted on idea #${ideaId}.\n\n💡 *${idea.description}* — 👍 ${idea.votes} votes`;
        const ar = `ℹ️ لقد صوّتت بالفعل على الفكرة #${ideaId}.\n\n💡 *${idea.description}* — 👍 ${idea.votes} أصوات`;
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
      }
      const updated = v5Db.getIdeaById(ideaId);
      const en = `✅ *Vote recorded!*\n\n💡 *#${ideaId}:* ${idea.description}\n👍 Now at ${updated.votes} vote${updated.votes !== 1 ? "s" : ""}`;
      const ar = `✅ *تم تسجيل صوتك!*\n\n💡 *#${ideaId}:* ${idea.description}\n👍 الآن ${updated.votes} صوت`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    // ─── Submit new idea ───
    const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const ideaId = v5Db.addIdea(chatId, args, user, threadId);

    const en = `✅ *Idea Submitted!*\n\n💡 *#${ideaId}:* ${args}\n👤 By: ${user}\n\nTap 👍 on /ideas to vote, or use \`/idea vote ${ideaId}\``;
    const ar = `✅ *تم تقديم الفكرة!*\n\n💡 *#${ideaId}:* ${args}\n👤 بواسطة: ${user}\n\nاضغط 👍 في /ideas للتصويت، أو استخدم \`/idea vote ${ideaId}\``;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsIdea] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsIdeas(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const ideas = v5Db.getIdeas(chatId);

    if (ideas.length === 0) {
      const en = `💡 *Ideas Board*\n\nNo ideas submitted yet.\nUse \`/idea Your idea description\` to submit one!`;
      const ar = `💡 *لوحة الأفكار*\n\nلم يتم تقديم أي أفكار بعد.\nاستخدم \`/idea وصف الفكرة\` لتقديم فكرة!`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    let en = `💡 *Ideas Board* (${ideas.length} ideas)\n\n`;
    let ar = `💡 *لوحة الأفكار* (${ideas.length} أفكار)\n\n`;
    ideas.forEach(i => {
      const statusEmoji = i.status === "approved" ? "✅" : i.status === "rejected" ? "❌" : "🆕";
      en += `${statusEmoji} *#${i.id}:* ${i.description}\n   👤 ${i.submitted_by} | 👍 ${i.votes} votes\n\n`;
      ar += `${statusEmoji} *#${i.id}:* ${i.description}\n   👤 ${i.submitted_by} | 👍 ${i.votes} أصوات\n\n`;
    });

    // Build inline vote buttons — one row per idea (up to 10 shown)
    const shownIdeas = ideas.slice(0, 10);
    const inlineKeyboard = shownIdeas.map(i => ([
      { text: `👍 Vote #${i.id} (${i.votes})`, callback_data: `idea_vote_${i.id}` }
    ]));

    await ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: threadId,
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } catch (e) {
    console.error("[handleOpsIdeas] Error:", e.message);
    await ctx.reply(`❌ Error loading ideas: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// Callback handler for inline vote buttons on /ideas board
async function handleIdeaVoteCallback(ctx) {
  try {
    const data = ctx.callbackQuery?.data || "";
    const match = data.match(/^idea_vote_(\d+)$/);
    if (!match) return ctx.answerCbQuery("❌ Invalid vote");

    const ideaId = parseInt(match[1]);
    const idea = v5Db.getIdeaById(ideaId);
    if (!idea) return ctx.answerCbQuery(`❌ Idea #${ideaId} not found`);

    const result = v5Db.voteIdea(ideaId, ctx.from.id);
    if (result.alreadyVoted) {
      return ctx.answerCbQuery(`ℹ️ Already voted on #${ideaId} / لقد صوّتت بالفعل`);
    }

    const updated = v5Db.getIdeaById(ideaId);
    await ctx.answerCbQuery(`✅ Vote recorded! #${ideaId} now has ${updated.votes} vote${updated.votes !== 1 ? "s" : ""} / تم تسجيل صوتك!`);

    // Try to update the button text to reflect new vote count
    try {
      const keyboard = ctx.callbackQuery.message?.reply_markup?.inline_keyboard;
      if (keyboard) {
        const newKeyboard = keyboard.map(row =>
          row.map(btn => {
            const m = btn.callback_data?.match(/^idea_vote_(\d+)$/);
            if (m && parseInt(m[1]) === ideaId) {
              return { ...btn, text: `👍 Vote #${ideaId} (${updated.votes})` };
            }
            return btn;
          })
        );
        await ctx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
      }
    } catch (e) { /* ignore edit errors */ }
  } catch (e) {
    console.error("[handleIdeaVoteCallback] Error:", e.message);
    await ctx.answerCbQuery("❌ Error recording vote").catch(() => {});
  }
}

async function handleOpsBrainstorm(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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

    if (subCmd === "end") {
      const en = `💡 *Brainstorming Session Ended*\n\nUse /ideas to review all submitted ideas.`;
      const ar = `💡 *انتهت جلسة العصف الذهني*\n\nاستخدم /ideas لمراجعة جميع الأفكار المقدمة.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    const en = `💡 *Brainstorming*\n\n/brainstorm start Topic name\n/brainstorm end`;
    const ar = `💡 *العصف الذهني*\n\n/brainstorm start اسم الموضوع\n/brainstorm end`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsBrainstorm] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsPhotos(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const en = `📸 *Property Photos*\n\n/photos unit5\n/photos pending\n/photos approved`;
    const ar = `📸 *صور العقارات*\n\n/photos unit5\n/photos pending\n/photos approved`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsPhotos] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handlePhotoReviewCallback(ctx) {
  try {
    const data = ctx.callbackQuery.data;
    const match = data.match(/^photo_(approve|reject)_(\d+)$/);
    if (!match) return ctx.answerCbQuery("❌ Invalid action");

    const action = match[1];
    const photoId = parseInt(match[2]);
    const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    if (action === "approve") {
      v5Db.approvePhoto(photoId, user);
    } else {
      v5Db.rejectPhoto(photoId, user, null);
    }
    await ctx.answerCbQuery(action === "approve" ? "✅ Approved / تم القبول" : "❌ Rejected / تم الرفض");
    
    const statusEmoji = action === "approve" ? "✅" : "❌";
    const en = `${statusEmoji} *Photo ${action === "approve" ? "Approved" : "Rejected"}*\n\nReviewed by: ${user}`;
    const ar = `${statusEmoji} *تم ${action === "approve" ? "قبول" : "رفض"} الصورة*\n\nبواسطة: ${user}`;
    
    await ctx.editMessageCaption(getBilingualText(en, ar), { parse_mode: "Markdown" }).catch(() => {});
  } catch (e) {
    console.error("[handlePhotoReviewCallback] Error:", e.message);
    await ctx.answerCbQuery("❌ Error processing review").catch(() => {});
  }
}

// ─── Exports ────────────────────────────────────────────────

function initV5() {
  v5Db.initV5Tables();
}

async function checkAndPostWeatherAlerts(bot) {
  // Weather alerts - fetch from API and post if extreme conditions
  try {
    const fetch = require("node-fetch");
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=24.7136&longitude=46.6753&current=temperature_2m,wind_speed_10m,weather_code&timezone=Asia/Riyadh");
    const data = await res.json();
    const temp = data.current?.temperature_2m;
    const wind = data.current?.wind_speed_10m;
    const code = data.current?.weather_code;
    
    // Only alert for extreme conditions
    if (temp > 45 || temp < 5 || wind > 50 || (code >= 95 && code <= 99)) {
      const OPS_GROUP_ID = -1003967447285;
      const THREAD_OPS = 8;
      let en = `\u26a0\ufe0f *Weather Alert | \u062a\u0646\u0628\u064a\u0647 \u0637\u0642\u0633*\n\n`;
      en += `\ud83c\udf21 Temp: ${temp}\u00b0C | \ud83d\udca8 Wind: ${wind} km/h\n`;
      en += `\ud83d\udccd Riyadh | Code: ${code}\n\n`;
      en += `Please take necessary precautions.\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\u064a\u0631\u062c\u0649 \u0627\u062a\u062e\u0627\u0630 \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u0627\u062a \u0627\u0644\u0644\u0627\u0632\u0645\u0629.`;
      await bot.telegram.sendMessage(OPS_GROUP_ID, en, { parse_mode: "Markdown", message_thread_id: THREAD_OPS });
    }
  } catch (e) {
    console.error("[Weather] Alert check error:", e.message);
  }
}

module.exports = {
  handleOpsMlog, handleOpsWorkflow, handleOpsTemplate, handleOpsClean,
  handleOpsTrends, handleOpsWeather, handleOpsIdea, handleOpsIdeas,
  handleOpsBrainstorm, handleOpsPhotos, handlePhotoReviewCallback,
  handleIdeaVoteCallback,
  initV5, checkAndPostWeatherAlerts,
};
