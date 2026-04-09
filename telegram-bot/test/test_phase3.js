/**
 * Phase 3 Integration Tests for Monthly Key Telegram Bot
 */
const assert = require("assert");
const i18n = require("../src/i18n");
const db = require("../src/services/database");
const admin = require("../src/handlers/admin");
const config = require("../src/config");

async function runTests() {
  console.log("🚀 Starting Phase 3 Tests...");
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}: ${e.message}`);
    }
  }

  // 1. Multi-language Tests
  test("i18n: supports French", () => {
    const welcome = i18n.t("fr", "welcome");
    assert(welcome.includes("Bienvenue sur Monthly Key"));
  });

  test("i18n: supports Urdu", () => {
    const welcome = i18n.t("ur", "welcome");
    assert(welcome.includes("میں خوش آمدید"));
  });

  test("i18n: supports Hindi", () => {
    const welcome = i18n.t("hi", "welcome");
    assert(welcome.includes("में आपका स्वागत है"));
  });

  test("i18n: detectLanguage function", () => {
    assert.strictEqual(i18n.detectLanguage("fr-FR"), "fr");
    assert.strictEqual(i18n.detectLanguage("ur-PK"), "ur");
    assert.strictEqual(i18n.detectLanguage("hi-IN"), "hi");
    assert.strictEqual(i18n.detectLanguage("unknown"), "en");
  });

  // 2. Admin Authentication Tests
  test("admin: isAdmin check", () => {
    // Mock ctx
    const adminCtx = { from: { id: config.adminIds[0] } };
    const userCtx = { from: { id: 9999999 } };
    assert(admin.isAdmin(adminCtx));
    assert(!admin.isAdmin(userCtx));
  });

  // 3. Database Phase 3 Tests
  test("db: channel posted properties tracking", () => {
    const propId = "test_prop_123";
    db.markPropertyAsPosted(propId);
    assert(db.isPropertyPosted(propId));
    const postedIds = db.getPostedPropertyIds();
    assert(postedIds.includes(propId));
  });

  // 4. Config Phase 3 Tests
  test("config: adminIds parsing", () => {
    assert(Array.isArray(config.adminIds));
    assert(config.adminIds.length > 0);
  });

  console.log(`\n🏁 Phase 3 Tests Finished: ${passed}/${total} passed`);
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Tests failed with error:", err);
  process.exit(1);
});
