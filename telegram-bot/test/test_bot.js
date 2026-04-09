/**
 * Monthly Key Telegram Bot — Comprehensive Feature Test
 * Tests all features by calling the Telegram Bot API directly
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fetch = require("node-fetch");
const { OpenAI } = require("openai");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://tg.monthlykey.com";

let passed = 0;
let failed = 0;
const results = [];

function log(emoji, label, detail = "") {
  const line = `${emoji} ${label}${detail ? ": " + detail : ""}`;
  console.log(line);
  results.push(line);
}

async function tgGet(method, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${method}${qs ? "?" + qs : ""}`;
  const res = await fetch(url);
  return res.json();
}

async function tgPost(method, body) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function check(label, fn) {
  try {
    const result = await fn();
    if (result.ok !== false) {
      log("✅", label, typeof result === "string" ? result : "PASS");
      passed++;
      return result;
    } else {
      log("❌", label, result.error || result.description || JSON.stringify(result));
      failed++;
      return null;
    }
  } catch (e) {
    log("❌", label, e.message);
    failed++;
    return null;
  }
}

async function runTests() {
  console.log("\n===========================================");
  console.log("  Monthly Key Telegram Bot — Test Suite");
  console.log("===========================================\n");

  // ── 1. getMe ──────────────────────────────────────────────
  const me = await check("getMe — Bot identity", async () => {
    const r = await tgGet("getMe");
    if (!r.ok) return { ok: false, error: r.description };
    log("  ℹ️", "Bot name", r.result.first_name);
    log("  ℹ️", "Username", "@" + r.result.username);
    log("  ℹ️", "Inline mode", r.result.supports_inline_queries ? "enabled" : "disabled");
    return r;
  });

  // ── 2. getMyCommands ──────────────────────────────────────
  await check("getMyCommands — Registered commands", async () => {
    const r = await tgGet("getMyCommands");
    if (!r.ok) return { ok: false, error: r.description };
    const cmds = r.result;
    if (!cmds || cmds.length === 0) return { ok: false, error: "No commands registered" };
    cmds.forEach(c => log("  ℹ️", `/${c.command}`, c.description));
    const required = ["start", "search", "help", "language", "notifications"];
    const missing = required.filter(cmd => !cmds.find(c => c.command === cmd));
    if (missing.length > 0) return { ok: false, error: `Missing commands: ${missing.join(", ")}` };
    return r;
  });

  // ── 3. getChatMenuButton ──────────────────────────────────
  await check("getChatMenuButton — Menu button set to Mini App", async () => {
    const r = await tgPost("getChatMenuButton", {});
    if (!r.ok) return { ok: false, error: r.description };
    const btn = r.result;
    log("  ℹ️", "Menu button type", btn.type);
    if (btn.type !== "web_app") return { ok: false, error: `Expected web_app, got: ${btn.type}` };
    log("  ℹ️", "Mini App URL", btn.web_app?.url);
    if (!btn.web_app?.url?.includes("tg.monthlykey.com")) {
      return { ok: false, error: `Wrong URL: ${btn.web_app?.url}` };
    }
    log("  ℹ️", "Button text", btn.text);
    return r;
  });

  // ── 4. getWebhookInfo ─────────────────────────────────────
  await check("getWebhookInfo — Polling mode (no webhook)", async () => {
    const r = await tgGet("getWebhookInfo");
    if (!r.ok) return { ok: false, error: r.description };
    const wh = r.result;
    log("  ℹ️", "Webhook URL", wh.url || "(none — using polling ✓)");
    log("  ℹ️", "Pending updates", wh.pending_update_count || 0);
    return r;
  });

  // ── 5. OpenAI API connectivity ────────────────────────────
  await check("OpenAI API — GPT-4.1-mini connectivity", async () => {
    if (!OPENAI_API_KEY) return { ok: false, error: "OPENAI_API_KEY not set" };
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are the Monthly Key bot assistant." },
        { role: "user", content: "What cities does Monthly Key serve? Reply in one sentence." },
      ],
      max_tokens: 80,
    });
    const reply = completion.choices[0]?.message?.content;
    if (!reply) return { ok: false, error: "No response from OpenAI" };
    log("  ℹ️", "AI response", reply.slice(0, 100));
    return { ok: true };
  });

  // ── 6. Monthly Key tRPC API ───────────────────────────────
  await check("tRPC API — property.featured endpoint", async () => {
    const url = "https://monthlykey.com/api/trpc/property.featured";
    const r = await fetch(url, {
      headers: { "User-Agent": "MonthlyKey-TelegramBot-Test/1.0" },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    const items = data?.result?.data?.json;
    if (!items) return { ok: false, error: "Unexpected response shape: " + JSON.stringify(data).slice(0, 100) };
    log("  ℹ️", "Featured properties returned", items.length);
    if (items.length > 0) {
      log("  ℹ️", "First property", items[0].titleEn || items[0].titleAr);
    }
    return { ok: true };
  });

  // ── 7. tRPC search endpoint ───────────────────────────────
  await check("tRPC API — property.search (Riyadh)", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { city: "Riyadh", limit: 3 } }));
    const url = `https://monthlykey.com/api/trpc/property.search?input=${input}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "MonthlyKey-TelegramBot-Test/1.0" },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    const result = data?.result?.data?.json;
    if (!result) return { ok: false, error: "Unexpected shape: " + JSON.stringify(data).slice(0, 100) };
    const items = result.items || result;
    log("  ℹ️", "Search results (Riyadh)", Array.isArray(items) ? items.length : "N/A");
    return { ok: true };
  });

  // ── 8. Database module ────────────────────────────────────
  await check("Database — SQLite upsert/read user", async () => {
    const db = require("../src/services/database");
    db.upsertUser(999999999, { username: "testuser", firstName: "Test", lastName: "User", language: "ar" });
    const user = db.getUser(999999999);
    if (!user) return { ok: false, error: "User not found after upsert" };
    if (user.language !== "ar") return { ok: false, error: `Wrong language: ${user.language}` };
    db.setUserLanguage(999999999, "en");
    const lang = db.getUserLanguage(999999999);
    if (lang !== "en") return { ok: false, error: `Language not updated: ${lang}` };
    db.addMessage(999999999, "user", "Hello");
    db.addMessage(999999999, "assistant", "Hi there!");
    const history = db.getConversationHistory(999999999, 5);
    if (history.length < 2) return { ok: false, error: `Expected 2 messages, got ${history.length}` };
    const stats = db.getUserStats();
    log("  ℹ️", "Total users in DB", stats.total);
    log("  ℹ️", "Active users", stats.active);
    return { ok: true };
  });

  // ── 9. Language detection ─────────────────────────────────
  await check("AI service — Language detection", async () => {
    const { detectLanguage } = require("../src/services/ai");
    const arResult = detectLanguage("ما هي المدن المتاحة؟");
    const enResult = detectLanguage("What cities are available?");
    const mixResult = detectLanguage("hello مرحبا");
    if (arResult !== "ar") return { ok: false, error: `Arabic detection failed: got ${arResult}` };
    if (enResult !== "en") return { ok: false, error: `English detection failed: got ${enResult}` };
    log("  ℹ️", "Arabic text detected as", arResult);
    log("  ℹ️", "English text detected as", enResult);
    log("  ℹ️", "Mixed text detected as", mixResult || "(null — correct)");
    return { ok: true };
  });

  // ── 10. City matching ─────────────────────────────────────
  await check("Command handler — City matching", async () => {
    const { matchCity } = require("../src/handlers/commands");
    const r1 = matchCity("Riyadh");
    const r2 = matchCity("الرياض");
    const r3 = matchCity("riyadh apartments");
    const r4 = matchCity("jeddah");
    const r5 = matchCity("xyz");
    if (!r1 || r1.id !== "riyadh") return { ok: false, error: `'Riyadh' not matched: ${JSON.stringify(r1)}` };
    if (!r2 || r2.id !== "riyadh") return { ok: false, error: `'الرياض' not matched` };
    if (!r3 || r3.id !== "riyadh") return { ok: false, error: `'riyadh apartments' not matched` };
    if (!r4 || r4.id !== "jeddah") return { ok: false, error: `'jeddah' not matched` };
    if (r5 !== null) return { ok: false, error: `'xyz' should not match, got: ${JSON.stringify(r5)}` };
    log("  ℹ️", "Matched 'Riyadh'", r1.name_ar);
    log("  ℹ️", "Matched 'الرياض'", r2.name_en);
    log("  ℹ️", "Matched 'jeddah'", r4.name_ar);
    log("  ℹ️", "Non-match 'xyz'", "null ✓");
    return { ok: true };
  });

  // ── 11. i18n module ───────────────────────────────────────
  await check("i18n — Arabic and English strings", async () => {
    const { t } = require("../src/i18n");
    const arWelcome = t("ar", "welcome");
    const enWelcome = t("en", "welcome");
    if (!arWelcome.includes("المفتاح الشهري")) return { ok: false, error: "Arabic welcome missing brand name" };
    if (!enWelcome.includes("Monthly Key")) return { ok: false, error: "English welcome missing brand name" };
    log("  ℹ️", "AR welcome (first 40 chars)", arWelcome.slice(0, 40));
    log("  ℹ️", "EN welcome (first 40 chars)", enWelcome.slice(0, 40));
    return { ok: true };
  });

  // ── 12. Property formatter ────────────────────────────────
  await check("API service — Property formatter", async () => {
    const apiService = require("../src/services/api");
    const mockProp = {
      id: 42,
      titleEn: "Modern Studio in Al Olaya",
      titleAr: "استوديو عصري في العليا",
      city: "Riyadh",
      cityAr: "الرياض",
      district: "Al Olaya",
      districtAr: "العليا",
      propertyType: "studio",
      furnishedLevel: "fully_furnished",
      monthlyRent: "4500",
      bedrooms: 0,
      bathrooms: 1,
      sizeSqm: 45,
      photos: null,
    };
    const arFormatted = apiService.formatProperty(mockProp, "ar");
    const enFormatted = apiService.formatProperty(mockProp, "en");
    if (!arFormatted.text.includes("الرياض")) return { ok: false, error: "Arabic format missing city" };
    if (!enFormatted.text.includes("Riyadh")) return { ok: false, error: "English format missing city" };
    if (!arFormatted.text.includes("4,500")) return { ok: false, error: "Arabic format missing price" };
    log("  ℹ️", "AR formatted (first 60 chars)", arFormatted.text.replace(/\*/g, "").slice(0, 60));
    log("  ℹ️", "EN formatted (first 60 chars)", enFormatted.text.replace(/\*/g, "").slice(0, 60));
    return { ok: true };
  });

  // ── Summary ───────────────────────────────────────────────
  console.log("\n===========================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("===========================================\n");

  return { passed, failed };
}

runTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
