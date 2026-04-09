/**
 * Monthly Key Telegram Bot — Main Entry Point
 * Built for Monthly Key (المفتاح الشهري)
 */
const { Telegraf, session } = require("telegraf");
const config = require("./config");
const db = require("./services/database");
const ai = require("./services/ai");
const { 
  handleStart, 
  handleHelp, 
  handleSearch, 
  handleLanguage, 
  handleNotifications,
  registerUser,
  getMainKeyboard
} = require("./handlers/commands");
const { registerCallbacks } = require("./handlers/callbacks");
const { registerInlineHandler } = require("./handlers/inline");
const { t } = require("./i18n");

// Initialize Bot
const bot = new Telegraf(config.botToken);

// Middleware
bot.use(session());

// Initialize Database
db.getDb();

// ─── Command Handlers ────────────────────────────────────────

bot.start(handleStart);
bot.help(handleHelp);
bot.command("search", handleSearch);
bot.command("language", handleLanguage);
bot.command("notifications", handleNotifications);

// ─── Text Message Handler (AI Chatbot) ───────────────────────

bot.on("text", async (ctx) => {
  // Ignore commands
  if (ctx.message.text.startsWith("/")) return;

  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;
  const lang = db.getUserLanguage(chatId) || registerUser(ctx);

  // Show typing status
  await ctx.sendChatAction("typing");

  try {
    // Check if it's a direct search request (e.g. "search for apartments in Riyadh")
    const searchKeywords = ["search", "find", "بحث", "دور", "عقار", "شقة", "فيلا"];
    const isSearchRequest = searchKeywords.some(k => userMessage.toLowerCase().includes(k));
    
    // If it looks like a search, but not too long, maybe offer search
    // Otherwise, let AI handle it as a general query
    
    const aiResponse = await ai.getAiResponse(chatId, userMessage);
    
    await ctx.reply(aiResponse, {
      parse_mode: "Markdown",
      ...getMainKeyboard(lang)
    });
  } catch (error) {
    console.error("[Bot] Error in text handler:", error);
    await ctx.reply(t(lang, "error"));
  }
});

// ─── Inline Search & Callbacks ───────────────────────────────

registerCallbacks(bot);
registerInlineHandler(bot);

// ─── Set Bot Menu & Commands ─────────────────────────────────

async function setupBot() {
  try {
    // Set Bot Commands
    await bot.telegram.setMyCommands([
      { command: "start", description: "Start the bot | بدء المحادثة" },
      { command: "search", description: "Search properties | البحث عن عقارات" },
      { command: "notifications", description: "Notification settings | إعدادات الإشعارات" },
      { command: "language", description: "Change language | تغيير اللغة" },
      { command: "help", description: "Show help | المساعدة" },
    ]);

    // Set Menu Button to open Mini App
    // The Mini App is served from tg.monthlykey.com by the same Railway backend
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Monthly Key 🔑",
        web_app: { url: config.webappUrl }
      }
    });

    console.log("[Bot] Commands and Menu Button configured");
    console.log(`[Bot] Mini App URL: ${config.webappUrl}`);
  } catch (error) {
    console.error("[Bot] Error setting up commands/menu:", error.message);
  }
}

// ─── Start Bot ───────────────────────────────────────────────

setupBot();

bot.launch()
  .then(() => {
    console.log("-------------------------------------------");
    console.log("🚀 Monthly Key Telegram Bot is RUNNING");
    console.log(`🤖 Bot Username: @${bot.botInfo?.username || 'Bot'}`);
    console.log("-------------------------------------------");
  })
  .catch((err) => {
    console.error("❌ Failed to launch bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
