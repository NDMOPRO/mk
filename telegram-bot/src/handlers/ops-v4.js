/**
 * Operations Group Handler — v4 (18-Feature)
 * ─────────────────────────────────────────────────────────────
 * Security, Onboarding, Team Management, Operations, Communication
 *
 * All features now BILINGUAL (English + Arabic) with improved design.
 * All handlers wrapped in try/catch so errors are surfaced, not silently dropped.
 */

const v4Db = require("../services/ops-database-v4");
const opsDb = require("../services/ops-database");

function getBilingualText(en, ar) {
  return `${en}\n━━━━━━━━━━━━━━\n${ar}`;
}

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Security & Access Control ──────────────────────────────

async function handleOpsRoles(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
      const emoji = roleEmoji[r.role?.toLowerCase()] || "👤";
      const line = `${emoji} *${r.role.toUpperCase()}* — ${r.username || r.display_name || "Unknown"}\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsRoles] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsSetRole(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsSetRole] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsAudit(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsAudit] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsVerify(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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

    v4Db.verifyMember(chatId, 0, `@${targetUsername}`, ctx.from.username || ctx.from.first_name);

    const en = `✅ *Member Verified*\n\n👤 @${escMd(targetUsername)} has been verified and granted full access.`;
    const ar = `✅ *تم توثيق العضو*\n\n👤 @${escMd(targetUsername)} تم توثيقه ومنحه صلاحية كاملة.`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsVerify] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Welcome & Onboarding ──────────────────────────────────

async function handleOpsOnboarding(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "onboarding");
    const targetUsername = args.startsWith("@") ? args : (ctx.from.username ? `@${ctx.from.username}` : null);

    if (!targetUsername) {
      return ctx.reply("❌ Please specify @user or send without args to view your own checklist.\n\nيرجى تحديد المستخدم أو أرسل بدون وسيطات لعرض قائمتك.", { message_thread_id: threadId });
    }

    const checklist = v4Db.getOnboardingProgress(chatId, targetUsername);
    if (checklist.length === 0) {
      const en = `📋 *Onboarding Checklist — ${targetUsername}*\n\nNo tasks yet. Tasks are assigned by admins.`;
      const ar = `📋 *قائمة التهيئة — ${targetUsername}*\n\nلا توجد مهام بعد. يتم تعيين المهام من قبل المسؤولين.`;
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
  } catch (e) {
    console.error("[handleOpsOnboarding] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Team Management ────────────────────────────────────────

async function handleOpsTeam(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsTeam] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsPerformance(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const scores = v4Db.getLeaderboard(chatId);

    if (scores.length === 0) {
      const en = `🏆 *Team Performance Leaderboard*\n\nNo scores recorded yet.`;
      const ar = `🏆 *لوحة أداء الفريق*\n\nلا توجد نقاط مسجلة بعد.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
    }

    let en = `🏆 *Team Leaderboard*\n\n`;
    let ar = `🏆 *لوحة المتصدرين*\n\n`;
    scores.forEach((s, i) => {
      const emoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "👤";
      const rate = s.completion_rate || 0;
      const line = `${emoji} *${s.assigned_to}*: ${s.completed}/${s.total_tasks} done (${rate}%)\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsPerformance] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsLeave(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
    v4Db.setAway(chatId, ctx.from.id, username, username, match[3], match[2]);

    const en = `📅 *Leave recorded*\n\n👤 ${username}\n🗓 ${match[1]} to ${match[2]}\n📝 Reason: ${match[3]}`;
    const ar = `📅 *تم تسجيل الإجازة*\n\n👤 ${username}\n🗓 من ${match[1]} إلى ${match[2]}\n📝 السبب: ${match[3]}`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsLeave] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

// ─── Communication ──────────────────────────────────────────

async function handleOpsPoll(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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

    const pollId = v4Db.createPoll(chatId, threadId, question, options, fromUser);
    const inlineKeyboard = options.map((opt, i) => ([{ text: opt, callback_data: `poll_vote_${pollId}_${i}` }]));

    const en = `📊 *POLL: ${question}*\n\nAsked by: ${fromUser}`;
    const ar = `📊 *تصويت: ${question}*\n\nبواسطة: ${fromUser}`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId, reply_markup: { inline_keyboard: inlineKeyboard } });
  } catch (e) {
    console.error("[handleOpsPoll] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsPin(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
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
  } catch (e) {
    console.error("[handleOpsPin] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handlePollVoteCallback(ctx) {
  try {
    const chatId = ctx.chat.id;
    const { userId, username } = { userId: ctx.from.id, username: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name };
    const data = ctx.callbackQuery.data;
    const match = data.match(/^poll_vote_(\d+)_(\d+)$/);
    if (!match) return ctx.answerCbQuery("❌ Invalid vote");

    const pollId = parseInt(match[1]);
    const optionIndex = parseInt(match[2]);

    v4Db.votePoll(pollId, userId, username, optionIndex);
    await ctx.answerCbQuery("✅ Vote recorded / تم تسجيل صوتك");
  } catch (e) {
    console.error("[handlePollVoteCallback] Error:", e.message);
    await ctx.answerCbQuery("❌ Error recording vote").catch(() => {});
  }
}

// ─── Passive & Utility Handlers ─────────────────────────────

async function handleSensitiveDataCheck(ctx) {
  // Passive: check for sensitive data patterns in messages
  const text = ctx.message?.text || "";
  const patterns = [/\b\d{10}\b/, /\b[A-Z]{2}\d{10}\b/, /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/];
  for (const p of patterns) {
    if (p.test(text)) {
      try {
        await ctx.reply("⚠️ *Security Notice* | This message may contain sensitive data. Please be careful sharing personal info in group chats.\n━━━━━━━━━━━━━━\n⚠️ *تنبيه أمني* | قد تحتوي هذه الرسالة على بيانات حساسة.", { parse_mode: "Markdown", message_thread_id: ctx.message?.message_thread_id || null });
      } catch (e) {}
      break;
    }
  }
}

async function handleNewMember(ctx, member) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const name = member.first_name || "New Member";
  const username = member.username ? `@${member.username}` : name;
  try {
    v4Db.addUnverifiedMember(chatId, member.id, username, name);
    v4Db.upsertTeamMember(chatId, member.id, username, name, null);
  } catch (e) {}
  const en = `👋 *Welcome to Monthly Key Operations!*\n\n🆕 ${username} has joined the team.\n\nPlease use /onboarding to get started.`;
  const ar = `👋 *مرحباً بك في عمليات المفتاح الشهري!*\n\n🆕 ${username} انضم للفريق.\n\nاستخدم /onboarding للبدء.`;
  try {
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {}
}

async function handleOpsLeaderboard(ctx) {
  // Alias for handleOpsPerformance
  return handleOpsPerformance(ctx);
}

async function handleOpsAway(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const text = ctx.message?.text || "";
    const args = extractCommandArgs(text, "away");
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const reason = args || "No reason given";
    v4Db.setAway(chatId, ctx.from.id, username, username, reason, null);
    const en = `🔴 *${username} is now away*\n📝 Reason: ${reason}`;
    const ar = `🔴 *${username} الآن غائب*\n📝 السبب: ${reason}`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsAway] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsBack(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    v4Db.setBack(chatId, ctx.from.id);
    const en = `🟢 *${username} is back!*`;
    const ar = `🟢 *${username} عاد!*`;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsBack] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

async function handleOpsAvailability(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const away = v4Db.getAwayMembers(chatId);
    const available = v4Db.getAvailableMembers(chatId);
    let en = `👥 *Team Availability*\n\n`;
    let ar = `👥 *توفر الفريق*\n\n`;
    if (available.length > 0) {
      en += `*🟢 Available:*\n`; ar += `*🟢 متاح:*\n`;
      available.forEach(m => { en += `• ${m.assigned_to}\n`; ar += `• ${m.assigned_to}\n`; });
    }
    if (away.length > 0) {
      en += `\n*🔴 Away:*\n`; ar += `\n*🔴 غائب:*\n`;
      away.forEach(m => { en += `• ${m.username} — ${m.reason || "No reason"}\n`; ar += `• ${m.username} — ${m.reason || "بدون سبب"}\n`; });
    }
    if (available.length === 0 && away.length === 0) {
      en += "No team data yet."; ar += "لا توجد بيانات فريق بعد.";
    }
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } catch (e) {
    console.error("[handleOpsAvailability] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId }).catch(() => {});
  }
}

function handleTopicRoutingSuggestion(ctx) {
  // Passive: suggest correct topic if message seems misplaced
  // Currently a no-op placeholder
}

function trackMentions(ctx) {
  const text = ctx.message?.text || "";
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const fromUser = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "Unknown";
  const mentions = text.match(/@([a-zA-Z0-9_]+)/g) || [];
  for (const mention of mentions) {
    if (mention !== `@${ctx.botInfo?.username}`) {
      try { v4Db.addMentionAlert(chatId, threadId, mention, fromUser, text.substring(0, 200), ctx.message.message_id); } catch (e) {}
    }
  }
}

function markMentionResponse(ctx) {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id || null;
  const username = ctx.from?.username ? `@${ctx.from.username}` : null;
  if (username) {
    try { v4Db.markMentionResponded(chatId, threadId, username); } catch (e) {}
  }
}

async function handleV4Passive(ctx) {
  try { handleSensitiveDataCheck(ctx); } catch (e) {}
  try { trackMentions(ctx); } catch (e) {}
  try { markMentionResponse(ctx); } catch (e) {}
  try { handleTopicRoutingSuggestion(ctx); } catch (e) {}
  // Auto check-in when user posts in ops group
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from?.id;
    const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name;
    const today = new Date(Date.now() + 3 * 3600000).toISOString().split("T")[0];
    if (userId && !v4Db.hasCheckedIn(chatId, userId, today)) {
      v4Db.recordCheckin(chatId, userId, username, today);
    }
  } catch (e) {}
}

function initV4() {
  v4Db.initV4Tables();
}

module.exports = {
  handleOpsRoles, handleOpsSetRole, handleOpsAudit, handleOpsVerify,
  handleOpsOnboarding, handleOpsTeam, handleOpsPerformance, handleOpsLeave,
  handleOpsPoll, handleOpsPin, handlePollVoteCallback,
  handleSensitiveDataCheck, handleNewMember, handleOpsLeaderboard,
  handleOpsAway, handleOpsBack, handleOpsAvailability,
  handleTopicRoutingSuggestion, trackMentions, markMentionResponse,
  handleV4Passive, initV4, handlePollCallback: handlePollVoteCallback,
};
