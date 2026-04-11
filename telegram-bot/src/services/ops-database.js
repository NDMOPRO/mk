/**
 * Operations Database Service
 * Stores tasks, checklists, follow-ups, and reminders
 * for the Monthly Key Daily Operations HQ group.
 *
 * This is COMPLETELY SEPARATE from the public bot database.
 * Only used when the bot is operating in the ops group context.
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
  }
  return db;
}

function initTables() {
  const d = getDb();

  // ─── Tasks / Checklists ──────────────────────────────────────
  // Each task belongs to a specific topic (message_thread_id) in the ops group.
  d.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER,          -- Telegram topic/thread ID (null = General)
      topic_name  TEXT,             -- Human-readable topic name, e.g. "02 — Operations Follow-Up"
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'pending',   -- pending | done | cancelled
      priority    TEXT DEFAULT 'normal',    -- low | normal | high | urgent
      assigned_to TEXT,             -- @username or name
      due_date    TEXT,             -- ISO date string
      created_by  TEXT,             -- @username of creator
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      done_at     TEXT
    )
  `);

  // ─── Follow-ups ──────────────────────────────────────────────
  // Detected promises like "will update tomorrow" or "I'll do it by evening"
  d.exec(`
    CREATE TABLE IF NOT EXISTS followups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      message_text  TEXT NOT NULL,    -- Original message that triggered the follow-up
      from_user     TEXT,             -- @username or first name
      follow_up_at  TEXT NOT NULL,    -- When to send the follow-up reminder (ISO datetime)
      sent          INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Reminders ───────────────────────────────────────────────
  // Manual reminders set via /remind command
  d.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER,
      topic_name  TEXT,
      message     TEXT NOT NULL,
      remind_at   TEXT NOT NULL,      -- ISO datetime (UTC)
      sent        INTEGER DEFAULT 0,
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ─── Task Operations ─────────────────────────────────────────

function addTask(chatId, threadId, topicName, title, options = {}) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO tasks (chat_id, thread_id, topic_name, title, description, priority, assigned_to, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    threadId || null,
    topicName || null,
    title,
    options.description || null,
    options.priority || "normal",
    options.assignedTo || null,
    options.dueDate || null,
    options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getTasksByThread(chatId, threadId) {
  const d = getDb();
  // threadId null means general (no topic)
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

// ─── Follow-up Operations ────────────────────────────────────

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

// ─── Reminder Operations ─────────────────────────────────────

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
  // Follow-ups
  addFollowUp,
  getDueFollowUps,
  markFollowUpSent,
  // Reminders
  addReminder,
  getDueReminders,
  markReminderSent,
};
