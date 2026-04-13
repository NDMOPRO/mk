/**
 * Translation Command Handler — Monthly Key Operations HQ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * /translate — Reply to any message to get a translation.
 *              Detects language automatically and translates to the other.
 *              Works on text, photo captions, and forwarded messages.
 */

const { translateOnDemand } = require("../services/translation");
const log = require("../utils/logger");

/**
 * Handle /translate command.
 * Must be used as a reply to another message.
 */
async function handleTranslate(ctx) {
  const threadId = ctx.message?.message_thread_id;
  const replyOpts = { parse_mode: "Markdown", ...(threadId ? { message_thread_id: threadId } : {}) };

  // Must be a reply
  const replied = ctx.message?.reply_to_message;
  if (!replied) {
    return ctx.reply(
      "💡 *Reply to a message with /translate to translate it.*\n\n━━━━━━━━━━━━━━━━━━━━\n\n💡 *قم بالرد على رسالة باستخدام /translate لترجمتها.*",
      replyOpts
    );
  }

  // Extract text from the replied message
  let text = replied.text || replied.caption || "";

  // For forwarded messages, try to get the text
  if (!text && replied.forward_date) {
    text = replied.text || replied.caption || "";
  }

  if (!text || !text.trim()) {
    return ctx.reply(
      "❌ *No text found in that message to translate.*\n\n━━━━━━━━━━━━━━━━━━━━\n\n❌ *لم يتم العثور على نص في تلك الرسالة للترجمة.*",
      replyOpts
    );
  }

  // Show typing indicator
  try { await ctx.sendChatAction("typing"); } catch (e) {}

  const result = await translateOnDemand(text);

  if (!result) {
    return ctx.reply(
      "❌ *Translation failed. Please try again.*\n\n━━━━━━━━━━━━━━━━━━━━\n\n❌ *فشلت الترجمة. يرجى المحاولة مرة أخرى.*",
      replyOpts
    );
  }

  // Reply to the original message with the translation
  return ctx.reply(
    `🔄 "${result.translation}"`,
    {
      ...replyOpts,
      reply_to_message_id: replied.message_id,
    }
  );
}

module.exports = {
  handleTranslate,
};
