/**
 * Team Members Registry — Monthly Key Operations HQ
 * ─────────────────────────────────────────────────────────────
 * Maps Telegram usernames to real names, roles, and priority levels.
 * Used for:
 *  - Addressing team members by real name in responses
 *  - Resolving assignee names in task creation
 *  - Priority handling based on role
 *  - Bilingual name display (English + Arabic)
 */

const TEAM_MEMBERS = {
  // ─── CEO / Admin ──────────────────────────────────────────
  monthlykey: {
    name: "Monthly Key",
    nameAr: "المفتاح الشهري",
    role: "CEO",
    roleAr: "المدير التنفيذي",
    priority: "top",
    isAdmin: true,
  },
  hobart2007: {
    name: "Monthly Key",
    nameAr: "المفتاح الشهري",
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
};

/**
 * Resolve a Telegram username (with or without @) to a team member record.
 * Case-insensitive lookup with alias support.
 * @param {string} usernameOrName - Telegram username, @username, or display name
 * @returns {object|null} Team member record or null
 */
function resolveTeamMember(usernameOrName) {
  if (!usernameOrName) return null;

  // Strip @ prefix and normalize to lowercase
  const clean = usernameOrName.replace(/^@/, "").toLowerCase().trim();
  if (!clean) return null;

  // Direct lookup
  if (TEAM_MEMBERS[clean]) {
    return { username: clean, ...TEAM_MEMBERS[clean] };
  }

  // Fuzzy match: check if the input contains or is contained by a known username
  for (const [key, member] of Object.entries(TEAM_MEMBERS)) {
    // Check if the cleaned input matches the member's real name (case-insensitive)
    if (member.name.toLowerCase() === clean) {
      return { username: key, ...member };
    }
    // Check partial username match (e.g., "mushtaq_123" should match "mushtaq")
    if (clean.includes(key) || key.includes(clean)) {
      return { username: key, ...member };
    }
  }

  return null;
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
  return member ? member.nameAr : (usernameOrName || "غير معروف");
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
    lines.push(`- @${username}: ${m.name} (${m.nameAr}) — ${m.role} (${m.roleAr}) [Priority: ${m.priority}]`);
  }
  return lines.join("\n");
}

/**
 * Get all team members as an array.
 * @returns {Array} Array of { username, name, nameAr, role, roleAr, priority, isAdmin }
 */
function getAllTeamMembers() {
  return Object.entries(TEAM_MEMBERS).map(([username, m]) => ({ username, ...m }));
}

module.exports = {
  TEAM_MEMBERS,
  resolveTeamMember,
  getDisplayName,
  getDisplayNameAr,
  normalizeAssignee,
  isTeamAdmin,
  isHighPriority,
  getTeamDirectory,
  getAllTeamMembers,
};
