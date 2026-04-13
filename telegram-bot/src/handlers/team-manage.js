/**
 * Team Management Handlers — /addmember, /removemember, /editmember, /team
 * ─────────────────────────────────────────────────────────────
 * Manages team members with database persistence + in-memory registry.
 * All responses bilingual (English + Arabic).
 */

const opsDb = require("../services/ops-database");
const {
  resolveTeamMember, getAllTeamMembers, isTeamAdmin, isHardcoded,
  loadFromDatabase, addToRegistry, removeFromRegistry, updateInRegistry,
} = require("../team-members");

// ─── Utility Functions ──────────────────────────────────────

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
  // Markdown v1 only needs _ * ` [ escaped
  return String(text).replace(/([_*`\[])/g, "\\$1");
}

/**
 * Role-to-emoji mapping
 */
function roleEmoji(role, priority) {
  if (priority === "top") return "👑";
  if (priority === "high") return "💎";
  const r = (role || "").toLowerCase();
  if (r.includes("ceo") || r.includes("executive")) return "👑";
  if (r.includes("top") || r.includes("management") || r.includes("إدارة")) return "💎";
  if (r.includes("operational") || r.includes("manager") || r.includes("مدير")) return "🔧";
  if (r.includes("officer") || r.includes("lead") || r.includes("مسؤول")) return "📋";
  if (r.includes("engineer") || r.includes("tech") || r.includes("فني")) return "⚙️";
  return "👤";
}

/**
 * Priority sort order
 */
const PRIORITY_ORDER = { top: 0, high: 1, normal: 2, low: 3 };

// ═══════════════════════════════════════════════════════════════
// ═══ /team — Clean bilingual team directory ═══════════════════
// ═══════════════════════════════════════════════════════════════

async function handleTeam(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    const members = getAllTeamMembers();

    if (members.length === 0) {
      const en = "👥 *Team Directory*\n\nNo members registered.";
      const ar = "👥 *دليل الفريق*\n\nلا يوجد أعضاء مسجلون.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Deduplicate by name+role (e.g., monthlykey + hobart2007 both = CEO)
    const seen = new Set();
    const unique = [];
    for (const m of members) {
      const key = `${m.name}|${m.role}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }

    // Sort by priority
    unique.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      return pa - pb;
    });

    // Build English section
    const enLines = ["👥 *Team Directory*", ""];
    for (const m of unique) {
      const emoji = roleEmoji(m.role, m.priority);
      const usernameStr = m.username ? ` (@${m.username})` : ``;
      enLines.push(`${emoji} *${m.name}*${usernameStr} — ${m.role}`);
    }
    enLines.push("");
    enLines.push(`_${unique.length} members total_`);

    // Build Arabic section
    const arLines = ["👥 *دليل الفريق*", ""];
    for (const m of unique) {
      const emoji = roleEmoji(m.role, m.priority);
      const nameAr = m.nameAr || m.name;
      const roleAr = m.roleAr || m.role;
      const usernameStr = m.username ? ` (@${m.username})` : ``;
      arLines.push(`${emoji} *${nameAr}*${usernameStr} — ${roleAr}`);
    }
    arLines.push("");
    arLines.push(`_إجمالي ${unique.length} أعضاء_`);

    await ctx.reply(getBilingualText(enLines.join("\n"), arLines.join("\n")), {
      parse_mode: "Markdown",
      message_thread_id: threadId || undefined,
    });
  } catch (e) {
    console.error("[handleTeam] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || undefined }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ /addmember — Add a new team member ═══════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleAddMember(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    // Admin check
    const fromUser = ctx.from.username || "";
    if (!isTeamAdmin(fromUser)) {
      const en = "🔒 *Access Denied*\n\nOnly admins can add team members.";
      const ar = "🔒 *تم رفض الوصول*\n\nفقط المسؤولون يمكنهم إضافة أعضاء الفريق.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "addmember");

    // Parse: /addmember @username "Full Name" "Role"
    // Also support: /addmember @username Full Name - Role
    let username, name, role;

    // Try quoted format first: @user "Name" "Role"
    const quotedMatch = args.match(/^@?(\S+)\s+"([^"]+)"\s+"([^"]+)"$/);
    if (quotedMatch) {
      username = quotedMatch[1];
      name = quotedMatch[2].trim();
      role = quotedMatch[3].trim();
    } else {
      // Try dash format: @user Name - Role
      const dashMatch = args.match(/^@?(\S+)\s+(.+?)\s*-\s*(.+)$/);
      if (dashMatch) {
        username = dashMatch[1];
        name = dashMatch[2].trim();
        role = dashMatch[3].trim();
      } else {
        // Try simple format: @user Name (role is "Staff")
        const simpleMatch = args.match(/^@?(\S+)\s+(.+)$/);
        if (simpleMatch) {
          username = simpleMatch[1];
          name = simpleMatch[2].trim().replace(/^["']|["']$/g, "");
          role = "Staff";
        }
      }
    }

    if (!username || !name) {
      const en = [
        "👥 *Add Team Member*",
        "",
        "Usage:",
        '`/addmember @username "Full Name" "Role"`',
        "`/addmember @username Full Name - Role`",
        "",
        "Examples:",
        '`/addmember @khaled_841 "Khaled" "Public Relations Officer"`',
        "`/addmember @ahmed Ahmed Al Rashid - AC Technician`",
      ].join("\n");
      const ar = [
        "👥 *إضافة عضو فريق*",
        "",
        "الاستخدام:",
        '`/addmember @username "الاسم الكامل" "الدور"`',
        "`/addmember @username الاسم - الدور`",
        "",
        "أمثلة:",
        '`/addmember @khaled_841 "خالد" "مسؤول العلاقات العامة"`',
        "`/addmember @ahmed أحمد الراشد - فني تكييف`",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    const cleanUsername = username.replace(/^@/, "").toLowerCase();

    // Check if already exists
    const existing = resolveTeamMember(cleanUsername);
    if (existing) {
      const en = `⚠️ *Member already exists*\n\n👤 *${escMd(existing.name)}* (@${escMd(existing.username)}) — ${escMd(existing.role)}\n\nUse \`/editmember @${escMd(cleanUsername)} "New Role"\` to update.`;
      const ar = `⚠️ *العضو موجود بالفعل*\n\n👤 *${escMd(existing.nameAr || existing.name)}* (@${escMd(existing.username)}) — ${escMd(existing.roleAr || existing.role)}\n\nاستخدم \`/editmember @${escMd(cleanUsername)} "الدور الجديد"\` للتحديث.`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Save to database
    opsDb.addTeamMemberExt(cleanUsername, name, null, role, null, "normal", false, fromUser);

    // Update in-memory registry
    addToRegistry(cleanUsername, { name, role, priority: "normal", isAdmin: false });

    const en = [
      "✅ *Team Member Added*",
      "",
      `👤 *${escMd(name)}* (@${escMd(cleanUsername)})`,
      `📋 Role: ${escMd(role)}`,
      "",
      `Added by @${escMd(fromUser)}`,
    ].join("\n");
    const ar = [
      "✅ *تمت إضافة عضو الفريق*",
      "",
      `👤 *${escMd(name)}* (@${escMd(cleanUsername)})`,
      `📋 الدور: ${escMd(role)}`,
      "",
      `أضافه @${escMd(fromUser)}`,
    ].join("\n");

    await ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: threadId || undefined,
    });

  } catch (e) {
    console.error("[handleAddMember] Error:", e.message);
    if (e.message && e.message.includes("UNIQUE constraint")) {
      const en = "⚠️ *This username is already registered.*\n\nUse `/editmember` to update.";
      const ar = "⚠️ *اسم المستخدم مسجل بالفعل.*\n\nاستخدم `/editmember` للتحديث.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      }).catch(() => {});
    }
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || undefined }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ /removemember — Remove a team member ═════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleRemoveMember(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    // Admin check
    const fromUser = ctx.from.username || "";
    if (!isTeamAdmin(fromUser)) {
      const en = "🔒 *Access Denied*\n\nOnly admins can remove team members.";
      const ar = "🔒 *تم رفض الوصول*\n\nفقط المسؤولون يمكنهم إزالة أعضاء الفريق.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "removemember");
    const username = args.replace(/^@/, "").trim().toLowerCase();

    if (!username) {
      const en = "👥 *Remove Team Member*\n\nUsage: `/removemember @username`\nExample: `/removemember @khaled_841`";
      const ar = "👥 *إزالة عضو فريق*\n\nالاستخدام: `/removemember @username`\nمثال: `/removemember @khaled_841`";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Can't remove hardcoded members
    if (isHardcoded(username)) {
      const en = "⚠️ *Cannot remove core team members.*\n\nThis member is part of the permanent team registry.";
      const ar = "⚠️ *لا يمكن إزالة أعضاء الفريق الأساسيين.*\n\nهذا العضو جزء من سجل الفريق الدائم.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Check if exists
    const member = resolveTeamMember(username);
    if (!member) {
      const en = `⚠️ *Member not found:* @${escMd(username)}`;
      const ar = `⚠️ *العضو غير موجود:* @${escMd(username)}`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Remove from database
    opsDb.removeTeamMemberExt(username);

    // Remove from in-memory registry
    removeFromRegistry(username);

    const en = `✅ *Member Removed*\n\n👤 *${escMd(member.name)}* (@${escMd(username)}) has been removed from the team.\n\nRemoved by @${escMd(fromUser)}`;
    const ar = `✅ *تمت إزالة العضو*\n\n👤 *${escMd(member.nameAr || member.name)}* (@${escMd(username)}) تمت إزالته من الفريق.\n\nأزاله @${escMd(fromUser)}`;

    await ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: threadId || undefined,
    });

  } catch (e) {
    console.error("[handleRemoveMember] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || undefined }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ /editmember — Edit a team member's role ══════════════════
// ═══════════════════════════════════════════════════════════════

async function handleEditMember(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  try {
    // Admin check
    const fromUser = ctx.from.username || "";
    if (!isTeamAdmin(fromUser)) {
      const en = "🔒 *Access Denied*\n\nOnly admins can edit team members.";
      const ar = "🔒 *تم رفض الوصول*\n\nفقط المسؤولون يمكنهم تعديل أعضاء الفريق.";
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "editmember");

    // Parse: /editmember @username "New Role"
    // Also: /editmember @username New Role
    let username, newRole;

    const quotedMatch = args.match(/^@?(\S+)\s+"([^"]+)"$/);
    if (quotedMatch) {
      username = quotedMatch[1].toLowerCase();
      newRole = quotedMatch[2].trim();
    } else {
      const simpleMatch = args.match(/^@?(\S+)\s+(.+)$/);
      if (simpleMatch) {
        username = simpleMatch[1].toLowerCase();
        newRole = simpleMatch[2].trim().replace(/^["']|["']$/g, "");
      }
    }

    if (!username || !newRole) {
      const en = [
        "👥 *Edit Team Member*",
        "",
        "Usage: `/editmember @username \"New Role\"`",
        "Example: `/editmember @khaled_841 \"Senior PRO\"`",
      ].join("\n");
      const ar = [
        "👥 *تعديل عضو فريق*",
        "",
        "الاستخدام: `/editmember @username \"الدور الجديد\"`",
        "مثال: `/editmember @khaled_841 \"مسؤول علاقات عامة أول\"`",
      ].join("\n");
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    // Check if exists
    const member = resolveTeamMember(username);
    if (!member) {
      const en = `⚠️ *Member not found:* @${escMd(username)}\n\nUse \`/addmember\` to add them first.`;
      const ar = `⚠️ *العضو غير موجود:* @${escMd(username)}\n\nاستخدم \`/addmember\` لإضافته أولاً.`;
      return ctx.reply(getBilingualText(en, ar), {
        parse_mode: "Markdown",
        message_thread_id: threadId || undefined,
      });
    }

    const oldRole = member.role;

    // Update in database (only for DB members)
    if (!isHardcoded(username)) {
      opsDb.updateTeamMemberExt(username, { role: newRole });
    }

    // Update in-memory registry
    updateInRegistry(username, { role: newRole });

    const en = [
      "✅ *Member Updated*",
      "",
      `👤 *${escMd(member.name)}* (@${escMd(username)})`,
      `📋 Old Role: ${escMd(oldRole)}`,
      `📋 New Role: *${escMd(newRole)}*`,
      "",
      `Updated by @${escMd(fromUser)}`,
    ].join("\n");
    const ar = [
      "✅ *تم تحديث العضو*",
      "",
      `👤 *${escMd(member.nameAr || member.name)}* (@${escMd(username)})`,
      `📋 الدور القديم: ${escMd(oldRole)}`,
      `📋 الدور الجديد: *${escMd(newRole)}*`,
      "",
      `حدّثه @${escMd(fromUser)}`,
    ].join("\n");

    await ctx.reply(getBilingualText(en, ar), {
      parse_mode: "Markdown",
      message_thread_id: threadId || undefined,
    });

  } catch (e) {
    console.error("[handleEditMember] Error:", e.message);
    await ctx.reply(`❌ Error: ${e.message}`, { message_thread_id: threadId || undefined }).catch(() => {});
  }
}

module.exports = {
  handleTeam,
  handleAddMember,
  handleRemoveMember,
  handleEditMember,
};
