/**
 * Monthly Key API Service
 * Connects to monthlykey.com tRPC API for real property data
 */
const fetch = require("node-fetch");
const config = require("../config");

const API_BASE = config.apiBaseUrl;

/**
 * Call a tRPC query endpoint
 * tRPC encodes input as JSON in the query string for GET requests
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

  // Remove undefined values
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
 * Format property data for display
 */
function formatProperty(property, lang = "ar") {
  if (!property) return null;

  const isAr = lang === "ar";
  const title = isAr ? property.titleAr : property.titleEn;
  const city = isAr ? property.cityAr : property.city;
  const district = isAr ? property.districtAr : property.district;
  const type = config.propertyTypes[property.propertyType];
  const typeName = type ? (isAr ? type.ar : type.en) : property.propertyType;
  const furnished = config.furnishedLevels[property.furnishedLevel];
  const furnishedName = furnished ? (isAr ? furnished.ar : furnished.en) : "";

  const rent = Number(property.monthlyRent || 0).toLocaleString();

  if (isAr) {
    return {
      title,
      text: [
        `🏠 *${title}*`,
        ``,
        `📍 ${city || ""}${district ? ` - ${district}` : ""}`,
        `🏷️ ${typeName}${furnishedName ? ` | ${furnishedName}` : ""}`,
        `💰 ${rent} ر.س / شهرياً`,
        property.bedrooms ? `🛏️ ${property.bedrooms} غرف نوم` : "",
        property.bathrooms ? `🚿 ${property.bathrooms} حمامات` : "",
        property.sizeSqm ? `📐 ${property.sizeSqm} م²` : "",
        ``,
        `🔗 [عرض التفاصيل](${config.websiteUrl}/property/${property.id})`,
      ]
        .filter(Boolean)
        .join("\n"),
      url: `${config.websiteUrl}/property/${property.id}`,
      photo: getPropertyPhoto(property),
    };
  }

  return {
    title,
    text: [
      `🏠 *${title}*`,
      ``,
      `📍 ${city || ""}${district ? ` - ${district}` : ""}`,
      `🏷️ ${typeName}${furnishedName ? ` | ${furnishedName}` : ""}`,
      `💰 ${rent} SAR / month`,
      property.bedrooms ? `🛏️ ${property.bedrooms} Bedrooms` : "",
      property.bathrooms ? `🚿 ${property.bathrooms} Bathrooms` : "",
      property.sizeSqm ? `📐 ${property.sizeSqm} sqm` : "",
      ``,
      `🔗 [View Details](${config.websiteUrl}/property/${property.id})`,
    ]
      .filter(Boolean)
      .join("\n"),
    url: `${config.websiteUrl}/property/${property.id}`,
    photo: getPropertyPhoto(property),
  };
}

/**
 * Get the first photo URL from a property
 */
function getPropertyPhoto(property) {
  if (!property.photos) return null;

  // Photos can be stored as JSON string or array
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
    // Could be a string URL or an object with url property
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
      ? "لم يتم العثور على عقارات مطابقة. جرب تعديل معايير البحث."
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
