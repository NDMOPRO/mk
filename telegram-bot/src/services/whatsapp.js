/**
 * WhatsApp Business API Integration via Twilio
 * ─────────────────────────────────────────────────────────────
 * Provides WhatsApp messaging capabilities through Twilio's API.
 * Degrades gracefully when Twilio is not configured — all public
 * methods return { success: false, error: '...' } without throwing.
 *
 * Environment variables:
 *   TWILIO_ACCOUNT_SID      — Twilio Account SID
 *   TWILIO_AUTH_TOKEN        — Twilio Auth Token
 *   TWILIO_WHATSAPP_NUMBER   — Twilio WhatsApp sender (e.g., whatsapp:+14155238886)
 *   WHATSAPP_CEO_NUMBER      — CEO's WhatsApp number (e.g., +966535080045)
 */

const log = require("../utils/logger");

// ─── Configuration ──────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "";
const WHATSAPP_CEO_NUMBER = process.env.WHATSAPP_CEO_NUMBER || "+966535080045";

let twilioClient = null;

/**
 * Check if Twilio/WhatsApp integration is configured.
 */
function isConfigured() {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);
}

/**
 * Get or create the Twilio client (lazy initialization).
 */
function getClient() {
  if (!isConfigured()) return null;
  if (!twilioClient) {
    try {
      const twilio = require("twilio");
      twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      log.info("WhatsApp", "Twilio client initialized");
    } catch (e) {
      log.error("WhatsApp", "Failed to initialize Twilio client", { error: e.message });
      return null;
    }
  }
  return twilioClient;
}

/**
 * Format a phone number for WhatsApp.
 * Ensures the number starts with "whatsapp:" prefix.
 */
function formatWhatsAppNumber(number) {
  if (!number) return null;
  const clean = number.trim();
  if (clean.startsWith("whatsapp:")) return clean;
  return `whatsapp:${clean}`;
}

/**
 * Format the sender number.
 */
function getSenderNumber() {
  return formatWhatsAppNumber(TWILIO_WHATSAPP_NUMBER);
}

// ═══════════════════════════════════════════════════════════════
// ═══ Public API ═════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

/**
 * Send a WhatsApp message to a phone number.
 * @param {string} to - Recipient phone number (e.g., +966535080045)
 * @param {string} body - Message text
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendMessage(to, body) {
  if (!isConfigured()) {
    return { success: false, error: "Twilio/WhatsApp not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER." };
  }

  const client = getClient();
  if (!client) {
    return { success: false, error: "Failed to initialize Twilio client" };
  }

  try {
    const message = await client.messages.create({
      from: getSenderNumber(),
      to: formatWhatsAppNumber(to),
      body: body,
    });
    log.info("WhatsApp", `Message sent to ${to}`, { sid: message.sid });
    return { success: true, sid: message.sid };
  } catch (e) {
    log.error("WhatsApp", `Failed to send message to ${to}`, { error: e.message });
    return { success: false, error: e.message };
  }
}

/**
 * Send a WhatsApp message to the CEO.
 * @param {string} body - Message text
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendToCeo(body) {
  if (!WHATSAPP_CEO_NUMBER) {
    return { success: false, error: "WHATSAPP_CEO_NUMBER not configured" };
  }
  return sendMessage(WHATSAPP_CEO_NUMBER, body);
}

/**
 * Send a critical alert to the CEO via WhatsApp.
 * Used for overdue tasks, escalations, urgent blockers.
 * @param {string} alertType - Type of alert (e.g., "overdue", "escalation", "blocker")
 * @param {string} details - Alert details
 */
async function sendCriticalAlert(alertType, details) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  const emoji = {
    overdue: "🔴",
    escalation: "🚨",
    blocker: "⛔",
    urgent: "⚠️",
    appointment: "📅",
    meeting: "📅",
  };

  const icon = emoji[alertType] || "📢";
  const body = `${icon} *Monthly Key Alert*\n\nType: ${alertType.toUpperCase()}\n\n${details}\n\n— Monthly Key Bot`;

  return sendToCeo(body);
}

/**
 * Send a daily summary via WhatsApp (9 PM KSA).
 * @param {object} summary - Summary data
 */
async function sendDailySummary(summary) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  let body = `📊 *Daily Summary — Monthly Key*\n`;
  body += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (summary.completedToday !== undefined) {
    body += `✅ Completed today: ${summary.completedToday}\n`;
  }
  if (summary.pendingTasks !== undefined) {
    body += `⏳ Pending tasks: ${summary.pendingTasks}\n`;
  }
  if (summary.overdueTasks !== undefined) {
    body += `🔴 Overdue: ${summary.overdueTasks}\n`;
  }
  if (summary.upcomingAppointments !== undefined) {
    body += `📅 Upcoming appointments: ${summary.upcomingAppointments}\n`;
  }
  if (summary.upcomingMeetings !== undefined) {
    body += `📅 Upcoming meetings: ${summary.upcomingMeetings}\n`;
  }

  body += `\n— Monthly Key Bot`;

  return sendToCeo(body);
}

/**
 * Send an appointment/meeting reminder via WhatsApp.
 * @param {object} event - The appointment or meeting object
 * @param {string} type - "appointment" or "meeting"
 * @param {string} timeLabel - e.g., "1 hour" or "15 minutes"
 */
async function sendEventReminder(event, type, timeLabel) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  const title = event.title || "Untitled";
  const location = event.location || "";
  const body = [
    `⏰ *${type === "appointment" ? "Appointment" : "Meeting"} Reminder*`,
    ``,
    `📌 ${title}`,
    `🕐 In ${timeLabel}`,
    location ? `📍 ${location}` : null,
    ``,
    `— Monthly Key Bot`,
  ].filter(Boolean).join("\n");

  return sendToCeo(body);
}

/**
 * Forward a Telegram message to WhatsApp (for incoming WhatsApp → Telegram bridge replies).
 * @param {string} to - Recipient phone number
 * @param {string} body - Message text
 */
async function forwardToWhatsApp(to, body) {
  return sendMessage(to, body);
}

/**
 * Get integration status info.
 */
function getStatus() {
  return {
    configured: isConfigured(),
    accountSid: TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 8)}...` : "Not set",
    whatsappNumber: TWILIO_WHATSAPP_NUMBER || "Not set",
    ceoNumber: WHATSAPP_CEO_NUMBER || "Not set",
  };
}

module.exports = {
  isConfigured,
  sendMessage,
  sendToCeo,
  sendCriticalAlert,
  sendDailySummary,
  sendEventReminder,
  forwardToWhatsApp,
  getStatus,
  WHATSAPP_CEO_NUMBER,
};
