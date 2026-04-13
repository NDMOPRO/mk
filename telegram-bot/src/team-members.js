/**
 * Team Members Registry — Monthly Key Operations HQ
 * ─────────────────────────────────────────────────────────────
 * Maps Telegram usernames (and first names for users without usernames)
 * to real names, roles, and priority levels.
 *
 * Used for:
 *  - Addressing team members by real name in responses
 *  - Resolving assignee names in task creation
 *  - Priority handling based on role
 *  - Bilingual name display (English + Arabic)
 *
 * Merges hardcoded defaults with database-stored members (added via /addmember).
 */

// ─── Hardcoded Core Team (always present) ──────────────────
// Key: lowercase Telegram username (no @)
const HARDCODED_MEMBERS = {
  // ─── CEO ──────────────────────────────────────────────────
  monthlykey: {
    name: "Khaled",
    nameAr: "خالد بن عبدالله",
    role: "CEO",
    roleAr: "المدير التنفيذي",
    priority: "top",
    isAdmin: true,
  },
  // Alias for the same CEO account
  hobart2007: {
    name: "Khaled",
    nameAr: "خالد بن عبدالله",
    role: "CEO",
    roleAr: "المدير التنفيذي",
    priority: "top",
    isAdmin: true,
  },

  // ─── Top Management ───────────────────────────────────────
  saq198: {
    name: "Saad Al Qasem",
    nameAr: "سعد القاسم",
    role: "Top Management",
    roleAr: "الإدارة العليا",
    priority: "high",
    isAdmin: false,
  },

  // ─── Operational Management ───────────────────────────────
  mushtaq: {
    name: "Mushtaq",
    nameAr: "مشتاق",
    role: "Operational Manager",
    roleAr: "مدير العمليات",
    priority: "high",
    isAdmin: false,
  },

  // ─── CFO — no Telegram username, matched by first name ────
  // Telegram first_name: "Sameh"
  // Special key: __firstname__sameh (used for first-name lookup)
  __firstname__sameh: {
    name: "Sameh",
    nameAr: "سامح",
    role: "CFO",
    roleAr: "المدير المالي",
    priority: "high",
    isAdmin: false,
    noUsername: true, // flag: this member has no Telegram username
    telegramFirstName: "Sameh",
  },

  // ─── Public Relations Manager ─────────────────────────────
  khaled_841: {
    name: "Khaled Abu Fahd",
    nameAr: "خالد أبو فهد",
    role: "Public Relations Manager",
    roleAr: "مدير العلاقات العامة",
    priority: "normal",
    isAdmin: false,
  },
};

// ─── In-memory merged registry ─────────────────────────────
// Starts with hardcoded, gets augmented with DB members on loadFromDatabase()
let TEAM_MEMBERS = { ...HARDCODED_MEMBERS };
let _dbLoaded = false;

/**
 * Load extended team members from the database and merge into the registry.
 * Safe to call multiple times — idempotent.
 */
function loadFromDatabase() {
  try {
    const opsDb = require("./services/ops-database");
    const dbMembers = opsDb.getAllTeamMembersExt();
    // Reset to hardcoded base, then overlay DB members
    TEAM_MEMBERS = { ...HARDCODED_MEMBERS };
    for (const m of dbMembers) {
      const key = m.username.toLowerCase().replace(/^@/, "");
      TEAM_MEMBERS[key] = {
        name: m.name,
        nameAr: m.name_ar || m.name,
        role: m.role || "Staff",
        roleAr: m.role_ar || m.role || "موظف",
        priority: m.priority || "normal",
        isAdmin: !!m.is_admin,
        fromDb: true,
      };
    }
    _dbLoaded = true;
    console.log(`[team-members] Loaded ${dbMembers.length} extended members from database (total: ${Object.keys(TEAM_MEMBERS).length})`);
  } catch (e) {
    console.error("[team-members] Failed to load from database:", e.message);
    // Continue with hardcoded members only
  }
}

/**
 * Add a member to the in-memory registry (called after /addmember saves to DB).
 */
function addToRegistry(username, memberData) {
  const key = username.toLowerCase().replace(/^@/, "");
  TEAM_MEMBERS[key] = {
    name: memberData.name,
    nameAr: memberData.nameAr || memberData.name,
    role: memberData.role || "Staff",
    roleAr: memberData.roleAr || memberData.role || "موظف",
    priority: memberData.priority || "normal",
    isAdmin: !!memberData.isAdmin,
    fromDb: true,
  };
}

/**
 * Remove a member from the in-memory registry (called after /removemember).
 * Cannot remove hardcoded members.
 */
function removeFromRegistry(username) {
  const key = username.toLowerCase().replace(/^@/, "");
  if (HARDCODED_MEMBERS[key]) return false; // can't remove hardcoded
  delete TEAM_MEMBERS[key];
  return true;
}

/**
 * Update a member in the in-memory registry (called after /editmember).
 */
function updateInRegistry(username, updates) {
  const key = username.toLowerCase().replace(/^@/, "");
  if (!TEAM_MEMBERS[key]) return false;
  if (updates.name !== undefined) TEAM_MEMBERS[key].name = updates.name;
  if (updates.nameAr !== undefined) TEAM_MEMBERS[key].nameAr = updates.nameAr;
  if (updates.role !== undefined) TEAM_MEMBERS[key].role = updates.role;
  if (updates.roleAr !== undefined) TEAM_MEMBERS[key].roleAr = updates.roleAr;
  if (updates.priority !== undefined) TEAM_MEMBERS[key].priority = updates.priority;
  if (updates.isAdmin !== undefined) TEAM_MEMBERS[key].isAdmin = updates.isAdmin;
  return true;
}

/**
 * Check if a member is hardcoded (cannot be removed).
 */
function isHardcoded(username) {
  const key = username.toLowerCase().replace(/^@/, "");
  return !!HARDCODED_MEMBERS[key];
}

/**
 * Resolve a Telegram user context (username or first_name) to a team member record.
 * Supports:
 *  - @username lookup (case-insensitive)
 *  - first_name lookup for members without usernames (e.g., Sameh)
 *  - Display name fuzzy match
 *
 * @param {string|object} usernameOrCtx - Username string, @username, display name,
 *                                        OR a ctx.from object {username, first_name}
 * @returns {object|null} Team member record or null
 */
function resolveTeamMember(usernameOrCtx) {
  if (!usernameOrCtx) return null;

  // If passed a Telegram ctx.from object, try username first then first_name
  if (typeof usernameOrCtx === "object" && (usernameOrCtx.first_name || usernameOrCtx.username)) {
    const fromObj = usernameOrCtx;
    if (fromObj.username) {
      const byUsername = resolveTeamMember(fromObj.username);
      if (byUsername) return byUsername;
    }
    if (fromObj.first_name) {
      const byFirstName = resolveByFirstName(fromObj.first_name);
      if (byFirstName) return byFirstName;
    }
    return null;
  }

  // Strip @ prefix and normalize to lowercase
  const clean = String(usernameOrCtx).replace(/^@/, "").toLowerCase().trim();
  if (!clean) return null;

  // Direct username lookup
  if (TEAM_MEMBERS[clean]) {
    return { username: clean, ...TEAM_MEMBERS[clean] };
  }

  // First-name lookup (for members without usernames)
  const byFirstName = resolveByFirstName(clean);
  if (byFirstName) return byFirstName;

  // Fuzzy match: check if the input contains or is contained by a known username
  for (const [key, member] of Object.entries(TEAM_MEMBERS)) {
    if (key.startsWith("__firstname__")) continue; // skip first-name keys in fuzzy
    // Check if the cleaned input matches the member's real name (case-insensitive)
    if (member.name.toLowerCase() === clean) {
      return { username: key, ...member };
    }
    // Check Arabic name match
    if (member.nameAr && member.nameAr === usernameOrCtx) {
      return { username: key, ...member };
    }
    // Check partial username match (e.g., "mushtaq_123" should match "mushtaq")
    if (!key.startsWith("__") && (clean.includes(key) || key.includes(clean))) {
      return { username: key, ...member };
    }
  }

  return null;
}

/**
 * Resolve a Telegram first_name to a team member (for users without usernames).
 * @param {string} firstName
 * @returns {object|null}
 */
function resolveByFirstName(firstName) {
  if (!firstName) return null;
  const cleanFirst = firstName.toLowerCase().trim();

  for (const [key, member] of Object.entries(TEAM_MEMBERS)) {
    if (member.noUsername && member.telegramFirstName) {
      if (member.telegramFirstName.toLowerCase() === cleanFirst) {
        return { username: key, ...member };
      }
    }
  }
  return null;
}

/**
 * Resolve a Telegram ctx.from object to a display name.
 * Falls back to first_name + last_name if not in registry.
 * @param {object} from - ctx.from object {username, first_name, last_name}
 * @returns {string} Display name
 */
function resolveFromCtx(from) {
  if (!from) return "Unknown";
  const member = resolveTeamMember(from);
  if (member) return member.name;
  // Fallback: construct name from Telegram profile
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (from.username || "Unknown");
}

/**
 * Resolve a Telegram ctx.from object to an Arabic display name.
 * @param {object} from - ctx.from object
 * @returns {string} Arabic display name
 */
function resolveFromCtxAr(from) {
  if (!from) return "غير معروف";
  const member = resolveTeamMember(from);
  if (member) return member.nameAr || member.name;
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (from.username || "غير معروف");
}

/**
 * Get the display name for a username. Returns real name if known, otherwise the raw input.
 * @param {string} usernameOrName - Telegram username or display name
 * @returns {string} Real name or original input
 */
function getDisplayName(usernameOrName) {
  const member = resolveTeamMember(usernameOrName);
  return member ? member.name : (usernameOrName || "Unknown");
}

/**
 * Get the Arabic display name for a username.
 * @param {string} usernameOrName
 * @returns {string} Arabic name or original input
 */
function getDisplayNameAr(usernameOrName) {
  const member = resolveTeamMember(usernameOrName);
  return member ? (member.nameAr || member.name) : (usernameOrName || "غير معروف");
}

/**
 * Normalize an assignee string for task storage.
 * Converts raw @username to "Real Name (@username)" format if known.
 * @param {string} assignee - Raw assignee string (e.g., "@SAQ198", "@Mushtaq", "John")
 * @returns {string} Normalized assignee string
 */
function normalizeAssignee(assignee) {
  if (!assignee) return null;
  const member = resolveTeamMember(assignee);
  if (member) {
    if (member.noUsername) {
      return member.name; // no @username to show
    }
    return `${member.name} (@${member.username})`;
  }
  // Return as-is if not a known team member
  return assignee;
}

/**
 * Check if a username belongs to an admin.
 * @param {string} username
 * @returns {boolean}
 */
function isTeamAdmin(username) {
  const member = resolveTeamMember(username);
  return member ? member.isAdmin : false;
}

/**
 * Check if a username belongs to a high-priority team member (top management or above).
 * @param {string} username
 * @returns {boolean}
 */
function isHighPriority(username) {
  const member = resolveTeamMember(username);
  return member ? (member.priority === "top" || member.priority === "high") : false;
}

/**
 * Get the full team registry (for AI system prompts, reports, etc.)
 * @returns {string} Formatted team directory
 */
function getTeamDirectory() {
  const lines = [];
  for (const [username, m] of Object.entries(TEAM_MEMBERS)) {
    if (username.startsWith("__firstname__")) continue; // skip internal keys
    const usernameDisplay = m.noUsername ? "(no username)" : `@${username}`;
    lines.push(`- ${usernameDisplay}: ${m.name} (${m.nameAr}) — ${m.role} (${m.roleAr}) [Priority: ${m.priority}]`);
  }
  return lines.join("\n");
}

/**
 * Get all team members as an array (for /team display).
 * Deduplicates by name+role and skips internal first-name keys.
 * Members without usernames (noUsername flag) are included with their internal key.
 * @returns {Array} Array of { username, name, nameAr, role, roleAr, priority, isAdmin, noUsername }
 */
function getAllTeamMembers() {
  const result = [];
  const seen = new Set();
  for (const [username, m] of Object.entries(TEAM_MEMBERS)) {
    if (username.startsWith("__firstname__")) {
      // Include noUsername members (e.g., Sameh) with a special display key
      const dedupeKey = `${m.name}|${m.role}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      result.push({ username: null, ...m }); // username = null means no @handle
      continue;
    }
    const dedupeKey = `${m.name}|${m.role}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ username, ...m });
  }
  return result;
}

module.exports = {
  TEAM_MEMBERS,
  HARDCODED_MEMBERS,
  resolveTeamMember,
  resolveByFirstName,
  resolveFromCtx,
  resolveFromCtxAr,
  getDisplayName,
  getDisplayNameAr,
  normalizeAssignee,
  isTeamAdmin,
  isHighPriority,
  getTeamDirectory,
  getAllTeamMembers,
  // DB integration
  loadFromDatabase,
  addToRegistry,
  removeFromRegistry,
  updateInRegistry,
  isHardcoded,
};
