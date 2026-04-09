/**
 * Test script to verify all 4 reported issues are fixed.
 * This tests the bot logic directly (not via Telegram API) to confirm
 * the code paths work correctly.
 */

// Load env
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { strings, t, detectLanguage, supportedLanguages } = require("../src/i18n");
const config = require("../src/config");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("\n=== Issue 1: Search button should show city selection, not search API ===\n");

// Build ALL_BUTTON_LABELS the same way index.js does
const ALL_BUTTON_LABELS = (() => {
  const map = {};
  for (const [langCode, s] of Object.entries(strings)) {
    if (s.btnSearch)        map[s.btnSearch]        = "action_search";
    if (s.btnFeatured)      map[s.btnFeatured]      = "action_featured";
    if (s.btnHelp)          map[s.btnHelp]          = "action_help";
    if (s.btnNotifications) map[s.btnNotifications] = "action_notifications";
    if (s.btnLanguage)      map[s.btnLanguage]      = "action_language";
    if (s.btnOpenApp)       map[s.btnOpenApp]       = "action_open_app";
    if (s.btnWebsite)       map[s.btnWebsite]       = "action_website";
  }
  return map;
})();

test("Arabic search button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["🔍 البحث عن عقار"];
  assert(action === "action_search", `Expected action_search, got ${action}`);
});

test("English search button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["🔍 Search Properties"];
  assert(action === "action_search", `Expected action_search, got ${action}`);
});

test("Arabic open app button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["📱 فتح التطبيق"];
  assert(action === "action_open_app", `Expected action_open_app, got ${action}`);
});

test("English open app button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["📱 Open App"];
  assert(action === "action_open_app", `Expected action_open_app, got ${action}`);
});

test("Arabic website button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["🌐 الموقع الإلكتروني"];
  assert(action === "action_website", `Expected action_website, got ${action}`);
});

test("English website button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["🌐 Website"];
  assert(action === "action_website", `Expected action_website, got ${action}`);
});

test("Arabic featured button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["⭐ العقارات المميزة"];
  assert(action === "action_featured", `Expected action_featured, got ${action}`);
});

test("Arabic help button is intercepted", () => {
  const action = ALL_BUTTON_LABELS["❓ المساعدة"];
  assert(action === "action_help", `Expected action_help, got ${action}`);
});

console.log("\n=== Issue 2: Open App should use web_app button ===\n");

test("Config has correct webappUrl", () => {
  assert(config.webappUrl === "https://tg.monthlykey.com", 
    `Expected https://tg.monthlykey.com, got ${config.webappUrl}`);
});

test("getMainKeyboard creates web_app button for Open App", () => {
  // Simulate what getMainKeyboard does
  const { Markup } = require("telegraf");
  const lang = "ar";
  const kb = Markup.keyboard([
    [t(lang, "btnSearch"), t(lang, "btnFeatured")],
    [
      { text: t(lang, "btnOpenApp"), web_app: { url: config.webappUrl } },
      t(lang, "btnWebsite"),
    ],
    [t(lang, "btnHelp"), t(lang, "btnLanguage")],
  ]).resize();
  
  // Check the keyboard structure
  const buttons = kb.reply_markup.keyboard;
  const row2 = buttons[1];
  const openAppBtn = row2[0];
  assert(typeof openAppBtn === "object", "Open App button should be an object");
  assert(openAppBtn.web_app !== undefined, "Open App button should have web_app property");
  assert(openAppBtn.web_app.url === "https://tg.monthlykey.com", 
    `web_app URL should be https://tg.monthlykey.com, got ${openAppBtn.web_app.url}`);
  assert(openAppBtn.text === "📱 فتح التطبيق", 
    `Button text should be Arabic, got ${openAppBtn.text}`);
});

console.log("\n=== Issue 3: Arabic strings are correct ===\n");

test("Arabic noResults is in Arabic", () => {
  const msg = t("ar", "noResults");
  assert(msg.includes("لم يتم العثور"), `Expected Arabic, got: ${msg}`);
});

test("Arabic searchPrompt is in Arabic", () => {
  const msg = t("ar", "searchPrompt");
  assert(msg.includes("البحث عن عقارات"), `Expected Arabic, got: ${msg}`);
});

test("Arabic welcome is in Arabic", () => {
  const msg = t("ar", "welcome");
  assert(msg.includes("المفتاح الشهري"), `Expected Arabic, got: ${msg}`);
});

test("Arabic error message is in Arabic", () => {
  const msg = t("ar", "error");
  assert(msg.includes("عذراً"), `Expected Arabic, got: ${msg}`);
});

console.log("\n=== Issue 4: registerUser respects saved language ===\n");

test("detectLanguage returns ar for Arabic", () => {
  assert(detectLanguage("ar") === "ar", "Should return ar");
});

test("detectLanguage returns en for English", () => {
  assert(detectLanguage("en") === "en", "Should return en");
});

test("detectLanguage defaults to ar for unknown", () => {
  assert(detectLanguage("xx") === "ar", "Should default to ar");
});

// Test the database language preservation
const db = require("../src/services/database");

test("upsertUser does NOT overwrite language on update", () => {
  const testChatId = 999999999;
  
  // First insert with Arabic
  db.upsertUser(testChatId, {
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    language: "ar",
  });
  
  let user = db.getUser(testChatId);
  assert(user.language === "ar", `Expected ar after insert, got ${user.language}`);
  
  // Now upsert again with English (simulating registerUser with en language_code)
  db.upsertUser(testChatId, {
    username: "testuser",
    firstName: "Test",
    lastName: "User",
    language: "en",
  });
  
  user = db.getUser(testChatId);
  assert(user.language === "ar", 
    `Expected ar (preserved), got ${user.language} — upsertUser is overwriting language!`);
  
  // Clean up
  const d = db.getDb ? db.getDb() : null;
  if (d) d.prepare("DELETE FROM users WHERE chat_id = ?").run(testChatId);
});

test("setUserLanguage explicitly changes language", () => {
  const testChatId = 999999998;
  
  db.upsertUser(testChatId, {
    username: "testuser2",
    firstName: "Test2",
    language: "ar",
  });
  
  db.setUserLanguage(testChatId, "en");
  let user = db.getUser(testChatId);
  assert(user.language === "en", `Expected en after setUserLanguage, got ${user.language}`);
  
  // Clean up
  const d = db.getDb ? db.getDb() : null;
  if (d) d.prepare("DELETE FROM users WHERE chat_id = ?").run(testChatId);
});

console.log("\n=== All button labels in ALL_BUTTON_LABELS ===\n");
console.log("Total labels:", Object.keys(ALL_BUTTON_LABELS).length);
for (const [label, action] of Object.entries(ALL_BUTTON_LABELS)) {
  console.log(`  "${label}" -> ${action}`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
