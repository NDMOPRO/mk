/**
 * Structured Logger for Monthly Key Telegram Bot
 * ─────────────────────────────────────────────────────────────
 * Provides timestamped, context-rich logging with error tracking.
 * All log entries include ISO timestamps and structured context.
 *
 * Usage:
 *   const log = require('./utils/logger');
 *   log.info('Bot', 'Server started on port 3000');
 *   log.error('AI', 'OpenAI call failed', { userId: 123, error: err.message });
 *   log.warn('Scheduler', 'Job skipped', { job: 'morning_briefing' });
 */

// ─── Error Tracking ──────────────────────────────────────────
let _errorCount = 0;
let _lastErrors = [];      // ring buffer of last 20 errors
const MAX_ERROR_HISTORY = 20;

function timestamp() {
  return new Date().toISOString();
}

function formatMsg(level, module, message, context) {
  const ts = timestamp();
  const prefix = `[${ts}] [${level}] [${module}]`;
  if (context && Object.keys(context).length > 0) {
    // Flatten context for single-line logging
    const ctxStr = Object.entries(context)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    return `${prefix} ${message} | ${ctxStr}`;
  }
  return `${prefix} ${message}`;
}

function info(module, message, context = {}) {
  console.log(formatMsg('INFO', module, message, context));
}

function warn(module, message, context = {}) {
  console.warn(formatMsg('WARN', module, message, context));
}

function error(module, message, context = {}) {
  _errorCount++;
  const entry = {
    timestamp: timestamp(),
    module,
    message,
    ...context,
  };
  _lastErrors.push(entry);
  if (_lastErrors.length > MAX_ERROR_HISTORY) {
    _lastErrors.shift();
  }
  console.error(formatMsg('ERROR', module, message, context));
}

function debug(module, message, context = {}) {
  if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
    console.log(formatMsg('DEBUG', module, message, context));
  }
}

/**
 * Get error statistics for health endpoint
 */
function getErrorStats() {
  return {
    totalErrors: _errorCount,
    recentErrors: _lastErrors.slice(-5).map(e => ({
      time: e.timestamp,
      module: e.module,
      message: e.message,
    })),
  };
}

/**
 * Reset error counter (useful after deploy)
 */
function resetErrorCount() {
  _errorCount = 0;
  _lastErrors = [];
}

/**
 * Log startup banner with system status
 */
function startupBanner(config) {
  const divider = '═══════════════════════════════════════════════════';
  console.log('');
  console.log(divider);
  console.log(`  Monthly Key Telegram Bot — STARTING`);
  console.log(`  Time: ${timestamp()}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  PID:  ${process.pid}`);
  console.log(`  Env:  ${process.env.NODE_ENV || 'production'}`);
  if (config) {
    if (config.botUsername) console.log(`  Bot:  @${config.botUsername}`);
    if (config.webhookUrl) console.log(`  Hook: ${config.webhookUrl}`);
    if (config.port) console.log(`  Port: ${config.port}`);
  }
  console.log(divider);
  console.log('');
}

/**
 * Log system readiness after all subsystems initialized
 */
function systemReady(subsystems) {
  const divider = '───────────────────────────────────────────────────';
  console.log('');
  console.log(divider);
  console.log(`  ALL SYSTEMS OPERATIONAL — ${timestamp()}`);
  for (const [name, status] of Object.entries(subsystems)) {
    const icon = status ? '✓' : '✗';
    console.log(`  ${icon} ${name}`);
  }
  console.log(divider);
  console.log('');
}

module.exports = {
  info,
  warn,
  error,
  debug,
  getErrorStats,
  resetErrorCount,
  startupBanner,
  systemReady,
};
