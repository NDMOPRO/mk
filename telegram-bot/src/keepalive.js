/**
 * Keep-Alive Monitor for Monthly Key Telegram Bot
 *
 * This process runs alongside the main bot via PM2.
 * Every 4 minutes it:
 *  1. Pings the Telegram API to confirm the bot token is valid
 *  2. Checks that the main bot process is still polling (via a shared heartbeat file)
 *  3. If the heartbeat is stale (>5 min old), it signals PM2 to restart the main bot
 *
 * This compensates for sandbox hibernation — when the sandbox wakes up, both
 * processes restart together, and this monitor catches any silent failures.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Load .env so BOT_TOKEN is available
try { require("dotenv").config({ path: path.join(__dirname, "../.env") }); } catch (e) {}

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const HEARTBEAT_FILE = path.join(__dirname, "../.heartbeat");
const CHECK_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const STALE_THRESHOLD_MS = 6 * 60 * 1000; // 6 minutes — bot is considered dead

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[KeepAlive] ${ts} ${msg}`);
}

function pingTelegram() {
  return new Promise((resolve) => {
    if (!BOT_TOKEN) {
      log("WARN: BOT_TOKEN not set — skipping Telegram ping");
      return resolve(false);
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              log(`OK: Bot @${parsed.result.username} is reachable via Telegram API`);
              resolve(true);
            } else {
              log(`WARN: Telegram API returned ok=false: ${data}`);
              resolve(false);
            }
          } catch (e) {
            log(`ERROR: Failed to parse Telegram response: ${e.message}`);
            resolve(false);
          }
        });
      })
      .on("error", (e) => {
        log(`ERROR: Telegram ping failed: ${e.message}`);
        resolve(false);
      });
  });
}

function checkHeartbeat() {
  try {
    if (!fs.existsSync(HEARTBEAT_FILE)) {
      log("WARN: No heartbeat file found — bot may not have started yet");
      return false;
    }
    const mtime = fs.statSync(HEARTBEAT_FILE).mtimeMs;
    const age = Date.now() - mtime;
    if (age > STALE_THRESHOLD_MS) {
      log(`WARN: Heartbeat is ${Math.round(age / 1000)}s old (threshold: ${STALE_THRESHOLD_MS / 1000}s) — bot appears stale`);
      return false;
    }
    log(`OK: Heartbeat is fresh (${Math.round(age / 1000)}s old)`);
    return true;
  } catch (e) {
    log(`ERROR: Could not read heartbeat file: ${e.message}`);
    return false;
  }
}

function restartMainBot() {
  log("ACTION: Attempting to restart monthlykey-bot via PM2...");
  try {
    const pm2Path = path.join(__dirname, "../../..", ".nvm/versions/node/v22.13.0/bin/pm2");
    const pm2 = fs.existsSync(pm2Path) ? pm2Path : "pm2";
    execSync(`${pm2} restart monthlykey-bot --update-env`, { stdio: "pipe" });
    log("ACTION: PM2 restart command sent successfully");
  } catch (e) {
    log(`ERROR: PM2 restart failed: ${e.message}`);
  }
}

async function runCheck() {
  log("--- Running health check ---");

  const telegramOk = await pingTelegram();
  const heartbeatOk = checkHeartbeat();

  if (!heartbeatOk && telegramOk) {
    // Telegram is reachable but our bot isn't writing heartbeats — restart it
    restartMainBot();
  } else if (!telegramOk) {
    log("WARN: Telegram unreachable — network issue or token problem. Will retry next cycle.");
  } else {
    log("OK: All checks passed");
  }
}

// Run immediately on start, then every CHECK_INTERVAL_MS
log("Keep-Alive monitor started");
runCheck();
setInterval(runCheck, CHECK_INTERVAL_MS);
