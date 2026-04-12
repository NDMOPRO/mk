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

/**
 * Analyze an operations group message to detect tasks, updates, or completions.
 * Returns a structured object with the detected action and data.
 * @param {string} userMessage - The message text to analyze
 * @param {string} senderName - The name of the sender
 * @param {Array} conversationHistory - Recent messages [{from_user, message, created_at}]
 */
async function analyzeOpsMessage(userMessage, senderName, conversationHistory = []) {
  try {
    // Build conversation context string from history
    let historyContext = "";
    if (conversationHistory.length > 0) {
      historyContext = "\n\nRECENT CONVERSATION HISTORY (oldest first):\n" +
        conversationHistory.map(m => `[${m.from_user}]: ${m.message}`).join("\n") +
        "\n\nUse this history to understand references like 'I finished that', 'the thing we discussed', 'نفس الموضوع', 'خلصت', etc.";
    }

    const systemPrompt = `You are the AI Operations Manager for Monthly Key (المفتاح الشهري).
Your job is to analyze messages from team members in the operations group and detect actionable items.

You have a HIGH confidence threshold — when in doubt, return "general" with actionable: false.
The default action is IGNORE. Only respond when you are CERTAIN there is a clear task, update, or completion.

CATEGORIES:
1. "new_task": The user is clearly assigning a new task, requesting something to be done, or reporting a new issue that needs fixing. Must be specific and actionable.
2. "status_update": The user is clearly providing a progress update on an existing task.
3. "completion": The user is clearly reporting that a task is finished or resolved.
4. "general": Anything else — greetings, acknowledgments, casual chat, vague comments, reactions, short replies. DEFAULT to this.

OUTPUT FORMAT (JSON ONLY):
{
  "category": "new_task" | "status_update" | "completion" | "general",
  "actionable": true | false,
  "confidence": "high" | "medium" | "low",
  "data": {
    "title": "Brief title of the task/update",
    "description": "Full details if provided",
    "assignee": "Name of person assigned (default to sender if not specified)",
    "priority": "urgent" | "high" | "normal",
    "due_date": "YYYY-MM-DD (if mentioned, otherwise null)",
    "task_id": "ID number if mentioned (e.g. #123 -> 123), otherwise null"
  },
  "reply_en": "Professional English acknowledgment (only if actionable)",
  "reply_ar": "Professional Arabic acknowledgment (only if actionable)"
}

STRICT RULES:
- ONLY mark actionable: true for categories new_task, status_update, or completion.
- ONLY mark actionable: true when confidence is "high".
- If confidence is "medium" or "low", set actionable: false and category: "general".
- Short messages, single words, greetings, "ok", "noted", "شكراً", "تم", "ماشي", "👍" are ALWAYS "general".
- Vague messages without a clear subject are "general".
- If you are not sure what the task is, it is "general".
- Priority: default to "normal" unless words like "urgent", "immediately", "عاجل", "فورا" are used.
- Assignee: default to "${senderName}" if it's a report about their own work.
- Dates: today is ${new Date().toISOString().split('T')[0]}.
- Replies should be brief and professional, starting with an emoji.
  Examples:
  - "✅ Task logged: [Title] — assigned to [Name]"
  - "📝 Update noted: [Details]"
  - "🎉 Task marked complete: [Title]"
  - "✅ تم تسجيل المهمة: [Title] — مسندة إلى [Name]"
  - "📝 تم تسجيل التحديث: [Details]"
  - "🎉 تم إنجاز المهمة: [Title]"${historyContext}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Sender: ${senderName}\nMessage: ${userMessage}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    
    // Extra safety: if confidence is not high, force to non-actionable
    if (result.confidence !== "high") {
      result.actionable = false;
    }
    
    return result;
  } catch (error) {
    console.error("[AI] Error analyzing ops message:", error.message);
    return { category: "general", actionable: false };
  }
}

// Add to exports
module.exports.analyzeOpsMessage = analyzeOpsMessage;
