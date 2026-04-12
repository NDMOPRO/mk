/**
 * ops-database-v5.js — Database extension for features 40–46
 * Maintenance Log, Custom Workflows, Template Messages, Trend Analysis, Weather
 */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const log = require("../utils/logger");

const DB_PATH = path.join(__dirname, "..", "..", "data", "ops.db");
let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try {
      db = new Database(DB_PATH);
      db.pragma("journal_mode = WAL");
      db.pragma("busy_timeout = 5000");
      log.info('OpsDBv5', 'Database opened', { path: DB_PATH });
    } catch (err) {
      log.error('OpsDBv5', 'Failed to open database', { path: DB_PATH, error: err.message });
      throw err;
    }
  }
  return db;
}

/**
 * Close the v5 database connection cleanly.
 */
function closeDb() {
  if (db) {
    try {
      db.close();
      db = null;
      log.info('OpsDBv5', 'Database closed');
    } catch (e) {
      log.warn('OpsDBv5', 'Error closing database', { error: e.message });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Table Initialization ════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function initV5Tables() {
  const d = getDb();

  // Feature 40: Maintenance Log
  d.exec(`CREATE TABLE IF NOT EXISTS maintenance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    unit_id TEXT NOT NULL,
    description TEXT NOT NULL,
    cost REAL DEFAULT 0,
    performed_by TEXT,
    topic_id INTEGER,
    thread_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Feature 49: Property Photos
  d.exec(`CREATE TABLE IF NOT EXISTS property_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    unit_id TEXT,
    file_id TEXT NOT NULL,
    file_type TEXT DEFAULT 'photo',
    caption TEXT,
    submitted_by TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    review_note TEXT,
    thread_id INTEGER,
    message_id INTEGER,
    website_ready INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT
  )`);

  // Feature 48: Ideas & Brainstorming
  d.exec(`CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    description TEXT NOT NULL,
    submitted_by TEXT,
    status TEXT DEFAULT 'new',
    votes INTEGER DEFAULT 0,
    thread_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  d.exec(`CREATE TABLE IF NOT EXISTS idea_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER,
    user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  d.exec(`CREATE TABLE IF NOT EXISTS brainstorm_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    topic TEXT NOT NULL,
    started_by TEXT,
    thread_id INTEGER,
    status TEXT DEFAULT 'active',
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    summary TEXT
  )`);

  d.exec(`CREATE TABLE IF NOT EXISTS brainstorm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    from_user TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Feature 41: Custom Workflows
  d.exec(`CREATE TABLE IF NOT EXISTS workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    name TEXT NOT NULL,
    steps TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  d.exec(`CREATE TABLE IF NOT EXISTS workflow_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    template_id INTEGER,
    template_name TEXT,
    unit_id TEXT,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    steps TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    started_by TEXT,
    thread_id INTEGER,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (template_id) REFERENCES workflow_templates(id)
  )`);

  // Feature 42: Template Messages
  d.exec(`CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Feature 47: Cleaning Log
  d.exec(`CREATE TABLE IF NOT EXISTS cleaning_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    unit_id TEXT NOT NULL,
    cleaning_type TEXT NOT NULL,
    cleaner_name TEXT,
    notes TEXT,
    photos TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  console.log("[OpsDB-v5] Tables initialized (maintenance_log, workflows, templates, cleaning_log)");
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 40: Maintenance Log ════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addMaintenanceLog(chatId, unitId, description, cost, performedBy, topicId, threadId) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO maintenance_log (chat_id, unit_id, description, cost, performed_by, topic_id, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const result = stmt.run(chatId, unitId.toLowerCase(), description, cost || 0, performedBy, topicId, threadId);
  return result.lastInsertRowid;
}

function getMaintenanceByUnit(chatId, unitId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM maintenance_log WHERE chat_id = ? AND unit_id = ? ORDER BY created_at DESC`).all(chatId, unitId.toLowerCase());
}

function getMaintenanceSummary(chatId) {
  const d = getDb();
  return d.prepare(`SELECT unit_id, COUNT(*) as count, SUM(cost) as total_cost, MAX(created_at) as last_maintenance FROM maintenance_log WHERE chat_id = ? GROUP BY unit_id ORDER BY total_cost DESC`).all(chatId);
}

function getRecentMaintenance(chatId, days = 30) {
  const d = getDb();
  return d.prepare(`SELECT * FROM maintenance_log WHERE chat_id = ? AND created_at >= datetime('now', '-' || ? || ' days') ORDER BY created_at DESC`).all(chatId, days);
}

function getMaintenanceStats(chatId) {
  const d = getDb();
  const total = d.prepare(`SELECT COUNT(*) as count, SUM(cost) as total_cost FROM maintenance_log WHERE chat_id = ?`).get(chatId);
  const thisMonth = d.prepare(`SELECT COUNT(*) as count, SUM(cost) as total_cost FROM maintenance_log WHERE chat_id = ? AND created_at >= datetime('now', 'start of month')`).get(chatId);
  const lastMonth = d.prepare(`SELECT COUNT(*) as count, SUM(cost) as total_cost FROM maintenance_log WHERE chat_id = ? AND created_at >= datetime('now', 'start of month', '-1 month') AND created_at < datetime('now', 'start of month')`).get(chatId);
  const topUnits = d.prepare(`SELECT unit_id, COUNT(*) as count, SUM(cost) as total_cost FROM maintenance_log WHERE chat_id = ? GROUP BY unit_id ORDER BY count DESC LIMIT 5`).all(chatId);
  return { total, thisMonth, lastMonth, topUnits };
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 41: Custom Workflows ═══════════════════════════
// ═══════════════════════════════════════════════════════════════

function createWorkflowTemplate(chatId, name, steps, createdBy) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO workflow_templates (chat_id, name, steps, created_by) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(chatId, name, JSON.stringify(steps), createdBy);
  return result.lastInsertRowid;
}

function getWorkflowTemplate(chatId, name) {
  const d = getDb();
  return d.prepare(`SELECT * FROM workflow_templates WHERE chat_id = ? AND LOWER(name) = LOWER(?) ORDER BY id DESC LIMIT 1`).get(chatId, name);
}

function getWorkflowTemplates(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM workflow_templates WHERE chat_id = ? ORDER BY name`).all(chatId);
}

function deleteWorkflowTemplate(templateId) {
  const d = getDb();
  d.prepare(`DELETE FROM workflow_templates WHERE id = ?`).run(templateId);
}

function startWorkflow(chatId, templateId, templateName, unitId, steps, startedBy, threadId) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO workflow_instances (chat_id, template_id, template_name, unit_id, current_step, total_steps, steps, started_by, thread_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`);
  const result = stmt.run(chatId, templateId, templateName, unitId.toLowerCase(), steps.length, JSON.stringify(steps), startedBy, threadId);
  return result.lastInsertRowid;
}

function getActiveWorkflow(chatId, unitId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM workflow_instances WHERE chat_id = ? AND unit_id = LOWER(?) AND status = 'active' ORDER BY started_at DESC LIMIT 1`).get(chatId, unitId);
}

function getActiveWorkflows(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM workflow_instances WHERE chat_id = ? AND status = 'active' ORDER BY started_at DESC`).all(chatId);
}

function advanceWorkflow(instanceId) {
  const d = getDb();
  const instance = d.prepare(`SELECT * FROM workflow_instances WHERE id = ?`).get(instanceId);
  if (!instance) return null;
  const nextStep = instance.current_step + 1;
  if (nextStep >= instance.total_steps) {
    d.prepare(`UPDATE workflow_instances SET current_step = ?, status = 'completed', completed_at = datetime('now') WHERE id = ?`).run(nextStep, instanceId);
    return { ...instance, current_step: nextStep, status: "completed" };
  } else {
    d.prepare(`UPDATE workflow_instances SET current_step = ? WHERE id = ?`).run(nextStep, instanceId);
    return { ...instance, current_step: nextStep, status: "active" };
  }
}

function getWorkflowStatus(chatId, unitId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM workflow_instances WHERE chat_id = ? AND unit_id = LOWER(?) ORDER BY started_at DESC`).all(chatId, unitId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 42: Template Messages ══════════════════════════
// ═══════════════════════════════════════════════════════════════

function saveTemplate(chatId, name, content, createdBy) {
  const d = getDb();
  // Upsert: if template with same name exists, update it
  const existing = d.prepare(`SELECT id FROM message_templates WHERE chat_id = ? AND LOWER(name) = LOWER(?)`).get(chatId, name);
  if (existing) {
    d.prepare(`UPDATE message_templates SET content = ?, created_by = ?, created_at = datetime('now') WHERE id = ?`).run(content, createdBy, existing.id);
    return existing.id;
  }
  const stmt = d.prepare(`INSERT INTO message_templates (chat_id, name, content, created_by) VALUES (?, ?, ?, ?)`);
  const result = stmt.run(chatId, name, content, createdBy);
  return result.lastInsertRowid;
}

function getTemplate(chatId, name) {
  const d = getDb();
  return d.prepare(`SELECT * FROM message_templates WHERE chat_id = ? AND LOWER(name) = LOWER(?)`).get(chatId, name);
}

function getTemplates(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM message_templates WHERE chat_id = ? ORDER BY name`).all(chatId);
}

function deleteTemplate(chatId, name) {
  const d = getDb();
  d.prepare(`DELETE FROM message_templates WHERE chat_id = ? AND LOWER(name) = LOWER(?)`).run(chatId, name);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 44: Trend Analysis — Data Helpers ══════════════
// ═══════════════════════════════════════════════════════════════

function getTrendData(chatId) {
  const d = getDb();
  const opsDb = require("./ops-database");

  // Tasks by month
  const tasksByMonth = d.prepare(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as created, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE chat_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`).all(chatId);

  // Expenses by month
  let expensesByMonth = [];
  try {
    expensesByMonth = d.prepare(`SELECT strftime('%Y-%m', created_at) as month, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE chat_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`).all(chatId);
  } catch (e) {}

  // Maintenance by month
  let maintenanceByMonth = [];
  try {
    maintenanceByMonth = d.prepare(`SELECT strftime('%Y-%m', created_at) as month, SUM(cost) as total, COUNT(*) as count FROM maintenance_log WHERE chat_id = ? GROUP BY month ORDER BY month DESC LIMIT 6`).all(chatId);
  } catch (e) {}

  // Repeat maintenance units (units with >2 maintenance entries)
  let repeatUnits = [];
  try {
    repeatUnits = d.prepare(`SELECT unit_id, COUNT(*) as count, SUM(cost) as total_cost FROM maintenance_log WHERE chat_id = ? GROUP BY unit_id HAVING count > 1 ORDER BY count DESC LIMIT 10`).all(chatId);
  } catch (e) {}

  // Tasks by topic
  const tasksByTopic = d.prepare(`SELECT topic_name, COUNT(*) as count FROM tasks WHERE chat_id = ? AND status = 'pending' GROUP BY topic_name ORDER BY count DESC`).all(chatId);

  // Average resolution time
  const avgResolution = d.prepare(`SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24) as avg_hours FROM tasks WHERE chat_id = ? AND status = 'done' AND updated_at IS NOT NULL`).get(chatId);

  // Overdue tasks
  const overdue = d.prepare(`SELECT COUNT(*) as count FROM tasks WHERE chat_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < date('now')`).get(chatId);

  return {
    tasksByMonth,
    expensesByMonth,
    maintenanceByMonth,
    repeatUnits,
    tasksByTopic,
    avgResolutionHours: avgResolution?.avg_hours ? Math.round(avgResolution.avg_hours) : null,
    overdueCount: overdue?.count || 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 47: Cleaning Log ════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function addCleaningLog(chatId, unitId, cleaningType, cleanerName, notes, threadId) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO cleaning_log (chat_id, unit_id, cleaning_type, cleaner_name, notes, status, started_at) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))`);
  const result = stmt.run(chatId, unitId.toLowerCase(), cleaningType, cleanerName, notes || null);
  return result.lastInsertRowid;
}

function createPendingCleaning(chatId, unitId, cleaningType, notes) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO cleaning_log (chat_id, unit_id, cleaning_type, notes, status) VALUES (?, ?, ?, ?, 'pending')`);
  const result = stmt.run(chatId, unitId.toLowerCase(), cleaningType, notes || null);
  return result.lastInsertRowid;
}

function getCleaningByUnit(chatId, unitId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM cleaning_log WHERE chat_id = ? AND unit_id = LOWER(?) ORDER BY created_at DESC LIMIT 20`).all(chatId, unitId);
}

function getPendingCleanings(chatId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM cleaning_log WHERE chat_id = ? AND status = 'pending' ORDER BY created_at ASC`).all(chatId);
}

function getCleaningSummary(chatId) {
  const d = getDb();
  const thisMonth = d.prepare(`SELECT cleaning_type, cleaner_name, COUNT(*) as count FROM cleaning_log WHERE chat_id = ? AND status = 'completed' AND created_at >= datetime('now', 'start of month') GROUP BY cleaning_type, cleaner_name ORDER BY count DESC`).all(chatId);
  const byUnit = d.prepare(`SELECT unit_id, COUNT(*) as count, MAX(created_at) as last_cleaned FROM cleaning_log WHERE chat_id = ? AND status = 'completed' GROUP BY unit_id ORDER BY last_cleaned DESC`).all(chatId);
  const byCleaner = d.prepare(`SELECT cleaner_name, COUNT(*) as count FROM cleaning_log WHERE chat_id = ? AND status = 'completed' AND created_at >= datetime('now', 'start of month') GROUP BY cleaner_name ORDER BY count DESC`).all(chatId);
  return { thisMonth, byUnit, byCleaner };
}

function getLastCleaning(chatId, unitId, cleaningType) {
  const d = getDb();
  const query = cleaningType
    ? `SELECT * FROM cleaning_log WHERE chat_id = ? AND unit_id = LOWER(?) AND cleaning_type = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1`
    : `SELECT * FROM cleaning_log WHERE chat_id = ? AND unit_id = LOWER(?) AND status = 'completed' ORDER BY created_at DESC LIMIT 1`;
  return cleaningType
    ? d.prepare(query).get(chatId, unitId, cleaningType)
    : d.prepare(query).get(chatId, unitId);
}

function markCleaningComplete(cleaningId, cleanerName) {
  const d = getDb();
  d.prepare(`UPDATE cleaning_log SET status = 'completed', cleaner_name = ?, completed_at = datetime('now') WHERE id = ?`).run(cleanerName, cleaningId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 48: Ideas & Brainstorming ══════════════════════
// ═══════════════════════════════════════════════════════════════

function addIdea(chatId, description, submittedBy, threadId) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO ideas (chat_id, description, submitted_by, thread_id) VALUES (?,?,?,?)`).run(chatId, description, submittedBy, threadId);
  return result.lastInsertRowid;
}

function getIdeas(chatId) {
  return getDb().prepare(`SELECT * FROM ideas WHERE chat_id=? ORDER BY votes DESC, created_at DESC`).all(chatId);
}

function getIdeaById(id) {
  return getDb().prepare(`SELECT * FROM ideas WHERE id=?`).get(id);
}

function voteIdea(ideaId, userId) {
  const d = getDb();
  const existing = d.prepare(`SELECT id FROM idea_votes WHERE idea_id=? AND user_id=?`).get(ideaId, userId);
  if (existing) return { alreadyVoted: true };
  d.prepare(`INSERT INTO idea_votes (idea_id, user_id) VALUES (?,?)`).run(ideaId, userId);
  d.prepare(`UPDATE ideas SET votes=votes+1, updated_at=datetime('now') WHERE id=?`).run(ideaId);
  return { alreadyVoted: false };
}

function setIdeaStatus(ideaId, status) {
  getDb().prepare(`UPDATE ideas SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, ideaId);
}

function startBrainstormSession(chatId, topic, startedBy, threadId) {
  const d = getDb();
  // End any existing active session in this thread
  d.prepare(`UPDATE brainstorm_sessions SET status='ended', ended_at=datetime('now') WHERE chat_id=? AND thread_id=? AND status='active'`).run(chatId, threadId);
  const result = d.prepare(`INSERT INTO brainstorm_sessions (chat_id, topic, started_by, thread_id, status) VALUES (?,?,?,?,?)`).run(chatId, topic, startedBy, threadId, 'active');
  return result.lastInsertRowid;
}

function getActiveBrainstormSession(chatId, threadId) {
  return getDb().prepare(`SELECT * FROM brainstorm_sessions WHERE chat_id=? AND thread_id=? AND status='active' ORDER BY started_at DESC LIMIT 1`).get(chatId, threadId);
}

function endBrainstormSession(sessionId, summary) {
  getDb().prepare(`UPDATE brainstorm_sessions SET status='ended', ended_at=datetime('now'), summary=? WHERE id=?`).run(summary, sessionId);
}

function getBrainstormSession(sessionId) {
  return getDb().prepare(`SELECT * FROM brainstorm_sessions WHERE id=?`).get(sessionId);
}

function addBrainstormMessage(sessionId, fromUser, message) {
  getDb().prepare(`INSERT INTO brainstorm_messages (session_id, from_user, message) VALUES (?,?,?)`).run(sessionId, fromUser, message);
}

function getBrainstormMessages(sessionId) {
  return getDb().prepare(`SELECT * FROM brainstorm_messages WHERE session_id=? ORDER BY created_at ASC`).all(sessionId);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Feature 49: Property Photos Approval ════════════════════
// ═══════════════════════════════════════════════════════════════

function addPropertyPhoto(chatId, unitId, fileId, fileType, caption, submittedBy, threadId, messageId) {
  const d = getDb();
  const result = d.prepare(`INSERT INTO property_photos (chat_id, unit_id, file_id, file_type, caption, submitted_by, thread_id, message_id) VALUES (?,?,?,?,?,?,?,?)`).run(chatId, unitId, fileId, fileType, caption, submittedBy, threadId, messageId);
  return result.lastInsertRowid;
}

function getPropertyPhotos(chatId, unitId, status = 'approved') {
  if (unitId) {
    return getDb().prepare(`SELECT * FROM property_photos WHERE chat_id=? AND unit_id=? AND status=? ORDER BY created_at DESC`).all(chatId, unitId, status);
  }
  return getDb().prepare(`SELECT * FROM property_photos WHERE chat_id=? AND status=? ORDER BY created_at DESC`).all(chatId, status);
}

function getPhotoById(id) {
  return getDb().prepare(`SELECT * FROM property_photos WHERE id=?`).get(id);
}

function getPhotoByMessageId(chatId, messageId) {
  return getDb().prepare(`SELECT * FROM property_photos WHERE chat_id=? AND message_id=?`).get(chatId, messageId);
}

function approvePhoto(id, reviewer) {
  getDb().prepare(`UPDATE property_photos SET status='approved', website_ready=1, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`).run(reviewer, id);
}

function rejectPhoto(id, reviewer, note) {
  getDb().prepare(`UPDATE property_photos SET status='rejected', website_ready=0, reviewed_by=?, review_note=?, reviewed_at=datetime('now') WHERE id=?`).run(reviewer, note, id);
}

function getWebsiteReadyPhotos(unitId) {
  return getDb().prepare(`SELECT * FROM property_photos WHERE unit_id=? AND website_ready=1 ORDER BY created_at DESC`).all(unitId);
}

module.exports = {
  initV5Tables,
  closeDb,
  // Maintenance
  addMaintenanceLog, getMaintenanceByUnit, getMaintenanceSummary, getRecentMaintenance, getMaintenanceStats,
  // Workflows
  createWorkflowTemplate, getWorkflowTemplate, getWorkflowTemplates, deleteWorkflowTemplate,
  startWorkflow, getActiveWorkflow, getActiveWorkflows, advanceWorkflow, getWorkflowStatus,
  // Templates
  saveTemplate, getTemplate, getTemplates, deleteTemplate,
  // Trends
  getTrendData,
  // Cleaning Log
  addCleaningLog, createPendingCleaning, getCleaningByUnit, getPendingCleanings,
  getCleaningSummary, getLastCleaning, markCleaningComplete,
  // Ideas & Brainstorming
  addIdea, getIdeas, getIdeaById, voteIdea, setIdeaStatus,
  startBrainstormSession, getActiveBrainstormSession, endBrainstormSession, getBrainstormSession,
  addBrainstormMessage, getBrainstormMessages,
  // Property Photos
  addPropertyPhoto, getPropertyPhotos, getPhotoById, getPhotoByMessageId, approvePhoto, rejectPhoto, getWebsiteReadyPhotos,
};
