/**
 * Command Handlers for Monthly Key Telegram Bot
 * Phase 1-3: Updated with multi-language support
 */
const { Markup } = require("telegraf");
const config = require("../config");
const { t, supportedLanguages, detectLanguage } = require("../i18n");
const db = require("../services/database");
const api = require("../services/api");

/**
 * Register user and detect language from Telegram settings
 */
function registerUser(ctx) {
  const user = ctx.from;
  const langCode = user.language_code || "ar";
  const lang = detectLanguage(langCode);

  db.upsertUser(ctx.chat.id, {
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    language: lang,
  });

  return lang;
}

/**
 * Get main menu keyboard
 * The "Open App" button uses Telegram's web_app KeyboardButton type
 * so it launches the Mini App directly instead of sending text.
 */
function getMainKeyboard(lang) {
  return Markup.keyboard([
    [t(lang, "btnSearch"), t(lang, "btnFeatured")],
    [
      // web_app button — opens Mini App directly in Telegram
      { text: t(lang, "btnOpenApp"), web_app: { url: config.webappUrl } },
      t(lang, "btnWebsite"),
    ],
    [t(lang, "btnHelp"), t(lang, "btnLanguage")],
  ]).resize();
}

/**
 * /start command handler
 */
async function handleStart(ctx) {
  const lang = registerUser(ctx);

  // Check for deep link parameters
  const startPayload = ctx.message?.text?.split(" ")[1];
  if (startPayload) {
    // Handle deep links from inline sharing
    if (startPayload.startsWith("property_")) {
      const propertyId = startPayload.replace("property_", "");
      // Show property details
      try {
        const property = await api.getPropertyById(propertyId);
        if (property) {
          const formatted = api.formatProperty(property, lang);
          if (formatted) {
            const buttons = Markup.inlineKeyboard([
              [
                Markup.button.url(
                  t(lang, "viewOnWebsite"),
                  `${config.websiteUrl}/property/${property.id}`
                ),
              ],
              [
                Markup.button.callback(
                  lang === "ar" ? "📋 حجز هذا العقار" : "📋 Book This Property",
                  `booking_property_${property.id}`
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
                return;
              } catch (e) {}
            }

            await ctx.reply(formatted.text, {
              parse_mode: "Markdown",
              ...buttons,
            });
            return;
          }
        }
      } catch (e) {
        console.error("[Start DeepLink] Error:", e.message);
      }
    }

    // Handle book deep link
    if (startPayload.startsWith("book_")) {
      const propertyId = startPayload.replace("book_", "");
      ctx.message.text = `/book ${propertyId}`;
      // The booking handler will pick this up
    }
  }

  const inlineButtons = Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, "btnSearch"), "action_search"),
      Markup.button.callback(t(lang, "btnFeatured"), "action_featured"),
    ],
    [
      Markup.button.webApp(t(lang, "btnOpenApp"), config.webappUrl),
      Markup.button.url(t(lang, "btnWebsite"), config.websiteUrl),
    ],
    [
      Markup.button.callback(t(lang, "btnNotifications"), "action_notifications"),
      Markup.button.callback(t(lang, "btnHelp"), "action_help"),
    ],
  ]);

  await ctx.reply(t(lang, "welcome"), {
    parse_mode: "Markdown",
    ...inlineButtons,
  });
}

/**
 * /help command handler
 */
async function handleHelp(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || registerUser(ctx);

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
}

/**
 * /search command handler
 */
async function handleSearch(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || registerUser(ctx);

  // Extract query only when called from a real /search command (not a keyboard button press)
  // A keyboard button press has ctx.message.text equal to the button label (no leading slash)
  const rawText = ctx.message?.text || "";
  const isCommand = rawText.startsWith("/search");
  const query = isCommand ? rawText.replace(/^\/search\s*/, "").trim() : "";

  if (query) {
    // Direct search with query: /search riyadh
    return performSearch(ctx, query, lang);
  }

  // Show city selection keyboard
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
}

/**
 * /language command handler — Phase 3: Now supports 5 languages
 */
async function handleLanguage(ctx) {
  const langButtons = supportedLanguages.map((lang) => [
    Markup.button.callback(`${lang.flag} ${lang.name}`, `lang_${lang.code}`),
  ]);

  const buttons = Markup.inlineKeyboard(langButtons);

  await ctx.reply(t("en", "chooseLanguage"), {
    ...buttons,
  });
}

/**
 * /notifications command handler
 */
async function handleNotifications(ctx) {
  const lang = db.getUserLanguage(ctx.chat.id) || registerUser(ctx);
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
}

/**
 * Perform a property search and display results
 */
async function performSearch(ctx, query, lang) {
  // Send "searching" message
  const searchingMsg = await ctx.reply(t(lang, "searching"));

  try {
    // Try to match city names
    const cityMatch = matchCity(query);
    const filters = {};

    if (cityMatch) {
      filters.city = cityMatch.name_en;
    } else {
      filters.query = query;
    }

    filters.limit = 5;

    const result = await api.searchProperties(filters);
    const properties = result?.items || result || [];

    // Delete "searching" message
    try {
      await ctx.deleteMessage(searchingMsg.message_id);
    } catch (e) {
      // Ignore if can't delete
    }

    if (!properties || properties.length === 0) {
      const noResultButtons = Markup.inlineKeyboard([
        [Markup.button.callback(t(lang, "btnSearch"), "action_search")],
        [Markup.button.webApp(t(lang, "btnOpenApp"), config.webappUrl)],
      ]);

      return ctx.reply(t(lang, "noResults"), {
        parse_mode: "Markdown",
        ...noResultButtons,
      });
    }

    // Send results header
    await ctx.reply(
      `${t(lang, "searchResults")} (${properties.length})`,
      { parse_mode: "Markdown" }
    );

    // Send each property
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
        [
          Markup.button.callback(
            lang === "ar" ? "📋 حجز هذا العقار" : "📋 Book This Property",
            `booking_property_${property.id}`
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
        } catch (e) {
          // Fall back to text if photo fails
        }
      }

      await ctx.reply(formatted.text, {
        parse_mode: "Markdown",
        disable_web_page_preview: false,
        ...buttons,
      });
    }

    // Show "more results" button
    if (properties.length >= 5) {
      const moreButtons = Markup.inlineKeyboard([
        [
          Markup.button.webApp(
            lang === "ar" ? "📱 عرض المزيد في التطبيق" : "📱 View More in App",
            config.webappUrl
          ),
        ],
        [
          Markup.button.url(
            lang === "ar" ? "🌐 عرض الكل على الموقع" : "🌐 View All on Website",
            `${config.websiteUrl}/search${cityMatch ? `?city=${cityMatch.id}` : ""}`
          ),
        ],
      ]);

      await ctx.reply(
        lang === "ar"
          ? "👆 هذه أبرز النتائج. للمزيد:"
          : "👆 These are the top results. For more:",
        { ...moreButtons }
      );
    }
  } catch (error) {
    console.error("[Search] Error:", error.message);
    try {
      await ctx.deleteMessage(searchingMsg.message_id);
    } catch (e) {}
    await ctx.reply(t(lang, "error"));
  }
}

/**
 * Match a query to a city
 */
function matchCity(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  for (const city of config.serviceAreas) {
    if (
      q === city.id ||
      q === city.name_en.toLowerCase() ||
      q === city.name_ar ||
      q.includes(city.name_en.toLowerCase()) ||
      q.includes(city.name_ar)
    ) {
      return city;
    }
  }

  // Fuzzy match for common variations (including French, Urdu, Hindi)
  const aliases = {
    riyadh: ["riyad", "riad", "ryad", "الرياض", "riyad", "ریاض", "रियाद"],
    jeddah: ["jeddah", "jedda", "jidda", "jida", "جدة", "جده", "djeddah", "جدہ", "जेद्दा"],
    madinah: ["madinah", "medina", "madina", "المدينة", "المدينه", "medine", "مدینہ", "मदीना"],
  };

  for (const [cityId, names] of Object.entries(aliases)) {
    if (names.some((n) => q.includes(n))) {
      return config.serviceAreas.find((c) => c.id === cityId);
    }
  }

  return null;
}

module.exports = {
  handleStart,
  handleHelp,
  handleSearch,
  handleLanguage,
  handleNotifications,
  performSearch,
  matchCity,
  registerUser,
  getMainKeyboard,
};
