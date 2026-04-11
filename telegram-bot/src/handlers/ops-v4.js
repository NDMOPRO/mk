/**
 * Operations Group Handler — v4 (18-Feature)
 * ─────────────────────────────────────────────────────────────
 * Security, Onboarding, Team Management, Operations, Communication
 *
 * All features now BILINGUAL (English + Arabic) with improved design.
 */

const v4Db = require("../services/ops-database-v4");

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

// ─── Security & Access Control ──────────────────────────────

async function handleOpsRoles(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const roles = v4Db.getAllRoles(chatId);

  if (roles.length === 0) {
    const en = `👥 *Team Roles*\n\nNo roles defined. Use \`/setrole @user CEO\``;
    const ar = `👥 *أدوار الفريق*\n\nلم يتم تحديد أدوار. استخدم \`/setrole @user CEO\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `👥 *Team Roles*\n\n`;
  let ar = `👥 *أدوار الفريق*\n\n`;
  const roleEmoji = { ceo: "👑", manager: "📋", staff: "👤" };
  
  roles.forEach(r => { 
    const emoji = roleEmoji[r.role.toLowerCase()] || "👤";
    const line = `${emoji} *${r.role.toUpperCase()}* — ${r.username || r.display_name || "Unknown"}\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsSetRole(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "setrole");

  const match = args.match(/^@?(\S+)\s+(CEO|Manager|Staff)$/i);
  if (!match) {
    const en = `👥 *Set Team Role*\n\nUsage: \`/setrole @user [CEO|Manager|Staff]\``;
    const ar = `👥 *تعيين دور الفريق*\n\nالاستخدام: \`/setrole @user [CEO|Manager|Staff]\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const targetUsername = match[1].replace(/^@/, "");
  const role = match[2].toLowerCase();
  
  // Try to find user ID from team members or just use username
  const teamMember = v4Db.getTeamMemberByUsername(chatId, `@${targetUsername}`);
  const targetUserId = teamMember ? teamMember.user_id : 0;

  v4Db.setRole(chatId, targetUserId, `@${targetUsername}`, targetUsername, role, ctx.from.username || ctx.from.first_name);

  const en = `✅ *Role updated*\n\n👤 @${escMd(targetUsername)} is now *${role.toUpperCase()}*`;
  const ar = `✅ *تم تحديث الدور*\n\n👤 @${escMd(targetUsername)} الآن هو *${role.toUpperCase()}*`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsAudit(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "audit");
  const username = args.startsWith("@") ? args : (args ? `@${args}` : null);

  const logs = username ? v4Db.getAuditLogByUser(chatId, username, 20) : v4Db.getAuditLog(chatId, 20);

  if (logs.length === 0) {
    const en = `📜 *Audit Log*\n\nNo actions recorded${username ? ` for ${username}` : ""}.`;
    const ar = `📜 *سجل العمليات*\n\nلا توجد عمليات مسجلة${username ? ` لـ ${username}` : ""}.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `📜 *Audit Log${username ? ` — ${username}` : ""}*\n\n`;
  let ar = `📜 *سجل العمليات${username ? ` — ${username}` : ""}*\n\n`;
  
  logs.forEach(log => {
    const time = log.created_at ? log.created_at.substring(11, 16) : "??:??";
    const who = log.username || "System";
    const line = `• [\`${time}\`] ${who}: ${log.action_type} ${log.details || ""}\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsVerify(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "verify");
  const targetUsername = args.replace(/^@/, "");

  if (!targetUsername) {
    const unverified = v4Db.getUnverifiedMembers(chatId);
    if (unverified.length === 0) {
      const en = "✅ *All members are verified.*";
      const ar = "✅ *جميع الأعضاء موثقون.*";
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let en = "🔐 *Unverified Members*\n\n";
    let ar = "🔐 *الأعضاء غير الموثقين*\n\n";
    unverified.forEach(m => {
      const line = `• ${m.username || m.display_name || "User"}\n`;
      en += line; ar += line;
    });
    en += `\nUse \`/verify @username\` to verify.`;
    ar += `\nاستخدم \`/verify @username\` للتوثيق.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // Simplified for this version - assuming we find the user by username
  v4Db.verifyMember(chatId, 0, `@${targetUsername}`, ctx.from.username || ctx.from.first_name);

  const en = `✅ *Member Verified*\n\n👤 @${escMd(targetUsername)} has been verified and granted full access.`;
  const ar = `✅ *تم توثيق العضو*\n\n👤 @${escMd(targetUsername)} تم توثيقه ومنحه صلاحية كاملة.`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Welcome & Onboarding ──────────────────────────────────

async function handleOpsOnboarding(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "onboarding");
  const targetUsername = args.startsWith("@") ? args : (ctx.from.username ? `@${ctx.from.username}` : null);

  if (!targetUsername) return ctx.reply("❌ Please specify @user / يرجى تحديد المستخدم", { message_thread_id: threadId });

  const checklist = v4Db.getOnboardingChecklist(chatId, targetUsername);
  if (checklist.length === 0) {
    const en = `📋 *Onboarding Checklist — ${targetUsername}*\n\nNo tasks yet.`;
    const ar = `📋 *قائمة التهيئة — ${targetUsername}*\n\nلا توجد مهام بعد.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `📋 *Onboarding — ${targetUsername}*\n\n`;
  let ar = `📋 *التهيئة — ${targetUsername}*\n\n`;
  checklist.forEach(item => {
    const emoji = item.status === "completed" ? "✅" : "⬜";
    const line = `${emoji} ${item.task_name}\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Team Management ────────────────────────────────────────

async function handleOpsTeam(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const team = v4Db.getTeamMembers(chatId);

  if (team.length === 0) {
    const en = `👥 *Team Directory*\n\nNo members registered.`;
    const ar = `👥 *دليل الفريق*\n\nلا يوجد أعضاء مسجلون.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `👥 *Team Directory*\n\n`;
  let ar = `👥 *دليل الفريق*\n\n`;
  team.forEach(m => {
    const status = m.status === "active" ? "🟢" : "🔴";
    const line = `${status} *${m.username || m.display_name}* — ${m.role || "Staff"}\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsPerformance(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const scores = v4Db.getPerformanceScores(chatId);

  if (scores.length === 0) {
    const en = `🏆 *Team Performance Leaderboard*\n\nNo scores recorded yet.`;
    const ar = `🏆 *لوحة أداء الفريق*\n\nلا توجد نقاط مسجلة بعد.`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let en = `🏆 *Team Leaderboard*\n\n`;
  let ar = `🏆 *لوحة المتصدرين*\n\n`;
  scores.forEach((s, i) => {
    const emoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "👤";
    const line = `${emoji} *${s.username}*: ${s.score} pts (${s.tasks_done} tasks)\n`;
    en += line; ar += line;
  });

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsLeave(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "leave");

  if (!args) {
    const en = `📅 *Leave Tracker*\n\nUsage: \`/leave [start_date] [end_date] [reason]\`\nExample: \`/leave 2026-05-01 2026-05-05 Vacation\``;
    const ar = `📅 *متتبع الإجازات*\n\nالاستخدام: \`/leave [تاريخ_البداية] [تاريخ_النهاية] [السبب]\`\nمثال: \`/leave 2026-05-01 2026-05-05 إجازة\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const match = args.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if (!match) return ctx.reply("❌ Format: `/leave 2026-05-01 2026-05-05 Vacation`", { message_thread_id: threadId });

  const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  v4Db.addLeave(chatId, ctx.from.id, username, match[1], match[2], match[3]);

  const en = `📅 *Leave recorded*\n\n👤 ${username}\n🗓 ${match[1]} to ${match[2]}\n📝 Reason: ${match[3]}`;
  const ar = `📅 *تم تسجيل الإجازة*\n\n👤 ${username}\n🗓 من ${match[1]} إلى ${match[2]}\n📝 السبب: ${match[3]}`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

// ─── Communication ──────────────────────────────────────────

async function handleOpsPoll(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "poll");

  const match = args.match(/"(.+?)"\s+"(.+?)"\s+"(.+?)"(?:\s+"(.+?)")?(?:\s+"(.+?)")?/);
  if (!match) {
    const en = `📊 *Quick Poll*\n\nUsage: \`/poll "Question" "Opt1" "Opt2" "Opt3"\``;
    const ar = `📊 *تصويت سريع*\n\nالاستخدام: \`/poll "السؤال" "الخيار1" "الخيار2" "الخيار3"\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const question = match[1];
  const options = match.slice(2).filter(Boolean);
  const fromUser = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

  const poll = v4Db.addPoll(chatId, threadId, question, options, fromUser);
  const inlineKeyboard = options.map((opt, i) => ([{ text: opt, callback_data: `poll_vote_${poll.id}_${i}` }]));

  const en = `📊 *POLL: ${question}*\n\nAsked by: ${fromUser}`;
  const ar = `📊 *تصويت: ${question}*\n\nبواسطة: ${fromUser}`;

  await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId, reply_markup: { inline_keyboard: inlineKeyboard } });
}

async function handleOpsPin(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;
  const text = ctx.message.text || "";
  const args = extractCommandArgs(text, "pin");

  if (!args) {
    const en = `📌 *Pin Summary*\n\nUsage: \`/pin [summary text]\``;
    const ar = `📌 *تثبيت ملخص*\n\nالاستخدام: \`/pin [نص الملخص]\``;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const en = `📌 *SUMMARY / DECISION*\n\n${args}\n\n👤 Posted by: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name}`;
  const ar = `📌 *ملخص / قرار*\n\n${args}\n\n👤 بواسطة: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name}`;

  const msg = await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  try { await ctx.telegram.pinChatMessage(chatId, msg.message_id); } catch (e) {}
}

async function handlePollVoteCallback(ctx) {
  const chatId = ctx.chat.id;
  const { userId, username } = { userId: ctx.from.id, username: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name };
  const data = ctx.callbackQuery.data;
  const match = data.match(/^poll_vote_(\d+)_(\d+)$/);
  if (!match) return;

  const pollId = parseInt(match[1]);
  const optionIndex = parseInt(match[2]);

  v4Db.addPollVote(pollId, userId, username, optionIndex);
  await ctx.answerCbQuery("✅ Vote recorded / تم تسجيل صوتك");
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  handleOpsRoles, handleOpsSetRole, handleOpsAudit, handleOpsVerify,
  handleOpsOnboarding, handleOpsTeam, handleOpsPerformance, handleOpsLeave,
  handleOpsPoll, handleOpsPin, handlePollVoteCallback
};
