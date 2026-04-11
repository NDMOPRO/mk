/**
 * Operations Database Service
 * ─────────────────────────────────────────────────────────────
 * Stores tasks, checklists, follow-ups, reminders, media logs,
 * vendor follow-ups, and KPI data for the Monthly Key Daily
 * Operations HQ group.
 *
 * This is COMPLETELY SEPARATE from the public bot database.
 */
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "ops.db");

let db;

function getDb() {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables();
    runMigrations();
  }
  return db;
}

function initTables() {
  const d = getDb();

  // ─── Tasks / Checklists ──────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      title         TEXT NOT NULL,
      description   TEXT,
      status        TEXT DEFAULT 'pending',
      priority      TEXT DEFAULT 'normal',
      assigned_to   TEXT,
      due_date      TEXT,
      property_tag  TEXT,
      created_by    TEXT,
      transferred_to_thread INTEGER,
      transferred_to_topic  TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      done_at       TEXT
    )
  `);

  // ─── Follow-ups ──────────────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS followups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      message_text  TEXT NOT NULL,
      from_user     TEXT,
      follow_up_at  TEXT NOT NULL,
      sent          INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Reminders ───────────────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER,
      topic_name  TEXT,
      message     TEXT NOT NULL,
      remind_at   TEXT NOT NULL,
      sent        INTEGER DEFAULT 0,
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Media Log (Feature 6) ──────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS media_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER,
      topic_name  TEXT,
      file_id     TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      caption     TEXT,
      from_user   TEXT,
      task_id     INTEGER,
      property_tag TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Vendor Follow-ups (Feature 7) ──────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS vendor_followups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      vendor_name   TEXT,
      promise_text  TEXT NOT NULL,
      from_user     TEXT,
      deadline_at   TEXT NOT NULL,
      status        TEXT DEFAULT 'pending',
      sent          INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Daily Report Log ────────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      report_date TEXT NOT NULL,
      report_type TEXT NOT NULL,
      sent        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ─── Migrations (add columns to existing tables) ─────────────

function runMigrations() {
  const d = getDb();

  // Add property_tag to tasks if not exists
  try { d.exec("ALTER TABLE tasks ADD COLUMN property_tag TEXT"); } catch (e) {}
  // Add transferred columns
  try { d.exec("ALTER TABLE tasks ADD COLUMN transferred_to_thread INTEGER"); } catch (e) {}
  try { d.exec("ALTER TABLE tasks ADD COLUMN transferred_to_topic TEXT"); } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// ═══ Task Operations ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addTask(chatId, threadId, topicName, title, options = {}) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO tasks (chat_id, thread_id, topic_name, title, description, priority, assigned_to, due_date, property_tag, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    threadId || null,
    topicName || null,
    title,
    options.description || null,
    options.priority || "normal",
    options.assignedTo || null,
    options.dueDate || null,
    options.propertyTag || null,
    options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getTasksByThread(chatId, threadId) {
  const d = getDb();
  if (threadId == null) {
    return d.prepare(`
      SELECT * FROM tasks WHERE chat_id = ? AND thread_id IS NULL AND status != 'cancelled'
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC
    `).all(chatId);
  }
  return d.prepare(`
    SELECT * FROM tasks WHERE chat_id = ? AND thread_id = ? AND status != 'cancelled'
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC
  `).all(chatId, threadId);
}

function getPendingTasksByThread(chatId, threadId) {
  const d = getDb();
  if (threadId == null) {
    return d.prepare(`
      SELECT * FROM tasks WHERE chat_id = ? AND thread_id IS NULL AND status = 'pending'
      ORDER BY id ASC
    `).all(chatId);
  }
  return d.prepare(`
    SELECT * FROM tasks WHERE chat_id = ? AND thread_id = ? AND status = 'pending'
    ORDER BY id ASC
  `).all(chatId, threadId);
}

function getAllPendingTasks(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending'
    ORDER BY thread_id, id ASC
  `).all(chatId);
}

function getTaskById(taskId) {
  const d = getDb();
  return d.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
}

function markTaskDone(taskId) {
  const d = getDb();
  d.prepare(`
    UPDATE tasks SET status = 'done', done_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(taskId);
}

function markTaskPending(taskId) {
  const d = getDb();
  d.prepare(`
    UPDATE tasks SET status = 'pending', done_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(taskId);
}

function cancelTask(taskId) {
  const d = getDb();
  d.prepare(`
    UPDATE tasks SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ?
  `).run(taskId);
}

function getTaskStats(chatId) {
  const d = getDb();
  const total   = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status != 'cancelled'").get(chatId);
  const pending = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending'").get(chatId);
  const done    = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done'").get(chatId);
  return { total: total.c, pending: pending.c, done: done.c };
}

// ─── Task Assignment & Overdue (Feature 2) ──────────────────

function getOverdueTasks(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?
    ORDER BY due_date ASC
  `).all(chatId, today);
}

function getTasksDueToday(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND status = 'pending' AND due_date = ?
    ORDER BY id ASC
  `).all(chatId, today);
}

function getTasksByAssignee(chatId, assignee) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND status = 'pending' AND assigned_to LIKE ?
    ORDER BY id ASC
  `).all(chatId, `%${assignee}%`);
}

// ─── Property Tracking (Feature 5) ──────────────────────────

function getTasksByProperty(chatId, propertyTag) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND property_tag = ? AND status != 'cancelled'
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC
  `).all(chatId, propertyTag);
}

function updateTaskProperty(taskId, propertyTag) {
  const d = getDb();
  d.prepare("UPDATE tasks SET property_tag = ?, updated_at = datetime('now') WHERE id = ?").run(propertyTag, taskId);
}

// ─── Task Transfer / Handoff (Feature 8) ────────────────────

function transferTask(taskId, newThreadId, newTopicName) {
  const d = getDb();
  d.prepare(`
    UPDATE tasks
    SET transferred_to_thread = ?, transferred_to_topic = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newThreadId, newTopicName, taskId);

  // Also update the actual thread_id and topic_name so it appears in the new topic
  d.prepare(`
    UPDATE tasks SET thread_id = ?, topic_name = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newThreadId, newTopicName, taskId);
}

// ─── KPI / Stats (Feature 3) ────────────────────────────────

function getWeeklyStats(chatId) {
  const d = getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);

  const created = d.prepare(`
    SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND created_at >= ?
  `).get(chatId, weekAgo);

  const completed = d.prepare(`
    SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ?
  `).get(chatId, weekAgo);

  const avgResolution = d.prepare(`
    SELECT AVG(
      CAST((julianday(done_at) - julianday(created_at)) * 24 AS REAL)
    ) as avg_hours
    FROM tasks
    WHERE chat_id = ? AND status = 'done' AND done_at >= ? AND done_at IS NOT NULL
  `).get(chatId, weekAgo);

  const byTopic = d.prepare(`
    SELECT topic_name, COUNT(*) as c
    FROM tasks
    WHERE chat_id = ? AND status = 'pending' AND created_at >= ?
    GROUP BY topic_name
    ORDER BY c DESC
  `).all(chatId, weekAgo);

  const blockers = d.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE chat_id = ? AND status = 'pending' AND priority IN ('urgent', 'high')
  `).get(chatId);

  return {
    created: created.c,
    completed: completed.c,
    avgResolutionHours: avgResolution.avg_hours ? Math.round(avgResolution.avg_hours * 10) / 10 : null,
    pendingByTopic: byTopic,
    highPriorityCount: blockers.c,
  };
}

function getCompletedToday(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND status = 'done' AND done_at >= ?
    ORDER BY done_at DESC
  `).all(chatId, today);
}

// ─── Escalation (Feature 4) ─────────────────────────────────

function getStaleBlockers(chatId, threadId, hoursOld) {
  const d = getDb();
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
  return d.prepare(`
    SELECT * FROM tasks
    WHERE chat_id = ? AND thread_id = ? AND status = 'pending' AND created_at <= ?
    ORDER BY created_at ASC
  `).all(chatId, threadId, cutoff);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Follow-up Operations ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addFollowUp(chatId, threadId, topicName, messageText, fromUser, followUpAt) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO followups (chat_id, thread_id, topic_name, message_text, from_user, follow_up_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(chatId, threadId || null, topicName || null, messageText, fromUser, followUpAt);
  return result.lastInsertRowid;
}

function getDueFollowUps() {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM followups
    WHERE sent = 0 AND follow_up_at <= datetime('now')
    ORDER BY follow_up_at ASC
  `).all();
}

function markFollowUpSent(followUpId) {
  const d = getDb();
  d.prepare("UPDATE followups SET sent = 1 WHERE id = ?").run(followUpId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Reminder Operations ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addReminder(chatId, threadId, topicName, message, remindAt, createdBy) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO reminders (chat_id, thread_id, topic_name, message, remind_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(chatId, threadId || null, topicName || null, message, remindAt, createdBy || null);
  return result.lastInsertRowid;
}

function getDueReminders() {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM reminders
    WHERE sent = 0 AND remind_at <= datetime('now')
    ORDER BY remind_at ASC
  `).all();
}

function markReminderSent(reminderId) {
  const d = getDb();
  d.prepare("UPDATE reminders SET sent = 1 WHERE id = ?").run(reminderId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Media Log Operations (Feature 6) ════════════════════════
// ═══════════════════════════════════════════════════════════════

function addMediaLog(chatId, threadId, topicName, fileId, fileType, options = {}) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO media_log (chat_id, thread_id, topic_name, file_id, file_type, caption, from_user, task_id, property_tag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    threadId || null,
    topicName || null,
    fileId,
    fileType,
    options.caption || null,
    options.fromUser || null,
    options.taskId || null,
    options.propertyTag || null
  );
  return result.lastInsertRowid;
}

function getMediaByProperty(chatId, propertyTag) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM media_log WHERE chat_id = ? AND property_tag = ?
    ORDER BY created_at DESC
  `).all(chatId, propertyTag);
}

function getMediaByTask(chatId, taskId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM media_log WHERE chat_id = ? AND task_id = ?
    ORDER BY created_at DESC
  `).all(chatId, taskId);
}

function getMediaByThread(chatId, threadId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM media_log WHERE chat_id = ? AND thread_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(chatId, threadId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Vendor Follow-up Operations (Feature 7) ═════════════════
// ═══════════════════════════════════════════════════════════════

function addVendorFollowUp(chatId, threadId, topicName, vendorName, promiseText, fromUser, deadlineAt) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO vendor_followups (chat_id, thread_id, topic_name, vendor_name, promise_text, from_user, deadline_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, threadId || null, topicName || null, vendorName, promiseText, fromUser, deadlineAt);
  return result.lastInsertRowid;
}

function getDueVendorFollowUps() {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM vendor_followups
    WHERE sent = 0 AND status = 'pending' AND deadline_at <= datetime('now')
    ORDER BY deadline_at ASC
  `).all();
}

function markVendorFollowUpSent(id) {
  const d = getDb();
  d.prepare("UPDATE vendor_followups SET sent = 1 WHERE id = ?").run(id);
}

function resolveVendorFollowUp(id) {
  const d = getDb();
  d.prepare("UPDATE vendor_followups SET status = 'resolved' WHERE id = ?").run(id);
}

function getPendingVendorFollowUps(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM vendor_followups
    WHERE chat_id = ? AND status = 'pending'
    ORDER BY deadline_at ASC
  `).all(chatId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Daily Report Log ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function hasReportBeenSent(chatId, reportDate, reportType) {
  const d = getDb();
  const row = d.prepare(`
    SELECT id FROM daily_reports WHERE chat_id = ? AND report_date = ? AND report_type = ?
  `).get(chatId, reportDate, reportType);
  return !!row;
}

function markReportSent(chatId, reportDate, reportType) {
  const d = getDb();
  d.prepare(`
    INSERT INTO daily_reports (chat_id, report_date, report_type, sent)
    VALUES (?, ?, ?, 1)
  `).run(chatId, reportDate, reportType);
}

module.exports = {
  getDb,
  // Tasks
  addTask,
  getTasksByThread,
  getPendingTasksByThread,
  getAllPendingTasks,
  getTaskById,
  markTaskDone,
  markTaskPending,
  cancelTask,
  getTaskStats,
  // Task Assignment & Overdue
  getOverdueTasks,
  getTasksDueToday,
  getTasksByAssignee,
  // Property Tracking
  getTasksByProperty,
  updateTaskProperty,
  // Task Transfer
  transferTask,
  // KPI
  getWeeklyStats,
  getCompletedToday,
  // Escalation
  getStaleBlockers,
  // Follow-ups
  addFollowUp,
  getDueFollowUps,
  markFollowUpSent,
  // Reminders
  addReminder,
  getDueReminders,
  markReminderSent,
  // Media Log
  addMediaLog,
  getMediaByProperty,
  getMediaByTask,
  getMediaByThread,
  // Vendor Follow-ups
  addVendorFollowUp,
  getDueVendorFollowUps,
  markVendorFollowUpSent,
  resolveVendorFollowUp,
  getPendingVendorFollowUps,
  // Daily Reports
  hasReportBeenSent,
  markReportSent,
};
