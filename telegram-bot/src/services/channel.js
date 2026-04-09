/**
 * Channel Auto-Posting Service for Monthly Key Telegram Bot
 * Phase 3: Automatically post new property listings to a Telegram channel
 *
 * - Periodically checks for new properties via the tRPC API
 * - Formats listings with images, price, location, details
 * - Posts to configured CHANNEL_ID
 * - Includes "View in App" button linking to tg.monthlykey.com
 * - Tracks posted property IDs in SQLite to avoid duplicates
 */
const { Markup } = require("telegraf");
const config = require("../config");
const api = require("./api");
const db = require("./database");

let pollingInterval = null;
let botInstance = null;

/**
 * Initialize the channel auto-posting service
 */
function initChannelPosting(bot) {
  botInstance = bot;

  if (!config.channelId) {
    console.log("[Channel] No CHANNEL_ID configured. Channel auto-posting disabled.");
    return;
  }

  console.log(`[Channel] Auto-posting enabled for channel: ${config.channelId}`);
  console.log(`[Channel] Check interval: ${config.channelCheckInterval / 1000}s`);

  // Start periodic check
  pollingInterval = setInterval(checkForNewProperties, config.channelCheckInterval);

  // Run first check after a short delay (let bot fully initialize)
  setTimeout(checkForNewProperties, 10000);
}

/**
 * Stop the channel posting service
 */
function stopChannelPosting() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Channel] Auto-posting stopped.");
  }
}

/**
 * Check for new properties and post them to the channel
 */
async function checkForNewProperties() {
  if (!botInstance || !config.channelId) return;

  try {
    // Fetch latest properties from API
    const result = await api.searchProperties({ limit: 10, offset: 0 });
    const properties = result?.items || result || [];

    if (!properties || properties.length === 0) {
      return;
    }

    // Get already-posted property IDs
    const postedIds = db.getPostedPropertyIds();

    // Filter new properties
    const newProperties = properties.filter(
      (p) => p.id && !postedIds.includes(String(p.id))
    );

    if (newProperties.length === 0) {
      return;
    }

    console.log(`[Channel] Found ${newProperties.length} new properties to post.`);

    // Post each new property (with rate limiting)
    for (const property of newProperties) {
      try {
        await postPropertyToChannel(property);
        db.markPropertyAsPosted(String(property.id));
        // Rate limit: wait 2 seconds between posts
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[Channel] Error posting property ${property.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[Channel] Error checking for new properties:", error.message);
  }
}

/**
 * Format and post a single property to the channel
 */
async function postPropertyToChannel(property) {
  if (!botInstance || !config.channelId) return;

  const titleEn = property.titleEn || property.titleAr || "New Property";
  const titleAr = property.titleAr || property.titleEn || "عقار جديد";
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
  const furnishedAr = furnished ? furnished.ar : "";
  const photo = api.getPropertyPhoto(property);

  // Build bilingual message (Arabic + English)
  const caption = [
    `🏠 *${titleAr}*`,
    titleEn !== titleAr ? `${titleEn}` : "",
    ``,
    `📍 ${cityAr}${districtAr ? ` — ${districtAr}` : ""}`,
    cityEn !== cityAr ? `📍 ${cityEn}${districtEn ? ` — ${districtEn}` : ""}` : "",
    ``,
    `💰 ${rent} ر.س / شهرياً`,
    `💰 ${rent} SAR / month`,
    ``,
    typeAr ? `🏷️ ${typeAr}${furnishedAr ? ` | ${furnishedAr}` : ""}` : "",
    typeEn ? `🏷️ ${typeEn}${furnishedEn ? ` | ${furnishedEn}` : ""}` : "",
    property.bedrooms ? `🛏️ ${property.bedrooms} Bedrooms / غرف نوم` : "",
    property.bathrooms ? `🚿 ${property.bathrooms} Bathrooms / حمامات` : "",
    property.sizeSqm ? `📐 ${property.sizeSqm} sqm / م²` : "",
    ``,
    `🔑 المفتاح الشهري — Monthly Key`,
  ]
    .filter(Boolean)
    .join("\n");

  // Buttons: View in App + View on Website
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.webApp(
        "📱 View in App | عرض في التطبيق",
        `${config.webappUrl}/property/${property.id}`
      ),
    ],
    [
      Markup.button.url(
        "🌐 Website | الموقع",
        `${config.websiteUrl}/property/${property.id}`
      ),
    ],
    [
      Markup.button.url(
        "🤖 Bot | البوت",
        `https://t.me/monthlykey_bot?start=property_${property.id}`
      ),
    ],
  ]);

  // Post with photo if available
  if (photo) {
    try {
      await botInstance.telegram.sendPhoto(config.channelId, photo, {
        caption,
        parse_mode: "Markdown",
        ...buttons,
      });
      console.log(`[Channel] Posted property ${property.id} with photo.`);
      return;
    } catch (e) {
      console.error(`[Channel] Photo post failed for ${property.id}, falling back to text:`, e.message);
    }
  }

  // Fallback: text-only post
  await botInstance.telegram.sendMessage(config.channelId, caption, {
    parse_mode: "Markdown",
    disable_web_page_preview: false,
    ...buttons,
  });
  console.log(`[Channel] Posted property ${property.id} (text only).`);
}

/**
 * Manually trigger a channel post for a specific property (admin use)
 */
async function manualPostProperty(propertyId) {
  if (!botInstance || !config.channelId) {
    throw new Error("Channel posting not configured.");
  }

  const property = await api.getPropertyById(propertyId);
  if (!property) {
    throw new Error(`Property ${propertyId} not found.`);
  }

  await postPropertyToChannel(property);
  db.markPropertyAsPosted(String(propertyId));
  return true;
}

module.exports = {
  initChannelPosting,
  stopChannelPosting,
  checkForNewProperties,
  postPropertyToChannel,
  manualPostProperty,
};
