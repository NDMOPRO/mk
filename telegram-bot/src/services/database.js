/**
 * SQLite Database Service for Monthly Key Telegram Bot
 * Stores user data, notification preferences, conversation history,
 * bookings, payments, and property alert subscriptions
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

  // ─── Phase 2: Bookings table ─────────────────────────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      property_title TEXT,
      property_city TEXT,
      monthly_rent REAL DEFAULT 0,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      duration_months INTEGER DEFAULT 1,
      total_amount REAL DEFAULT 0,
      security_deposit REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_provider_id TEXT,
      payment_charge_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES users(chat_id)
    )
  `);

  // ─── Phase 3: Channel posted properties tracking ────────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS channel_posted_properties (
      property_id TEXT PRIMARY KEY,
      posted_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Phase 2: Property Alerts / Subscriptions table ──────────
  d.exec(`
    CREATE TABLE IF NOT EXISTS alert_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      city TEXT,
      min_price REAL,
      max_price REAL,
      property_type TEXT,
      bedrooms INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES users(chat_id)
    )
  `);
}

// ─── User Operations ────────────────────────────────────────

function upsertUser(chatId, userData) {
  const d = getDb();
  // IMPORTANT: Do NOT overwrite language if user already exists.
  // Language should only be set on first insert (from Telegram language_code),
  // and after that only changed explicitly via setUserLanguage (language picker).
  const stmt = d.prepare(`
    INSERT INTO users (chat_id, username, first_name, last_name, language, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(chat_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
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

// ─── Booking Operations (Phase 2) ──────────────────────────

function createBooking(chatId, bookingData) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO bookings (
      chat_id, property_id, property_title, property_city,
      monthly_rent, check_in_date, check_out_date, duration_months,
      total_amount, security_deposit, service_fee, vat_amount, grand_total,
      status, payment_status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    chatId,
    bookingData.propertyId,
    bookingData.propertyTitle || null,
    bookingData.propertyCity || null,
    bookingData.monthlyRent || 0,
    bookingData.checkInDate,
    bookingData.checkOutDate,
    bookingData.durationMonths || 1,
    bookingData.totalAmount || 0,
    bookingData.securityDeposit || 0,
    bookingData.serviceFee || 0,
    bookingData.vatAmount || 0,
    bookingData.grandTotal || 0,
    "pending",
    "unpaid",
    bookingData.notes || null
  );
  return result.lastInsertRowid;
}

function getBooking(bookingId) {
  const d = getDb();
  return d.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
}

function getUserBookings(chatId, limit = 10) {
  const d = getDb();
  return d.prepare(
    "SELECT * FROM bookings WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(chatId, limit);
}

function updateBookingStatus(bookingId, status) {
  const d = getDb();
  d.prepare(
    "UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, bookingId);
}

function updateBookingPayment(bookingId, paymentData) {
  const d = getDb();
  d.prepare(`
    UPDATE bookings SET
      payment_status = ?,
      payment_provider_id = ?,
      payment_charge_id = ?,
      status = CASE WHEN ? = 'paid' THEN 'confirmed' ELSE status END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    paymentData.paymentStatus,
    paymentData.providerPaymentId || null,
    paymentData.chargeId || null,
    paymentData.paymentStatus,
    bookingId
  );
}

function cancelBooking(bookingId) {
  const d = getDb();
  d.prepare(
    "UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
  ).run(bookingId);
}

// ─── Alert Subscription Operations (Phase 2) ───────────────

function createAlertSubscription(chatId, filters) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO alert_subscriptions (
      chat_id, city, min_price, max_price, property_type, bedrooms, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(
    chatId,
    filters.city || null,
    filters.minPrice || null,
    filters.maxPrice || null,
    filters.propertyType || null,
    filters.bedrooms || null
  );
  return result.lastInsertRowid;
}

function getUserAlerts(chatId) {
  const d = getDb();
  return d.prepare(
    "SELECT * FROM alert_subscriptions WHERE chat_id = ? AND is_active = 1 ORDER BY created_at DESC"
  ).all(chatId);
}

function getAllActiveAlerts() {
  const d = getDb();
  return d.prepare(
    "SELECT * FROM alert_subscriptions WHERE is_active = 1"
  ).all();
}

function getAlertById(alertId) {
  const d = getDb();
  return d.prepare("SELECT * FROM alert_subscriptions WHERE id = ?").get(alertId);
}

function deactivateAlert(alertId) {
  const d = getDb();
  d.prepare(
    "UPDATE alert_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(alertId);
}

function deactivateAllUserAlerts(chatId) {
  const d = getDb();
  d.prepare(
    "UPDATE alert_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE chat_id = ?"
  ).run(chatId);
}

function getMatchingAlerts(property) {
  const d = getDb();
  // Get all active alerts that could match this property
  const alerts = d.prepare(
    "SELECT * FROM alert_subscriptions WHERE is_active = 1"
  ).all();

  return alerts.filter((alert) => {
    // Check city match (case-insensitive)
    if (alert.city && property.city) {
      if (alert.city.toLowerCase() !== property.city.toLowerCase()) {
        return false;
      }
    }
    // Check price range
    const rent = Number(property.monthlyRent || 0);
    if (alert.min_price && rent < alert.min_price) return false;
    if (alert.max_price && rent > alert.max_price) return false;
    // Check property type
    if (alert.property_type && property.propertyType) {
      if (alert.property_type !== property.propertyType) return false;
    }
    // Check bedrooms
    if (alert.bedrooms && property.bedrooms) {
      if (alert.bedrooms !== property.bedrooms) return false;
    }
    return true;
  });
}

// ─── Channel Posted Properties (Phase 3) ─────────────────────

function getPostedPropertyIds() {
  const d = getDb();
  return d.prepare("SELECT property_id FROM channel_posted_properties").all().map(r => r.property_id);
}

function markPropertyAsPosted(propertyId) {
  const d = getDb();
  d.prepare("INSERT OR IGNORE INTO channel_posted_properties (property_id) VALUES (?)").run(String(propertyId));
}

function isPropertyPosted(propertyId) {
  const d = getDb();
  const row = d.prepare("SELECT 1 FROM channel_posted_properties WHERE property_id = ?").get(String(propertyId));
  return !!row;
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
  // Phase 2: Bookings
  createBooking,
  getBooking,
  getUserBookings,
  updateBookingStatus,
  updateBookingPayment,
  cancelBooking,
  // Phase 2: Alerts
  createAlertSubscription,
  getUserAlerts,
  getAllActiveAlerts,
  getAlertById,
  deactivateAlert,
  deactivateAllUserAlerts,
  getMatchingAlerts,
  // Phase 3: Channel posting
  getPostedPropertyIds,
  markPropertyAsPosted,
  isPropertyPosted,
};
