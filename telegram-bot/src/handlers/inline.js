/**
 * Inline Query Handler for Monthly Key Telegram Bot
 * Allows users to search and share properties in any Telegram chat
 * Usage: @MonthlyKeyBot <city or keyword>
 */
const config = require("../config");
const api = require("../services/api");
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
        // Show default results — featured properties or city suggestions
        results = getDefaultInlineResults();
      } else {
        // Search for properties
        results = await searchInlineResults(query);
      }

      await ctx.answerInlineQuery(results, {
        cache_time: 60, // Cache for 60 seconds
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
}

/**
 * Get default inline results (city suggestions)
 */
function getDefaultInlineResults() {
  const results = [];

  // Add city suggestions
  for (const city of config.serviceAreas) {
    const statusEmoji = city.status === "active" ? "✅" : "🔜";
    const statusText = city.status === "active" ? "Available" : "Coming Soon";

    results.push({
      type: "article",
      id: `city_${city.id}`,
      title: `${statusEmoji} ${city.name_en} — ${city.name_ar}`,
      description: `${statusText} | ${city.districts.length} districts | Search properties in ${city.name_en}`,
      input_message_content: {
        message_text: [
          `🔑 *Monthly Key — ${city.name_en} (${city.name_ar})*`,
          ``,
          `${statusEmoji} ${statusText}`,
          `📍 ${city.districts.length} districts available`,
          ``,
          `🏠 Browse properties: ${config.websiteUrl}/search?city=${city.id}`,
          `📱 Open Mini App: ${config.webappUrl}`,
        ].join("\n"),
        parse_mode: "Markdown",
      },
      thumb_url: "https://monthlykey.com/favicon.ico",
    });
  }

  // Add general platform info
  results.push({
    type: "article",
    id: "about_monthlykey",
    title: "🔑 About Monthly Key — المفتاح الشهري",
    description: "Monthly rental platform in Saudi Arabia",
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
        ``,
        `🌐 Website: ${config.websiteUrl}`,
        `📱 Mini App: ${config.webappUrl}`,
      ].join("\n"),
      parse_mode: "Markdown",
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
    filters.query = query;
  }

  filters.limit = 20; // Telegram allows up to 50 inline results

  try {
    const searchResult = await api.searchProperties(filters);
    const properties = searchResult?.items || searchResult || [];

    if (properties && properties.length > 0) {
      for (const property of properties.slice(0, 20)) {
        const title = property.titleEn || property.titleAr;
        const titleAr = property.titleAr || property.titleEn;
        const city = property.city || "";
        const cityAr = property.cityAr || "";
        const district = property.district || "";
        const districtAr = property.districtAr || "";
        const rent = Number(property.monthlyRent || 0).toLocaleString();
        const type = config.propertyTypes[property.propertyType];
        const typeName = type ? `${type.en} (${type.ar})` : property.propertyType;
        const photo = api.getPropertyPhoto(property);

        const messageText = [
          `🏠 *${title}*`,
          titleAr !== title ? `${titleAr}` : "",
          ``,
          `📍 ${city}${district ? ` — ${district}` : ""}`,
          cityAr !== city ? `📍 ${cityAr}${districtAr ? ` — ${districtAr}` : ""}` : "",
          `🏷️ ${typeName}`,
          `💰 ${rent} SAR/month (${rent} ر.س/شهرياً)`,
          property.bedrooms ? `🛏️ ${property.bedrooms} Bedrooms` : "",
          property.bathrooms ? `🚿 ${property.bathrooms} Bathrooms` : "",
          property.sizeSqm ? `📐 ${property.sizeSqm} sqm` : "",
          ``,
          `🔗 View: ${config.websiteUrl}/property/${property.id}`,
          `🔑 Monthly Key — المفتاح الشهري`,
        ]
          .filter(Boolean)
          .join("\n");

        if (photo) {
          // Use photo result type for properties with images
          results.push({
            type: "photo",
            id: `prop_${property.id}`,
            photo_url: photo,
            thumb_url: photo,
            photo_width: 800,
            photo_height: 600,
            title: `${title} — ${rent} SAR/mo`,
            description: `📍 ${city}${district ? ` — ${district}` : ""} | ${typeName}`,
            caption: messageText,
            parse_mode: "Markdown",
          });
        } else {
          // Use article type for properties without images
          results.push({
            type: "article",
            id: `prop_${property.id}`,
            title: `🏠 ${title} — ${rent} SAR/mo`,
            description: `📍 ${city}${district ? ` — ${district}` : ""} | ${typeName} | ${property.bedrooms || "?"} BR`,
            input_message_content: {
              message_text: messageText,
              parse_mode: "Markdown",
            },
            thumb_url: "https://monthlykey.com/favicon.ico",
          });
        }
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
          ``,
          `🌐 ${config.websiteUrl}`,
          `📱 ${config.webappUrl}`,
        ].join("\n"),
        parse_mode: "Markdown",
      },
    });
  }

  return results;
}

module.exports = { registerInlineHandler };
