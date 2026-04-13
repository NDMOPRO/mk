/**
 * WhatsApp Integration Handlers
 * ─────────────────────────────────────────────────────────────
 * Handles /whatsapp command and incoming WhatsApp webhook messages.
 * All responses are bilingual (English + Arabic).
 *
 * Commands:
 *   /whatsapp send +966XXXXXXXXX "Message text"
 *   /whatsapp status
 *   /whatsapp notify on|off
 */

const whatsapp = require("../services/whatsapp");
const opsDb = require("../services/ops-database");
const log = require("../utils/logger");

const OPS_GROUP_ID = -1003967447285;
const ADMIN_PANEL_THREAD = 235;
const DIV = "━━━━━━━━━━━━━━━━━━━━";

// ─── Utility Functions ──────────────────────────────────────

function getBilingualText(en, ar) {
  return `${en}\n${DIV}\n${ar}`;
}

function extractCommandArgs(text, command) {
  if (!text) return "";
  const re = new RegExp(`^\\/(?:${command})(?:@\\S+)?\\s*`, "i");
  return text.replace(re, "").trim();
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

// ─── Track reply context: WhatsApp number → last incoming message info ──
// Used to enable "reply from Telegram → send back via WhatsApp"
const replyContext = new Map();

/**
 * Store reply context when a WhatsApp message is forwarded to Telegram.
 * @param {number} telegramMessageId - The Telegram message ID of the forwarded message
 * @param {string} whatsappNumber - The sender's WhatsApp number
 * @param {string} senderName - The sender's name/number for display
 */
function setReplyContext(telegramMessageId, whatsappNumber, senderName) {
  replyContext.set(telegramMessageId, { whatsappNumber, senderName, timestamp: Date.now() });
  // Clean old entries (older than 24 hours)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, val] of replyContext.entries()) {
    if (val.timestamp < cutoff) replyContext.delete(key);
  }
}

/**
 * Get reply context for a Telegram message.
 */
function getReplyContext(telegramMessageId) {
  return replyContext.get(telegramMessageId) || null;
}

// ═══════════════════════════════════════════════════════════════
// ═══ /whatsapp Command Handler ══════════════════════════════
// ═══════════════════════════════════════════════════════════════

async function handleWhatsApp(ctx) {
  const threadId = ctx.message?.message_thread_id || null;
  const chatId = ctx.chat.id;

  try {
    const text = ctx.message.text || "";
    const args = extractCommandArgs(text, "whatsapp");

    if (!args) {
      return showWhatsAppHelp(ctx, threadId);
    }

    // Parse subcommand
    const parts = args.split(/\s+/);
    const subcommand = parts[0].toLowerCase();

    switch (subcommand) {
      case "send":
        return handleWhatsAppSend(ctx, args.substring(5).trim(), threadId);
      case "status":
        return handleWhatsAppStatus(ctx, threadId);
      case "notify":
        return handleWhatsAppNotify(ctx, parts[1], threadId, chatId);
      default:
        return showWhatsAppHelp(ctx, threadId);
    }
  } catch (e) {
    log.error("WhatsApp", "Command error", { error: e.message });
    const en = `❌ *Error:* \`${e.message}\``;
    const ar = `❌ *خطأ:* \`${e.message}\``;
    await ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId }).catch(() => {});
  }
}

/**
 * Show help for /whatsapp command
 */
async function showWhatsAppHelp(ctx, threadId) {
  const en = [
    "📱 *WhatsApp Integration*",
    "",
    "Commands:",
    '`/whatsapp send +966XXXXXXXXX "Message text"`',
    "`/whatsapp status` — Show integration status",
    "`/whatsapp notify on` — Enable WhatsApp notifications",
    "`/whatsapp notify off` — Disable WhatsApp notifications",
    "",
    "Features:",
    "  • Critical alerts forwarded to WhatsApp",
    "  • Daily summary at 9 PM KSA",
    "  • Appointment/meeting reminders",
    "  • Two-way messaging (reply from Telegram)",
  ].join("\n");

  const ar = [
    "📱 *تكامل واتساب*",
    "",
    "الأوامر:",
    '`/whatsapp send +966XXXXXXXXX "نص الرسالة"`',
    "`/whatsapp status` — عرض حالة التكامل",
    "`/whatsapp notify on` — تفعيل إشعارات واتساب",
    "`/whatsapp notify off` — إيقاف إشعارات واتساب",
    "",
    "المميزات:",
    "  • إعادة توجيه التنبيهات الحرجة إلى واتساب",
    "  • ملخص يومي الساعة 9 مساءً بتوقيت السعودية",
    "  • تذكيرات المواعيد والاجتماعات",
    "  • مراسلة ثنائية الاتجاه (الرد من تيليجرام)",
  ].join("\n");

  return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

/**
 * /whatsapp send +966XXXXXXXXX "Message text"
 */
async function handleWhatsAppSend(ctx, args, threadId) {
  if (!whatsapp.isConfigured()) {
    const en = "❌ *WhatsApp not configured.*\n\nPlease set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_NUMBER` in Railway environment variables.";
    const ar = "❌ *واتساب غير مهيأ.*\n\nيرجى تعيين `TWILIO_ACCOUNT_SID` و `TWILIO_AUTH_TOKEN` و `TWILIO_WHATSAPP_NUMBER` في متغيرات بيئة Railway.";
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  // Parse: +966XXXXXXXXX "Message text" or +966XXXXXXXXX Message text
  const sendMatch = args.match(/^(\+?\d[\d\s-]+)\s+"?([^"]+)"?\s*$/);
  if (!sendMatch) {
    const en = '❌ *Invalid format.*\n\nUsage: `/whatsapp send +966XXXXXXXXX "Your message"`';
    const ar = '❌ *صيغة غير صالحة.*\n\nالاستخدام: `/whatsapp send +966XXXXXXXXX "رسالتك"`';
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const phoneNumber = sendMatch[1].replace(/[\s-]/g, "").trim();
  const messageText = sendMatch[2].trim();

  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  await ctx.reply(`📤 Sending WhatsApp message to ${phoneNumber}...`, { message_thread_id: threadId });

  const result = await whatsapp.sendMessage(phoneNumber, messageText);

  if (result.success) {
    const en = [
      `✅ *WhatsApp Message Sent*`,
      "",
      `📱 *To:* ${phoneNumber}`,
      `💬 *Message:* ${escMd(messageText.substring(0, 100))}${messageText.length > 100 ? "..." : ""}`,
      `👤 *Sent by:* ${user}`,
    ].join("\n");
    const ar = [
      `✅ *تم إرسال رسالة واتساب*`,
      "",
      `📱 *إلى:* ${phoneNumber}`,
      `💬 *الرسالة:* ${escMd(messageText.substring(0, 100))}${messageText.length > 100 ? "..." : ""}`,
      `👤 *أرسلها:* ${user}`,
    ].join("\n");
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } else {
    const en = `❌ *Failed to send:* ${escMd(result.error)}`;
    const ar = `❌ *فشل الإرسال:* ${escMd(result.error)}`;
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }
}

/**
 * /whatsapp status
 */
async function handleWhatsAppStatus(ctx, threadId) {
  const status = whatsapp.getStatus();
  const chatId = ctx.chat.id;

  let notifyStatus = "On";
  try {
    const config = opsDb.getWhatsAppConfig(chatId);
    if (config && config.notifications_on === 0) notifyStatus = "Off";
  } catch (e) {}

  const statusIcon = status.configured ? "🟢" : "🔴";
  const en = [
    `📱 *WhatsApp Integration Status*`,
    "",
    `${statusIcon} *Status:* ${status.configured ? "Connected" : "Not Configured"}`,
    `🔑 *Account SID:* ${status.accountSid}`,
    `📞 *WhatsApp Number:* ${status.whatsappNumber}`,
    `👤 *CEO Number:* ${status.ceoNumber}`,
    `🔔 *Notifications:* ${notifyStatus}`,
    "",
    status.configured
      ? "✅ All WhatsApp features are active."
      : "⚠️ Set Twilio env vars in Railway to enable WhatsApp features.",
  ].join("\n");

  const ar = [
    `📱 *حالة تكامل واتساب*`,
    "",
    `${statusIcon} *الحالة:* ${status.configured ? "متصل" : "غير مهيأ"}`,
    `🔑 *معرف الحساب:* ${status.accountSid}`,
    `📞 *رقم واتساب:* ${status.whatsappNumber}`,
    `👤 *رقم الرئيس التنفيذي:* ${status.ceoNumber}`,
    `🔔 *الإشعارات:* ${notifyStatus === "On" ? "مفعّلة" : "متوقفة"}`,
    "",
    status.configured
      ? "✅ جميع ميزات واتساب نشطة."
      : "⚠️ قم بتعيين متغيرات Twilio في Railway لتفعيل ميزات واتساب.",
  ].join("\n");

  return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
}

/**
 * /whatsapp notify on|off
 */
async function handleWhatsAppNotify(ctx, toggle, threadId, chatId) {
  if (!toggle || !["on", "off"].includes(toggle.toLowerCase())) {
    const en = "❌ Usage: `/whatsapp notify on` or `/whatsapp notify off`";
    const ar = "❌ الاستخدام: `/whatsapp notify on` أو `/whatsapp notify off`";
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }

  const enabled = toggle.toLowerCase() === "on";
  opsDb.setWhatsAppNotifications(chatId, enabled);

  if (enabled) {
    const en = "🔔 *WhatsApp notifications enabled.*\n\nYou will receive:\n  • Critical alerts\n  • Daily summary at 9 PM\n  • Appointment/meeting reminders";
    const ar = "🔔 *تم تفعيل إشعارات واتساب.*\n\nستتلقى:\n  • التنبيهات الحرجة\n  • الملخص اليومي الساعة 9 مساءً\n  • تذكيرات المواعيد والاجتماعات";
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  } else {
    const en = "🔕 *WhatsApp notifications disabled.*\n\nYou can re-enable with `/whatsapp notify on`";
    const ar = "🔕 *تم إيقاف إشعارات واتساب.*\n\nيمكنك إعادة التفعيل بـ `/whatsapp notify on`";
    return ctx.reply(getBilingualText(en, ar), { parse_mode: "Markdown", message_thread_id: threadId });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ Incoming WhatsApp Webhook Handler (Express) ════════════
// ═══════════════════════════════════════════════════════════════

/**
 * Create Express routes for Twilio WhatsApp webhook.
 * @param {Express.Router} app - Express app or router
 * @param {Telegraf} bot - Telegraf bot instance
 */
function registerWhatsAppWebhook(app, bot) {
  // POST /whatsapp/webhook — receives incoming WhatsApp messages from Twilio
  app.post("/whatsapp/webhook", async (req, res) => {
    // Respond to Twilio immediately
    res.set("Content-Type", "text/xml");
    res.status(200).send("<Response></Response>");

    try {
      const body = req.body || {};
      const from = body.From || "";       // e.g., "whatsapp:+966535080045"
      const msgBody = body.Body || "";
      const profileName = body.ProfileName || "";
      const numMedia = parseInt(body.NumMedia || "0");

      if (!from || !msgBody) return;

      // Clean the phone number
      const phoneNumber = from.replace("whatsapp:", "");
      const displayName = profileName || phoneNumber;

      log.info("WhatsApp", `Incoming message from ${displayName} (${phoneNumber}): ${msgBody.substring(0, 50)}`);

      // Forward to Admin Panel topic (thread 235) in Telegram
      const en = [
        `📱 *Incoming WhatsApp Message*`,
        "",
        `👤 *From:* ${displayName}`,
        `📞 *Number:* ${phoneNumber}`,
        `💬 *Message:*`,
        msgBody,
        numMedia > 0 ? `\n📎 ${numMedia} attachment(s)` : null,
        "",
        `_Reply to this message to respond via WhatsApp_`,
      ].filter(Boolean).join("\n");

      const ar = [
        `📱 *رسالة واتساب واردة*`,
        "",
        `👤 *من:* ${displayName}`,
        `📞 *الرقم:* ${phoneNumber}`,
        `💬 *الرسالة:*`,
        msgBody,
        numMedia > 0 ? `\n📎 ${numMedia} مرفق(ات)` : null,
        "",
        `_قم بالرد على هذه الرسالة للرد عبر واتساب_`,
      ].filter(Boolean).join("\n");

      const fullMsg = `${en}\n${DIV}\n${ar}`;

      const sentMsg = await bot.telegram.sendMessage(OPS_GROUP_ID, fullMsg, {
        parse_mode: "Markdown",
        message_thread_id: ADMIN_PANEL_THREAD,
      });

      // Store reply context so replies to this message go back to WhatsApp
      if (sentMsg && sentMsg.message_id) {
        setReplyContext(sentMsg.message_id, phoneNumber, displayName);
      }
    } catch (error) {
      log.error("WhatsApp", "Webhook processing error", { error: error.message });
    }
  });

  log.info("WhatsApp", "Webhook endpoint registered: POST /whatsapp/webhook");
}

/**
 * Handle Telegram replies to forwarded WhatsApp messages.
 * Called from the text handler when a reply is detected in the admin topic.
 * @param {Context} ctx - Telegraf context
 * @returns {boolean} true if handled, false otherwise
 */
async function handleTelegramReplyToWhatsApp(ctx) {
  const replyTo = ctx.message?.reply_to_message;
  if (!replyTo) return false;

  const context = getReplyContext(replyTo.message_id);
  if (!context) return false;

  const replyText = ctx.message.text || "";
  if (!replyText) return false;

  const user = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const fullMessage = `${replyText}\n\n— ${user} via Monthly Key`;

  const result = await whatsapp.forwardToWhatsApp(context.whatsappNumber, fullMessage);

  if (result.success) {
    await ctx.reply(`✅ Reply sent to ${context.senderName} via WhatsApp\n${DIV}\n✅ تم إرسال الرد إلى ${context.senderName} عبر واتساب`, {
      parse_mode: "Markdown",
      message_thread_id: ADMIN_PANEL_THREAD,
    }).catch(() => {});
  } else {
    await ctx.reply(`❌ Failed to send WhatsApp reply: ${result.error}\n${DIV}\n❌ فشل إرسال رد واتساب: ${result.error}`, {
      message_thread_id: ADMIN_PANEL_THREAD,
    }).catch(() => {});
  }

  return true;
}

module.exports = {
  handleWhatsApp,
  registerWhatsAppWebhook,
  handleTelegramReplyToWhatsApp,
  setReplyContext,
  getReplyContext,
};
