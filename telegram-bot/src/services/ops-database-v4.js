/**
 * Operations Database v4 — 18 New Feature Tables & Methods
 * ─────────────────────────────────────────────────────────────
 * Extends the v3 ops-database with tables for:
 *
 *  22. Role-Based Permissions      23. Audit Log
 *  24. New Member Verification     25. Sensitive Data Protection (no table)
 *  26. Smart Welcome (uses roles)  27. Onboarding Checklist
 *  28. Team Directory              29. Workload Balancer (uses tasks)
 *  30. Performance Scores (uses tasks) 31. Leave/Availability Tracker
 *  32. Smart Topic Routing (no table)  33. Duplicate Detection (no table)
 *  34. Priority Auto-Escalation (no table) 35. End-of-Day Check-in
 *  36. Weekly Team Standup (no table)
 *  37. Quick Polls                 38. Pinned Summaries (no table)
 *  39. @mention Alerts
 */

const baseDb = require("./ops-database");

function initV4Tables() {
  const d = baseDb.getDb();

  // ─── Feature 22: Roles ───────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      username    TEXT,
      display_name TEXT,
      role        TEXT NOT NULL DEFAULT 'staff',
      set_by      TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, user_id)
    )
  `);

  // ─── Feature 23: Audit Log ──────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      user_id     INTEGER,
      username    TEXT,
      action_type TEXT NOT NULL,
      target_type TEXT,
      target_id   INTEGER,
      details     TEXT,
      thread_id   INTEGER,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 24: Member Verification ────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS member_verification (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      user_id       INTEGER NOT NULL,
      username      TEXT,
      display_name  TEXT,
      verified      INTEGER DEFAULT 0,
      verified_by   TEXT,
      verified_at   TEXT,
      joined_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, user_id)
    )
  `);

  // ─── Feature 27: Onboarding Checklist ───────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_checklist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      item_key    TEXT NOT NULL,
      item_label  TEXT NOT NULL,
      completed   INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, user_id, item_key)
    )
  `);

  // ─── Feature 28: Team Members ───────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      user_id       INTEGER NOT NULL,
      username      TEXT,
      display_name  TEXT,
      responsibilities TEXT,
      joined_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, user_id)
    )
  `);

  // ─── Feature 31: Leave/Availability Tracker ─────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS leave_tracker (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      username    TEXT,
      display_name TEXT,
      reason      TEXT,
      away_until  TEXT,
      status      TEXT DEFAULT 'away',
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 35: Check-in Tracking ──────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS daily_checkins (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      username    TEXT,
      checkin_date TEXT NOT NULL,
      checked_in  INTEGER DEFAULT 0,
      flagged     INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, user_id, checkin_date)
    )
  `);

  // ─── Feature 37: Polls ──────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      message_id    INTEGER,
      question      TEXT NOT NULL,
      options       TEXT NOT NULL,
      created_by    TEXT,
      status        TEXT DEFAULT 'active',
      created_at    TEXT DEFAULT (datetime('now')),
      closed_at     TEXT
    )
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id     INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      username    TEXT,
      option_index INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(poll_id, user_id)
    )
  `);

  // ─── Feature 39: Mention Alerts ─────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS mention_alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      mentioned_username TEXT NOT NULL,
      mentioned_by  TEXT,
      message_text  TEXT,
      message_id    INTEGER,
      responded     INTEGER DEFAULT 0,
      reminder_sent INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 22: Role Operations ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

function setRole(chatId, userId, username, displayName, role, setBy) {
  const d = baseDb.getDb();
  const existing = d.prepare(`SELECT id FROM roles WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
  if (existing) {
    d.prepare(`UPDATE roles SET username = ?, display_name = ?, role = ?, set_by = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(username, displayName, role, setBy, existing.id);
    return existing.id;
  }
  const result = d.prepare(`INSERT INTO roles (chat_id, user_id, username, display_name, role, set_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(chatId, userId, username, displayName, role, setBy);
  return result.lastInsertRowid;
}

function getRole(chatId, userId) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT * FROM roles WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
  return row ? row.role : "staff"; // default to staff
}

function getRoleRecord(chatId, userId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM roles WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
}

function getAllRoles(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM roles WHERE chat_id = ? ORDER BY CASE role WHEN 'ceo' THEN 1 WHEN 'manager' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END, display_name ASC`).all(chatId);
}

function hasPermission(chatId, userId, requiredRole) {
  const role = getRole(chatId, userId);
  const hierarchy = { ceo: 3, manager: 2, staff: 1 };
  return (hierarchy[role] || 0) >= (hierarchy[requiredRole] || 0);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 23: Audit Log Operations ═══════════════════════
// ═══════════════════════════════════════════════════════════════

function addAuditLog(chatId, userId, username, actionType, targetType, targetId, details, threadId) {
  const d = baseDb.getDb();
  d.prepare(`INSERT INTO audit_log (chat_id, user_id, username, action_type, target_type, target_id, details, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(chatId, userId || null, username || null, actionType, targetType || null, targetId || null, details || null, threadId || null);
}

function getAuditLog(chatId, limit = 20) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM audit_log WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`).all(chatId, limit);
}

function getAuditLogByUser(chatId, username, limit = 20) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM audit_log WHERE chat_id = ? AND username = ? ORDER BY created_at DESC LIMIT ?`).all(chatId, username, limit);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 24: Member Verification ═════════════════════════
// ═══════════════════════════════════════════════════════════════

function addUnverifiedMember(chatId, userId, username, displayName) {
  const d = baseDb.getDb();
  const existing = d.prepare(`SELECT id FROM member_verification WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
  if (existing) return existing.id;
  const result = d.prepare(`INSERT INTO member_verification (chat_id, user_id, username, display_name) VALUES (?, ?, ?, ?)`)
    .run(chatId, userId, username || null, displayName || null);
  return result.lastInsertRowid;
}

function verifyMember(chatId, userId, verifiedBy) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE member_verification SET verified = 1, verified_by = ?, verified_at = datetime('now') WHERE chat_id = ? AND user_id = ?`)
    .run(verifiedBy, chatId, userId);
}

function isMemberVerified(chatId, userId) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT verified FROM member_verification WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
  if (!row) return true; // If no record, assume existing member (pre-feature)
  return row.verified === 1;
}

function getUnverifiedMembers(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM member_verification WHERE chat_id = ? AND verified = 0 ORDER BY joined_at DESC`).all(chatId);
}

function getMemberVerification(chatId, userId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM member_verification WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 27: Onboarding Checklist ═══════════════════════
// ═══════════════════════════════════════════════════════════════

const ONBOARDING_ITEMS = [
  { key: "read_rules", label: "Read Rules & Channel Guide (Topic 00)" },
  { key: "introduce", label: "Introduce yourself in the group" },
  { key: "setup_notifications", label: "Set up topic notifications" },
  { key: "review_tasks", label: "Review current tasks (/tasks)" },
  { key: "first_task", label: "Create or complete your first task" },
];

function initOnboarding(chatId, userId) {
  const d = baseDb.getDb();
  for (const item of ONBOARDING_ITEMS) {
    try {
      d.prepare(`INSERT OR IGNORE INTO onboarding_checklist (chat_id, user_id, item_key, item_label) VALUES (?, ?, ?, ?)`)
        .run(chatId, userId, item.key, item.label);
    } catch (e) { /* ignore duplicate */ }
  }
}

function completeOnboardingItem(chatId, userId, itemKey) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE onboarding_checklist SET completed = 1, completed_at = datetime('now') WHERE chat_id = ? AND user_id = ? AND item_key = ?`)
    .run(chatId, userId, itemKey);
}

function getOnboardingProgress(chatId, userId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM onboarding_checklist WHERE chat_id = ? AND user_id = ? ORDER BY id ASC`).all(chatId, userId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 28: Team Members ═══════════════════════════════
// ═══════════════════════════════════════════════════════════════

function upsertTeamMember(chatId, userId, username, displayName, responsibilities) {
  const d = baseDb.getDb();
  const existing = d.prepare(`SELECT id FROM team_members WHERE chat_id = ? AND user_id = ?`).get(chatId, userId);
  if (existing) {
    d.prepare(`UPDATE team_members SET username = ?, display_name = ?, responsibilities = ? WHERE id = ?`)
      .run(username, displayName, responsibilities || null, existing.id);
    return existing.id;
  }
  const result = d.prepare(`INSERT INTO team_members (chat_id, user_id, username, display_name, responsibilities) VALUES (?, ?, ?, ?, ?)`)
    .run(chatId, userId, username || null, displayName || null, responsibilities || null);
  return result.lastInsertRowid;
}

function getTeamMembers(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM team_members WHERE chat_id = ? ORDER BY display_name ASC`).all(chatId);
}

function getTeamMemberByUsername(chatId, username) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM team_members WHERE chat_id = ? AND username = ?`).get(chatId, username);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 29: Workload (uses tasks table) ═════════════════
// ═══════════════════════════════════════════════════════════════

function getWorkloadByAssignee(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`
    SELECT assigned_to, COUNT(*) as open_tasks,
      SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
    FROM tasks
    WHERE chat_id = ? AND status IN ('pending', 'in_progress') AND assigned_to IS NOT NULL
    GROUP BY assigned_to
    ORDER BY open_tasks DESC
  `).all(chatId);
}

function getOpenTaskCount(chatId, assignee) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND assigned_to = ? AND status IN ('pending', 'in_progress')`).get(chatId, assignee);
  return row ? row.c : 0;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 30: Performance Scores ═════════════════════════
// ═══════════════════════════════════════════════════════════════

function getPerformanceStats(chatId, assignee) {
  const d = baseDb.getDb();
  const total = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND assigned_to = ?`).get(chatId, assignee);
  const completed = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND assigned_to = ? AND status = 'done'`).get(chatId, assignee);
  const pending = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND assigned_to = ? AND status IN ('pending', 'in_progress')`).get(chatId, assignee);
  const overdue = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND assigned_to = ? AND due_date IS NOT NULL AND due_date < date('now') AND status != 'done'`).get(chatId, assignee);

  // Average resolution time (hours) for completed tasks
  const avgRes = d.prepare(`
    SELECT AVG((julianday(done_at) - julianday(created_at)) * 24) as avg_hours
    FROM tasks WHERE chat_id = ? AND assigned_to = ? AND status = 'done' AND done_at IS NOT NULL
  `).get(chatId, assignee);

  const completionRate = total.c > 0 ? Math.round((completed.c / total.c) * 100) : 0;

  return {
    totalTasks: total.c,
    completed: completed.c,
    pending: pending.c,
    overdue: overdue.c,
    completionRate,
    avgResolutionHours: avgRes.avg_hours ? Math.round(avgRes.avg_hours * 10) / 10 : null,
  };
}

function getLeaderboard(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`
    SELECT assigned_to,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) as pending,
      ROUND(CAST(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100) as completion_rate,
      ROUND(AVG(CASE WHEN status = 'done' AND done_at IS NOT NULL THEN (julianday(done_at) - julianday(created_at)) * 24 END), 1) as avg_hours
    FROM tasks
    WHERE chat_id = ? AND assigned_to IS NOT NULL
    GROUP BY assigned_to
    ORDER BY completion_rate DESC, completed DESC
  `).all(chatId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 31: Leave/Availability ═════════════════════════
// ═══════════════════════════════════════════════════════════════

function setAway(chatId, userId, username, displayName, reason, awayUntil) {
  const d = baseDb.getDb();
  // Remove any existing away record
  d.prepare(`DELETE FROM leave_tracker WHERE chat_id = ? AND user_id = ? AND status = 'away'`).run(chatId, userId);
  const result = d.prepare(`INSERT INTO leave_tracker (chat_id, user_id, username, display_name, reason, away_until) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(chatId, userId, username || null, displayName || null, reason || null, awayUntil || null);
  return result.lastInsertRowid;
}

function setBack(chatId, userId) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE leave_tracker SET status = 'back' WHERE chat_id = ? AND user_id = ? AND status = 'away'`).run(chatId, userId);
}

function isUserAway(chatId, userId) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT * FROM leave_tracker WHERE chat_id = ? AND user_id = ? AND status = 'away' ORDER BY created_at DESC LIMIT 1`).get(chatId, userId);
  if (!row) return false;
  // Check if away_until has passed
  if (row.away_until && new Date(row.away_until) < new Date()) {
    d.prepare(`UPDATE leave_tracker SET status = 'back' WHERE id = ?`).run(row.id);
    return false;
  }
  return true;
}

function isUsernameAway(chatId, username) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT * FROM leave_tracker WHERE chat_id = ? AND username = ? AND status = 'away' ORDER BY created_at DESC LIMIT 1`).get(chatId, username);
  if (!row) return false;
  if (row.away_until && new Date(row.away_until) < new Date()) {
    d.prepare(`UPDATE leave_tracker SET status = 'back' WHERE id = ?`).run(row.id);
    return false;
  }
  return true;
}

function getAwayMembers(chatId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM leave_tracker WHERE chat_id = ? AND status = 'away' ORDER BY created_at DESC`).all(chatId);
}

function getAvailableMembers(chatId) {
  const d = baseDb.getDb();
  const allMembers = d.prepare(`SELECT DISTINCT assigned_to FROM tasks WHERE chat_id = ? AND assigned_to IS NOT NULL`).all(chatId);
  const awayUsernames = d.prepare(`SELECT username FROM leave_tracker WHERE chat_id = ? AND status = 'away'`).all(chatId).map(r => r.username);
  return allMembers.filter(m => !awayUsernames.includes(m.assigned_to));
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 35: Daily Check-in ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

function recordCheckin(chatId, userId, username, checkinDate) {
  const d = baseDb.getDb();
  try {
    d.prepare(`INSERT OR REPLACE INTO daily_checkins (chat_id, user_id, username, checkin_date, checked_in) VALUES (?, ?, ?, ?, 1)`)
      .run(chatId, userId, username, checkinDate);
  } catch (e) { /* ignore */ }
}

function hasCheckedIn(chatId, userId, checkinDate) {
  const d = baseDb.getDb();
  const row = d.prepare(`SELECT checked_in FROM daily_checkins WHERE chat_id = ? AND user_id = ? AND checkin_date = ?`).get(chatId, userId, checkinDate);
  return row ? row.checked_in === 1 : false;
}

function getUncheckedMembers(chatId, checkinDate) {
  const d = baseDb.getDb();
  // Get all team members who haven't checked in
  const allMembers = getTeamMembers(chatId);
  const checkedIn = d.prepare(`SELECT user_id FROM daily_checkins WHERE chat_id = ? AND checkin_date = ? AND checked_in = 1`).all(chatId, checkinDate);
  const checkedInIds = new Set(checkedIn.map(r => r.user_id));
  return allMembers.filter(m => !checkedInIds.has(m.user_id));
}

function flagUnchecked(chatId, userId, checkinDate) {
  const d = baseDb.getDb();
  try {
    d.prepare(`INSERT OR REPLACE INTO daily_checkins (chat_id, user_id, checkin_date, checked_in, flagged) VALUES (?, ?, ?, 0, 1)`)
      .run(chatId, userId, checkinDate);
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 37: Polls ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function createPoll(chatId, threadId, question, options, createdBy, messageId) {
  const d = baseDb.getDb();
  const result = d.prepare(`INSERT INTO polls (chat_id, thread_id, question, options, created_by, message_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(chatId, threadId || null, question, JSON.stringify(options), createdBy, messageId || null);
  return result.lastInsertRowid;
}

function getPollById(id) {
  const d = baseDb.getDb();
  const poll = d.prepare(`SELECT * FROM polls WHERE id = ?`).get(id);
  if (poll) poll.options = JSON.parse(poll.options);
  return poll;
}

function votePoll(pollId, userId, username, optionIndex) {
  const d = baseDb.getDb();
  const existing = d.prepare(`SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?`).get(pollId, userId);
  if (existing) {
    d.prepare(`UPDATE poll_votes SET option_index = ?, username = ? WHERE id = ?`).run(optionIndex, username, existing.id);
    return "updated";
  }
  d.prepare(`INSERT INTO poll_votes (poll_id, user_id, username, option_index) VALUES (?, ?, ?, ?)`)
    .run(pollId, userId, username || null, optionIndex);
  return "new";
}

function getPollResults(pollId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT option_index, COUNT(*) as votes FROM poll_votes WHERE poll_id = ? GROUP BY option_index ORDER BY option_index`).all(pollId);
}

function getPollVoters(pollId) {
  const d = baseDb.getDb();
  return d.prepare(`SELECT * FROM poll_votes WHERE poll_id = ? ORDER BY option_index`).all(pollId);
}

function closePoll(pollId) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE polls SET status = 'closed', closed_at = datetime('now') WHERE id = ?`).run(pollId);
}

function getActivePollByMessage(chatId, messageId) {
  const d = baseDb.getDb();
  const poll = d.prepare(`SELECT * FROM polls WHERE chat_id = ? AND message_id = ? AND status = 'active'`).get(chatId, messageId);
  if (poll) poll.options = JSON.parse(poll.options);
  return poll;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 39: Mention Alerts ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addMentionAlert(chatId, threadId, mentionedUsername, mentionedBy, messageText, messageId) {
  const d = baseDb.getDb();
  const result = d.prepare(`INSERT INTO mention_alerts (chat_id, thread_id, mentioned_username, mentioned_by, message_text, message_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(chatId, threadId || null, mentionedUsername, mentionedBy || null, messageText || null, messageId || null);
  return result.lastInsertRowid;
}

function markMentionResponded(chatId, threadId, username) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE mention_alerts SET responded = 1 WHERE chat_id = ? AND thread_id = ? AND mentioned_username = ? AND responded = 0`)
    .run(chatId, threadId || null, username);
}

function getUnrespondedMentions(chatId, hoursOld = 2) {
  const d = baseDb.getDb();
  return d.prepare(`
    SELECT * FROM mention_alerts
    WHERE chat_id = ? AND responded = 0 AND reminder_sent = 0
      AND created_at <= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at ASC
  `).all(chatId, hoursOld);
}

function markMentionReminderSent(id) {
  const d = baseDb.getDb();
  d.prepare(`UPDATE mention_alerts SET reminder_sent = 1 WHERE id = ?`).run(id);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Duplicate Detection Helper ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

function findSimilarTasks(chatId, title) {
  const d = baseDb.getDb();
  // Get all pending tasks and check for keyword overlap
  const pending = d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status IN ('pending', 'in_progress') ORDER BY created_at DESC`).all(chatId);

  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (titleWords.length === 0) return [];

  const similar = [];
  for (const task of pending) {
    const taskWords = task.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = titleWords.filter(w => taskWords.includes(w));
    const similarity = titleWords.length > 0 ? overlap.length / titleWords.length : 0;
    if (similarity >= 0.5) {
      similar.push({ ...task, similarity: Math.round(similarity * 100) });
    }
  }
  return similar.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// ═══ High Priority Stale Tasks (for auto-escalation) ════════
// ═══════════════════════════════════════════════════════════════

function getStaleHighPriorityTasks(chatId, hoursOld = 48) {
  const d = baseDb.getDb();
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND status IN ('pending', 'in_progress') AND priority = 'high'
      AND thread_id != 13
      AND created_at <= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at ASC
  `).all(chatId, hoursOld);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  initV4Tables,
  // Roles (Feature 22)
  setRole, getRole, getRoleRecord, getAllRoles, hasPermission,
  // Audit Log (Feature 23)
  addAuditLog, getAuditLog, getAuditLogByUser,
  // Member Verification (Feature 24)
  addUnverifiedMember, verifyMember, isMemberVerified, getUnverifiedMembers, getMemberVerification,
  // Onboarding (Feature 27)
  ONBOARDING_ITEMS, initOnboarding, completeOnboardingItem, getOnboardingProgress,
  // Team Members (Feature 28)
  upsertTeamMember, getTeamMembers, getTeamMemberByUsername,
  // Workload (Feature 29)
  getWorkloadByAssignee, getOpenTaskCount,
  // Performance (Feature 30)
  getPerformanceStats, getLeaderboard,
  // Leave/Availability (Feature 31)
  setAway, setBack, isUserAway, isUsernameAway, getAwayMembers, getAvailableMembers,
  // Check-in (Feature 35)
  recordCheckin, hasCheckedIn, getUncheckedMembers, flagUnchecked,
  // Polls (Feature 37)
  createPoll, getPollById, votePoll, getPollResults, getPollVoters, closePoll, getActivePollByMessage,
  // Mention Alerts (Feature 39)
  addMentionAlert, markMentionResponded, getUnrespondedMentions, markMentionReminderSent,
  // Duplicate Detection (Feature 33)
  findSimilarTasks,
  // Priority Auto-Escalation (Feature 34)
  getStaleHighPriorityTasks,
};
