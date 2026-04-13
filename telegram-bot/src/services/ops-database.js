/**
 * Operations Database Service — v3 (21-Feature)
 * ─────────────────────────────────────────────────────────────
 * Stores all data for the Monthly Key Daily Operations HQ group.
 * This is COMPLETELY SEPARATE from the public bot database.
 *
 * Tables:
 *  - tasks            (core tasks/checklists)
 *  - followups        (follow-up reminders)
 *  - reminders        (manual reminders)
 *  - media_log        (photo/doc/video/voice logging)
 *  - vendor_followups (vendor promise tracking)
 *  - daily_reports    (dedup for scheduled reports)
 *  - sla_config       (SLA timers per topic)         — Feature 11
 *  - sla_alerts       (SLA breach alert log)         — Feature 11
 *  - approvals        (approval workflow)             — Feature 12
 *  - recurring_tasks  (recurring task definitions)    — Feature 13
 *  - task_dependencies (task dependency graph)        — Feature 14
 *  - expenses         (expense tracking)              — Feature 17
 *  - occupancy        (unit/property occupancy)       — Feature 18
 *  - meetings         (meeting sessions)              — Feature 19
 *  - meeting_messages (captured meeting messages)     — Feature 19
 */
const Database = require("better-sqlite3");
const path = require("path");
const log = require("../utils/logger");

// Use persistent volume on Railway (/app/data) if available, else local
const VOLUME_PATH = "/app/data/ops.db";
const LOCAL_PATH = path.join(__dirname, "..", "..", "data", "ops.db");
const fs = require("fs");

function resolveDbPath() {
  // If /app/data exists (Railway volume), use it
  if (fs.existsSync("/app/data")) {
    // If the volume DB doesn't exist yet, copy the seed from the repo
    if (!fs.existsSync(VOLUME_PATH) && fs.existsSync(LOCAL_PATH)) {
      console.log("[OpsDB] Copying seed database to persistent volume...");
      fs.copyFileSync(LOCAL_PATH, VOLUME_PATH);
    }
    console.log("[OpsDB] Using persistent volume:", VOLUME_PATH);
    return VOLUME_PATH;
  }
  console.log("[OpsDB] Using local path:", LOCAL_PATH);
  return LOCAL_PATH;
}

const DB_PATH = resolveDbPath();

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      db = new Database(DB_PATH);
      db.pragma("journal_mode = WAL");
      db.pragma("busy_timeout = 5000");
      initTables();
      runMigrations();
      log.info('OpsDB', 'Database opened', { path: DB_PATH });
    } catch (err) {
      log.error('OpsDB', 'Failed to open database', { path: DB_PATH, error: err.message });
      throw err;
    }
  }
  return db;
}

/**
 * Close the ops database connection cleanly.
 * Used during graceful shutdown.
 */
function closeDb() {
  if (db) {
    try {
      db.close();
      db = null;
      log.info('OpsDB', 'Database closed');
    } catch (e) {
      log.warn('OpsDB', 'Error closing database', { error: e.message });
    }
  }
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

  // ─── Media Log ───────────────────────────────────────────────
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

  // ─── Vendor Follow-ups ──────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════
  // ═══ NEW TABLES — v3 (11 new features) ═════════════════════════
  // ═══════════════════════════════════════════════════════════════

  // ─── Feature 1: SLA Config ───────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS sla_config (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER NOT NULL,
      topic_name  TEXT,
      sla_hours   INTEGER NOT NULL DEFAULT 24,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 1: SLA Alerts (dedup) ──────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS sla_alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     INTEGER NOT NULL,
      alert_type  TEXT NOT NULL,
      sent_at     TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 2: Approvals ───────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      request_text  TEXT NOT NULL,
      requested_by  TEXT,
      status        TEXT DEFAULT 'pending',
      decided_by    TEXT,
      decision_comment TEXT,
      message_id    INTEGER,
      created_at    TEXT DEFAULT (datetime('now')),
      decided_at    TEXT
    )
  `);

  // ─── Feature 3: Recurring Tasks ─────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      title         TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      assigned_to   TEXT,
      property_tag  TEXT,
      priority      TEXT DEFAULT 'normal',
      created_by    TEXT,
      active        INTEGER DEFAULT 1,
      last_created  TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 4: Task Dependencies ───────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS task_dependencies (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id         INTEGER NOT NULL,
      depends_on_id   INTEGER NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 7: Expenses ────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      amount        REAL NOT NULL,
      description   TEXT NOT NULL,
      property_tag  TEXT,
      category      TEXT,
      created_by    TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 8: Occupancy ───────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS occupancy (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      unit_name     TEXT NOT NULL UNIQUE,
      status        TEXT DEFAULT 'vacant',
      tenant_name   TEXT,
      updated_by    TEXT,
      updated_at    TEXT DEFAULT (datetime('now')),
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Feature 9: Meetings ────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL,
      thread_id     INTEGER,
      topic_name    TEXT,
      status        TEXT DEFAULT 'active',
      started_by    TEXT,
      started_at    TEXT DEFAULT (datetime('now')),
      ended_at      TEXT,
      summary       TEXT
    )
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS meeting_messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id    INTEGER NOT NULL,
      from_user     TEXT,
      message_text  TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Scheduled Meetings (Meeting Management System) ─────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_meetings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id         INTEGER NOT NULL,
      thread_id       INTEGER,
      title           TEXT NOT NULL,
      meeting_datetime TEXT NOT NULL,
      location        TEXT,
      agenda          TEXT,
      attendees       TEXT DEFAULT '[]',
      status          TEXT DEFAULT 'scheduled',
      created_by      TEXT,
      reminded_30     INTEGER DEFAULT 0,
      reminded_5      INTEGER DEFAULT 0,
      calendar_event_id TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  d.exec(`
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id      INTEGER NOT NULL,
      notes           TEXT NOT NULL,
      action_items    TEXT DEFAULT '[]',
      created_by      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Appointments (Appointment Scheduling System) ──────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id               INTEGER NOT NULL,
      topic_thread_id       INTEGER,
      title                 TEXT NOT NULL,
      appointment_datetime  TEXT NOT NULL,
      location              TEXT,
      attendees_internal    TEXT DEFAULT '[]',
      attendees_external    TEXT DEFAULT '[]',
      notes                 TEXT,
      status                TEXT DEFAULT 'scheduled',
      created_by            TEXT,
      reminder_1h_sent      INTEGER DEFAULT 0,
      reminder_15m_sent     INTEGER DEFAULT 0,
      created_at            TEXT DEFAULT (datetime('now')),
      updated_at            TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── WhatsApp Notification Preferences ─────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_config (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id           INTEGER NOT NULL,
      notifications_on  INTEGER DEFAULT 1,
      updated_at        TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Activity Log ─────────────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id           INTEGER NOT NULL,
      topic_thread_id   INTEGER,
      user_username     TEXT,
      user_display_name TEXT,
      message_type      TEXT NOT NULL DEFAULT 'text',
      caption_or_text   TEXT,
      file_id           TEXT,
      timestamp         TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Task Evidence (photo proof linked to tasks) ──────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS task_evidence (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id       INTEGER NOT NULL,
      photo_file_id TEXT NOT NULL,
      caption       TEXT,
      submitted_by  TEXT,
      submitted_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // ─── Contacts ─────────────────────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id             INTEGER NOT NULL,
      name                TEXT NOT NULL,
      phone               TEXT NOT NULL,
      email               TEXT,
      contact_type        TEXT,
      notes               TEXT,
      added_by_username   TEXT,
      added_by_name       TEXT,
      topic_message_id    INTEGER,
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Bot State (for one-time flags) ───────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS bot_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

// ─── Migrations ─────────────────────────────────────────────

function runMigrations() {
  const d = getDb();
  try { d.exec("ALTER TABLE tasks ADD COLUMN property_tag TEXT"); } catch (e) {}
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
    chatId, threadId || null, topicName || null, title,
    options.description || null, options.priority || "normal",
    options.assignedTo || null, options.dueDate || null,
    options.propertyTag || null, options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getTasksByThread(chatId, threadId) {
  const d = getDb();
  if (threadId == null) {
    return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND thread_id IS NULL AND status != 'cancelled' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(chatId);
  }
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND thread_id = ? AND status != 'cancelled' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(chatId, threadId);
}

function getPendingTasksByThread(chatId, threadId) {
  const d = getDb();
  if (threadId == null) {
    return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND thread_id IS NULL AND status = 'pending' ORDER BY id ASC`).all(chatId);
  }
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND thread_id = ? AND status = 'pending' ORDER BY id ASC`).all(chatId, threadId);
}

function getAllPendingTasks(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' ORDER BY thread_id, id ASC`).all(chatId);
}

function getTaskById(taskId) {
  const d = getDb();
  return d.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
}

function markTaskDone(taskId) {
  const d = getDb();
  d.prepare(`UPDATE tasks SET status = 'done', done_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(taskId);
}

function markTaskPending(taskId) {
  const d = getDb();
  d.prepare(`UPDATE tasks SET status = 'pending', done_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(taskId);
}

function cancelTask(taskId) {
  const d = getDb();
  d.prepare(`UPDATE tasks SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(taskId);
}

function getTaskStats(chatId) {
  const d = getDb();
  const total   = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status != 'cancelled'").get(chatId);
  const pending = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending'").get(chatId);
  const done    = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done'").get(chatId);
  return { total: total.c, pending: pending.c, done: done.c };
}

function getOverdueTasks(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date ASC`).all(chatId, today);
}

function getTasksDueToday(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date = ? ORDER BY id ASC`).all(chatId, today);
}

function getTasksByAssignee(chatId, assignee) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'pending' AND assigned_to LIKE ? ORDER BY id ASC`).all(chatId, `%${assignee}%`);
}

function getTasksByProperty(chatId, propertyTag) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND property_tag = ? AND status != 'cancelled' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(chatId, propertyTag);
}

function updateTaskProperty(taskId, propertyTag) {
  const d = getDb();
  d.prepare("UPDATE tasks SET property_tag = ?, updated_at = datetime('now') WHERE id = ?").run(propertyTag, taskId);
}

function transferTask(taskId, newThreadId, newTopicName) {
  const d = getDb();
  d.prepare(`UPDATE tasks SET transferred_to_thread = ?, transferred_to_topic = ?, updated_at = datetime('now') WHERE id = ?`).run(newThreadId, newTopicName, taskId);
  d.prepare(`UPDATE tasks SET thread_id = ?, topic_name = ?, updated_at = datetime('now') WHERE id = ?`).run(newThreadId, newTopicName, taskId);
}

function getWeeklyStats(chatId) {
  const d = getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
  const created = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND created_at >= ?`).get(chatId, weekAgo);
  const completed = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ?`).get(chatId, weekAgo);
  const avgResolution = d.prepare(`SELECT AVG(CAST((julianday(done_at) - julianday(created_at)) * 24 AS REAL)) as avg_hours FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ? AND done_at IS NOT NULL`).get(chatId, weekAgo);
  const byTopic = d.prepare(`SELECT topic_name, COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending' AND created_at >= ? GROUP BY topic_name ORDER BY c DESC`).all(chatId, weekAgo);
  const blockers = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending' AND priority IN ('urgent', 'high')`).get(chatId);
  return {
    created: created.c, completed: completed.c,
    avgResolutionHours: avgResolution.avg_hours ? Math.round(avgResolution.avg_hours * 10) / 10 : null,
    pendingByTopic: byTopic, highPriorityCount: blockers.c,
  };
}

function getCompletedToday(chatId) {
  const d = getDb();
  const today = new Date().toISOString().split("T")[0];
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ? ORDER BY done_at DESC`).all(chatId, today);
}

function getStaleBlockers(chatId, threadId, hoursOld) {
  const d = getDb();
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND thread_id = ? AND status = 'pending' AND created_at <= ? ORDER BY created_at ASC`).all(chatId, threadId, cutoff);
}

// ─── Monthly Stats (Feature 6: Monthly Report) ─────────────

function getMonthlyStats(chatId) {
  const d = getDb();
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const created = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND created_at >= ?`).get(chatId, firstOfMonth);
  const completed = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ?`).get(chatId, firstOfMonth);
  const overdue = d.prepare(`SELECT COUNT(*) as c FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < date('now')`).get(chatId);

  // Per-assignee stats
  const byAssignee = d.prepare(`
    SELECT assigned_to, 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM tasks WHERE chat_id = ? AND created_at >= ? AND assigned_to IS NOT NULL
    GROUP BY assigned_to ORDER BY total DESC
  `).all(chatId, firstOfMonth);

  // Per-topic stats
  const byTopic = d.prepare(`
    SELECT topic_name, COUNT(*) as c
    FROM tasks WHERE chat_id = ? AND created_at >= ?
    GROUP BY topic_name ORDER BY c DESC
  `).all(chatId, firstOfMonth);

  return { created: created.c, completed: completed.c, overdue: overdue.c, byAssignee, byTopic, firstOfMonth };
}

// ─── Tasks created in time range (for shift handover) ───────

function getTasksCreatedSince(chatId, sinceISO) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND created_at >= ? ORDER BY created_at ASC`).all(chatId, sinceISO);
}

function getTasksCompletedSince(chatId, sinceISO) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status = 'done' AND done_at >= ? ORDER BY done_at ASC`).all(chatId, sinceISO);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Follow-up Operations ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addFollowUp(chatId, threadId, topicName, messageText, fromUser, followUpAt) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO followups (chat_id, thread_id, topic_name, message_text, from_user, follow_up_at) VALUES (?, ?, ?, ?, ?, ?)`).run(chatId, threadId || null, topicName || null, messageText, fromUser, followUpAt);
  return result.lastInsertRowid;
}

function getDueFollowUps() {
  const d = getDb();
  return d.prepare(`SELECT * FROM followups WHERE sent = 0 AND follow_up_at <= datetime('now') ORDER BY follow_up_at ASC`).all();
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
  const result = d.prepare(`INSERT INTO reminders (chat_id, thread_id, topic_name, message, remind_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`).run(chatId, threadId || null, topicName || null, message, remindAt, createdBy || null);
  return result.lastInsertRowid;
}

function getDueReminders() {
  const d = getDb();
  return d.prepare(`SELECT * FROM reminders WHERE sent = 0 AND remind_at <= datetime('now') ORDER BY remind_at ASC`).all();
}

function markReminderSent(reminderId) {
  const d = getDb();
  d.prepare("UPDATE reminders SET sent = 1 WHERE id = ?").run(reminderId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Media Log Operations ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addMediaLog(chatId, threadId, topicName, fileId, fileType, options = {}) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO media_log (chat_id, thread_id, topic_name, file_id, file_type, caption, from_user, task_id, property_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    chatId, threadId || null, topicName || null, fileId, fileType,
    options.caption || null, options.fromUser || null, options.taskId || null, options.propertyTag || null
  );
  return result.lastInsertRowid;
}

function getMediaByProperty(chatId, propertyTag) {
  const d = getDb();
  return d.prepare(`SELECT * FROM media_log WHERE chat_id = ? AND property_tag = ? ORDER BY created_at DESC`).all(chatId, propertyTag);
}

function getMediaByTask(chatId, taskId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM media_log WHERE chat_id = ? AND task_id = ? ORDER BY created_at DESC`).all(chatId, taskId);
}

function getMediaByThread(chatId, threadId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM media_log WHERE chat_id = ? AND thread_id = ? ORDER BY created_at DESC LIMIT 20`).all(chatId, threadId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Vendor Follow-up Operations ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addVendorFollowUp(chatId, threadId, topicName, vendorName, promiseText, fromUser, deadlineAt) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO vendor_followups (chat_id, thread_id, topic_name, vendor_name, promise_text, from_user, deadline_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(chatId, threadId || null, topicName || null, vendorName, promiseText, fromUser, deadlineAt);
  return result.lastInsertRowid;
}

function getDueVendorFollowUps() {
  const d = getDb();
  return d.prepare(`SELECT * FROM vendor_followups WHERE sent = 0 AND status = 'pending' AND deadline_at <= datetime('now') ORDER BY deadline_at ASC`).all();
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
  return d.prepare(`SELECT * FROM vendor_followups WHERE chat_id = ? AND status = 'pending' ORDER BY deadline_at ASC`).all(chatId);
}

// Alias used by ops-scheduler.js — filters by chat_id and maps column names
// to what the scheduler template expects (description → promise_text, expected_date → deadline_at)
function getOverdueVendorFollowUps(chatId) {
  const d = getDb();
  const rows = d.prepare(
    `SELECT * FROM vendor_followups
     WHERE chat_id = ? AND sent = 0 AND status = 'pending'
     AND deadline_at <= datetime('now')
     ORDER BY deadline_at ASC`
  ).all(chatId);
  // Map column names to what the scheduler template expects
  return rows.map(r => ({
    ...r,
    description: r.promise_text,
    expected_date: r.deadline_at ? r.deadline_at.substring(0, 10) : r.deadline_at,
  }));
}

// Alias used by ops-scheduler.js — marks vendor follow-up as notified (sent = 1)
function markVendorFollowUpNotified(id) {
  const d = getDb();
  d.prepare("UPDATE vendor_followups SET sent = 1 WHERE id = ?").run(id);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Daily Report Log ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function hasReportBeenSent(chatId, reportDate, reportType) {
  const d = getDb();
  const row = d.prepare(`SELECT id FROM daily_reports WHERE chat_id = ? AND report_date = ? AND report_type = ?`).get(chatId, reportDate, reportType);
  return !!row;
}

function markReportSent(chatId, reportDate, reportType) {
  const d = getDb();
  d.prepare(`INSERT INTO daily_reports (chat_id, report_date, report_type, sent) VALUES (?, ?, ?, 1)`).run(chatId, reportDate, reportType);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 1: SLA Config & Alerts ═════════════════════════
// ═══════════════════════════════════════════════════════════════

function setSlaConfig(chatId, threadId, topicName, slaHours) {
  const d = getDb();
  const existing = d.prepare(`SELECT id FROM sla_config WHERE chat_id = ? AND thread_id = ?`).get(chatId, threadId);
  if (existing) {
    d.prepare(`UPDATE sla_config SET sla_hours = ?, topic_name = ? WHERE id = ?`).run(slaHours, topicName, existing.id);
    return existing.id;
  }
  const result = d.prepare(`INSERT INTO sla_config (chat_id, thread_id, topic_name, sla_hours) VALUES (?, ?, ?, ?)`).run(chatId, threadId, topicName, slaHours);
  return result.lastInsertRowid;
}

function getSlaConfig(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM sla_config WHERE chat_id = ?`).all(chatId);
}

function getSlaForThread(chatId, threadId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM sla_config WHERE chat_id = ? AND thread_id = ?`).get(chatId, threadId);
}

function hasSlaAlertBeenSent(taskId, alertType) {
  const d = getDb();
  const row = d.prepare(`SELECT id FROM sla_alerts WHERE task_id = ? AND alert_type = ?`).get(taskId, alertType);
  return !!row;
}

function markSlaAlertSent(taskId, alertType) {
  const d = getDb();
  d.prepare(`INSERT INTO sla_alerts (task_id, alert_type) VALUES (?, ?)`).run(taskId, alertType);
}

function getTasksWithSla(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT t.*, s.sla_hours
    FROM tasks t
    JOIN sla_config s ON t.chat_id = s.chat_id AND t.thread_id = s.thread_id
    WHERE t.chat_id = ? AND t.status = 'pending'
    ORDER BY t.created_at ASC
  `).all(chatId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 2: Approvals ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addApproval(chatId, threadId, topicName, requestText, requestedBy, messageId) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO approvals (chat_id, thread_id, topic_name, request_text, requested_by, message_id) VALUES (?, ?, ?, ?, ?, ?)`).run(chatId, threadId || null, topicName || null, requestText, requestedBy, messageId || null);
  return result.lastInsertRowid;
}

function getApprovalById(id) {
  const d = getDb();
  return d.prepare(`SELECT * FROM approvals WHERE id = ?`).get(id);
}

function decideApproval(id, status, decidedBy, comment) {
  const d = getDb();
  d.prepare(`UPDATE approvals SET status = ?, decided_by = ?, decision_comment = ?, decided_at = datetime('now') WHERE id = ?`).run(status, decidedBy, comment || null, id);
}

function getPendingApprovals(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM approvals WHERE chat_id = ? AND status = 'pending' ORDER BY created_at DESC`).all(chatId);
}

function getApprovalByMessageId(chatId, messageId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM approvals WHERE chat_id = ? AND message_id = ?`).get(chatId, messageId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 3: Recurring Tasks ══════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addRecurringTask(chatId, threadId, topicName, title, scheduleType, scheduleValue, options = {}) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO recurring_tasks (chat_id, thread_id, topic_name, title, schedule_type, schedule_value, assigned_to, property_tag, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    chatId, threadId || null, topicName || null, title, scheduleType, scheduleValue,
    options.assignedTo || null, options.propertyTag || null, options.priority || "normal", options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getActiveRecurringTasks(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM recurring_tasks WHERE chat_id = ? AND active = 1 ORDER BY id ASC`).all(chatId);
}

function getRecurringTaskById(id) {
  const d = getDb();
  return d.prepare(`SELECT * FROM recurring_tasks WHERE id = ?`).get(id);
}

function deleteRecurringTask(id) {
  const d = getDb();
  d.prepare(`UPDATE recurring_tasks SET active = 0 WHERE id = ?`).run(id);
}

function updateRecurringLastCreated(id, dateStr) {
  const d = getDb();
  d.prepare(`UPDATE recurring_tasks SET last_created = ? WHERE id = ?`).run(dateStr, id);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 4: Task Dependencies ════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addTaskDependency(taskId, dependsOnId) {
  const d = getDb();
  const existing = d.prepare(`SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?`).get(taskId, dependsOnId);
  if (existing) return existing.id;
  const result = d.prepare(`INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)`).run(taskId, dependsOnId);
  return result.lastInsertRowid;
}

function getTaskDependencies(taskId) {
  const d = getDb();
  return d.prepare(`
    SELECT td.*, t.title, t.status
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_id = t.id
    WHERE td.task_id = ?
  `).all(taskId);
}

function getDependentTasks(taskId) {
  const d = getDb();
  return d.prepare(`
    SELECT td.*, t.title, t.status, t.assigned_to, t.thread_id
    FROM task_dependencies td
    JOIN tasks t ON td.task_id = t.id
    WHERE td.depends_on_id = ? AND t.status = 'pending'
  `).all(taskId);
}

function isTaskBlocked(taskId) {
  const d = getDb();
  const deps = d.prepare(`
    SELECT t.status
    FROM task_dependencies td
    JOIN tasks t ON td.depends_on_id = t.id
    WHERE td.task_id = ?
  `).all(taskId);
  return deps.some(dep => dep.status !== 'done');
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 7: Expenses ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addExpense(chatId, threadId, topicName, amount, description, options = {}) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO expenses (chat_id, thread_id, topic_name, amount, description, property_tag, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    chatId, threadId || null, topicName || null, amount, description,
    options.propertyTag || null, options.category || null, options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getMonthlyExpenses(chatId) {
  const d = getDb();
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return d.prepare(`SELECT * FROM expenses WHERE chat_id = ? AND created_at >= ? ORDER BY created_at DESC`).all(chatId, firstOfMonth);
}

function getExpensesByProperty(chatId, propertyTag) {
  const d = getDb();
  return d.prepare(`SELECT * FROM expenses WHERE chat_id = ? AND property_tag = ? ORDER BY created_at DESC`).all(chatId, propertyTag);
}

function getExpenseSummary(chatId) {
  const d = getDb();
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const total = d.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE chat_id = ? AND created_at >= ?`).get(chatId, firstOfMonth);
  const byCategory = d.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE chat_id = ? AND created_at >= ? GROUP BY category ORDER BY total DESC`).all(chatId, firstOfMonth);
  const byProperty = d.prepare(`SELECT property_tag, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE chat_id = ? AND created_at >= ? AND property_tag IS NOT NULL GROUP BY property_tag ORDER BY total DESC`).all(chatId, firstOfMonth);
  return { totalAmount: total.total, byCategory, byProperty };
}

function getMonthlyExpenseTotal(chatId) {
  const d = getDb();
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const row = d.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE chat_id = ? AND created_at >= ?`).get(chatId, firstOfMonth);
  return row.total;
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 8: Occupancy ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function setOccupancy(chatId, unitName, status, tenantName, updatedBy) {
  const d = getDb();
  const existing = d.prepare(`SELECT id FROM occupancy WHERE chat_id = ? AND unit_name = ?`).get(chatId, unitName);
  if (existing) {
    d.prepare(`UPDATE occupancy SET status = ?, tenant_name = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`).run(status, tenantName || null, updatedBy, existing.id);
    return existing.id;
  }
  const result = d.prepare(`INSERT INTO occupancy (chat_id, unit_name, status, tenant_name, updated_by) VALUES (?, ?, ?, ?, ?)`).run(chatId, unitName, status, tenantName || null, updatedBy);
  return result.lastInsertRowid;
}

function getOccupancy(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM occupancy WHERE chat_id = ? ORDER BY unit_name ASC`).all(chatId);
}

function getOccupancyByUnit(chatId, unitName) {
  const d = getDb();
  return d.prepare(`SELECT * FROM occupancy WHERE chat_id = ? AND unit_name = ?`).get(chatId, unitName);
}

function getOccupancySummary(chatId) {
  const d = getDb();
  const total = d.prepare(`SELECT COUNT(*) as c FROM occupancy WHERE chat_id = ?`).get(chatId);
  const occupied = d.prepare(`SELECT COUNT(*) as c FROM occupancy WHERE chat_id = ? AND status = 'occupied'`).get(chatId);
  const vacant = d.prepare(`SELECT COUNT(*) as c FROM occupancy WHERE chat_id = ? AND status = 'vacant'`).get(chatId);
  const maintenance = d.prepare(`SELECT COUNT(*) as c FROM occupancy WHERE chat_id = ? AND status = 'maintenance'`).get(chatId);
  return { total: total.c, occupied: occupied.c, vacant: vacant.c, maintenance: maintenance.c };
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 9: Meetings ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function startMeeting(chatId, threadId, topicName, startedBy) {
  const d = getDb();
  // End any active meeting in this thread first
  d.prepare(`UPDATE meetings SET status = 'ended', ended_at = datetime('now') WHERE chat_id = ? AND thread_id = ? AND status = 'active'`).run(chatId, threadId || null);
  const result = d.prepare(`INSERT INTO meetings (chat_id, thread_id, topic_name, started_by) VALUES (?, ?, ?, ?)`).run(chatId, threadId || null, topicName || null, startedBy);
  return result.lastInsertRowid;
}

function getActiveMeeting(chatId, threadId) {
  const d = getDb();
  if (threadId == null) {
    return d.prepare(`SELECT * FROM meetings WHERE chat_id = ? AND thread_id IS NULL AND status = 'active'`).get(chatId);
  }
  return d.prepare(`SELECT * FROM meetings WHERE chat_id = ? AND thread_id = ? AND status = 'active'`).get(chatId, threadId);
}

function endMeeting(meetingId, summary) {
  const d = getDb();
  d.prepare(`UPDATE meetings SET status = 'ended', ended_at = datetime('now'), summary = ? WHERE id = ?`).run(summary || null, meetingId);
}

function addMeetingMessage(meetingId, fromUser, messageText) {
  const d = getDb();
  d.prepare(`INSERT INTO meeting_messages (meeting_id, from_user, message_text) VALUES (?, ?, ?)`).run(meetingId, fromUser, messageText);
}

function getMeetingMessages(meetingId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM meeting_messages WHERE meeting_id = ? ORDER BY created_at ASC`).all(meetingId);
}

function getMeetingById(id) {
  const d = getDb();
  return d.prepare(`SELECT * FROM meetings WHERE id = ?`).get(id);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Conversation Memory (per topic, last 30 messages) ══════
// ═══════════════════════════════════════════════════════════════

function ensureConversationMemoryTable() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversation_memory (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     INTEGER NOT NULL,
      thread_id   INTEGER,
      from_user   TEXT NOT NULL,
      message     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  // Create index for fast retrieval
  d.exec(`CREATE INDEX IF NOT EXISTS idx_conv_mem_thread ON conversation_memory (chat_id, thread_id, created_at DESC)`);
}

function storeConversationMessage(chatId, threadId, fromUser, message) {
  ensureConversationMemoryTable();
  const d = getDb();
  // Insert the new message
  d.prepare(`INSERT INTO conversation_memory (chat_id, thread_id, from_user, message) VALUES (?, ?, ?, ?)`)
    .run(chatId, threadId ?? null, fromUser, message);
  // Keep only the last 30 messages per topic to avoid unbounded growth
  d.prepare(`
    DELETE FROM conversation_memory
    WHERE chat_id = ? AND (thread_id = ? OR (thread_id IS NULL AND ? IS NULL))
    AND id NOT IN (
      SELECT id FROM conversation_memory
      WHERE chat_id = ? AND (thread_id = ? OR (thread_id IS NULL AND ? IS NULL))
      ORDER BY id DESC LIMIT 30
    )
  `).run(chatId, threadId ?? null, threadId ?? null, chatId, threadId ?? null, threadId ?? null);
}

function getConversationHistory(chatId, threadId, limit = 20) {
  ensureConversationMemoryTable();
  const d = getDb();
  const rows = d.prepare(`
    SELECT from_user, message, created_at FROM conversation_memory
    WHERE chat_id = ? AND (thread_id = ? OR (thread_id IS NULL AND ? IS NULL))
    ORDER BY id DESC LIMIT ?
  `).all(chatId, threadId ?? null, threadId ?? null, limit);
  // Return in chronological order (oldest first)
  return rows.reverse();
}

// ═══════════════════════════════════════════════════════════════
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  getDb,
  closeDb,
  // Tasks
  addTask, getTasksByThread, getPendingTasksByThread, getAllPendingTasks, getTaskById,
  markTaskDone, markTaskPending, cancelTask, getTaskStats,
  // Task queries
  getOverdueTasks, getTasksDueToday, getTasksByAssignee, getTasksByProperty,
  updateTaskProperty, transferTask,
  moveTask: transferTask,  // alias used by ops.js handleOpsMove
  // KPI / Stats
  getWeeklyStats, getCompletedToday, getStaleBlockers, getMonthlyStats,
  // Time-range queries
  getTasksCreatedSince, getTasksCompletedSince,
  // Follow-ups
  addFollowUp, getDueFollowUps, markFollowUpSent,
  markFollowUpDone: markFollowUpSent,  // alias used by scheduler
  // Reminders
  addReminder, getDueReminders, markReminderSent,
  markReminderDone: markReminderSent,  // alias used by scheduler
  // Media Log
  addMediaLog, getMediaByProperty, getMediaByTask, getMediaByThread,
  // Vendor Follow-ups
  addVendorFollowUp, getDueVendorFollowUps, markVendorFollowUpSent, resolveVendorFollowUp, getPendingVendorFollowUps,
  getOverdueVendorFollowUps, markVendorFollowUpNotified,
  // Daily Reports
  hasReportBeenSent, markReportSent,
  // SLA (Feature 1)
  setSlaConfig, getSlaConfig, getSlaForThread, hasSlaAlertBeenSent, markSlaAlertSent, getTasksWithSla,
  getAllSlaConfigs: getSlaConfig,  // alias used by scheduler
  // Approvals (Feature 2)
  addApproval, getApprovalById, decideApproval, getPendingApprovals, getApprovalByMessageId,
  // Recurring Tasks (Feature 3)
  addRecurringTask, getActiveRecurringTasks, getRecurringTaskById, deleteRecurringTask, updateRecurringLastCreated,
  // Task Dependencies (Feature 4)
  addTaskDependency, getTaskDependencies, getDependentTasks, isTaskBlocked,
  // Expenses (Feature 7)
  addExpense, getMonthlyExpenses, getExpensesByProperty, getExpenseSummary, getMonthlyExpenseTotal,
  // Occupancy (Feature 8)
  setOccupancy, getOccupancy, getOccupancyByUnit, getOccupancySummary,
  // Meetings (Feature 9)
  startMeeting, getActiveMeeting, endMeeting, addMeetingMessage, getMeetingMessages, getMeetingById,
   // Conversation Memory
  storeConversationMessage, getConversationHistory,
  // Google Sync
  getAllTasksForSync,
  // Scheduled Meetings (Meeting Management System)
  scheduleNewMeeting, getScheduledMeetings, getScheduledMeetingById,
  cancelScheduledMeeting, getMeetingsNeedingReminder,
  markMeetingReminded30, markMeetingReminded5,
  addMeetingNotes, getMeetingNotes, getUpcomingMeetings,
  // Appointments (Appointment Scheduling System)
  createAppointment, getUpcomingAppointments, getAllScheduledAppointments,
  getAppointmentById, cancelAppointment,
  getAppointmentsNeedingReminder, markAppointmentReminder1h, markAppointmentReminder15m,
  // WhatsApp Config
  getWhatsAppConfig, setWhatsAppNotifications,
  // Activity Log
  logActivity, getActivitySince, getTodayActivity,
  // Task Evidence
  addTaskEvidence, getTaskEvidence, getTodayTaskEvidence,
  // Contacts
  addContact, getContactById, getAllContacts, searchContactsByName,
  searchContactsByType, updateContact, deleteContact, updateContactMessageId,
  // Bot State
  getBotState, setBotState,
};

function getAllTasksForSync(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM tasks WHERE chat_id = ? AND status != 'cancelled' ORDER BY updated_at DESC`).all(chatId);
}

// ═════════════════════════════════════════════════════════════
// ═══ Activity Log ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

/**
 * Log a team member activity entry (silent — no bot reply).
 */
function logActivity(chatId, topicThreadId, userUsername, userDisplayName, messageType, captionOrText, fileId) {
  const d = getDb();
  return d.prepare(`
    INSERT INTO activity_log (chat_id, topic_thread_id, user_username, user_display_name, message_type, caption_or_text, file_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, topicThreadId || null, userUsername || null, userDisplayName || null, messageType, captionOrText || null, fileId || null).lastInsertRowid;
}

/**
 * Get all activity entries for a given chat since a UTC datetime string.
 * Returns rows ordered by timestamp ASC.
 */
function getActivitySince(chatId, sinceUtc) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM activity_log
    WHERE chat_id = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(chatId, sinceUtc);
}

/**
 * Get today's activity entries grouped by user (KSA day = UTC day + 3h).
 * "Today" is defined as the current KSA calendar day.
 */
function getTodayActivity(chatId) {
  const d = getDb();
  // KSA is UTC+3; today in KSA starts at UTC 21:00 yesterday
  const now = new Date();
  const ksaOffset = 3 * 60 * 60 * 1000;
  const ksaNow = new Date(now.getTime() + ksaOffset);
  // Start of today in KSA = midnight KSA = 21:00 UTC previous day
  const ksaMidnight = new Date(Date.UTC(ksaNow.getUTCFullYear(), ksaNow.getUTCMonth(), ksaNow.getUTCDate()));
  const utcStart = new Date(ksaMidnight.getTime() - ksaOffset);
  const sinceUtc = utcStart.toISOString().replace('T', ' ').substring(0, 19);
  return d.prepare(`
    SELECT * FROM activity_log
    WHERE chat_id = ? AND timestamp >= ?
    ORDER BY user_display_name ASC, timestamp ASC
  `).all(chatId, sinceUtc);
}

// ═════════════════════════════════════════════════════════════
// ═══ Task Evidence ═════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

/**
 * Store photo evidence linked to a task.
 */
function addTaskEvidence(taskId, photoFileId, caption, submittedBy) {
  const d = getDb();
  return d.prepare(`
    INSERT INTO task_evidence (task_id, photo_file_id, caption, submitted_by)
    VALUES (?, ?, ?, ?)
  `).run(taskId, photoFileId, caption || null, submittedBy || null).lastInsertRowid;
}

/**
 * Get all evidence for a specific task.
 */
function getTaskEvidence(taskId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM task_evidence WHERE task_id = ? ORDER BY submitted_at ASC`).all(taskId);
}

/**
 * Get all task evidence submitted today (KSA day).
 * Returns joined with task title for reporting.
 */
function getTodayTaskEvidence(chatId) {
  const d = getDb();
  const now = new Date();
  const ksaOffset = 3 * 60 * 60 * 1000;
  const ksaNow = new Date(now.getTime() + ksaOffset);
  const ksaMidnight = new Date(Date.UTC(ksaNow.getUTCFullYear(), ksaNow.getUTCMonth(), ksaNow.getUTCDate()));
  const utcStart = new Date(ksaMidnight.getTime() - ksaOffset);
  const sinceUtc = utcStart.toISOString().replace('T', ' ').substring(0, 19);
  return d.prepare(`
    SELECT te.*, t.title AS task_title, t.id AS task_id
    FROM task_evidence te
    JOIN tasks t ON te.task_id = t.id
    WHERE t.chat_id = ? AND te.submitted_at >= ?
    ORDER BY te.submitted_at ASC
  `).all(chatId, sinceUtc);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Scheduled Meetings (Meeting Management System) ═════════
// ═══════════════════════════════════════════════════════════════

function scheduleNewMeeting(chatId, threadId, title, meetingDatetime, options = {}) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO scheduled_meetings (chat_id, thread_id, title, meeting_datetime, location, agenda, attendees, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    threadId || null,
    title,
    meetingDatetime,
    options.location || null,
    options.agenda || null,
    JSON.stringify(options.attendees || []),
    options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getScheduledMeetings(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM scheduled_meetings
    WHERE chat_id = ? AND status = 'scheduled'
    ORDER BY meeting_datetime ASC
  `).all(chatId);
}

function getUpcomingMeetings(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM scheduled_meetings
    WHERE chat_id = ? AND status = 'scheduled' AND meeting_datetime >= datetime('now')
    ORDER BY meeting_datetime ASC
  `).all(chatId);
}

function getScheduledMeetingById(meetingId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM scheduled_meetings WHERE id = ?`).get(meetingId);
}

function cancelScheduledMeeting(meetingId) {
  const d = getDb();
  d.prepare(`UPDATE scheduled_meetings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(meetingId);
}

function getMeetingsNeedingReminder(minutesBefore) {
  const d = getDb();
  // Find meetings that are within `minutesBefore` minutes from now, still scheduled, and not yet reminded
  if (minutesBefore === 30) {
    return d.prepare(`
      SELECT * FROM scheduled_meetings
      WHERE status = 'scheduled'
        AND reminded_30 = 0
        AND meeting_datetime <= datetime('now', '+31 minutes')
        AND meeting_datetime > datetime('now')
    `).all();
  } else if (minutesBefore === 5) {
    return d.prepare(`
      SELECT * FROM scheduled_meetings
      WHERE status = 'scheduled'
        AND reminded_5 = 0
        AND meeting_datetime <= datetime('now', '+6 minutes')
        AND meeting_datetime > datetime('now')
    `).all();
  }
  return [];
}

function markMeetingReminded30(meetingId) {
  const d = getDb();
  d.prepare(`UPDATE scheduled_meetings SET reminded_30 = 1, updated_at = datetime('now') WHERE id = ?`).run(meetingId);
}

function markMeetingReminded5(meetingId) {
  const d = getDb();
  d.prepare(`UPDATE scheduled_meetings SET reminded_5 = 1, updated_at = datetime('now') WHERE id = ?`).run(meetingId);
}

function addMeetingNotes(meetingId, notes, actionItems, createdBy) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO meeting_notes (meeting_id, notes, action_items, created_by)
    VALUES (?, ?, ?, ?)
  `).run(meetingId, notes, JSON.stringify(actionItems || []), createdBy || null);
  // Mark the meeting as 'completed' once notes are added
  d.prepare(`UPDATE scheduled_meetings SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(meetingId);
  return result.lastInsertRowid;
}

function getMeetingNotes(meetingId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM meeting_notes WHERE meeting_id = ? ORDER BY created_at ASC`).all(meetingId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Appointments (Appointment Scheduling System) ════════════
// ═══════════════════════════════════════════════════════════════

function createAppointment(chatId, threadId, title, appointmentDatetime, options = {}) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO appointments (chat_id, topic_thread_id, title, appointment_datetime, location, attendees_internal, attendees_external, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    threadId || null,
    title,
    appointmentDatetime,
    options.location || null,
    JSON.stringify(options.attendeesInternal || []),
    JSON.stringify(options.attendeesExternal || []),
    options.notes || null,
    options.createdBy || null
  );
  return result.lastInsertRowid;
}

function getUpcomingAppointments(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM appointments
    WHERE chat_id = ? AND status = 'scheduled' AND appointment_datetime >= datetime('now')
    ORDER BY appointment_datetime ASC
  `).all(chatId);
}

function getAllScheduledAppointments(chatId) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM appointments
    WHERE chat_id = ? AND status = 'scheduled'
    ORDER BY appointment_datetime ASC
  `).all(chatId);
}

function getAppointmentById(appointmentId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM appointments WHERE id = ?`).get(appointmentId);
}

function cancelAppointment(appointmentId) {
  const d = getDb();
  d.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(appointmentId);
}

function getAppointmentsNeedingReminder(minutesBefore) {
  const d = getDb();
  if (minutesBefore === 60) {
    return d.prepare(`
      SELECT * FROM appointments
      WHERE status = 'scheduled'
        AND reminder_1h_sent = 0
        AND appointment_datetime <= datetime('now', '+61 minutes')
        AND appointment_datetime > datetime('now')
    `).all();
  } else if (minutesBefore === 15) {
    return d.prepare(`
      SELECT * FROM appointments
      WHERE status = 'scheduled'
        AND reminder_15m_sent = 0
        AND appointment_datetime <= datetime('now', '+16 minutes')
        AND appointment_datetime > datetime('now')
    `).all();
  }
  return [];
}

function markAppointmentReminder1h(appointmentId) {
  const d = getDb();
  d.prepare(`UPDATE appointments SET reminder_1h_sent = 1, updated_at = datetime('now') WHERE id = ?`).run(appointmentId);
}

function markAppointmentReminder15m(appointmentId) {
  const d = getDb();
  d.prepare(`UPDATE appointments SET reminder_15m_sent = 1, updated_at = datetime('now') WHERE id = ?`).run(appointmentId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ WhatsApp Configuration ═════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function getWhatsAppConfig(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM whatsapp_config WHERE chat_id = ?`).get(chatId);
}

function setWhatsAppNotifications(chatId, enabled) {
  const d = getDb();
  const existing = d.prepare(`SELECT * FROM whatsapp_config WHERE chat_id = ?`).get(chatId);
  if (existing) {
    d.prepare(`UPDATE whatsapp_config SET notifications_on = ?, updated_at = datetime('now') WHERE chat_id = ?`).run(enabled ? 1 : 0, chatId);
  } else {
    d.prepare(`INSERT INTO whatsapp_config (chat_id, notifications_on) VALUES (?, ?)`).run(chatId, enabled ? 1 : 0);
  }
}

// ═════════════════════════════════════════════════════════════
// ═══ Contacts ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

function addContact(chatId, data) {
  const d = getDb();
  const result = d.prepare(`
    INSERT INTO contacts (chat_id, name, phone, email, contact_type, notes, added_by_username, added_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId,
    data.name,
    data.phone,
    data.email || null,
    data.contact_type || null,
    data.notes || null,
    data.added_by_username || null,
    data.added_by_name || null
  );
  return result.lastInsertRowid;
}

function getContactById(contactId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM contacts WHERE id = ?`).get(contactId);
}

function getAllContacts(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM contacts WHERE chat_id = ? ORDER BY name ASC`).all(chatId);
}

function searchContactsByName(chatId, query) {
  const d = getDb();
  const pattern = `%${query}%`;
  return d.prepare(`
    SELECT * FROM contacts
    WHERE chat_id = ? AND (name LIKE ? COLLATE NOCASE)
    ORDER BY name ASC
  `).all(chatId, pattern);
}

function searchContactsByType(chatId, typeQuery) {
  const d = getDb();
  const pattern = `%${typeQuery}%`;
  return d.prepare(`
    SELECT * FROM contacts
    WHERE chat_id = ? AND (contact_type LIKE ? COLLATE NOCASE)
    ORDER BY name ASC
  `).all(chatId, pattern);
}

function updateContact(contactId, data) {
  const d = getDb();
  const fields = [];
  const values = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.contact_type !== undefined) { fields.push('contact_type = ?'); values.push(data.contact_type); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.topic_message_id !== undefined) { fields.push('topic_message_id = ?'); values.push(data.topic_message_id); }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(contactId);
  d.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteContact(contactId) {
  const d = getDb();
  d.prepare(`DELETE FROM contacts WHERE id = ?`).run(contactId);
}

function updateContactMessageId(contactId, messageId) {
  const d = getDb();
  d.prepare(`UPDATE contacts SET topic_message_id = ? WHERE id = ?`).run(messageId, contactId);
}

// ═════════════════════════════════════════════════════════════
// ═══ Bot State ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

function getBotState(key) {
  const d = getDb();
  const row = d.prepare(`SELECT value FROM bot_state WHERE key = ?`).get(key);
  return row ? row.value : null;
}

function setBotState(key, value) {
  const d = getDb();
  d.prepare(`
    INSERT INTO bot_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}
