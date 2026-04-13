/**
 * Smart Hybrid Translation Service — Monthly Key Operations HQ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Provides:
 *  - Language detection (Arabic vs English)
 *  - Quick-filter rules to skip casual messages (saves API costs)
 *  - AI-based importance classification via gpt-4.1-nano
 *  - AI-powered translation via gpt-4.1-nano
 *  - Per-user rate limiting (1 auto-translation per 30s)
 */

const { OpenAI } = require("openai");
const log = require("../utils/logger");

// ─── OpenAI Client ─────────────────────────────────────────────
const openai = new OpenAI({
  baseUrl: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || undefined,
  timeout: 15000,
  maxRetries: 2,
});

const MODEL = "gpt-4.1-nano";

// ─── Rate Limiter (per-user, 30s cooldown) ─────────────────────
const rateLimitMap = new Map(); // userId → timestamp
const RATE_LIMIT_MS = 30_000;

function isRateLimited(userId) {
  const last = rateLimitMap.get(userId);
  if (!last) return false;
  return Date.now() - last < RATE_LIMIT_MS;
}

function markTranslated(userId) {
  rateLimitMap.set(userId, Date.now());
}

// Clean up stale entries every 5 minutes
const _rateLimitCleanup = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_MS * 2;
  for (const [uid, ts] of rateLimitMap) {
    if (ts < cutoff) rateLimitMap.delete(uid);
  }
}, 5 * 60_000);
// Allow Node to exit even if this interval is still running
if (_rateLimitCleanup.unref) _rateLimitCleanup.unref();

// ─── Language Detection ────────────────────────────────────────

/**
 * Detect language of text. Returns 'ar' or 'en'.
 */
function detectLanguage(text) {
  if (!text) return "en";
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (arabicChars === 0 && latinChars === 0) return "en"; // emoji-only → treat as en
  return arabicChars > latinChars ? "ar" : "en";
}

// ─── Quick Filters (skip before calling AI) ────────────────────

const CASUAL_EXACT = new Set([
  // English
  "ok", "okay", "yes", "no", "yep", "nope", "sure", "thanks", "thank you",
  "thx", "ty", "np", "good", "great", "nice", "cool", "done", "noted",
  "alright", "fine", "got it", "roger", "copy", "understood", "hi", "hello",
  "hey", "bye", "good morning", "good night", "gm", "gn", "lol", "haha",
  "👍", "👌", "✅", "🙏", "❤️", "😂", "😊", "🔥", "💪", "👏",
  // Arabic
  "تمام", "اوكي", "نعم", "لا", "شكرا", "شكراً", "مشكور", "جزاك الله خير",
  "ان شاء الله", "إن شاء الله", "الحمد لله", "الحمدلله", "ماشي", "طيب",
  "حسنا", "حسناً", "يعطيك العافية", "الله يعافيك", "صباح الخير", "مساء الخير",
  "السلام عليكم", "وعليكم السلام", "اهلا", "أهلاً", "مرحبا", "مرحباً",
  "بارك الله فيك", "جزاك الله خيرا", "تم", "اكيد",
]);

/**
 * Quick-filter: returns true if the message should be SKIPPED (casual/not worth translating).
 * These rules run BEFORE the AI call to save costs.
 */
function shouldSkipQuick(text, ctx) {
  if (!text) return true;

  // Bot's own messages
  if (ctx?.message?.from?.is_bot) return true;

  // Commands
  if (text.startsWith("/")) return true;

  // Strip whitespace and normalize
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Very short messages (fewer than 5 words)
  const wordCount = clean.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 5) return true;

  // Exact casual matches
  if (CASUAL_EXACT.has(lower)) return true;

  // Pure emoji messages (no letters at all)
  const stripped = clean.replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  const hasLetters = /[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(stripped);
  if (!hasLetters) return true;

  return false;
}

// ─── AI Importance Classification ──────────────────────────────

/**
 * Classify a message as "important" or "casual" using gpt-4.1-nano.
 * Returns "important" or "casual".
 */
async function classifyImportance(text) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 10,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a message classifier for a property management operations team.
Classify the following message as either "important" or "casual".

IMPORTANT: task updates, work instructions, status reports, questions about work, deadlines, blockers, announcements, meeting notes, property issues, maintenance reports, client/tenant communications, financial updates, scheduling.

CASUAL: greetings, acknowledgments, short replies, jokes, personal chat, emoji reactions, simple confirmations.

Reply with ONLY one word: "important" or "casual". Nothing else.`,
        },
        { role: "user", content: text },
      ],
    });

    const result = (response.choices?.[0]?.message?.content || "").trim().toLowerCase();
    return result.includes("important") ? "important" : "casual";
  } catch (e) {
    log.error("Translation", `Classification failed: ${e.message}`);
    // On error, default to casual (don't translate) to avoid noise
    return "casual";
  }
}

// ─── AI Translation ────────────────────────────────────────────

/**
 * Translate text from one language to the other using gpt-4.1-nano.
 * @param {string} text - The text to translate
 * @param {string} fromLang - 'ar' or 'en'
 * @returns {string|null} - The translation, or null on failure
 */
async function translateText(text, fromLang) {
  const toLang = fromLang === "ar" ? "English" : "Arabic";
  const fromLangName = fromLang === "ar" ? "Arabic" : "English";

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Translate the following ${fromLangName} text to ${toLang}. Keep it natural, concise, and faithful to the original meaning. Only return the translation, nothing else. Do not add quotes or explanations.`,
        },
        { role: "user", content: text },
      ],
    });

    const translation = (response.choices?.[0]?.message?.content || "").trim();
    return translation || null;
  } catch (e) {
    log.error("Translation", `Translation failed: ${e.message}`);
    return null;
  }
}

// ─── Main Auto-Translation Pipeline ────────────────────────────

/**
 * Process a message for auto-translation.
 * Returns { shouldTranslate: boolean, translation?: string, fromLang?: string }
 */
async function processAutoTranslation(text, ctx) {
  // Step 1: Quick filters
  if (shouldSkipQuick(text, ctx)) {
    return { shouldTranslate: false, reason: "quick_filter" };
  }

  // Step 2: Rate limit check
  const userId = ctx?.from?.id || ctx?.message?.from?.id;
  if (userId && isRateLimited(userId)) {
    return { shouldTranslate: false, reason: "rate_limited" };
  }

  // Step 3: AI importance classification
  const importance = await classifyImportance(text);
  if (importance === "casual") {
    return { shouldTranslate: false, reason: "casual" };
  }

  // Step 4: Detect language and translate
  const fromLang = detectLanguage(text);
  const translation = await translateText(text, fromLang);

  if (!translation) {
    return { shouldTranslate: false, reason: "translation_failed" };
  }

  // Step 5: Mark rate limit
  if (userId) markTranslated(userId);

  return {
    shouldTranslate: true,
    translation,
    fromLang,
    toLang: fromLang === "ar" ? "en" : "ar",
  };
}

/**
 * On-demand translation (for /translate command). No importance check, no rate limit.
 * @param {string} text - The text to translate
 * @returns {{ translation: string, fromLang: string, toLang: string } | null}
 */
async function translateOnDemand(text) {
  if (!text || !text.trim()) return null;

  const fromLang = detectLanguage(text);
  const translation = await translateText(text, fromLang);

  if (!translation) return null;

  return {
    translation,
    fromLang,
    toLang: fromLang === "ar" ? "en" : "ar",
  };
}

// ─── Exports ───────────────────────────────────────────────────

module.exports = {
  detectLanguage,
  shouldSkipQuick,
  classifyImportance,
  translateText,
  processAutoTranslation,
  translateOnDemand,
  isRateLimited,
};
