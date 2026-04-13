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

// ─── Team member WhatsApp lookup ────────────────────────────
// Lazy-loaded to avoid circular require issues at startup
function getTeamMembers() {
  try { return require("../team-members"); } catch (e) { return null; }
}

let twilioClient = null;

// ─── Name resolution helpers ────────────────────────────────

/**
 * Resolve a raw assignee string (may contain multiple @mentions separated by spaces)
 * to a bilingual real name. Returns { en, ar }.
 * e.g. "@ceo @administration" → { en: "Khalid", ar: "خالد بن عبدالله" }
 * e.g. "@SAQ198"              → { en: "Saad Al Qasem", ar: "سعد القاسم" }
 */
function resolveAssignee(raw) {
  if (!raw) return { en: "", ar: "" };
  try {
    const { getDisplayName, getDisplayNameAr } = require("../team-members");
    // Handle multi-mention strings like "@ceo @administration" — resolve each token
    const tokens = String(raw).trim().split(/\s+/);
    const resolvedEn = new Set();
    const resolvedAr = new Set();
    for (const token of tokens) {
      const en = getDisplayName(token);
      const ar = getDisplayNameAr(token);
      // Only add if it was actually resolved (not returned as-is)
      if (en !== token || ar !== token) {
        resolvedEn.add(en);
        resolvedAr.add(ar);
      } else {
        // Not resolved — include the raw token
        resolvedEn.add(token);
        resolvedAr.add(token);
      }
    }
    return {
      en: Array.from(resolvedEn).join(", "),
      ar: Array.from(resolvedAr).join(", "),
    };
  } catch (e) {
    return { en: raw, ar: raw };
  }
}

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
 * Send a WhatsApp message to a specific team member by name or username.
 * Resolves the member from team-members.js registry.
 * @param {string} nameOrUsername - e.g., "Mushtaq", "@saq198", "Sameh", "Khalid"
 * @param {string} body - Message text
 * @returns {Promise<{success: boolean, sid?: string, error?: string, memberName?: string}>}
 */
async function sendToMember(nameOrUsername, body) {
  const tm = getTeamMembers();
  if (!tm) return { success: false, error: "team-members module unavailable" };
  const number = tm.getWhatsAppNumber(nameOrUsername);
  if (!number) {
    const member = tm.resolveTeamMember(nameOrUsername);
    if (member) {
      return { success: false, error: `${member.name} does not have a WhatsApp number configured` };
    }
    return { success: false, error: `Unknown team member: ${nameOrUsername}` };
  }
  const result = await sendMessage(number, body);
  const member = tm.resolveTeamMember(nameOrUsername);
  return { ...result, memberName: member ? member.name : nameOrUsername };
}

/**
 * Send a WhatsApp message to ALL team members with configured numbers.
 * @param {string} body - Message text
 * @returns {Promise<Array<{name, success, sid?, error?}>>}
 */
async function sendToAll(body) {
  const tm = getTeamMembers();
  if (!tm) return [{ name: "all", success: false, error: "team-members module unavailable" }];
  const members = tm.getTeamWhatsAppNumbers();
  const results = [];
  for (const m of members) {
    const result = await sendMessage(m.whatsapp, body);
    results.push({ name: m.name, nameAr: m.nameAr, whatsapp: m.whatsapp, ...result });
  }
  return results;
}

/**
 * Send a task assignment notification to the assigned team member via WhatsApp.
 * Called when a new task is created or reassigned.
 * @param {object} task - Task object { id, title, assigned_to, due_date, topic_name }
 * @param {string} assignedBy - Name of the person who assigned the task
 */
async function sendTaskAssignment(task, assignedBy) {
  if (!isConfigured()) return { success: false, error: "Not configured" };
  if (!task || !task.assigned_to) return { success: false, error: "No assignee" };

  const tm = getTeamMembers();
  if (!tm) return { success: false, error: "team-members module unavailable" };

  // Resolve assignee — may be a multi-mention string like "@ceo @administration"
  // Use the first resolvable token for WhatsApp delivery
  const tokens = String(task.assigned_to).trim().split(/\s+/);
  let targetNumber = null;
  let targetName = task.assigned_to;
  let targetNameAr = task.assigned_to;
  for (const token of tokens) {
    const num = tm.getWhatsAppNumber(token);
    if (num) {
      targetNumber = num;
      const member = tm.resolveTeamMember(token);
      if (member) { targetName = member.name; targetNameAr = member.nameAr || member.name; }
      break;
    }
  }
  if (!targetNumber) {
    // Try resolving the whole string as a display name
    const num = tm.getWhatsAppNumber(task.assigned_to);
    if (!num) return { success: false, error: `No WhatsApp number for: ${task.assigned_to}` };
    targetNumber = num;
  }

  const dueEn = task.due_date ? `\n📅 Due: ${task.due_date}` : "";
  const dueAr = task.due_date ? `\n📅 موعد الاستحقاق: ${task.due_date}` : "";
  const topicEn = task.topic_name ? `\n📍 Topic: ${task.topic_name}` : "";
  const topicAr = task.topic_name ? `\n📍 الموضوع: ${task.topic_name}` : "";
  const byEn = assignedBy ? ` (assigned by ${assignedBy})` : "";
  const byAr = assignedBy ? ` (من ${assignedBy})` : "";

  const body = [
    `📋 *New Task Assigned — Monthly Key*`,
    ``,
    `Hi ${targetName}! You have a new task:`,
    ``,
    `📌 #${task.id}: ${task.title}${byEn}${dueEn}${topicEn}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 *مهمة جديدة — Monthly Key*`,
    ``,
    `مرحباً ${targetNameAr}! لديك مهمة جديدة:`,
    ``,
    `📌 #${task.id}: ${task.title}${byAr}${dueAr}${topicAr}`,
    ``,
    `— Monthly Key Bot`,
  ].join("\n");

  return sendMessage(targetNumber, body);
}

/**
 * Send a critical alert to the CEO via WhatsApp.
 * Used for overdue tasks, escalations, urgent blockers.
 * Message is bilingual: English first, then Arabic after a divider.
 *
 * @param {string} alertType - Type of alert (e.g., "overdue", "escalation", "blocker")
 * @param {Array<{id, title, assigned_to, hoursOld}>} tasks - Array of task objects
 */
async function sendCriticalAlert(alertType, tasks) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  const icons = { overdue: "🔴", escalation: "🚨", blocker: "⛔", urgent: "⚠️" };
  const icon = icons[alertType] || "📢";

  const typeLabels = {
    escalation: { en: "ESCALATION — Unresolved Blockers", ar: "تصعيد — عوائق لم تُحل" },
    overdue:    { en: "OVERDUE TASKS", ar: "مهام متأخرة" },
    blocker:    { en: "CRITICAL BLOCKER", ar: "عائق حرج" },
    urgent:     { en: "URGENT ALERT", ar: "تنبيه عاجل" },
  };
  const label = typeLabels[alertType] || { en: alertType.toUpperCase(), ar: alertType };

  // Support legacy string-details call (backwards compat)
  if (typeof tasks === "string") {
    const body = [
      `${icon} *Monthly Key — ${label.en}*`,
      ``,
      tasks,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${icon} *Monthly Key — ${label.ar}*`,
      ``,
      tasks,
      ``,
      `— Monthly Key Bot`,
    ].join("\n");
    return sendToCeo(body);
  }

  // Build bilingual task list
  const enLines = [];
  const arLines = [];

  for (const t of tasks) {
    const assignee = resolveAssignee(t.assigned_to);
    const ageEn = t.hoursOld ? `${t.hoursOld}h old` : "";
    const ageAr = t.hoursOld ? `منذ ${t.hoursOld} ساعة` : "";
    const assigneeEn = assignee.en ? ` — ${assignee.en}` : "";
    const assigneeAr = assignee.ar ? ` — ${assignee.ar}` : "";

    enLines.push(`🔴 #${t.id}: ${t.title}`);
    if (ageEn || assigneeEn) enLines.push(`   ⏰ ${ageEn}${assigneeEn}`);
    enLines.push(``);

    arLines.push(`🔴 #${t.id}: ${t.title}`);
    if (ageAr || assigneeAr) arLines.push(`   ⏰ ${ageAr}${assigneeAr}`);
    arLines.push(``);
  }

  const body = [
    `${icon} *Monthly Key — ${label.en}*`,
    `${tasks.length} item(s) need immediate attention:`,
    ``,
    ...enLines,
    `⚠️ Please review and take action.`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${icon} *Monthly Key — ${label.ar}*`,
    `${tasks.length} بند/بنود تحتاج اهتمام فوري:`,
    ``,
    ...arLines,
    `⚠️ يرجى المراجعة واتخاذ الإجراء اللازم.`,
    ``,
    `— Monthly Key Bot`,
  ].join("\n");

  return sendToCeo(body);
}

/**
 * Send a daily summary via WhatsApp (9 PM KSA).
 * Bilingual: English + Arabic.
 * @param {object} summary - Summary data
 */
async function sendDailySummary(summary) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  const enLines = [
    `📊 *Daily Summary — Monthly Key*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];
  const arLines = [
    `📊 *الملخص اليومي — Monthly Key*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  if (summary.completedToday !== undefined) {
    enLines.push(`✅ Completed today: ${summary.completedToday}`);
    arLines.push(`✅ مكتملة اليوم: ${summary.completedToday}`);
  }
  if (summary.pendingTasks !== undefined) {
    enLines.push(`⏳ Pending tasks: ${summary.pendingTasks}`);
    arLines.push(`⏳ مهام معلقة: ${summary.pendingTasks}`);
  }
  if (summary.overdueTasks !== undefined) {
    enLines.push(`🔴 Overdue: ${summary.overdueTasks}`);
    arLines.push(`🔴 متأخرة: ${summary.overdueTasks}`);
  }
  if (summary.upcomingAppointments !== undefined) {
    enLines.push(`📅 Upcoming appointments: ${summary.upcomingAppointments}`);
    arLines.push(`📅 مواعيد قادمة: ${summary.upcomingAppointments}`);
  }
  if (summary.upcomingMeetings !== undefined) {
    enLines.push(`📅 Upcoming meetings: ${summary.upcomingMeetings}`);
    arLines.push(`📅 اجتماعات قادمة: ${summary.upcomingMeetings}`);
  }

  const body = [
    ...enLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    ...arLines,
    ``,
    `— Monthly Key Bot`,
  ].join("\n");

  return sendToCeo(body);
}

/**
 * Send an appointment/meeting reminder via WhatsApp.
 * Bilingual: English + Arabic.
 * @param {object} event - The appointment or meeting object
 * @param {string} type - "appointment" or "meeting"
 * @param {string} timeLabel - e.g., "1 hour" or "15 minutes"
 */
async function sendEventReminder(event, type, timeLabel) {
  if (!isConfigured()) return { success: false, error: "Not configured" };

  const title = event.title || "Untitled";
  const location = event.location || "";
  const isAppt = type === "appointment";

  const timeLabelAr = timeLabel === "1 hour" ? "ساعة واحدة"
    : timeLabel === "15 minutes" ? "15 دقيقة"
    : timeLabel;

  const body = [
    `⏰ *${isAppt ? "Appointment" : "Meeting"} Reminder — Monthly Key*`,
    ``,
    `📌 ${title}`,
    `🕐 In ${timeLabel}`,
    location ? `📍 ${location}` : null,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `⏰ *تذكير ${isAppt ? "موعد" : "اجتماع"} — Monthly Key*`,
    ``,
    `📌 ${title}`,
    `🕐 خلال ${timeLabelAr}`,
    location ? `📍 ${location}` : null,
    ``,
    `— Monthly Key Bot`,
  ].filter(l => l !== null).join("\n");

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
  const tm = getTeamMembers();
  const members = tm ? tm.getTeamWhatsAppNumbers() : [];
  return {
    configured: isConfigured(),
    accountSid: TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 8)}...` : "Not set",
    whatsappNumber: TWILIO_WHATSAPP_NUMBER || "Not set",
    ceoNumber: WHATSAPP_CEO_NUMBER || "Not set",
    teamMembers: members.map(m => ({ name: m.name, role: m.role, whatsapp: m.whatsapp })),
  };
}

module.exports = {
  isConfigured,
  sendMessage,
  sendToCeo,
  sendToMember,
  sendToAll,
  sendTaskAssignment,
  sendCriticalAlert,
  sendDailySummary,
  sendEventReminder,
  forwardToWhatsApp,
  getStatus,
  WHATSAPP_CEO_NUMBER,
};
