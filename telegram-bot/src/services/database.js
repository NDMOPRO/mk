/**
 * SQLite Database Service for Monthly Key Telegram Bot
 * Stores user data, notification preferences, and conversation history
 */
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "bot.db");

let db;

function getDb() {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables();
  }
  return db;
}

function initTables() {
  const d = getDb();

  // Users table — stores chat IDs and preferences for push notifications
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language TEXT DEFAULT 'ar',
      is_active INTEGER DEFAULT 1,
      notify_new_properties INTEGER DEFAULT 1,
      notify_price_drops INTEGER DEFAULT 1,
      notify_bookings INTEGER DEFAULT 1,
      preferred_city TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Conversation history for AI context
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES users(chat_id)
    )
  `);

  // Notification log
  d.exec(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'sent'
    )
  `);
}

// ─── User Operations ────────────────────────────────────────

function upsertUser(chatId, userData) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO users (chat_id, username, first_name, last_name, language, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(chat_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      language = excluded.language,
      is_active = 1,
      updated_at = datetime('now')
  `);
  stmt.run(
    chatId,
    userData.username || null,
    userData.firstName || null,
    userData.lastName || null,
    userData.language || "ar"
  );
}

function getUser(chatId) {
  const d = getDb();
  return d.prepare("SELECT * FROM users WHERE chat_id = ?").get(chatId);
}

function getUserLanguage(chatId) {
  const user = getUser(chatId);
  return user?.language || "ar";
}

function setUserLanguage(chatId, language) {
  const d = getDb();
  d.prepare("UPDATE users SET language = ?, updated_at = datetime('now') WHERE chat_id = ?").run(language, chatId);
}

function setUserCity(chatId, city) {
  const d = getDb();
  d.prepare("UPDATE users SET preferred_city = ?, updated_at = datetime('now') WHERE chat_id = ?").run(city, chatId);
}

function deactivateUser(chatId) {
  const d = getDb();
  d.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE chat_id = ?").run(chatId);
}

function getActiveUsers() {
  const d = getDb();
  return d.prepare("SELECT * FROM users WHERE is_active = 1").all();
}

function getNotifiableUsers(type) {
  const d = getDb();
  const column = {
    new_properties: "notify_new_properties",
    price_drops: "notify_price_drops",
    bookings: "notify_bookings",
  }[type] || "notify_new_properties";

  return d.prepare(`SELECT * FROM users WHERE is_active = 1 AND ${column} = 1`).all();
}

function updateNotificationPreference(chatId, type, enabled) {
  const d = getDb();
  const column = {
    new_properties: "notify_new_properties",
    price_drops: "notify_price_drops",
    bookings: "notify_bookings",
  }[type];
  if (!column) return;
  d.prepare(`UPDATE users SET ${column} = ?, updated_at = datetime('now') WHERE chat_id = ?`).run(enabled ? 1 : 0, chatId);
}

// ─── Conversation Operations ────────────────────────────────

function addMessage(chatId, role, content) {
  const d = getDb();
  d.prepare("INSERT INTO conversations (chat_id, role, content) VALUES (?, ?, ?)").run(chatId, role, content);

  // Keep only last 20 messages per user for context window
  d.prepare(`
    DELETE FROM conversations WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM conversations WHERE chat_id = ? ORDER BY id DESC LIMIT 20
    )
  `).run(chatId, chatId);
}

function getConversationHistory(chatId, limit = 10) {
  const d = getDb();
  return d
    .prepare("SELECT role, content FROM conversations WHERE chat_id = ? ORDER BY id DESC LIMIT ?")
    .all(chatId, limit)
    .reverse();
}

function clearConversation(chatId) {
  const d = getDb();
  d.prepare("DELETE FROM conversations WHERE chat_id = ?").run(chatId);
}

// ─── Notification Log ───────────────────────────────────────

function logNotification(chatId, type, message, status = "sent") {
  const d = getDb();
  d.prepare("INSERT INTO notification_log (chat_id, type, message, status) VALUES (?, ?, ?, ?)").run(
    chatId,
    type,
    message,
    status
  );
}

function getUserStats() {
  const d = getDb();
  const total = d.prepare("SELECT COUNT(*) as count FROM users").get();
  const active = d.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").get();
  return { total: total.count, active: active.count };
}

module.exports = {
  getDb,
  upsertUser,
  getUser,
  getUserLanguage,
  setUserLanguage,
  setUserCity,
  deactivateUser,
  getActiveUsers,
  getNotifiableUsers,
  updateNotificationPreference,
  addMessage,
  getConversationHistory,
  clearConversation,
  logNotification,
  getUserStats,
};
