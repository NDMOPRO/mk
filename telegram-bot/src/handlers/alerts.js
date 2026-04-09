/**
 * Property Alert Handlers for Monthly Key Telegram Bot
 * Implements alert subscription system:
 *   - /alerts — View active alert subscriptions
 *   - /subscribe — Create a new alert subscription (city, price range, type)
 *   - /unsubscribe — Remove alert subscriptions
 *
 * Users get notified when new properties matching their criteria are listed.
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t } = require("../i18n");
const db = require("../services/database");
const api = require("../services/api");

/**
 * /alerts command handler — Show user's active alerts
 */
async function handleAlerts(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";
  const alerts = db.getUserAlerts(ctx.chat.id);

  if (!alerts || alerts.length === 0) {
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === "ar" ? "🔔 اشتراك جديد" : "🔔 New Subscription",
        "alert_subscribe_start"
      )],
    ]);

    return ctx.reply(t(lang, "alertsEmpty"), {
      parse_mode: "Markdown",
      ...buttons,
    });
  }

  let message = t(lang, "alertsListHeader") + "\n";

  for (const alert of alerts) {
    message += formatAlertDisplay(alert, lang);
    message += "\n";
  }

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(
      lang === "ar" ? "🔔 اشتراك جديد" : "🔔 New Subscription",
      "alert_subscribe_start"
    )],
    [Markup.button.callback(
      t(lang, "alertDeleteAllBtn"),
      "alert_delete_all"
    )],
  ]);

  await ctx.reply(message, {
    parse_mode: "Markdown",
    ...buttons,
  });
}

/**
 * /subscribe command handler — Start subscription flow
 */
async function handleSubscribe(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";

  // Check if there's inline parameters: /subscribe riyadh 3000-8000
  const text = ctx.message.text;
  const params = text.replace(/^\/subscribe\s*/, "").trim();

  if (params) {
    return handleQuickSubscribe(ctx, params, lang);
  }

  // Show city selection
  await showSubscribeCitySelection(ctx, lang);
}

/**
 * Handle quick subscribe with inline parameters
 * Format: /subscribe [city] [min-max]
 */
async function handleQuickSubscribe(ctx, params, lang) {
  const parts = params.split(/\s+/);
  const filters = {};

  for (const part of parts) {
    // Check if it's a price range (e.g., 3000-8000)
    const priceMatch = part.match(/^(\d+)-(\d+)$/);
    if (priceMatch) {
      filters.minPrice = parseInt(priceMatch[1]);
      filters.maxPrice = parseInt(priceMatch[2]);
      continue;
    }

    // Check if it's a city name
    const cityMatch = matchCityForAlert(part);
    if (cityMatch) {
      filters.city = cityMatch;
      continue;
    }
  }

  if (Object.keys(filters).length === 0) {
    // No valid parameters, show interactive flow
    return showSubscribeCitySelection(ctx, lang);
  }

  // Create the subscription
  const alertId = db.createAlertSubscription(ctx.chat.id, filters);

  const successMsg = buildSubscriptionConfirmation(filters, alertId, lang);
  await ctx.reply(successMsg, { parse_mode: "Markdown" });
}

/**
 * /unsubscribe command handler
 */
async function handleUnsubscribe(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";
  const alerts = db.getUserAlerts(ctx.chat.id);

  if (!alerts || alerts.length === 0) {
    return ctx.reply(t(lang, "alertsEmpty"), { parse_mode: "Markdown" });
  }

  // Show list of alerts with delete buttons
  let message = t(lang, "unsubscribePrompt") + "\n\n";

  const buttons = [];

  for (const alert of alerts) {
    const label = formatAlertLabel(alert, lang);
    buttons.push([
      Markup.button.callback(
        `🗑️ ${label}`,
        `alert_delete_${alert.id}`
      ),
    ]);
  }

  buttons.push([
    Markup.button.callback(
      t(lang, "alertDeleteAllBtn"),
      "alert_delete_all"
    ),
  ]);

  await ctx.reply(message, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons),
  });
}

/**
 * Show city selection for subscription
 */
async function showSubscribeCitySelection(ctx, lang) {
  const cityButtons = [
    [Markup.button.callback(
      lang === "ar" ? "🏙️ الرياض" : "🏙️ Riyadh",
      "alert_city_Riyadh"
    )],
    [Markup.button.callback(
      lang === "ar" ? "🏙️ جدة" : "🏙️ Jeddah",
      "alert_city_Jeddah"
    )],
    [Markup.button.callback(
      lang === "ar" ? "🏙️ المدينة المنورة" : "🏙️ Madinah",
      "alert_city_Madinah"
    )],
    [Markup.button.callback(
      t(lang, "subscribeAllCities"),
      "alert_city_all"
    )],
  ];

  await ctx.reply(t(lang, "subscribeStart"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(cityButtons),
  });
}

/**
 * Register alert-related callback handlers
 */
function registerAlertCallbacks(bot) {
  // ─── Start Subscribe Flow ──────────────────────────────────

  bot.action("alert_subscribe_start", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";
    await showSubscribeCitySelection(ctx, lang);
  });

  // ─── City Selection ─────────────────────────────────────────

  bot.action(/^alert_city_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const city = ctx.match[1];
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    // Initialize session for alert subscription
    if (!ctx.session) ctx.session = {};
    ctx.session.alertSubscription = {
      city: city === "all" ? null : city,
      step: "price",
    };

    await ctx.reply(t(lang, "subscribePricePrompt"), {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true },
    });
  });

  // ─── Property Type Selection ────────────────────────────────

  bot.action(/^alert_type_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const type = ctx.match[1];
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    if (!ctx.session?.alertSubscription) {
      return ctx.reply(t(lang, "error"));
    }

    ctx.session.alertSubscription.propertyType = type === "all" ? null : type;

    // Complete the subscription
    const filters = {
      city: ctx.session.alertSubscription.city,
      minPrice: ctx.session.alertSubscription.minPrice,
      maxPrice: ctx.session.alertSubscription.maxPrice,
      propertyType: ctx.session.alertSubscription.propertyType,
    };

    const alertId = db.createAlertSubscription(ctx.chat.id, filters);

    // Clear session
    ctx.session.alertSubscription = null;

    const successMsg = buildSubscriptionConfirmation(filters, alertId, lang);
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === "ar" ? "🔔 عرض تنبيهاتي" : "🔔 View My Alerts",
        "action_alerts"
      )],
    ]);

    await ctx.reply(successMsg, {
      parse_mode: "Markdown",
      ...buttons,
    });
  });

  // ─── Delete Single Alert ────────────────────────────────────

  bot.action(/^alert_delete_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const alertId = parseInt(ctx.match[1]);
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    const alert = db.getAlertById(alertId);
    if (!alert || alert.chat_id !== ctx.chat.id) {
      return ctx.reply(t(lang, "error"));
    }

    db.deactivateAlert(alertId);
    await ctx.reply(t(lang, "alertDeleted"));
  });

  // ─── Delete All Alerts ──────────────────────────────────────

  bot.action("alert_delete_all", async (ctx) => {
    await ctx.answerCbQuery();
    const lang = db.getUserLanguage(ctx.chat.id) || "ar";

    db.deactivateAllUserAlerts(ctx.chat.id);
    await ctx.reply(t(lang, "alertAllDeleted"));
  });

  // ─── View Alerts callback ──────────────────────────────────

  bot.action("action_alerts", async (ctx) => {
    await ctx.answerCbQuery();
    await handleAlerts(ctx);
  });
}

/**
 * Handle alert subscription text input (price range)
 * Returns true if the message was handled
 */
function handleAlertTextInput(ctx) {
  if (!ctx.session?.alertSubscription) return false;

  const sub = ctx.session.alertSubscription;
  const lang = db.getUserLanguage(ctx.chat.id) || "ar";
  const text = ctx.message.text.trim().toLowerCase();

  if (sub.step === "price") {
    return handlePriceInput(ctx, text, lang);
  }

  return false;
}

/**
 * Handle price range input
 */
async function handlePriceInput(ctx, text, lang) {
  if (text === "skip" || text === "تخطي") {
    // Skip price filter
    ctx.session.alertSubscription.minPrice = null;
    ctx.session.alertSubscription.maxPrice = null;
  } else {
    // Parse price range: min-max
    const priceMatch = text.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (!priceMatch) {
      await ctx.reply(t(lang, "subscribeInvalidPrice"));
      return true;
    }

    const minPrice = parseInt(priceMatch[1]);
    const maxPrice = parseInt(priceMatch[2]);

    if (minPrice >= maxPrice) {
      await ctx.reply(t(lang, "subscribeInvalidPrice"));
      return true;
    }

    ctx.session.alertSubscription.minPrice = minPrice;
    ctx.session.alertSubscription.maxPrice = maxPrice;
  }

  // Move to property type selection
  ctx.session.alertSubscription.step = "type";

  const typeButtons = [
    [Markup.button.callback(t(lang, "subscribeAllTypes"), "alert_type_all")],
  ];

  // Add property type buttons
  for (const [key, val] of Object.entries(config.propertyTypes)) {
    typeButtons.push([
      Markup.button.callback(
        lang === "ar" ? val.ar : val.en,
        `alert_type_${key}`
      ),
    ]);
  }

  await ctx.reply(t(lang, "subscribeTypePrompt"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(typeButtons),
  });

  return true;
}

/**
 * Match city name for alerts (more flexible matching)
 */
function matchCityForAlert(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  for (const city of config.serviceAreas) {
    if (
      q === city.id ||
      q === city.name_en.toLowerCase() ||
      q === city.name_ar
    ) {
      return city.name_en;
    }
  }

  // Aliases
  const aliases = {
    Riyadh: ["riyad", "riad", "ryad", "الرياض"],
    Jeddah: ["jeddah", "jedda", "jidda", "jida", "جدة", "جده"],
    Madinah: ["madinah", "medina", "madina", "المدينة", "المدينه"],
  };

  for (const [cityName, names] of Object.entries(aliases)) {
    if (names.some((n) => q.includes(n))) {
      return cityName;
    }
  }

  return null;
}

/**
 * Format an alert for display
 */
function formatAlertDisplay(alert, lang) {
  const isAr = lang === "ar";
  const lines = [];

  lines.push(`━━━━━━━━━━━━━━━`);
  lines.push(`🔔 *#${alert.id}*`);

  // City
  const cityDisplay = alert.city || t(lang, "alertAny");
  lines.push(`${t(lang, "alertCity")}: ${cityDisplay}`);

  // Price range
  if (alert.min_price || alert.max_price) {
    const min = alert.min_price ? Number(alert.min_price).toLocaleString() : "0";
    const max = alert.max_price ? Number(alert.max_price).toLocaleString() : "∞";
    lines.push(`${t(lang, "alertPriceRange")}: ${min} - ${max} ${t(lang, "sar")}`);
  } else {
    lines.push(`${t(lang, "alertPriceRange")}: ${t(lang, "alertAny")}`);
  }

  // Property type
  if (alert.property_type) {
    const typeInfo = config.propertyTypes[alert.property_type];
    const typeName = typeInfo ? (isAr ? typeInfo.ar : typeInfo.en) : alert.property_type;
    lines.push(`${t(lang, "alertPropertyType")}: ${typeName}`);
  }

  // Bedrooms
  if (alert.bedrooms) {
    lines.push(`${t(lang, "alertBedrooms")}: ${alert.bedrooms}`);
  }

  return lines.join("\n");
}

/**
 * Format a short alert label for buttons
 */
function formatAlertLabel(alert, lang) {
  const parts = [];
  if (alert.city) parts.push(alert.city);
  if (alert.min_price || alert.max_price) {
    const min = alert.min_price || 0;
    const max = alert.max_price || "∞";
    parts.push(`${min}-${max}`);
  }
  if (alert.property_type) {
    const typeInfo = config.propertyTypes[alert.property_type];
    parts.push(typeInfo ? (lang === "ar" ? typeInfo.ar : typeInfo.en) : alert.property_type);
  }
  return parts.length > 0 ? parts.join(" | ") : `#${alert.id}`;
}

/**
 * Build subscription confirmation message
 */
function buildSubscriptionConfirmation(filters, alertId, lang) {
  const isAr = lang === "ar";
  let msg = t(lang, "subscribeSuccess") + "\n\n";

  msg += `🔔 ${isAr ? "تنبيه" : "Alert"} *#${alertId}*\n`;

  if (filters.city) {
    msg += `${t(lang, "alertCity")}: ${filters.city}\n`;
  } else {
    msg += `${t(lang, "alertCity")}: ${t(lang, "alertAny")}\n`;
  }

  if (filters.minPrice || filters.maxPrice) {
    const min = filters.minPrice ? Number(filters.minPrice).toLocaleString() : "0";
    const max = filters.maxPrice ? Number(filters.maxPrice).toLocaleString() : "∞";
    msg += `${t(lang, "alertPriceRange")}: ${min} - ${max} ${t(lang, "sar")}\n`;
  }

  if (filters.propertyType) {
    const typeInfo = config.propertyTypes[filters.propertyType];
    const typeName = typeInfo ? (isAr ? typeInfo.ar : typeInfo.en) : filters.propertyType;
    msg += `${t(lang, "alertPropertyType")}: ${typeName}\n`;
  }

  return msg;
}

/**
 * Send alert notifications for a new property to all matching subscribers
 * Called when a new property is detected
 */
async function notifyMatchingAlerts(bot, property) {
  try {
    const matchingAlerts = db.getMatchingAlerts(property);

    if (!matchingAlerts || matchingAlerts.length === 0) return 0;

    // Group alerts by chat_id to avoid duplicate notifications
    const chatIds = [...new Set(matchingAlerts.map((a) => a.chat_id))];
    let sent = 0;

    for (const chatId of chatIds) {
      const user = db.getUser(chatId);
      if (!user || !user.is_active) continue;

      const isAr = user.language === "ar";
      const title = isAr ? (property.titleAr || property.titleEn) : (property.titleEn || property.titleAr);
      const city = isAr ? (property.cityAr || property.city) : (property.city || property.cityAr);
      const rent = Number(property.monthlyRent || 0).toLocaleString();

      const message = isAr
        ? `🔔 *تنبيه عقار جديد!*\n\nعقار جديد يطابق تنبيهاتك:\n\n🏠 *${title}*\n📍 ${city}\n💰 ${rent} ر.س/شهرياً\n\n🔗 [عرض التفاصيل](${config.websiteUrl}/property/${property.id})`
        : `🔔 *New Property Alert!*\n\nA new property matches your alerts:\n\n🏠 *${title}*\n📍 ${city}\n💰 ${rent} SAR/month\n\n🔗 [View Details](${config.websiteUrl}/property/${property.id})`;

      try {
        await bot.telegram.sendMessage(chatId, message, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: isAr ? "📋 حجز هذا العقار" : "📋 Book This Property",
                  callback_data: `book_prop_${property.id}`,
                },
              ],
              [
                {
                  text: isAr ? "🌐 عرض على الموقع" : "🌐 View on Website",
                  url: `${config.websiteUrl}/property/${property.id}`,
                },
              ],
            ],
          },
        });
        db.logNotification(chatId, "alert_match", message, "sent");
        sent++;
      } catch (error) {
        console.error(`[Alerts] Failed to notify ${chatId}:`, error.message);
        if (error.code === 403 || error.description?.includes("blocked")) {
          db.deactivateUser(chatId);
        }
        db.logNotification(chatId, "alert_match", message, "failed");
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    return sent;
  } catch (error) {
    console.error("[Alerts] Error notifying matching alerts:", error.message);
    return 0;
  }
}

module.exports = {
  handleAlerts,
  handleSubscribe,
  handleUnsubscribe,
  registerAlertCallbacks,
  handleAlertTextInput,
  notifyMatchingAlerts,
};
