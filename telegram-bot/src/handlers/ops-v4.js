/**
 * Operations Group Handler — v4 (18 New Features)
 * ─────────────────────────────────────────────────────────────
 * Features 22-39 for the Monthly Key Daily Operations HQ group.
 *
 * Security & Access Control:
 *  22. Role-Based Permissions     23. Audit Log
 *  24. New Member Verification    25. Sensitive Data Protection
 *
 * Welcome & Onboarding:
 *  26. Smart Welcome Message      27. Onboarding Checklist
 *
 * Team Management:
 *  28. Team Directory             29. Workload Balancer
 *  30. Performance Scores         31. Leave/Availability Tracker
 *
 * Daily Operations:
 *  32. Smart Topic Routing        33. Duplicate Detection
 *  34. Priority Auto-Escalation   35. End-of-Day Check-in
 *  36. Weekly Team Standup
 *
 * Communication:
 *  37. Quick Polls                38. Pinned Summaries
 *  39. @mention Alerts
 */

const opsDb = require("../services/ops-database");
const v4Db = require("../services/ops-database-v4");

const OPS_GROUP_ID = -1003967447285;

const THREAD_IDS = {
  RULES: 3, CEO_UPDATE: 4, OPERATIONS: 5, LISTINGS: 6,
  BOOKINGS: 7, SUPPORT: 8, TECH: 9, PAYMENTS: 10,
  MARKETING: 11, LEGAL: 12, BLOCKERS: 13, COMPLETED: 14, PRIORITIES: 15,
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

// Topic keyword → thread_id mapping for smart routing
const TOPIC_KEYWORDS = {
  [THREAD_IDS.PAYMENTS]: ["payment", "invoice", "salary", "rent", "sar", "transfer", "bank", "iban", "money", "refund", "deposit", "دفع", "فاتورة", "إيجار", "تحويل"],
  [THREAD_IDS.SUPPORT]: ["complaint", "guest", "tenant", "noise", "issue", "problem", "customer", "شكوى", "ضيف", "مستأجر"],
  [THREAD_IDS.TECH]: ["website", "app", "bug", "server", "domain", "ssl", "api", "code", "موقع", "تطبيق"],
  [THREAD_IDS.BOOKINGS]: ["booking", "reservation", "checkin", "checkout", "airbnb", "occupancy", "حجز"],
  [THREAD_IDS.MARKETING]: ["marketing", "social", "instagram", "content", "campaign", "ad", "تسويق", "محتوى"],
  [THREAD_IDS.LEGAL]: ["legal", "license", "permit", "government", "compliance", "contract", "قانوني", "رخصة", "عقد"],
  [THREAD_IDS.LISTINGS]: ["listing", "property", "unit", "apartment", "villa", "عقار", "وحدة", "شقة"],
  [THREAD_IDS.BLOCKERS]: ["blocker", "blocked", "urgent", "critical", "emergency", "عاجل", "طارئ"],
};

// Saudi sensitive data patterns
const SENSITIVE_PATTERNS = [
  { name: "Saudi Phone", regex: /\b05\d{8}\b/g },
  { name: "National ID", regex: /\b[12]\d{9}\b/g },
  { name: "IBAN", regex: /\bSA\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi },
  { name: "Bank Account", regex: /\b\d{10,16}\b/g }, // Only flag if other patterns match too
];

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

function getUserInfo(ctx) {
  const from = ctx.message?.from || ctx.callbackQuery?.from || {};
  return {
    userId: from.id,
    username: from.username ? `@${from.username}` : null,
    displayName: [from.first_name, from.last_name].filter(Boolean).join(" ") || "Unknown",
  };
}

function getChatId(ctx) {
  return ctx.message?.chat?.id || ctx.callbackQuery?.message?.chat?.id || OPS_GROUP_ID;
}

function getThreadId(ctx) {
  return ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id || null;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 22: Role-Based Permissions ═════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsSetRole(ctx) {
  const chatId = getChatId(ctx);
  const { userId, username } = getUserInfo(ctx);
  const threadId = getThreadId(ctx);

  // Only CEO can set roles
  if (!v4Db.hasPermission(chatId, userId, "ceo")) {
    return ctx.reply("⛔ Only CEO-level members can assign roles.", { message_thread_id: threadId });
  }

  const text = ctx.message?.text || "";
  // /setrole @username CEO|Manager|Staff
  const match = text.match(/\/setrole\s+@?(\S+)\s+(ceo|manager|staff)/i);
  if (!match) {
    return ctx.reply(
      "📋 *Set Role*\n\nUsage: `/setrole @username CEO|Manager|Staff`\n\nExample: `/setrole @Mushtaq Manager`",
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const targetUsername = match[1].replace(/^@/, "");
  const role = match[2].toLowerCase();
  const roleEmoji = { ceo: "👑", manager: "📋", staff: "👤" };

  // Try to find user ID from team members or just use username
  const teamMember = v4Db.getTeamMemberByUsername(chatId, `@${targetUsername}`);
  const targetUserId = teamMember ? teamMember.user_id : 0;

  v4Db.setRole(chatId, targetUserId, `@${targetUsername}`, targetUsername, role, username);

  // Audit log
  v4Db.addAuditLog(chatId, userId, username, "set_role", "user", targetUserId, `Set @${targetUsername} as ${role}`, threadId);

  return ctx.reply(
    `${roleEmoji[role]} *Role Updated*\n\n@${escMd(targetUsername)} is now *${role.toUpperCase()}*\n\nSet by: ${username || "Admin"}`,
    { parse_mode: "Markdown", message_thread_id: threadId }
  );
}

async function handleOpsRoles(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  const roles = v4Db.getAllRoles(chatId);
  if (roles.length === 0) {
    return ctx.reply(
      "📋 *Roles*\n\nNo roles assigned yet.\n\nUse `/setrole @username CEO|Manager|Staff` to assign roles.",
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const roleEmoji = { ceo: "👑", manager: "📋", staff: "👤" };
  let msg = "📋 *Team Roles*\n\n";

  for (const r of roles) {
    const emoji = roleEmoji[r.role] || "👤";
    msg += `${emoji} *${r.role.toUpperCase()}* — ${r.username || r.display_name || "Unknown"}\n`;
  }

  msg += `\n_Total: ${roles.length} members with roles_`;

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 23: Audit Log ══════════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsAudit(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId } = getUserInfo(ctx);

  // Only managers+ can view audit log
  if (!v4Db.hasPermission(chatId, userId, "manager")) {
    return ctx.reply("⛔ Only Managers and CEO can view the audit log.", { message_thread_id: threadId });
  }

  const text = ctx.message?.text || "";
  const userMatch = text.match(/\/audit\s+@?(\S+)/);

  let logs;
  let title;
  if (userMatch) {
    const targetUser = `@${userMatch[1].replace(/^@/, "")}`;
    logs = v4Db.getAuditLogByUser(chatId, targetUser, 20);
    title = `Audit Log — ${targetUser}`;
  } else {
    logs = v4Db.getAuditLog(chatId, 20);
    title = "Audit Log — Last 20 Actions";
  }

  if (logs.length === 0) {
    return ctx.reply(`📝 *${title}*\n\nNo actions recorded yet.`, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let msg = `📝 *${escMd(title)}*\n\n`;
  for (const log of logs) {
    const time = log.created_at ? log.created_at.substring(5, 16).replace("T", " ") : "?";
    const who = log.username || "System";
    msg += `\`${time}\` ${who}: ${log.action_type}`;
    if (log.target_type) msg += ` (${log.target_type}`;
    if (log.target_id) msg += ` #${log.target_id}`;
    if (log.target_type) msg += `)`;
    if (log.details) msg += ` — ${log.details.substring(0, 60)}`;
    msg += "\n";
  }

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 24: New Member Verification ════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsVerify(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username } = getUserInfo(ctx);

  // Only managers+ can verify
  if (!v4Db.hasPermission(chatId, userId, "manager")) {
    return ctx.reply("⛔ Only Managers and CEO can verify members.", { message_thread_id: threadId });
  }

  const text = ctx.message?.text || "";
  const match = text.match(/\/verify\s+@?(\S+)/);

  if (!match) {
    // Show unverified members
    const unverified = v4Db.getUnverifiedMembers(chatId);
    if (unverified.length === 0) {
      return ctx.reply("✅ *All members are verified.*", { parse_mode: "Markdown", message_thread_id: threadId });
    }
    let msg = "🔐 *Unverified Members*\n\n";
    for (const m of unverified) {
      msg += `• ${m.username || m.display_name || `User ${m.user_id}`} — joined ${m.joined_at?.substring(0, 10) || "?"}\n`;
    }
    msg += `\nUse \`/verify @username\` to verify a member.`;
    return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const targetUsername = match[1].replace(/^@/, "");

  // Find the member in verification table by username
  const d = opsDb.getDb();
  const member = d.prepare(`SELECT * FROM member_verification WHERE chat_id = ? AND username = ?`).get(chatId, `@${targetUsername}`);

  if (!member) {
    return ctx.reply(`❌ No unverified member found with username @${targetUsername}`, { message_thread_id: threadId });
  }

  v4Db.verifyMember(chatId, member.user_id, username);
  v4Db.addAuditLog(chatId, userId, username, "verify_member", "user", member.user_id, `Verified @${targetUsername}`, threadId);

  return ctx.reply(
    `✅ *Member Verified*\n\n@${escMd(targetUsername)} has been verified by ${username || "Admin"}.\nThey now have full access to bot commands.`,
    { parse_mode: "Markdown", message_thread_id: threadId }
  );
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 25: Sensitive Data Protection ══════════════════
// ═══════════════════════════════════════════════════════════════

function detectSensitiveData(text) {
  if (!text) return [];
  const found = [];

  // Saudi phone numbers (05xxxxxxxx)
  const phones = text.match(/\b05\d{8}\b/g);
  if (phones) found.push({ type: "Phone Number", count: phones.length, pattern: "05xxxxxxxx" });

  // Saudi National ID (1 or 2 followed by 9 digits)
  const ids = text.match(/\b[12]\d{9}\b/g);
  if (ids) found.push({ type: "National ID", count: ids.length, pattern: "10-digit ID" });

  // IBAN
  const ibans = text.match(/\bSA\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi);
  if (ibans) found.push({ type: "IBAN", count: ibans.length, pattern: "SAxx xxxx..." });

  return found;
}

async function handleSensitiveDataCheck(ctx) {
  const text = ctx.message?.text || ctx.message?.caption || "";
  const found = detectSensitiveData(text);

  if (found.length === 0) return false;

  const threadId = getThreadId(ctx);
  const { username } = getUserInfo(ctx);

  let msg = `⚠️ *Sensitive Data Detected*\n\n`;
  msg += `${username || "Someone"}, this message may contain:\n\n`;
  for (const f of found) {
    msg += `• 🔴 *${f.type}* (${f.count} found)\n`;
  }
  msg += `\n🔒 Please *delete this message* and share sensitive information through private/secure channels only.\n`;
  msg += `_This is an automated security alert._`;

  try {
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      message_thread_id: threadId,
      reply_to_message_id: ctx.message?.message_id,
    });
  } catch (e) {
    console.error("[SensitiveData] Warning error:", e.message);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 26: Smart Welcome Message ══════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleNewMember(ctx) {
  const chatId = getChatId(ctx);
  const newMembers = ctx.message?.new_chat_members || [];

  for (const member of newMembers) {
    if (member.is_bot) continue;

    const userId = member.id;
    const username = member.username ? `@${member.username}` : null;
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(" ") || "New Member";

    // Add to verification table
    v4Db.addUnverifiedMember(chatId, userId, username, displayName);

    // Add to team members
    v4Db.upsertTeamMember(chatId, userId, username, displayName, null);

    // Initialize onboarding
    v4Db.initOnboarding(chatId, userId);

    // Set default role
    v4Db.setRole(chatId, userId, username, displayName, "staff", "system");

    // Audit log
    v4Db.addAuditLog(chatId, null, "system", "member_joined", "user", userId, `${displayName} (${username || "no username"}) joined`, null);

    // Send welcome message
    let msg = `👋 *Welcome to Monthly Key Operations, ${escMd(displayName)}\\!*\n\n`;
    msg += `You've been assigned the role: *Staff* 👤\n\n`;
    msg += `📋 *Quick Start:*\n`;
    msg += `1\\. Read the rules in *00 — Rules & Channel Guide*\n`;
    msg += `2\\. Introduce yourself in the group\n`;
    msg += `3\\. Set up topic notifications\n`;
    msg += `4\\. Review current tasks with /tasks\n\n`;
    msg += `📌 *Key Topics to Follow:*\n`;
    msg += `• 01 — Daily CEO Update \\(daily briefings\\)\n`;
    msg += `• 02 — Operations Follow\\-Up \\(main work\\)\n`;
    msg += `• 12 — Tomorrow Priorities \\(planning\\)\n\n`;
    msg += `🤖 *Bot Commands:* /tasks, /summary, /kpi, /help\n\n`;
    msg += `⏳ A manager will verify your access shortly\\.`;

    try {
      await ctx.reply(msg, { parse_mode: "MarkdownV2" });
    } catch (e) {
      // Fallback without MarkdownV2
      try {
        const plainMsg = `👋 Welcome to Monthly Key Operations, ${displayName}!\n\n` +
          `You've been assigned the role: Staff 👤\n\n` +
          `📋 Quick Start:\n` +
          `1. Read the rules in "00 — Rules & Channel Guide"\n` +
          `2. Introduce yourself in the group\n` +
          `3. Set up topic notifications\n` +
          `4. Review current tasks with /tasks\n\n` +
          `🤖 Bot Commands: /tasks, /summary, /kpi\n\n` +
          `⏳ A manager will verify your access shortly.`;
        await ctx.reply(plainMsg);
      } catch (e2) {
        console.error("[Welcome] Error:", e2.message);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 27: Onboarding Checklist ═══════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsOnboarding(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username } = getUserInfo(ctx);

  const text = ctx.message?.text || "";
  const userMatch = text.match(/\/onboarding\s+@?(\S+)/);

  let targetUserId = userId;
  let targetLabel = "Your";

  if (userMatch) {
    // Manager checking someone else's onboarding
    const targetUsername = `@${userMatch[1].replace(/^@/, "")}`;
    const member = v4Db.getTeamMemberByUsername(chatId, targetUsername);
    if (member) {
      targetUserId = member.user_id;
      targetLabel = `${targetUsername}'s`;
    } else {
      return ctx.reply(`❌ Member ${targetUsername} not found.`, { message_thread_id: threadId });
    }
  }

  const progress = v4Db.getOnboardingProgress(chatId, targetUserId);
  if (progress.length === 0) {
    // Initialize if not yet done
    v4Db.initOnboarding(chatId, targetUserId);
    const newProgress = v4Db.getOnboardingProgress(chatId, targetUserId);
    if (newProgress.length === 0) {
      return ctx.reply("📋 No onboarding checklist found.", { message_thread_id: threadId });
    }
    return showOnboardingProgress(ctx, threadId, targetLabel, newProgress);
  }

  return showOnboardingProgress(ctx, threadId, targetLabel, progress);
}

function showOnboardingProgress(ctx, threadId, label, progress) {
  const completed = progress.filter(p => p.completed).length;
  const total = progress.length;
  const pct = Math.round((completed / total) * 100);

  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));

  let msg = `📋 *${label} Onboarding Progress*\n\n`;
  msg += `${bar} ${pct}% (${completed}/${total})\n\n`;

  for (const item of progress) {
    const check = item.completed ? "✅" : "⬜";
    msg += `${check} ${item.item_label}\n`;
  }

  if (completed === total) {
    msg += `\n🎉 *Onboarding complete!*`;
  } else {
    msg += `\n_Complete remaining items to finish onboarding._`;
  }

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 28: Team Directory ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsTeam(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  const members = v4Db.getTeamMembers(chatId);
  if (members.length === 0) {
    return ctx.reply("👥 *Team Directory*\n\nNo team members registered yet. Members are added automatically when they join the group.", { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let msg = "👥 *Team Directory*\n\n";

  for (const m of members) {
    const role = v4Db.getRole(chatId, m.user_id);
    const roleEmoji = { ceo: "👑", manager: "📋", staff: "👤" }[role] || "👤";
    const away = v4Db.isUserAway(chatId, m.user_id);
    const statusEmoji = away ? "🔴 Away" : "🟢 Available";

    // Get open task count
    const assignee = m.username || m.display_name;
    const openTasks = v4Db.getOpenTaskCount(chatId, assignee);

    msg += `${roleEmoji} *${m.display_name || m.username || "Unknown"}*`;
    if (m.username) msg += ` (${m.username})`;
    msg += `\n   ${statusEmoji} | ${openTasks} open tasks | ${role.toUpperCase()}`;
    if (m.responsibilities) msg += `\n   📝 ${m.responsibilities}`;
    msg += "\n\n";
  }

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 29: Workload Balancer ══════════════════════════
// ═══════════════════════════════════════════════════════════════

function getWorkloadWarning(chatId, assignee) {
  if (!assignee) return null;
  const count = v4Db.getOpenTaskCount(chatId, assignee);
  if (count >= 10) {
    // Find who has fewer tasks
    const workloads = v4Db.getWorkloadByAssignee(chatId);
    const lighter = workloads.filter(w => w.assigned_to !== assignee && w.open_tasks < count);
    let suggestion = "";
    if (lighter.length > 0) {
      const best = lighter[lighter.length - 1]; // least loaded
      suggestion = `\nConsider assigning to ${best.assigned_to} (${best.open_tasks} tasks).`;
    }
    return `⚠️ ${assignee} already has *${count} open tasks*.${suggestion}`;
  }

  // Check if user is away
  const usernameClean = assignee.replace(/^@/, "");
  if (v4Db.isUsernameAway(chatId, `@${usernameClean}`)) {
    return `⚠️ ${assignee} is currently marked as *away*. Consider assigning to someone else.`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 30: Performance Scores ═════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsPerformance(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  const text = ctx.message?.text || "";
  const userMatch = text.match(/\/performance\s+@?(\S+)/);

  if (!userMatch) {
    return ctx.reply(
      "📊 *Performance*\n\nUsage: `/performance @username`\n\nOr use `/leaderboard` for team ranking.",
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const targetUser = `@${userMatch[1].replace(/^@/, "")}`;
  const stats = v4Db.getPerformanceStats(chatId, targetUser);

  if (stats.totalTasks === 0) {
    return ctx.reply(`📊 No tasks found for ${targetUser}.`, { message_thread_id: threadId });
  }

  let msg = `📊 *Performance — ${escMd(targetUser)}*\n\n`;
  msg += `📈 Completion Rate: *${stats.completionRate}%*\n`;
  msg += `✅ Completed: ${stats.completed}\n`;
  msg += `⬜ Pending: ${stats.pending}\n`;
  msg += `🔴 Overdue: ${stats.overdue}\n`;
  msg += `📋 Total: ${stats.totalTasks}\n`;
  if (stats.avgResolutionHours !== null) {
    msg += `⏱️ Avg Resolution: ${stats.avgResolutionHours}h\n`;
  }

  // Rating
  let rating;
  if (stats.completionRate >= 90) rating = "⭐⭐⭐⭐⭐ Excellent";
  else if (stats.completionRate >= 75) rating = "⭐⭐⭐⭐ Good";
  else if (stats.completionRate >= 50) rating = "⭐⭐⭐ Average";
  else if (stats.completionRate >= 25) rating = "⭐⭐ Needs Improvement";
  else rating = "⭐ Critical";

  msg += `\n🏆 Rating: ${rating}`;

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsLeaderboard(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  const board = v4Db.getLeaderboard(chatId);
  if (board.length === 0) {
    return ctx.reply("🏆 *Leaderboard*\n\nNo data yet.", { parse_mode: "Markdown", message_thread_id: threadId });
  }

  let msg = "🏆 *Team Leaderboard*\n\n";
  const medals = ["🥇", "🥈", "🥉"];

  board.forEach((entry, i) => {
    const medal = medals[i] || `${i + 1}.`;
    const rate = entry.completion_rate || 0;
    msg += `${medal} *${entry.assigned_to}*\n`;
    msg += `   ✅ ${entry.completed}/${entry.total_tasks} (${rate}%) | ⬜ ${entry.pending}`;
    if (entry.avg_hours) msg += ` | ⏱️ ${entry.avg_hours}h avg`;
    msg += "\n";
  });

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 31: Leave/Availability Tracker ═════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsAway(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username, displayName } = getUserInfo(ctx);

  const text = ctx.message?.text || "";
  // /away 3 days "vacation"
  const match = text.match(/\/away\s+(\d+)\s*(day|days|hour|hours|h|d)?\s*"?([^"]*)"?/i);

  let reason = "No reason given";
  let awayUntil = null;

  if (match) {
    const num = parseInt(match[1]);
    const unit = (match[2] || "days").toLowerCase();
    reason = match[3] || reason;

    const now = new Date();
    if (unit.startsWith("h")) {
      now.setHours(now.getHours() + num);
    } else {
      now.setDate(now.getDate() + num);
    }
    awayUntil = now.toISOString().substring(0, 19).replace("T", " ");
  } else {
    // Simple /away reason
    const simpleMatch = text.match(/\/away\s+(.+)/);
    if (simpleMatch) reason = simpleMatch[1];
  }

  v4Db.setAway(chatId, userId, username, displayName, reason, awayUntil);
  v4Db.addAuditLog(chatId, userId, username, "set_away", "user", userId, reason, threadId);

  let msg = `🔴 *${escMd(displayName)} is now Away*\n\n`;
  msg += `📝 Reason: ${escMd(reason)}\n`;
  if (awayUntil) msg += `📅 Until: ${awayUntil.substring(0, 10)}\n`;
  msg += `\n_Tasks will not be auto-assigned to this member._`;

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

async function handleOpsBack(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username, displayName } = getUserInfo(ctx);

  v4Db.setBack(chatId, userId);
  v4Db.addAuditLog(chatId, userId, username, "set_back", "user", userId, "Marked as available", threadId);

  return ctx.reply(
    `🟢 *${escMd(displayName)} is back\\!*\n\n_You're now available for task assignments\\._`,
    { parse_mode: "MarkdownV2", message_thread_id: threadId }
  );
}

async function handleOpsAvailability(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);

  const away = v4Db.getAwayMembers(chatId);
  const members = v4Db.getTeamMembers(chatId);

  let msg = "📊 *Team Availability*\n\n";

  if (away.length > 0) {
    msg += `🔴 *Away (${away.length}):*\n`;
    for (const a of away) {
      msg += `• ${a.display_name || a.username || "Unknown"}`;
      if (a.reason) msg += ` — ${a.reason}`;
      if (a.away_until) msg += ` (until ${a.away_until.substring(0, 10)})`;
      msg += "\n";
    }
    msg += "\n";
  }

  const awayIds = new Set(away.map(a => a.user_id));
  const available = members.filter(m => !awayIds.has(m.user_id));

  if (available.length > 0) {
    msg += `🟢 *Available (${available.length}):*\n`;
    for (const m of available) {
      const tasks = v4Db.getOpenTaskCount(chatId, m.username || m.display_name);
      msg += `• ${m.display_name || m.username || "Unknown"} (${tasks} tasks)\n`;
    }
  }

  if (away.length === 0 && available.length === 0) {
    msg += "_No team members registered yet._";
  }

  return ctx.reply(msg, { parse_mode: "Markdown", message_thread_id: threadId });
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 32: Smart Topic Routing ════════════════════════
// ═══════════════════════════════════════════════════════════════

function detectWrongTopic(text, currentThreadId) {
  if (!text || !currentThreadId) return null;
  const lower = text.toLowerCase();

  for (const [threadIdStr, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const threadId = parseInt(threadIdStr);
    if (threadId === currentThreadId) continue;

    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount >= 2) {
      return {
        suggestedThreadId: threadId,
        suggestedTopicName: TOPIC_FULL_NAMES[threadId],
        matchCount,
      };
    }
  }
  return null;
}

async function handleTopicRoutingSuggestion(ctx) {
  const text = ctx.message?.text || "";
  const threadId = getThreadId(ctx);
  if (!threadId) return false;

  const suggestion = detectWrongTopic(text, threadId);
  if (!suggestion) return false;

  const currentTopic = TOPIC_FULL_NAMES[threadId] || "this topic";

  try {
    await ctx.reply(
      `💡 *Topic Suggestion*\n\nThis message looks like it belongs in *${suggestion.suggestedTopicName}* rather than ${currentTopic}.\n\nUse \`/move [task_id] ${suggestion.suggestedTopicName.split(" — ")[1]?.toLowerCase() || "topic"}\` to move related tasks.`,
      {
        parse_mode: "Markdown",
        message_thread_id: threadId,
        reply_to_message_id: ctx.message?.message_id,
      }
    );
  } catch (e) {
    console.error("[TopicRouting] Error:", e.message);
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 33: Duplicate Detection ════════════════════════
// ═══════════════════════════════════════════════════════════════

function checkDuplicateTask(chatId, title) {
  return v4Db.findSimilarTasks(chatId, title);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 37: Quick Polls ════════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsPoll(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username } = getUserInfo(ctx);

  const text = ctx.message?.text || "";

  // /poll "Question" "Option 1" "Option 2" "Option 3"
  const parts = [];
  const regex = /"([^"]+)"/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    parts.push(m[1]);
  }

  if (parts.length < 3) {
    return ctx.reply(
      `📊 *Quick Poll*\n\nUsage: \`/poll "Question" "Option 1" "Option 2" "Option 3"\`\n\nExample: \`/poll "Best meeting time?" "9 AM" "11 AM" "2 PM"\``,
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const question = parts[0];
  const options = parts.slice(1);

  // Create poll message with inline buttons
  let msg = `📊 *Poll: ${escMd(question)}*\n\nCreated by: ${username || "Unknown"}\n\n`;
  options.forEach((opt, i) => {
    msg += `${i + 1}. ${opt}\n`;
  });
  msg += `\n_Vote by clicking the buttons below. Results update live._`;

  // Build inline keyboard
  const keyboard = options.map((opt, i) => [{
    text: `${i + 1}. ${opt}`,
    callback_data: `poll_vote_${i}`, // Will be updated with poll ID after creation
  }]);
  keyboard.push([{ text: "📊 Show Results", callback_data: "poll_results" }]);
  keyboard.push([{ text: "🔒 Close Poll", callback_data: "poll_close" }]);

  try {
    const sent = await ctx.reply(msg, {
      parse_mode: "Markdown",
      message_thread_id: threadId,
      reply_markup: { inline_keyboard: keyboard },
    });

    // Create poll in DB with the message ID
    const pollId = v4Db.createPoll(chatId, threadId, question, options, username, sent.message_id);

    // Update the callback data with the poll ID
    const updatedKeyboard = options.map((opt, i) => [{
      text: `${i + 1}. ${opt}`,
      callback_data: `poll_vote_${pollId}_${i}`,
    }]);
    updatedKeyboard.push([{ text: "📊 Show Results", callback_data: `poll_results_${pollId}` }]);
    updatedKeyboard.push([{ text: "🔒 Close Poll", callback_data: `poll_close_${pollId}` }]);

    await ctx.telegram.editMessageReplyMarkup(chatId, sent.message_id, null, {
      inline_keyboard: updatedKeyboard,
    });

    v4Db.addAuditLog(chatId, userId, username, "create_poll", "poll", pollId, question, threadId);
  } catch (e) {
    console.error("[Poll] Error:", e.message);
    await ctx.reply("❌ Failed to create poll. Please try again.", { message_thread_id: threadId });
  }
}

async function handlePollCallback(ctx) {
  const data = ctx.callbackQuery?.data || "";
  const chatId = ctx.callbackQuery?.message?.chat?.id;
  const { userId, username } = getUserInfo(ctx);

  // Vote: poll_vote_{pollId}_{optionIndex}
  const voteMatch = data.match(/^poll_vote_(\d+)_(\d+)$/);
  if (voteMatch) {
    const pollId = parseInt(voteMatch[1]);
    const optionIndex = parseInt(voteMatch[2]);
    const poll = v4Db.getPollById(pollId);

    if (!poll || poll.status !== "active") {
      return ctx.answerCbQuery("This poll is closed.");
    }

    const result = v4Db.votePoll(pollId, userId, username, optionIndex);
    const optionText = poll.options[optionIndex] || `Option ${optionIndex + 1}`;
    return ctx.answerCbQuery(result === "updated" ? `Vote changed to: ${optionText}` : `Voted: ${optionText}`);
  }

  // Results: poll_results_{pollId}
  const resultsMatch = data.match(/^poll_results_(\d+)$/);
  if (resultsMatch) {
    const pollId = parseInt(resultsMatch[1]);
    const poll = v4Db.getPollById(pollId);
    if (!poll) return ctx.answerCbQuery("Poll not found.");

    const results = v4Db.getPollResults(pollId);
    const voters = v4Db.getPollVoters(pollId);
    const totalVotes = voters.length;

    let msg = `📊 *Results: ${poll.question}*\n\n`;
    for (let i = 0; i < poll.options.length; i++) {
      const optResult = results.find(r => r.option_index === i);
      const votes = optResult ? optResult.votes : 0;
      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
      msg += `${poll.options[i]}\n${bar} ${pct}% (${votes})\n\n`;
    }
    msg += `_Total votes: ${totalVotes}_`;

    return ctx.answerCbQuery(`Total votes: ${totalVotes}`, { show_alert: false });
  }

  // Close: poll_close_{pollId}
  const closeMatch = data.match(/^poll_close_(\d+)$/);
  if (closeMatch) {
    const pollId = parseInt(closeMatch[1]);
    const poll = v4Db.getPollById(pollId);
    if (!poll) return ctx.answerCbQuery("Poll not found.");

    // Only creator or managers can close
    if (poll.created_by !== username && !v4Db.hasPermission(chatId, userId, "manager")) {
      return ctx.answerCbQuery("Only the poll creator or managers can close this poll.");
    }

    v4Db.closePoll(pollId);

    // Show final results
    const results = v4Db.getPollResults(pollId);
    const voters = v4Db.getPollVoters(pollId);
    const totalVotes = voters.length;

    let msg = `📊 *Poll Closed: ${poll.question}*\n\n`;
    for (let i = 0; i < poll.options.length; i++) {
      const optResult = results.find(r => r.option_index === i);
      const votes = optResult ? optResult.votes : 0;
      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
      msg += `${poll.options[i]}\n${bar} ${pct}% (${votes})\n\n`;
    }
    msg += `_Final results — ${totalVotes} total votes_`;

    try {
      await ctx.editMessageText(msg, { parse_mode: "Markdown" });
    } catch (e) {
      console.error("[Poll] Close error:", e.message);
    }

    return ctx.answerCbQuery("Poll closed!");
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 38: Pinned Summaries ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleOpsPin(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { userId, username } = getUserInfo(ctx);

  // Only managers+ can pin
  if (!v4Db.hasPermission(chatId, userId, "manager")) {
    return ctx.reply("⛔ Only Managers and CEO can pin summaries.", { message_thread_id: threadId });
  }

  const text = ctx.message?.text || "";
  const content = text.replace(/^\/pin\s*/i, "").trim();

  if (!content) {
    return ctx.reply(
      "📌 *Pin Summary*\n\nUsage: `/pin Your summary text here`\n\nThis will post and pin a formatted summary in the current topic.",
      { parse_mode: "Markdown", message_thread_id: threadId }
    );
  }

  const topicName = TOPIC_FULL_NAMES[threadId] || "General";
  const date = new Date().toISOString().substring(0, 10);

  let msg = `📌 *Pinned Summary — ${escMd(topicName)}*\n`;
  msg += `📅 ${date} | By: ${username || "Admin"}\n\n`;
  msg += escMd(content);

  try {
    const sent = await ctx.reply(msg, {
      parse_mode: "Markdown",
      message_thread_id: threadId,
    });

    // Try to pin the message
    try {
      await ctx.telegram.pinChatMessage(chatId, sent.message_id);
    } catch (e) {
      // Bot may not have pin permissions
      console.error("[Pin] Pin error:", e.message);
    }

    v4Db.addAuditLog(chatId, userId, username, "pin_summary", "message", sent.message_id, content.substring(0, 100), threadId);
  } catch (e) {
    console.error("[Pin] Error:", e.message);
    await ctx.reply("❌ Failed to pin summary.", { message_thread_id: threadId });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 39: @mention Alert Tracking ════════════════════
// ═══════════════════════════════════════════════════════════════

function trackMentions(ctx) {
  const text = ctx.message?.text || "";
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { username: fromUser } = getUserInfo(ctx);
  const messageId = ctx.message?.message_id;

  // Find @mentions in the text
  const mentions = text.match(/@(\w+)/g);
  if (!mentions) return;

  for (const mention of mentions) {
    const mentionedUsername = mention; // includes @
    if (mentionedUsername === fromUser) continue; // Don't track self-mentions
    if (mentionedUsername === "@monthlykey_bot") continue; // Don't track bot mentions

    v4Db.addMentionAlert(chatId, threadId, mentionedUsername, fromUser, text.substring(0, 200), messageId);
  }
}

function markMentionResponse(ctx) {
  const chatId = getChatId(ctx);
  const threadId = getThreadId(ctx);
  const { username } = getUserInfo(ctx);
  if (username) {
    v4Db.markMentionResponded(chatId, threadId, username);
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Passive Handler — runs on every message ════════════════
// ═══════════════════════════════════════════════════════════════

async function handleV4Passive(ctx) {
  const chatId = getChatId(ctx);
  if (chatId !== OPS_GROUP_ID) return;

  const { userId, username, displayName } = getUserInfo(ctx);

  // Auto-register team member on any message
  if (userId) {
    try {
      v4Db.upsertTeamMember(chatId, userId, username, displayName, null);
    } catch (e) { /* ignore */ }
  }

  // Track mentions
  try {
    trackMentions(ctx);
  } catch (e) { /* ignore */ }

  // Mark mention responses (user is active in this thread)
  try {
    markMentionResponse(ctx);
  } catch (e) { /* ignore */ }

  // Record daily check-in (any message counts)
  try {
    const ksa = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const today = `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, "0")}-${String(ksa.getUTCDate()).padStart(2, "0")}`;
    v4Db.recordCheckin(chatId, userId, username, today);
  } catch (e) { /* ignore */ }

  // Check for sensitive data
  try {
    await handleSensitiveDataCheck(ctx);
  } catch (e) { /* ignore */ }

  // Smart topic routing suggestion
  try {
    await handleTopicRoutingSuggestion(ctx);
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Feature 22: Roles
  handleOpsSetRole, handleOpsRoles,
  // Feature 23: Audit Log
  handleOpsAudit,
  // Feature 24: Verification
  handleOpsVerify,
  // Feature 25: Sensitive Data (passive)
  handleSensitiveDataCheck, detectSensitiveData,
  // Feature 26: Welcome
  handleNewMember,
  // Feature 27: Onboarding
  handleOpsOnboarding,
  // Feature 28: Team Directory
  handleOpsTeam,
  // Feature 29: Workload Balancer
  getWorkloadWarning, checkDuplicateTask,
  // Feature 30: Performance
  handleOpsPerformance, handleOpsLeaderboard,
  // Feature 31: Availability
  handleOpsAway, handleOpsBack, handleOpsAvailability,
  // Feature 32: Topic Routing (passive)
  handleTopicRoutingSuggestion, detectWrongTopic,
  // Feature 37: Polls
  handleOpsPoll, handlePollCallback,
  // Feature 38: Pinned Summaries
  handleOpsPin,
  // Feature 39: Mention Alerts (passive)
  trackMentions, markMentionResponse,
  // Passive handler
  handleV4Passive,
  // DB init
  initV4: () => { v4Db.initV4Tables(); },
};
