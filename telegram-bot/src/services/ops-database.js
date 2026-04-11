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
// ═══ Exports ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

module.exports = {
  getDb,
  // Tasks
  addTask, getTasksByThread, getPendingTasksByThread, getAllPendingTasks, getTaskById,
  markTaskDone, markTaskPending, cancelTask, getTaskStats,
  // Task queries
  getOverdueTasks, getTasksDueToday, getTasksByAssignee, getTasksByProperty,
  updateTaskProperty, transferTask,
  // KPI / Stats
  getWeeklyStats, getCompletedToday, getStaleBlockers, getMonthlyStats,
  // Time-range queries
  getTasksCreatedSince, getTasksCompletedSince,
  // Follow-ups
  addFollowUp, getDueFollowUps, markFollowUpSent,
  // Reminders
  addReminder, getDueReminders, markReminderSent,
  // Media Log
  addMediaLog, getMediaByProperty, getMediaByTask, getMediaByThread,
  // Vendor Follow-ups
  addVendorFollowUp, getDueVendorFollowUps, markVendorFollowUpSent, resolveVendorFollowUp, getPendingVendorFollowUps,
  // Daily Reports
  hasReportBeenSent, markReportSent,
  // SLA (Feature 1)
  setSlaConfig, getSlaConfig, getSlaForThread, hasSlaAlertBeenSent, markSlaAlertSent, getTasksWithSla,
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
};
