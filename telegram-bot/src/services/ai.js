/**
 * AI Chatbot Service for Monthly Key Telegram Bot
 * Uses OpenAI GPT-4.1-mini for intelligent customer support
 */
const { OpenAI } = require("openai");
const config = require("../config");
const db = require("./database");

// Support OpenAI-compatible proxy via OPENAI_BASE_URL / OPENAI_API_BASE env vars
const openaiBaseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || undefined;
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
});
if (openaiBaseUrl) {
  console.log(`[AI] Using OpenAI proxy: ${openaiBaseUrl}`);
}

/**
 * System prompt that defines the AI assistant's behavior
 */
function getSystemPrompt(lang) {
  const activeCities = config.serviceAreas
    .filter((c) => c.status === "active")
    .map((c) => `${c.name_en} (${c.name_ar})`)
    .join(", ");

  const comingSoonCities = config.serviceAreas
    .filter((c) => c.status === "coming_soon")
    .map((c) => `${c.name_en} (${c.name_ar})`)
    .join(", ");

  const riyadhDistricts = config.serviceAreas
    .find((c) => c.id === "riyadh")
    ?.districts.map((d) => `${d.en} (${d.ar})`)
    .join(", ");

  const propertyTypesList = Object.entries(config.propertyTypes)
    .map(([key, val]) => `${val.en} (${val.ar})`)
    .join(", ");

  return `You are the official AI customer support assistant for Monthly Key (المفتاح الشهري), a trusted monthly rental platform in Saudi Arabia.

ABOUT MONTHLY KEY:
- Website: monthlykey.com
- Monthly Key is a platform that connects tenants with landlords for monthly rental properties in Saudi Arabia
- The platform offers verified properties with transparent pricing
- All properties are for monthly rental (not daily or yearly)
- The platform handles the booking process, payments, and lease contracts

CURRENT SERVICE AREAS:
- Active cities: ${activeCities}
- Coming soon: ${comingSoonCities}
- Districts in Riyadh: ${riyadhDistricts}

PROPERTY TYPES AVAILABLE:
${propertyTypesList}

FURNISHED LEVELS:
- Fully Furnished (مفروش بالكامل) — includes all furniture and appliances
- Semi Furnished (نصف مفروش) — includes basic furniture
- Unfurnished (غير مفروش) — empty unit

HOW THE PLATFORM WORKS:
1. Browse properties on monthlykey.com or the Telegram Mini App
2. Filter by city, district, property type, price range, bedrooms, and furnished level
3. View property details, photos, and amenities
4. Book instantly (if instant booking is available) or request a booking
5. Pay securely through the platform
6. Sign a digital lease contract
7. Move in!

PRICING:
- Monthly rent varies by property (typically 2,000 - 25,000+ SAR/month)
- Security deposit is usually 1-2 months' rent
- Some properties include utilities (water, electricity, internet)
- No commission fees for tenants

FREQUENTLY ASKED QUESTIONS:
- Minimum stay is usually 1 month, maximum varies by property
- Properties are verified by the Monthly Key team
- Both furnished and unfurnished options are available
- The platform supports online payments
- Lease contracts are digital and legally binding
- Customer support is available via the platform

LANGUAGE RULES:
- The user's preferred language is: ${lang === "ar" ? "Arabic" : "English"}
- ALWAYS respond in the same language the user writes in
- If the user writes in Arabic, respond in Arabic
- If the user writes in English, respond in English
- If mixed, prefer ${lang === "ar" ? "Arabic" : "English"}

RESPONSE GUIDELINES:
- Be helpful, friendly, and professional
- Keep responses concise but informative (max 3-4 paragraphs)
- Use relevant emojis sparingly for a friendly tone
- If asked about a specific property, suggest using the /search command or visiting monthlykey.com
- If you don't know something specific, say so honestly and direct them to the website
- Never make up property listings or prices — only reference what you know about the platform
- For booking or payment issues, direct users to contact support through the website
- You can suggest the user open the Mini App for browsing properties

IMPORTANT:
- You represent Monthly Key officially
- Do not discuss competitors
- Do not provide legal or financial advice
- Always encourage users to verify details on the website`;
}

/**
 * Detect if text is primarily Arabic
 */
function detectLanguage(text) {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (arabicChars > latinChars) return "ar";
  if (latinChars > arabicChars) return "en";
  return null; // Can't determine
}

/**
 * Get AI response for a user message
 */
async function getAiResponse(chatId, userMessage, ctx = null) {
  try {
    // Safety: ensure user row exists before any DB writes (prevents FK constraint errors)
    if (!db.getUser(chatId)) {
      db.upsertUser(chatId, { language: "ar" });
    }
    // Get user's preferred language
    let lang = db.getUserLanguage(chatId);
    
    // Also detect language from the message
    const detectedLang = detectLanguage(userMessage);
    if (detectedLang) {
      lang = detectedLang;
      // Update user's language preference based on what they write
      db.setUserLanguage(chatId, detectedLang);
    }

    // Get conversation history for context
    const history = db.getConversationHistory(chatId, 10);

    // Build messages array
    const messages = [
      { role: "system", content: getSystemPrompt(lang) },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: config.aiModel,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 
      (lang === "ar" 
        ? "عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى."
        : "Sorry, I couldn't process your request. Please try again.");

    // Save conversation to database
    db.addMessage(chatId, "user", userMessage);
    db.addMessage(chatId, "assistant", reply);

    return reply;
  } catch (error) {
    console.error("[AI] Error getting response:", error.message);
    const lang = db.getUserLanguage(chatId);
    return lang === "ar"
      ? "عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى لاحقاً. 🙏"
      : "Sorry, an error occurred while processing your request. Please try again later. 🙏";
  }
}

/**
 * Get the shared OpenAI client instance.
 * Used by ops.js for topic-aware group responses.
 */
function getOpenAIClient() {
  return openai;
}

module.exports = {
  getAiResponse,
  detectLanguage,
  getOpenAIClient,
};
