/**
 * Database Resilience Utilities
 * ─────────────────────────────────────────────────────────────
 * Provides SQLite connection recovery, WAL mode enforcement,
 * and safe execution wrappers for database operations.
 */

const log = require('./logger');

/**
 * Safely open or reopen a SQLite database connection.
 * Handles corruption and lock errors gracefully.
 *
 * @param {Function} Database - The better-sqlite3 constructor
 * @param {string} dbPath - Path to the database file
 * @param {Object} opts - Options
 * @param {string} opts.name - Database name for logging
 * @returns {Object|null} Database instance or null on failure
 */
function safeOpenDb(Database, dbPath, opts = {}) {
  const { name = 'DB' } = opts;
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    try {
      db.pragma('journal_mode = WAL');
    } catch (e) {
      log.warn(name, 'Could not set WAL mode', { error: e.message });
    }

    // Set busy timeout to handle lock contention (5 seconds)
    try {
      db.pragma('busy_timeout = 5000');
    } catch (e) {
      log.warn(name, 'Could not set busy_timeout', { error: e.message });
    }

    log.info(name, `Database opened successfully`, { path: dbPath });
    return db;
  } catch (err) {
    log.error(name, `Failed to open database`, { path: dbPath, error: err.message });
    return null;
  }
}

/**
 * Safely close a database connection.
 *
 * @param {Object} db - The better-sqlite3 instance
 * @param {string} name - Database name for logging
 */
function safeCloseDb(db, name = 'DB') {
  if (!db) return;
  try {
    db.close();
    log.info(name, 'Database closed cleanly');
  } catch (err) {
    log.warn(name, 'Error closing database (non-fatal)', { error: err.message });
  }
}

/**
 * Execute a database operation with error recovery.
 * If the operation fails due to a recoverable error (locked, busy),
 * it will retry once after a short delay.
 *
 * @param {Function} fn - Synchronous function to execute
 * @param {Object} opts - Options
 * @param {*} opts.defaultValue - Value to return on failure
 * @param {string} opts.name - Operation name for logging
 * @param {Function} opts.onRecovery - Called when recovery is needed (e.g., reopen DB)
 * @returns {*} Result of fn() or defaultValue
 */
function safeExec(fn, opts = {}) {
  const { defaultValue = null, name = 'db_exec', onRecovery = null } = opts;
  try {
    return fn();
  } catch (err) {
    const msg = (err.message || '').toLowerCase();

    // Recoverable errors: try once more
    if (msg.includes('database is locked') || msg.includes('busy')) {
      log.warn('DB', `${name}: database locked/busy — retrying after 100ms`);
      try {
        // Small synchronous delay
        const start = Date.now();
        while (Date.now() - start < 100) { /* busy wait */ }
        return fn();
      } catch (retryErr) {
        log.error('DB', `${name}: retry also failed`, { error: retryErr.message });
      }
    }

    // Corruption: log critical error, try recovery callback
    if (msg.includes('malformed') || msg.includes('corrupt') || msg.includes('not a database')) {
      log.error('DB', `CRITICAL: ${name} — database corruption detected`, { error: err.message });
      if (onRecovery) {
        try {
          onRecovery();
        } catch (recoveryErr) {
          log.error('DB', `Recovery callback failed`, { error: recoveryErr.message });
        }
      }
    } else {
      log.error('DB', `${name} failed`, { error: err.message });
    }

    return defaultValue;
  }
}

module.exports = {
  safeOpenDb,
  safeCloseDb,
  safeExec,
};
