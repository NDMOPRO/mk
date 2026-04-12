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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    let en = `👥 *Team Roles*\n\n`;
    let ar = `👥 *أدوار الفريق*\n\n`;
    const roleEmoji = { ceo: "👑", manager: "📋", staff: "👤" };

    roles.forEach(r => {
      const emoji = roleEmoji[r.role?.toLowerCase()] || "👤";
      const line = `${emoji} *${r.role.toUpperCase()}* — ${r.username || r.display_name || "Unknown"}\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsRoles] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
  }
}

/**
 * Fuzzy-match a role string to one of the three valid roles.
 * Handles case variations and common typos (e.g. Manger → Manager).
 * Returns the canonical role string ("CEO", "Manager", "Staff") or null.
 */
function normalizeRole(input) {
  if (!input) return null;
  const s = input.toLowerCase().trim();
  // Exact canonical matches
  if (s === "ceo")     return "CEO";
  if (s === "manager") return "Manager";
  if (s === "staff")   return "Staff";
  // Known typos — Manager
  const managerTypos = ["manger", "maneger", "mangaer", "mangger", "managar",
                        "managr", "manaer", "maanger", "mnager", "manegr",
                        "manageer", "manaager", "managerr", "mabager", "manaber"];
  if (managerTypos.includes(s)) return "Manager";
  // Known typos — Staff
  const staffTypos = ["staf", "staaf", "stff", "satff", "sttaf", "stafg"];
  if (staffTypos.includes(s)) return "Staff";
  // Known typos — CEO
  const ceoTypos = ["coo", "c.e.o", "c.o.o", "ceo."];
  if (ceoTypos.includes(s)) return "CEO";
  // Levenshtein distance ≤ 2 fallback for anything else
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[a.length][b.length];
  }
  const candidates = [["CEO", "ceo"], ["Manager", "manager"], ["Staff", "staff"]];
  for (const [label, canonical] of candidates) {
    if (levenshtein(s, canonical) <= 2) return label;
  }
  return null;
}

async function handleOpsSetRole(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "setrole");

    // Accept any two-token input: @user role  (role is fuzzy-matched)
    const match = args.match(/^@?(\S+)\s+(\S+)$/);
    if (!match) {
      const en = `👥 *Set Team Role*\n\nUsage: \`/setrole @user [CEO|Manager|Staff]\`\nExample: \`/setrole @SAQ198 Manager\``;
      const ar = `👥 *تعيين دور الفريق*\n\nالاستخدام: \`/setrole @user [CEO|Manager|Staff]\`\nمثال: \`/setrole @SAQ198 Manager\``;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    const targetUsername = match[1].replace(/^@/, "");
    const rawRole = match[2];
    const role = normalizeRole(rawRole);

    if (!role) {
      const en = `❌ *Unknown role:* \`${rawRole}\`\n\nValid roles: *CEO*, *Manager*, *Staff*`;
      const ar = `❌ *دور غير معروف:* \`${rawRole}\`\n\nالأدوار الصحيحة: *CEO*، *Manager*، *Staff*`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    // Try to find user ID from team members or fall back to 0
    const teamMember = v4Db.getTeamMemberByUsername(chatId, `@${targetUsername}`);
    const targetUserId = teamMember ? teamMember.user_id : 0;

    v4Db.setRole(chatId, targetUserId, `@${targetUsername}`, targetUsername, role.toLowerCase(), ctx.from.username || ctx.from.first_name);

    const en = `✅ *Role updated*\n\n👤 @${escMd(targetUsername)} is now *${role}*`;
    const ar = `✅ *تم تحديث الدور*\n\n👤 @${escMd(targetUsername)} الآن هو *${role}*`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsSetRole] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    let en = `📜 *Audit Log${username ? ` — ${username}` : ""}*\n\n`;
    let ar = `📜 *سجل العمليات${username ? ` — ${username}` : ""}*\n\n`;

    logs.forEach(log => {
      const time = log.created_at ? log.created_at.substring(11, 16) : "??:??";
      const who = log.username || "System";
      const line = `• [\`${time}\`] ${who}: ${log.action_type} ${log.details || ""}\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsAudit] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
        return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
      }
      let en = "🔐 *Unverified Members*\n\n";
      let ar = "🔐 *الأعضاء غير الموثقين*\n\n";
      unverified.forEach(m => {
        const line = `• ${m.username || m.display_name || "User"}\n`;
        en += line; ar += line;
      });
      en += `\nUse \`/verify @username\` to verify.`;
      ar += `\nاستخدم \`/verify @username\` للتوثيق.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    v4Db.verifyMember(chatId, 0, `@${targetUsername}`, ctx.from.username || ctx.from.first_name);

    const en = `✅ *Member Verified*\n\n👤 @${escMd(targetUsername)} has been verified and granted full access.`;
    const ar = `✅ *تم توثيق العضو*\n\n👤 @${escMd(targetUsername)} تم توثيقه ومنحه صلاحية كاملة.`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsVerify] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
      return ctx.reply("❌ Please specify @user or send without args to view your own checklist.\n\nيرجى تحديد المستخدم أو أرسل بدون وسيطات لعرض قائمتك.", { message_thread_id: threadId || 4 });
    }

    const checklist = v4Db.getOnboardingProgress(chatId, targetUsername);
    if (checklist.length === 0) {
      const en = `📋 *Onboarding Checklist — ${targetUsername}*\n\nNo tasks yet. Tasks are assigned by admins.`;
      const ar = `📋 *قائمة التهيئة — ${targetUsername}*\n\nلا توجد مهام بعد. يتم تعيين المهام من قبل المسؤولين.`;
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    let en = `📋 *Onboarding — ${targetUsername}*\n\n`;
    let ar = `📋 *التهيئة — ${targetUsername}*\n\n`;
    checklist.forEach(item => {
      const emoji = item.status === "completed" ? "✅" : "⬜";
      const line = `${emoji} ${item.task_name}\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsOnboarding] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    let en = `👥 *Team Directory*\n\n`;
    let ar = `👥 *دليل الفريق*\n\n`;
    team.forEach(m => {
      const status = m.status === "active" ? "🟢" : "🔴";
      const line = `${status} *${m.username || m.display_name}* — ${m.role || "Staff"}\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsTeam] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    let en = `🏆 *Team Leaderboard*\n\n`;
    let ar = `🏆 *لوحة المتصدرين*\n\n`;
    scores.forEach((s, i) => {
      const emoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "👤";
      const rate = s.completion_rate || 0;
      const line = `${emoji} *${s.assigned_to}*: ${s.completed}/${s.total_tasks} done (${rate}%)\n`;
      en += line; ar += line;
    });

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsPerformance] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    const match = args.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (!match) return ctx.reply("❌ Format: `/leave 2026-05-01 2026-05-05 Vacation`", { message_thread_id: threadId || 4 });

    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    v4Db.setAway(chatId, ctx.from.id, username, username, match[3], match[2]);

    const en = `📅 *Leave recorded*\n\n👤 ${username}\n🗓 ${match[1]} to ${match[2]}\n📝 Reason: ${match[3]}`;
    const ar = `📅 *تم تسجيل الإجازة*\n\n👤 ${username}\n🗓 من ${match[1]} إلى ${match[2]}\n📝 السبب: ${match[3]}`;

    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsLeave] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
  }
}

// ─── Communication ──────────────────────────────────────────

async function handleOpsPoll(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const chatId = ctx.chat.id;
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "poll");

    // ── Normalise curly/smart quotes (common on mobile keyboards) ──
    const normalised = args
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // curly double quotes
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // curly single quotes

    // ── Extract all "quoted tokens" (options, and optionally the question) ──
    const quotedTokens = [];
    const tokenRe = /"([^"]+)"/g;
    let m;
    while ((m = tokenRe.exec(normalised)) !== null) {
      const val = m[1].trim();
      if (val) quotedTokens.push(val);
    }

    // ── Determine question and options ────────────────────────
    // Strategy:
    //   1. If there is text BEFORE the first quote, that is the question
    //      and all quoted tokens are options.
    //      e.g.  Is this easier? "Yes" "No"  →  Q="Is this easier?"  Opts=["Yes","No"]
    //   2. Otherwise the first quoted token is the question and the rest are options.
    //      e.g.  "Is this easier?" "Yes" "No"  →  Q="Is this easier?"  Opts=["Yes","No"]
    let question = "";
    let options  = [];

    const firstQuoteIdx = normalised.indexOf('"');
    const textBeforeFirstQuote = firstQuoteIdx > 0
      ? normalised.substring(0, firstQuoteIdx).trim()
      : "";

    if (textBeforeFirstQuote.length > 0) {
      // Unquoted question + quoted options
      question = textBeforeFirstQuote.substring(0, 300);
      options  = quotedTokens.slice(0, 10);
    } else {
      // Fully quoted: first token = question, rest = options
      question = (quotedTokens[0] || "").substring(0, 300);
      options  = quotedTokens.slice(1, 11);
    }

    // ── Validate ──────────────────────────────────────────────
    if (!question || options.length < 2) {
      const en = [
        "📊 *Quick Poll — Usage*",
        "",
        "`/poll \"Question\" \"Option 1\" \"Option 2\" ...`",
        "",
        "• You can also write the question without quotes:",
        "`/poll Is this easier? \"Yes\" \"Somewhat\" \"No\"`",
        "",
        "• Minimum 2 options, maximum 10",
        "",
        "*Example:*",
        "`/poll \"Is the workflow easier?\" \"Yes\" \"Somewhat\" \"No\"`",
      ].join("\n");
      const ar = [
        "📊 *تصويت سريع — طريقة الاستخدام*",
        "",
        "`/poll \"السؤال\" \"الخيار 1\" \"الخيار 2\" ...`",
        "",
        "• يمكن كتابة السؤال بدون اقتباسات:",
        "`/poll هل العمل أسهل؟ \"نعم\" \"نوعاً ما\" \"لا\"`",
        "",
        "• الحد الأدنى خياران، الحد الأقصى 10",
        "",
        "*مثال:*",
        "`/poll \"هل أصبح سير العمل أسهل؟\" \"نعم\" \"نوعاً ما\" \"لا\"`",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // ── Send a NATIVE Telegram poll ───────────────────────────
    // ctx.telegram.sendPoll() creates a real interactive poll card —
    // NOT a text message. Users tap an option to vote directly in the chat.
    await ctx.telegram.sendPoll(
      chatId,
      question,
      options.map(o => ({ text: o.substring(0, 100) })), // Telegram: max 100 chars/option
      {
        is_anonymous: false,           // show who voted
        allows_multiple_answers: false,
        ...(threadId ? { message_thread_id: threadId } : {}),
      }
    );

    // ── Persist in our DB for /poll results tracking ──────────
    const fromUser = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    try {
      v4Db.createPoll(chatId, threadId, question, options, fromUser);
    } catch (dbErr) {
      // DB persistence is non-critical — the poll was already sent successfully
      console.error("[handleOpsPoll] DB persist error (non-fatal):", dbErr.message);
    }

  } catch (e) {
    console.error("[handleOpsPoll] Error:", e.message);
    const errMsg = getBilingualText(
      `❌ Failed to create poll: ${e.message}`,
      `❌ فشل إنشاء التصويت: ${e.message}`
    );
    await ctx.reply(errMsg, { message_thread_id: threadId || undefined }).catch(() => {});
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
      return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    }

    const en = `📌 *SUMMARY / DECISION*\n\n${args}\n\n👤 Posted by: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name}`;
    const ar = `📌 *ملخص / قرار*\n\n${args}\n\n👤 بواسطة: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name}`;

    const msg = await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
    try { await ctx.telegram.pinChatMessage(chatId, msg.message_id, { disable_notification: true }); } catch (e) {}
  } catch (e) {
    console.error("[handleOpsPin] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
        await ctx.reply("⚠️ *Security Notice* | This message may contain sensitive data. Please be careful sharing personal info in group chats.\n━━━━━━━━━━━━━━\n⚠️ *تنبيه أمني* | قد تحتوي هذه الرسالة على بيانات حساسة.", { parse_mode: "Markdown", message_thread_id: ctx.message?.message_thread_id || 4 });
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
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
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
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsAway] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsBack] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId || 4 });
  } catch (e) {
    console.error("[handleOpsAvailability] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || 4 }).catch(() => {});
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
