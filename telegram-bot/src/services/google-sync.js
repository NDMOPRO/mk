/**
 * Google Sync Service — Google Sheets & Calendar via Apps Script Webhook
 * ─────────────────────────────────────────────────────────────
 * Sends data to a Google Apps Script web app that writes to
 * Google Sheets and Google Calendar.
 *
 * Environment variable: GOOGLE_APPS_SCRIPT_URL
 * ─────────────────────────────────────────────────────────────
 */

const https = require("https");
const http = require("http");

const WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

// ─── HTTP Helper ───────────────────────────────────────────

function postToWebhook(data) {
  return new Promise((resolve, reject) => {
    if (!WEBHOOK_URL) {
      return resolve({ success: false, error: "GOOGLE_APPS_SCRIPT_URL not configured" });
    }

    const payload = JSON.stringify(data);
    const url = new URL(WEBHOOK_URL);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = lib.request(options, (res) => {
      let body = "";

      // Handle redirects (Google Apps Script redirects 302 on doPost)
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          return postToUrl(redirectUrl, payload).then(resolve).catch(reject);
        }
      }

      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          resolve({ success: true, raw: body.substring(0, 200) });
        }
      });
    });

    req.on("error", (err) => {
      console.error("[GoogleSync] HTTP error:", err.message);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ success: false, error: "Request timeout" });
    });

    req.write(payload);
    req.end();
  });
}

function postToUrl(url, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = lib.request(options, (res) => {
      let body = "";

      // Follow another redirect if needed
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          return postToUrl(redirectUrl, payload).then(resolve).catch(reject);
        }
      }

      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: true, raw: body.substring(0, 200) });
        }
      });
    });

    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ success: false, error: "Request timeout" });
    });

    req.write(payload);
    req.end();
  });
}

// ─── Public API ────────────────────────────────────────────

/**
 * Check if Google sync is configured
 */
function isConfigured() {
  return !!WEBHOOK_URL;
}

/**
 * Initial setup — creates spreadsheet and calendar
 */
async function setup() {
  return postToWebhook({ action: "setup" });
}

/**
 * Sync all tasks to the Tasks sheet
 */
async function syncTasks(tasks) {
  return postToWebhook({ action: "sync_tasks", tasks });
}

/**
 * Sync KPI data to the KPIs sheet
 */
async function syncKpis(kpis) {
  return postToWebhook({ action: "sync_kpis", kpis });
}

/**
 * Sync expenses to the Expenses sheet
 */
async function syncExpenses(expenses) {
  return postToWebhook({ action: "sync_expenses", expenses });
}

/**
 * Sync occupancy data to the Occupancy sheet
 */
async function syncOccupancy(occupancy) {
  return postToWebhook({ action: "sync_occupancy", occupancy });
}

/**
 * Sync everything at once
 */
async function syncAll(data) {
  return postToWebhook({ action: "sync_all", ...data });
}

/**
 * Create a calendar event for a task with a due date
 */
async function createCalendarEvent(event) {
  return postToWebhook({ action: "create_calendar_event", event });
}

/**
 * Update a calendar event (e.g., mark as done)
 */
async function updateCalendarEvent(event) {
  return postToWebhook({ action: "update_calendar_event", event });
}

/**
 * Delete a calendar event by task ID
 */
async function deleteCalendarEvent(taskId) {
  return postToWebhook({ action: "delete_calendar_event", taskId });
}

/**
 * Full calendar sync — sync all tasks with due dates
 */
async function syncCalendar(tasks) {
  return postToWebhook({ action: "sync_calendar", tasks });
}

/**
 * Get the spreadsheet URL
 */
async function getSpreadsheetUrl() {
  return postToWebhook({ action: "get_spreadsheet_url" });
}

/**
 * Get the calendar ID
 */
async function getCalendarId() {
  return postToWebhook({ action: "get_calendar_id" });
}

/**
 * Sync a single contact to the "Contacts" tab in Google Sheets.
 * @param {object} contact - Contact data
 * @param {string} contactAction - 'add', 'update', or 'delete'
 */
async function syncContact(contact, contactAction) {
  return postToWebhook({
    action: 'sync_contact',
    contact_action: contactAction,
    contact,
  });
}

/**
 * Sync all contacts to Google Sheets.
 * @param {Array} contacts - Array of contact objects
 */
async function syncContacts(contacts) {
  return postToWebhook({ action: 'sync_contacts', contacts });
}

module.exports = {
  isConfigured,
  setup,
  syncTasks,
  syncKpis,
  syncExpenses,
  syncOccupancy,
  syncAll,
  syncContact,
  syncContacts,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncCalendar,
  getSpreadsheetUrl,
  getCalendarId,
};
