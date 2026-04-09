/**
 * Callback Query Handlers for Monthly Key Telegram Bot
 * Handles inline button presses
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t } = require("../i18n");
const db = require("../services/database");
const api = require("../services/api");
const { performSearch, handleNotifications } = require("./commands");

/**
 * Register all callback query handlers
 */
function registerCallbacks(bot) {
  // ─── Action Callbacks ──────────────────────────────────────

  bot.action("action_search", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, "btnRiyadh"), "search_city_riyadh")],
      [Markup.button.callback(t(lang, "btnJeddah"), "search_city_jeddah")],
      [Markup.button.callback(t(lang, "btnMadinah"), "search_city_madinah")],
      [
        Markup.button.callback(
          lang === "ar" ? "🔍 بحث حر" : "🔍 Free Search",
          "search_free"
        ),
      ],
    ]);

    await ctx.reply(t(lang, "searchPrompt"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  bot.action("action_featured", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const searchingMsg = await ctx.reply(t(lang, "searching"));

    try {
      const properties = await api.getFeaturedProperties();

      try {
        await ctx.deleteMessage(searchingMsg.message_id);
      } catch (e) {}

      if (!properties || properties.length === 0) {
        return ctx.reply(t(lang, "noResults"));
      }

      await ctx.reply(
        lang === "ar"
          ? `⭐ *العقارات المميزة* (${properties.length})`
          : `⭐ *Featured Properties* (${properties.length})`,
        { parse_mode: "Markdown" }
      );

      for (const property of properties.slice(0, 5)) {
        const formatted = api.formatProperty(property, lang);
        if (!formatted) continue;

        const buttons = Markup.inlineKeyboard([
          [
            Markup.button.url(
              t(lang, "viewOnWebsite"),
              `${config.websiteUrl}/property/${property.id}`
            ),
          ],
        ]);

        if (formatted.photo) {
          try {
            await ctx.replyWithPhoto(formatted.photo, {
              caption: formatted.text,
              parse_mode: "Markdown",
              ...buttons,
            });
            continue;
          } catch (e) {}
        }

        await ctx.reply(formatted.text, {
          parse_mode: "Markdown",
          ...buttons,
        });
      }
    } catch (error) {
      console.error("[Featured] Error:", error.message);
      try {
        await ctx.deleteMessage(searchingMsg.message_id);
      } catch (e) {}
      await ctx.reply(t(lang, "error"));
    }
  });

  bot.action("action_help", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(t(lang, "btnSearch"), "action_search"),
        Markup.button.webApp(t(lang, "btnOpenApp"), config.webappUrl),
      ],
      [Markup.button.url(t(lang, "btnWebsite"), config.websiteUrl)],
    ]);

    await ctx.reply(t(lang, "help"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  bot.action("action_notifications", async (ctx) => {
    await ctx.answerCbQuery();
    // Reuse the notifications handler
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    const user = db.getUser(ctx.chat.id);

    const newPropStatus = user?.notify_new_properties
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");
    const priceDropStatus = user?.notify_price_drops
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");
    const bookingStatus = user?.notify_bookings
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${t(lang, "notifNewProperties")} ${newPropStatus}`,
          "notif_toggle_new_properties"
        ),
      ],
      [
        Markup.button.callback(
          `${t(lang, "notifPriceDrops")} ${priceDropStatus}`,
          "notif_toggle_price_drops"
        ),
      ],
      [
        Markup.button.callback(
          `${t(lang, "notifBookings")} ${bookingStatus}`,
          "notif_toggle_bookings"
        ),
      ],
    ]);

    await ctx.reply(t(lang, "notifSettings"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // ─── Search City Callbacks ─────────────────────────────────

  bot.action("search_city_riyadh", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    db.setUserCity(ctx.chat.id, "Riyadh");
    await performSearch(ctx, "Riyadh", lang);
  });

  bot.action("search_city_jeddah", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await ctx.reply(
      lang === "ar"
        ? "🏙️ جدة قادمة قريباً! حالياً نخدم الرياض فقط."
        : "🏙️ Jeddah is coming soon! Currently we serve Riyadh only."
    );
  });

  bot.action("search_city_madinah", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await ctx.reply(
      lang === "ar"
        ? "🏙️ المدينة المنورة قادمة قريباً! حالياً نخدم الرياض فقط."
        : "🏙️ Madinah is coming soon! Currently we serve Riyadh only."
    );
  });

  bot.action("search_free", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await ctx.reply(
      lang === "ar"
        ? "🔍 اكتب كلمة البحث (مثال: شقة مفروشة، استوديو، فيلا):"
        : "🔍 Type your search query (e.g., furnished apartment, studio, villa):",
      { reply_markup: { force_reply: true } }
    );
  });

  // ─── Language Callbacks ────────────────────────────────────

  bot.action("lang_ar", async (ctx) => {
    await ctx.answerCbQuery();
    db.setUserLanguage(ctx.chat.id, "ar");
    await ctx.reply(t("ar", "languageChanged"));

    // Show welcome again with new language
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(t("ar", "btnSearch"), "action_search"),
        Markup.button.callback(t("ar", "btnFeatured"), "action_featured"),
      ],
      [
        Markup.button.webApp(t("ar", "btnOpenApp"), config.webappUrl),
        Markup.button.url(t("ar", "btnWebsite"), config.websiteUrl),
      ],
    ]);

    await ctx.reply(t("ar", "welcome"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  bot.action("lang_en", async (ctx) => {
    await ctx.answerCbQuery();
    db.setUserLanguage(ctx.chat.id, "en");
    await ctx.reply(t("en", "languageChanged"));

    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback(t("en", "btnSearch"), "action_search"),
        Markup.button.callback(t("en", "btnFeatured"), "action_featured"),
      ],
      [
        Markup.button.webApp(t("en", "btnOpenApp"), config.webappUrl),
        Markup.button.url(t("en", "btnWebsite"), config.websiteUrl),
      ],
    ]);

    await ctx.reply(t("en", "welcome"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // ─── Notification Toggle Callbacks ─────────────────────────

  bot.action(/^notif_toggle_(.+)$/, async (ctx) => {
    const type = ctx.match[1];
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    const user = db.getUser(ctx.chat.id);

    if (!user) {
      await ctx.answerCbQuery();
      return;
    }

    const column = {
      new_properties: "notify_new_properties",
      price_drops: "notify_price_drops",
      bookings: "notify_bookings",
    }[type];

    if (!column) {
      await ctx.answerCbQuery();
      return;
    }

    const currentValue = user[column];
    const newValue = currentValue ? 0 : 1;
    db.updateNotificationPreference(ctx.chat.id, type, newValue);

    await ctx.answerCbQuery(t(lang, "notifUpdated"));

    // Refresh the notification settings display
    const updatedUser = db.getUser(ctx.chat.id);
    const newPropStatus = updatedUser?.notify_new_properties
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");
    const priceDropStatus = updatedUser?.notify_price_drops
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");
    const bookingStatus = updatedUser?.notify_bookings
      ? t(lang, "notifEnabled")
      : t(lang, "notifDisabled");

    try {
      await ctx.editMessageText(t(lang, "notifSettings"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${t(lang, "notifNewProperties")} ${newPropStatus}`,
                callback_data: "notif_toggle_new_properties",
              },
            ],
            [
              {
                text: `${t(lang, "notifPriceDrops")} ${priceDropStatus}`,
                callback_data: "notif_toggle_price_drops",
              },
            ],
            [
              {
                text: `${t(lang, "notifBookings")} ${bookingStatus}`,
                callback_data: "notif_toggle_bookings",
              },
            ],
          ],
        },
      });
    } catch (e) {
      // Message might not be editable
    }
  });
}

module.exports = { registerCallbacks };
