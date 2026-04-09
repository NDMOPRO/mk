/**
 * Enhanced Inline Query Handler for Monthly Key Telegram Bot
 * Phase 3: Rich property cards with images, price, location
 *
 * Usage: @monthlykey_bot <city or keyword> in any chat
 * - Search properties by typing @monthlykey_bot in any chat
 * - See rich property cards with images, price, location
 * - Share property details with friends directly in any conversation
 * - Include "Open in App" button on shared cards
 */
const { Markup } = require("telegraf");
const config = require("../config");
const api = require("../services/api");
const db = require("../services/database");
const { matchCity } = require("./commands");

/**
 * Register inline query handler
 */
function registerInlineHandler(bot) {
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim();

    try {
      let results = [];

      if (!query) {
        // Show default results — featured properties + city suggestions
        results = await getDefaultInlineResults();
      } else {
        // Search for properties
        results = await searchInlineResults(query);
      }

      await ctx.answerInlineQuery(results, {
        cache_time: 30,
        is_personal: true,
        switch_pm_text: "🔑 Open Monthly Key Bot",
        switch_pm_parameter: "inline",
      });
    } catch (error) {
      console.error("[Inline] Error:", error.message);
      await ctx.answerInlineQuery([], {
        cache_time: 5,
        switch_pm_text: "🔑 Open Monthly Key Bot",
        switch_pm_parameter: "inline",
      });
    }
  });

  // Handle chosen inline result (for analytics)
  bot.on("chosen_inline_result", (ctx) => {
    const resultId = ctx.chosenInlineResult.result_id;
    const userId = ctx.from.id;
    console.log(`[Inline] User ${userId} shared result: ${resultId}`);
  });
}

/**
 * Get default inline results — featured properties + city suggestions
 */
async function getDefaultInlineResults() {
  const results = [];

  // Try to fetch featured properties first
  try {
    const featured = await api.getFeaturedProperties();
    const properties = featured?.items || featured || [];

    if (properties && properties.length > 0) {
      for (const property of properties.slice(0, 10)) {
        const card = buildPropertyCard(property);
        if (card) results.push(card);
      }
    }
  } catch (e) {
    console.error("[Inline Default] Error fetching featured:", e.message);
  }

  // Add city suggestions
  for (const city of config.serviceAreas) {
    const statusEmoji = city.status === "active" ? "✅" : "🔜";
    const statusText = city.status === "active" ? "Available" : "Coming Soon";
    const statusTextAr = city.status === "active" ? "متاح" : "قريباً";

    results.push({
      type: "article",
      id: `city_${city.id}`,
      title: `${statusEmoji} ${city.name_en} — ${city.name_ar}`,
      description: `${statusText} | ${city.districts.length} districts | Search properties in ${city.name_en}`,
      input_message_content: {
        message_text: [
          `🔑 *Monthly Key — المفتاح الشهري*`,
          ``,
          `🏙️ *${city.name_en} — ${city.name_ar}*`,
          `${statusEmoji} ${statusText} | ${statusTextAr}`,
          `📍 ${city.districts.length} districts available`,
          ``,
          `🏠 Browse properties in ${city.name_en}:`,
          `🌐 ${config.websiteUrl}/search?city=${city.id}`,
        ].join("\n"),
        parse_mode: "Markdown",
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📱 Open in App | فتح التطبيق",
              url: config.webappUrl,
            },
          ],
          [
            {
              text: `🔍 Search ${city.name_en}`,
              url: `${config.websiteUrl}/search?city=${city.id}`,
            },
          ],
        ],
      },
      thumb_url: "https://monthlykey.com/favicon.ico",
    });
  }

  // Add general platform info
  results.push({
    type: "article",
    id: "about_monthlykey",
    title: "🔑 About Monthly Key — المفتاح الشهري",
    description: "Monthly rental platform in Saudi Arabia | منصة الإيجار الشهري",
    input_message_content: {
      message_text: [
        `🔑 *Monthly Key — المفتاح الشهري*`,
        ``,
        `The trusted monthly rental platform in Saudi Arabia.`,
        `منصة الإيجار الشهري الموثوقة في المملكة العربية السعودية.`,
        ``,
        `🏠 Verified properties with transparent pricing`,
        `📍 Currently serving Riyadh — Jeddah & Madinah coming soon`,
        `💰 No commission fees for tenants`,
        `🌐 Available in: AR, EN, FR, UR, HI`,
      ].join("\n"),
      parse_mode: "Markdown",
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📱 Open App | فتح التطبيق",
            url: config.webappUrl,
          },
        ],
        [
          {
            text: "🌐 Website | الموقع",
            url: config.websiteUrl,
          },
        ],
        [
          {
            text: "🤖 Start Bot | بدء البوت",
            url: "https://t.me/monthlykey_bot?start=inline",
          },
        ],
      ],
    },
    thumb_url: "https://monthlykey.com/favicon.ico",
  });

  return results;
}

/**
 * Search and format properties for inline results
 */
async function searchInlineResults(query) {
  const results = [];

  // Try to match a city
  const cityMatch = matchCity(query);
  const filters = {};

  if (cityMatch) {
    filters.city = cityMatch.name_en;
  } else {
    // Parse price range queries like "riyadh 3000-8000"
    const priceMatch = query.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (priceMatch) {
      filters.minPrice = parseInt(priceMatch[1], 10);
      filters.maxPrice = parseInt(priceMatch[2], 10);
      // Remove price from query for city matching
      const remaining = query.replace(priceMatch[0], "").trim();
      const remainingCity = matchCity(remaining);
      if (remainingCity) {
        filters.city = remainingCity.name_en;
      } else if (remaining) {
        filters.query = remaining;
      }
    } else {
      // Check for property type keywords
      const typeKeywords = {
        apartment: ["apartment", "شقة", "شقق", "apt"],
        villa: ["villa", "فيلا", "فلل"],
        studio: ["studio", "استوديو", "ستوديو"],
        duplex: ["duplex", "دوبلكس"],
        furnished_room: ["room", "غرفة", "غرف"],
        compound: ["compound", "كمباوند"],
        hotel_apartment: ["hotel", "فندقية", "فندق"],
      };

      const lowerQuery = query.toLowerCase();
      for (const [typeKey, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some((k) => lowerQuery.includes(k))) {
          filters.propertyType = typeKey;
          break;
        }
      }

      filters.query = query;
    }
  }

  filters.limit = 20;

  try {
    const searchResult = await api.searchProperties(filters);
    const properties = searchResult?.items || searchResult || [];

    if (properties && properties.length > 0) {
      for (const property of properties.slice(0, 20)) {
        const card = buildPropertyCard(property);
        if (card) results.push(card);
      }
    }
  } catch (error) {
    console.error("[Inline Search] Error:", error.message);
  }

  // If no property results, add a "no results" item
  if (results.length === 0) {
    results.push({
      type: "article",
      id: "no_results",
      title: `🔍 No results for "${query}"`,
      description: "Try a different search term or browse on our website",
      input_message_content: {
        message_text: [
          `🔍 *Searching for "${query}" on Monthly Key*`,
          ``,
          `No properties found for this search.`,
          `Try browsing all available properties:`,
        ].join("\n"),
        parse_mode: "Markdown",
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📱 Browse in App",
              url: config.webappUrl,
            },
          ],
          [
            {
              text: "🌐 Browse on Website",
              url: config.websiteUrl,
            },
          ],
        ],
      },
    });
  }

  return results;
}

/**
 * Build a rich property card for inline results
 * Returns a Telegram InlineQueryResult object
 */
function buildPropertyCard(property) {
  if (!property) return null;

  const titleEn = property.titleEn || property.titleAr || "Property";
  const titleAr = property.titleAr || property.titleEn || "عقار";
  const cityEn = property.city || "";
  const cityAr = property.cityAr || "";
  const districtEn = property.district || "";
  const districtAr = property.districtAr || "";
  const rent = Number(property.monthlyRent || 0).toLocaleString();
  const type = config.propertyTypes[property.propertyType];
  const typeEn = type ? type.en : property.propertyType || "";
  const typeAr = type ? type.ar : "";
  const furnished = config.furnishedLevels[property.furnishedLevel];
  const furnishedEn = furnished ? furnished.en : "";
  const photo = api.getPropertyPhoto(property);

  // Build rich bilingual message
  const messageText = [
    `🏠 *${titleEn}*`,
    titleAr !== titleEn ? `${titleAr}` : "",
    ``,
    `📍 ${cityEn}${districtEn ? ` — ${districtEn}` : ""}`,
    cityAr && cityAr !== cityEn ? `📍 ${cityAr}${districtAr ? ` — ${districtAr}` : ""}` : "",
    ``,
    `💰 *${rent} SAR/month* (${rent} ر.س/شهرياً)`,
    ``,
    typeEn ? `🏷️ ${typeEn}${furnishedEn ? ` | ${furnishedEn}` : ""}` : "",
    property.bedrooms ? `🛏️ ${property.bedrooms} Bedrooms` : "",
    property.bathrooms ? `🚿 ${property.bathrooms} Bathrooms` : "",
    property.sizeSqm ? `📐 ${property.sizeSqm} sqm` : "",
    ``,
    `🔑 Monthly Key — المفتاح الشهري`,
  ]
    .filter(Boolean)
    .join("\n");

  // Inline keyboard with "Open in App" button
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "📱 Open in App | فتح في التطبيق",
          url: `${config.webappUrl}/property/${property.id}`,
        },
      ],
      [
        {
          text: "🌐 View on Website | عرض على الموقع",
          url: `${config.websiteUrl}/property/${property.id}`,
        },
      ],
      [
        {
          text: "📋 Book Now | احجز الآن",
          url: `https://t.me/monthlykey_bot?start=book_${property.id}`,
        },
      ],
    ],
  };

  if (photo) {
    // Rich photo card
    return {
      type: "photo",
      id: `prop_${property.id}`,
      photo_url: photo,
      thumb_url: photo,
      photo_width: 800,
      photo_height: 600,
      title: `${titleEn} — ${rent} SAR/mo`,
      description: `📍 ${cityEn}${districtEn ? ` — ${districtEn}` : ""} | ${typeEn} | ${property.bedrooms || "?"} BR`,
      caption: messageText,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    };
  }

  // Article card (no photo)
  return {
    type: "article",
    id: `prop_${property.id}`,
    title: `🏠 ${titleEn} — ${rent} SAR/mo`,
    description: `📍 ${cityEn}${districtEn ? ` — ${districtEn}` : ""} | ${typeEn} | ${property.bedrooms || "?"} BR | 💰 ${rent} SAR`,
    input_message_content: {
      message_text: messageText,
      parse_mode: "Markdown",
    },
    reply_markup: replyMarkup,
    thumb_url: "https://monthlykey.com/favicon.ico",
  };
}

module.exports = { registerInlineHandler };
