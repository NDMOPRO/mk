/**
 * Health Monitor for Monthly Key Telegram Bot
 * ─────────────────────────────────────────────────────────────
 * - Self-ping mechanism (every 5 minutes)
 * - Webhook verification and auto-re-registration
 * - Health status aggregation for /health endpoint
 */

const http = require('http');
const https = require('https');
const log = require('./logger');

let _bot = null;
let _webhookUrl = null;
let _port = null;
let _selfPingInterval = null;
let _webhookCheckInterval = null;
let _consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Initialize the health monitor.
 * @param {Object} bot - Telegraf bot instance
 * @param {string} webhookUrl - Full webhook URL
 * @param {number} port - Express server port
 */
function init(bot, webhookUrl, port) {
  _bot = bot;
  _webhookUrl = webhookUrl;
  _port = port;

  // Self-ping every 5 minutes
  _selfPingInterval = setInterval(selfPing, 5 * 60 * 1000);
  // First self-ping after 60 seconds (give server time to start)
  setTimeout(selfPing, 60 * 1000);

  // Webhook verification every 10 minutes
  _webhookCheckInterval = setInterval(verifyWebhook, 10 * 60 * 1000);
  // First webhook check after 30 seconds
  setTimeout(verifyWebhook, 30 * 1000);

  log.info('Health', 'Health monitor initialized', {
    selfPingInterval: '5min',
    webhookCheckInterval: '10min',
  });
}

/**
 * Stop the health monitor.
 */
function stop() {
  if (_selfPingInterval) {
    clearInterval(_selfPingInterval);
    _selfPingInterval = null;
  }
  if (_webhookCheckInterval) {
    clearInterval(_webhookCheckInterval);
    _webhookCheckInterval = null;
  }
  log.info('Health', 'Health monitor stopped');
}

/**
 * Self-ping: hit our own /health endpoint to ensure the server is responsive.
 */
async function selfPing() {
  try {
    const url = `http://127.0.0.1:${_port}/health`;
    const result = await httpGet(url, 5000);
    if (result && result.status === 'ok') {
      _consecutiveFailures = 0;
      log.debug('Health', 'Self-ping OK', { uptime: result.uptime });
    } else {
      _consecutiveFailures++;
      log.warn('Health', `Self-ping returned unexpected response`, { result });
    }
  } catch (err) {
    _consecutiveFailures++;
    log.error('Health', 'Self-ping FAILED', {
      error: err.message,
      consecutiveFailures: _consecutiveFailures,
    });

    // If multiple consecutive failures, try to re-register webhook
    if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && _bot && _webhookUrl) {
      log.warn('Health', 'Multiple self-ping failures — attempting webhook re-registration');
      await reRegisterWebhook();
    }
  }
}

/**
 * Verify that the webhook is correctly registered with Telegram.
 */
async function verifyWebhook() {
  if (!_bot || !_webhookUrl) return;

  try {
    const info = await _bot.telegram.getWebhookInfo();
    if (!info.url || info.url !== _webhookUrl) {
      log.warn('Health', 'Webhook mismatch or deregistered', {
        expected: _webhookUrl,
        actual: info.url || '(none)',
      });
      await reRegisterWebhook();
    } else {
      const details = {
        url: info.url,
        pendingUpdates: info.pending_update_count || 0,
      };
      if (info.last_error_date) {
        details.lastError = info.last_error_message;
        details.lastErrorAge = Math.round((Date.now() / 1000) - info.last_error_date) + 's ago';
      }
      log.debug('Health', 'Webhook verified OK', details);
    }
  } catch (err) {
    log.error('Health', 'Webhook verification failed', { error: err.message });
  }
}

/**
 * Re-register the webhook with Telegram.
 */
async function reRegisterWebhook() {
  if (!_bot || !_webhookUrl) return;

  try {
    await _bot.telegram.setWebhook(_webhookUrl, {
      drop_pending_updates: false,
      allowed_updates: [
        'message', 'edited_message', 'callback_query',
        'inline_query', 'chosen_inline_result',
        'chat_member', 'my_chat_member',
      ],
    });
    log.info('Health', 'Webhook re-registered successfully', { url: _webhookUrl });
    _consecutiveFailures = 0;
  } catch (err) {
    log.error('Health', 'Webhook re-registration FAILED', { error: err.message });
  }
}

/**
 * Simple HTTP GET with timeout.
 */
function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', reject);
  });
}

module.exports = {
  init,
  stop,
  selfPing,
  verifyWebhook,
  reRegisterWebhook,
};
