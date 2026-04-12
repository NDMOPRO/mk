/**
 * Resilience Utilities for Monthly Key Telegram Bot
 * ─────────────────────────────────────────────────────────────
 * Provides:
 *  - safeHandler()       — wraps bot handlers in try-catch
 *  - safeCallback()      — wraps callback_query handlers
 *  - retryWithBackoff()  — exponential backoff for API calls
 *  - safeTelegramCall()  — Telegram API call with rate-limit handling
 *  - safeDbCall()        — database operation wrapper
 */

const log = require('./logger');

// ─── Track last processed message time ──────────────────────
let _lastMessageTime = null;

function getLastMessageTime() {
  return _lastMessageTime;
}

// ─── Safe Handler Wrapper ───────────────────────────────────
/**
 * Wraps a Telegraf handler function in try-catch.
 * Logs errors with context but never lets them propagate to crash the process.
 *
 * @param {string} name - Handler name for logging (e.g., 'cmd:task', 'on:text')
 * @param {Function} fn - The async handler function (ctx) => {...}
 * @returns {Function} Wrapped handler
 */
function safeHandler(name, fn) {
  return async (ctx) => {
    _lastMessageTime = Date.now();
    try {
      return await fn(ctx);
    } catch (err) {
      const userId = ctx.from?.id || 'unknown';
      const chatId = ctx.chat?.id || 'unknown';
      const text = ctx.message?.text?.substring(0, 80) || '';
      log.error('Handler', `Error in "${name}"`, {
        error: err.message,
        userId,
        chatId,
        text,
        stack: (err.stack || '').split('\n').slice(0, 3).join(' → '),
      });
      // In private chats, try to send a generic error message
      if (ctx.chat?.type === 'private' && ctx.reply) {
        try {
          await ctx.reply('❌ An error occurred. Please try again.');
        } catch (_) { /* ignore reply failure */ }
      }
    }
  };
}

/**
 * Wraps a callback query handler in try-catch.
 * Always answers the callback query to prevent Telegram's loading spinner.
 */
function safeCallback(name, fn) {
  return async (ctx) => {
    _lastMessageTime = Date.now();
    try {
      return await fn(ctx);
    } catch (err) {
      const userId = ctx.from?.id || 'unknown';
      const data = ctx.callbackQuery?.data || '';
      log.error('Callback', `Error in "${name}"`, {
        error: err.message,
        userId,
        data,
      });
      try {
        await ctx.answerCbQuery('❌ Error occurred').catch(() => {});
      } catch (_) { /* ignore */ }
    }
  };
}

// ─── Retry with Exponential Backoff ─────────────────────────
/**
 * Retries an async function with exponential backoff.
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} opts - Options
 * @param {number} opts.maxRetries - Maximum number of retries (default: 3)
 * @param {number} opts.baseDelay - Base delay in ms (default: 1000)
 * @param {number} opts.maxDelay - Maximum delay in ms (default: 15000)
 * @param {string} opts.name - Operation name for logging
 * @param {Function} opts.shouldRetry - Function(error) => bool, whether to retry
 * @returns {*} Result of fn()
 */
async function retryWithBackoff(fn, opts = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 15000,
    name = 'operation',
    shouldRetry = () => true,
  } = opts;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !shouldRetry(err)) {
        throw err;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
      log.warn('Retry', `${name} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms`, {
        error: err.message,
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── OpenAI-specific retry ──────────────────────────────────
/**
 * Determines if an OpenAI error is retryable.
 */
function isRetryableOpenAIError(err) {
  const msg = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode || 0;
  // Retry on rate limits, server errors, timeouts, network errors
  if (status === 429 || status >= 500) return true;
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('enotfound')) return true;
  if (msg.includes('rate limit') || msg.includes('too many requests')) return true;
  if (msg.includes('network') || msg.includes('socket hang up')) return true;
  return false;
}

/**
 * Wraps an OpenAI API call with retry logic and fallback.
 *
 * @param {Function} fn - Async function that calls OpenAI
 * @param {Object} opts - Options
 * @param {string} opts.fallback - Fallback response if all retries fail
 * @param {string} opts.name - Operation name for logging
 * @returns {*} Result of fn() or fallback
 */
async function safeOpenAICall(fn, opts = {}) {
  const { fallback = null, name = 'openai_call' } = opts;
  try {
    return await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000,
      name,
      shouldRetry: isRetryableOpenAIError,
    });
  } catch (err) {
    log.error('OpenAI', `${name} failed after retries`, { error: err.message });
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}

// ─── Telegram API Safety ────────────────────────────────────
/**
 * Determines if a Telegram API error is retryable.
 */
function isRetryableTelegramError(err) {
  const msg = (err.message || '').toLowerCase();
  const code = err.code || 0;
  // Rate limiting
  if (code === 429 || msg.includes('too many requests') || msg.includes('retry_after')) return true;
  // Network errors
  if (msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('timeout')) return true;
  if (msg.includes('network') || msg.includes('socket hang up') || msg.includes('econnrefused')) return true;
  // Telegram server errors
  if (code >= 500) return true;
  return false;
}

/**
 * Wraps a Telegram API call with retry and rate-limit handling.
 */
async function safeTelegramCall(fn, name = 'telegram_call') {
  try {
    return await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      name,
      shouldRetry: (err) => {
        // If Telegram says "retry_after", extract the delay
        const retryAfter = err.parameters?.retry_after;
        if (retryAfter) {
          log.warn('Telegram', `Rate limited, waiting ${retryAfter}s`, { name });
        }
        return isRetryableTelegramError(err);
      },
    });
  } catch (err) {
    log.error('Telegram', `${name} failed after retries`, { error: err.message });
    throw err;
  }
}

// ─── Database Safety ────────────────────────────────────────
/**
 * Wraps a synchronous database operation in try-catch.
 * Returns the result or a default value on failure.
 *
 * @param {Function} fn - Synchronous function that does DB work
 * @param {*} defaultValue - Value to return on error (default: null)
 * @param {string} name - Operation name for logging
 * @returns {*} Result of fn() or defaultValue
 */
function safeDbCall(fn, defaultValue = null, name = 'db_op') {
  try {
    return fn();
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    log.error('Database', `${name} failed`, { error: err.message });

    // Handle specific SQLite errors
    if (msg.includes('database is locked')) {
      log.warn('Database', 'Database locked — will retry on next access');
    }
    if (msg.includes('database disk image is malformed') || msg.includes('corrupt')) {
      log.error('Database', 'DATABASE CORRUPTION DETECTED — manual intervention may be needed');
    }

    return defaultValue;
  }
}

module.exports = {
  safeHandler,
  safeCallback,
  retryWithBackoff,
  safeOpenAICall,
  isRetryableOpenAIError,
  safeTelegramCall,
  isRetryableTelegramError,
  safeDbCall,
  getLastMessageTime,
};
