/**
 * Monthly Key API Service
 * Connects to monthlykey.com tRPC API for real property data
 * RTL-safe formatting for Arabic messages using Unicode direction marks
 */
const fetch = require("node-fetch");
const config = require("../config");

const API_BASE = config.apiBaseUrl;

// Unicode direction marks
// RLM = Right-to-Left Mark — forces RTL rendering for the line
// LRM = Left-to-Right Mark — forces LTR rendering (used for numbers/prices)
const RLM = "\u200F";
const LRM = "\u200E";

/**
 * Call a tRPC query endpoint
 */
async function trpcQuery(procedure, input = undefined) {
  try {
    let url = `${API_BASE}/${procedure}`;
    if (input !== undefined) {
      const encoded = encodeURIComponent(JSON.stringify({ json: input }));
      url += `?input=${encoded}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MonthlyKey-TelegramBot/1.0",
      },
      timeout: 10000,
    });

    if (!response.ok) {
      console.error(`[API] ${procedure} returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.result?.data?.json ?? data?.result?.data ?? null;
  } catch (error) {
    console.error(`[API] Error calling ${procedure}:`, error.message);
    return null;
  }
}

/**
 * Search properties with filters
 */
async function searchProperties(filters = {}) {
  const input = {
    query: filters.query || undefined,
    city: filters.city || undefined,
    propertyType: filters.propertyType || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    bedrooms: filters.bedrooms || undefined,
    furnishedLevel: filters.furnishedLevel || undefined,
    limit: filters.limit || 10,
    offset: filters.offset || 0,
  };

  Object.keys(input).forEach((key) => {
    if (input[key] === undefined) delete input[key];
  });

  return trpcQuery("property.search", input);
}

/**
 * Get featured properties
 */
async function getFeaturedProperties() {
  return trpcQuery("property.featured");
}

/**
 * Get property by ID
 */
async function getPropertyById(id) {
  return trpcQuery("property.getById", { id: Number(id) });
}

/**
 * Format a price number with locale-aware thousands separators
 */
function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-US");
}

/**
 * Format property data for Telegram display.
 *
 * Arabic RTL strategy:
 * - Each line starts with RLM (\u200F) to anchor the paragraph direction to RTL.
 * - Numeric values (prices, sizes) are wrapped with LRM...LRM so they render
 *   left-to-right inside the RTL paragraph without flipping punctuation.
 * - Emoji at the start of a line act as neutral characters; the RLM after them
 *   ensures the following Arabic text flows right-to-left.
 */
function formatProperty(property, lang = "ar") {
  if (!property) return null;

  const isAr = lang === "ar";
  const isRtl = lang === "ar" || lang === "ur";

  const title = isAr
    ? (property.titleAr || property.titleEn)
    : property.titleEn || property.titleAr;

  const city = isAr
    ? (property.cityAr || property.city)
    : (property.city || property.cityAr);

  const district = isAr
    ? (property.districtAr || property.district)
    : (property.district || property.districtAr);

  const type = config.propertyTypes[property.propertyType];
  const typeName = type ? (isAr ? type.ar : type.en) : property.propertyType;

  const furnished = config.furnishedLevels[property.furnishedLevel];
  const furnishedName = furnished ? (isAr ? furnished.ar : furnished.en) : "";

  const rent = formatPrice(property.monthlyRent);
  const propertyUrl = `${config.websiteUrl}/property/${property.id}`;

  if (isAr) {
    // RTL-safe Arabic property card
    // Each line: RLM + emoji + Arabic label + LRM-wrapped number/value
    const lines = [
      `${RLM}🏠 *${title}*`,
      ``,
      `${RLM}📍 ${city || ""}${district ? ` - ${district}` : ""}`,
      `${RLM}🏷️ ${typeName}${furnishedName ? ` | ${furnishedName}` : ""}`,
      // Price: wrap the number+currency in LRM so "4,500 ر.س" doesn't flip
      `${RLM}💰 ${LRM}${rent}${LRM} ر.س / شهرياً`,
      property.bedrooms
        ? `${RLM}🛏️ ${LRM}${property.bedrooms}${LRM} غرف نوم`
        : "",
      property.bathrooms
        ? `${RLM}🚿 ${LRM}${property.bathrooms}${LRM} حمامات`
        : "",
      property.sizeSqm
        ? `${RLM}📐 ${LRM}${property.sizeSqm}${LRM} م²`
        : "",
      ``,
      `${RLM}🔗 [عرض التفاصيل](${propertyUrl})`,
    ];

    return {
      title,
      text: lines.filter((l) => l !== "").join("\n"),
      url: propertyUrl,
      photo: getPropertyPhoto(property),
    };
  }

  if (lang === "ur") {
    // Urdu — also RTL, similar treatment
    const lines = [
      `${RLM}🏠 *${title}*`,
      ``,
      `${RLM}📍 ${city || ""}${district ? ` - ${district}` : ""}`,
      `${RLM}🏷️ ${typeName}${furnishedName ? ` | ${furnishedName}` : ""}`,
      `${RLM}💰 ${LRM}${rent}${LRM} SAR / ماہانہ`,
      property.bedrooms
        ? `${RLM}🛏️ ${LRM}${property.bedrooms}${LRM} بیڈروم`
        : "",
      property.bathrooms
        ? `${RLM}🚿 ${LRM}${property.bathrooms}${LRM} باتھ روم`
        : "",
      property.sizeSqm
        ? `${RLM}📐 ${LRM}${property.sizeSqm}${LRM} مربع میٹر`
        : "",
      ``,
      `${RLM}🔗 [تفصیلات دیکھیں](${propertyUrl})`,
    ];

    return {
      title,
      text: lines.filter((l) => l !== "").join("\n"),
      url: propertyUrl,
      photo: getPropertyPhoto(property),
    };
  }

  // LTR languages: English, French, Hindi
  const lines = [
    `🏠 *${title}*`,
    ``,
    `📍 ${city || ""}${district ? ` - ${district}` : ""}`,
    `🏷️ ${typeName}${furnishedName ? ` | ${furnishedName}` : ""}`,
    `💰 ${rent} ${lang === "fr" ? "SAR / mois" : "SAR / month"}`,
    property.bedrooms
      ? `🛏️ ${property.bedrooms} ${lang === "fr" ? "Chambres" : lang === "hi" ? "बेडरूम" : "Bedrooms"}`
      : "",
    property.bathrooms
      ? `🚿 ${property.bathrooms} ${lang === "fr" ? "Salles de bain" : lang === "hi" ? "बाथरूम" : "Bathrooms"}`
      : "",
    property.sizeSqm
      ? `📐 ${property.sizeSqm} ${lang === "hi" ? "वर्ग मीटर" : "sqm"}`
      : "",
    ``,
    `🔗 [${lang === "fr" ? "Voir les détails" : lang === "hi" ? "विवरण देखें" : "View Details"}](${propertyUrl})`,
  ];

  return {
    title,
    text: lines.filter((l) => l !== "").join("\n"),
    url: propertyUrl,
    photo: getPropertyPhoto(property),
  };
}

/**
 * Get the first photo URL from a property
 */
function getPropertyPhoto(property) {
  if (!property.photos) return null;

  let photos = property.photos;
  if (typeof photos === "string") {
    try {
      photos = JSON.parse(photos);
    } catch {
      return null;
    }
  }

  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }

  return null;
}

/**
 * Format a list of properties for display
 */
function formatPropertyList(properties, lang = "ar") {
  if (!properties || properties.length === 0) {
    return lang === "ar"
      ? `${RLM}لم يتم العثور على عقارات مطابقة. جرب تعديل معايير البحث.`
      : "No matching properties found. Try adjusting your search criteria.";
  }

  return properties.map((p) => formatProperty(p, lang));
}

module.exports = {
  searchProperties,
  getFeaturedProperties,
  getPropertyById,
  formatProperty,
  formatPropertyList,
  getPropertyPhoto,
};
