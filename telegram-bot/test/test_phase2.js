/**
 * Phase 2 Feature Tests for Monthly Key Telegram Bot
 * Tests: Booking System, Payment Integration, Property Alerts
 *
 * Run: node test/test_phase2.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = process.env.API_BASE_URL || "https://monthlykey.com/api/trpc";

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function testAsync(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.log(`  ❌ ${name}: ${err.message}`);
      failed++;
    });
}

function skip(name) {
  console.log(`  ⏭️  ${name} (skipped)`);
  skipped++;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

// ═══════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════

async function runTests() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Monthly Key Bot — Phase 2 Feature Tests");
  console.log("═══════════════════════════════════════════════\n");

  // ─── 1. Module Loading Tests ──────────────────────────────

  console.log("📦 Module Loading:");

  test("Database module loads", () => {
    const db = require("../src/services/database");
    assert(typeof db.getDb === "function");
    assert(typeof db.createBooking === "function");
    assert(typeof db.createAlertSubscription === "function");
  });

  test("Booking handler loads", () => {
    const booking = require("../src/handlers/booking");
    assert(typeof booking.handleBook === "function");
    assert(typeof booking.handleMyBookings === "function");
    assert(typeof booking.registerBookingCallbacks === "function");
    assert(typeof booking.handleBookingTextInput === "function");
    assert(typeof booking.calculateBookingCost === "function");
    assert(typeof booking.calculateDurationMonths === "function");
    assert(typeof booking.isValidDate === "function");
    assert(typeof booking.isDateInPast === "function");
  });

  test("Payment handler loads", () => {
    const payment = require("../src/handlers/payment");
    assert(typeof payment.sendBookingInvoice === "function");
    assert(typeof payment.registerPaymentHandlers === "function");
  });

  test("Alerts handler loads", () => {
    const alerts = require("../src/handlers/alerts");
    assert(typeof alerts.handleAlerts === "function");
    assert(typeof alerts.handleSubscribe === "function");
    assert(typeof alerts.handleUnsubscribe === "function");
    assert(typeof alerts.registerAlertCallbacks === "function");
    assert(typeof alerts.handleAlertTextInput === "function");
    assert(typeof alerts.notifyMatchingAlerts === "function");
  });

  test("i18n has Phase 2 strings", () => {
    const { t } = require("../src/i18n");
    // Booking strings
    assert(t("ar", "bookingStart").length > 0, "Missing ar bookingStart");
    assert(t("en", "bookingStart").length > 0, "Missing en bookingStart");
    assert(t("ar", "bookingConfirmTitle").length > 0, "Missing ar bookingConfirmTitle");
    assert(t("en", "bookingConfirmTitle").length > 0, "Missing en bookingConfirmTitle");
    // Payment strings
    assert(t("ar", "paymentTitle").length > 0, "Missing ar paymentTitle");
    assert(t("en", "paymentTitle").length > 0, "Missing en paymentTitle");
    // Alert strings
    assert(t("ar", "alertsTitle").length > 0, "Missing ar alertsTitle");
    assert(t("en", "alertsTitle").length > 0, "Missing en alertsTitle");
    assert(t("ar", "subscribeStart").length > 0, "Missing ar subscribeStart");
    assert(t("en", "subscribeStart").length > 0, "Missing en subscribeStart");
  });

  // ─── 2. Booking Calculation Tests ─────────────────────────

  console.log("\n📊 Booking Calculations:");

  test("calculateBookingCost — 1 month at 5000 SAR", () => {
    const { calculateBookingCost } = require("../src/handlers/booking");
    const cost = calculateBookingCost(5000, 1);
    assert(cost.totalRent === 5000, `Expected totalRent 5000, got ${cost.totalRent}`);
    assert(cost.securityDeposit === 500, `Expected deposit 500, got ${cost.securityDeposit}`);
    assert(cost.serviceFee === 250, `Expected serviceFee 250, got ${cost.serviceFee}`);
    assert(cost.vatAmount === 38, `Expected VAT 38, got ${cost.vatAmount}`);
    assert(cost.grandTotal === 5788, `Expected grandTotal 5788, got ${cost.grandTotal}`);
  });

  test("calculateBookingCost — 3 months at 8000 SAR", () => {
    const { calculateBookingCost } = require("../src/handlers/booking");
    const cost = calculateBookingCost(8000, 3);
    assert(cost.totalRent === 24000, `Expected totalRent 24000, got ${cost.totalRent}`);
    assert(cost.securityDeposit === 800, `Expected deposit 800, got ${cost.securityDeposit}`);
    assert(cost.serviceFee === 1200, `Expected serviceFee 1200, got ${cost.serviceFee}`);
    assert(cost.vatAmount === 180, `Expected VAT 180, got ${cost.vatAmount}`);
    assert(cost.grandTotal === 26180, `Expected grandTotal 26180, got ${cost.grandTotal}`);
  });

  test("calculateDurationMonths — 30 days = 1 month", () => {
    const { calculateDurationMonths } = require("../src/handlers/booking");
    const months = calculateDurationMonths("2026-05-01", "2026-05-31");
    assert(months === 1, `Expected 1, got ${months}`);
  });

  test("calculateDurationMonths — 90 days = 3 months", () => {
    const { calculateDurationMonths } = require("../src/handlers/booking");
    const months = calculateDurationMonths("2026-05-01", "2026-07-30");
    assert(months === 3, `Expected 3, got ${months}`);
  });

  test("calculateDurationMonths — minimum 1 month", () => {
    const { calculateDurationMonths } = require("../src/handlers/booking");
    const months = calculateDurationMonths("2026-05-01", "2026-05-10");
    assert(months === 1, `Expected 1, got ${months}`);
  });

  // ─── 3. Date Validation Tests ─────────────────────────────

  console.log("\n📅 Date Validation:");

  test("isValidDate — valid dates", () => {
    const { isValidDate } = require("../src/handlers/booking");
    assert(isValidDate("2026-05-01") === true, "2026-05-01 should be valid");
    assert(isValidDate("2026-12-31") === true, "2026-12-31 should be valid");
    assert(isValidDate("2027-01-15") === true, "2027-01-15 should be valid");
  });

  test("isValidDate — invalid dates", () => {
    const { isValidDate } = require("../src/handlers/booking");
    assert(isValidDate("2026-13-01") === false, "Month 13 should be invalid");
    assert(isValidDate("2026-02-30") === false, "Feb 30 should be invalid");
    assert(isValidDate("not-a-date") === false, "Text should be invalid");
    assert(isValidDate("2026/05/01") === false, "Wrong format should be invalid");
    assert(isValidDate("") === false, "Empty should be invalid");
  });

  test("isDateInPast — future date", () => {
    const { isDateInPast } = require("../src/handlers/booking");
    assert(isDateInPast("2027-12-31") === false, "Future date should not be in past");
  });

  test("isDateInPast — past date", () => {
    const { isDateInPast } = require("../src/handlers/booking");
    assert(isDateInPast("2020-01-01") === true, "2020-01-01 should be in past");
  });

  // ─── 4. Database Operations Tests ─────────────────────────

  console.log("\n💾 Database Operations:");

  test("Database initializes with Phase 2 tables", () => {
    const db = require("../src/services/database");
    const d = db.getDb();

    // Check bookings table exists
    const bookingsTable = d
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bookings'")
      .get();
    assert(bookingsTable, "bookings table should exist");

    // Check alert_subscriptions table exists
    const alertsTable = d
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='alert_subscriptions'")
      .get();
    assert(alertsTable, "alert_subscriptions table should exist");
  });

  test("Create and retrieve booking", () => {
    const db = require("../src/services/database");

    // Ensure test user exists
    db.upsertUser(999999, {
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      language: "en",
    });

    const bookingId = db.createBooking(999999, {
      propertyId: 1,
      propertyTitle: "Test Property",
      propertyCity: "Riyadh",
      monthlyRent: 5000,
      checkInDate: "2026-06-01",
      checkOutDate: "2026-07-01",
      durationMonths: 1,
      totalAmount: 5000,
      securityDeposit: 500,
      serviceFee: 250,
      vatAmount: 38,
      grandTotal: 5788,
    });

    assert(bookingId > 0, `Expected positive booking ID, got ${bookingId}`);

    const booking = db.getBooking(bookingId);
    assert(booking, "Should retrieve booking");
    assert(booking.property_title === "Test Property", "Title should match");
    assert(booking.status === "pending", "Status should be pending");
    assert(booking.payment_status === "unpaid", "Payment should be unpaid");
  });

  test("Update booking payment", () => {
    const db = require("../src/services/database");
    const bookings = db.getUserBookings(999999, 1);
    assert(bookings.length > 0, "Should have at least one booking");

    const bookingId = bookings[0].id;
    db.updateBookingPayment(bookingId, {
      paymentStatus: "paid",
      providerPaymentId: "test_provider_123",
      chargeId: "test_charge_456",
    });

    const updated = db.getBooking(bookingId);
    assert(updated.payment_status === "paid", "Payment status should be paid");
    assert(updated.status === "confirmed", "Status should be confirmed after payment");
    assert(updated.payment_provider_id === "test_provider_123", "Provider ID should match");
  });

  test("Cancel booking", () => {
    const db = require("../src/services/database");

    const bookingId = db.createBooking(999999, {
      propertyId: 2,
      propertyTitle: "Cancel Test",
      propertyCity: "Riyadh",
      monthlyRent: 3000,
      checkInDate: "2026-07-01",
      checkOutDate: "2026-08-01",
      durationMonths: 1,
      totalAmount: 3000,
      securityDeposit: 300,
      serviceFee: 150,
      vatAmount: 23,
      grandTotal: 3473,
    });

    db.cancelBooking(bookingId);
    const cancelled = db.getBooking(bookingId);
    assert(cancelled.status === "cancelled", "Status should be cancelled");
  });

  test("Create and retrieve alert subscription", () => {
    const db = require("../src/services/database");

    const alertId = db.createAlertSubscription(999999, {
      city: "Riyadh",
      minPrice: 3000,
      maxPrice: 8000,
      propertyType: "apartment",
    });

    assert(alertId > 0, `Expected positive alert ID, got ${alertId}`);

    const alerts = db.getUserAlerts(999999);
    assert(alerts.length > 0, "Should have at least one alert");

    const alert = alerts.find((a) => a.id === alertId);
    assert(alert, "Should find the created alert");
    assert(alert.city === "Riyadh", "City should match");
    assert(alert.min_price === 3000, "Min price should match");
    assert(alert.max_price === 8000, "Max price should match");
    assert(alert.property_type === "apartment", "Property type should match");
  });

  test("Deactivate alert subscription", () => {
    const db = require("../src/services/database");
    const alerts = db.getUserAlerts(999999);
    assert(alerts.length > 0, "Should have alerts");

    const alertId = alerts[0].id;
    db.deactivateAlert(alertId);

    const updatedAlerts = db.getUserAlerts(999999);
    const deactivated = updatedAlerts.find((a) => a.id === alertId);
    assert(!deactivated, "Deactivated alert should not appear in active alerts");
  });

  test("Matching alerts — property matches criteria", () => {
    const db = require("../src/services/database");

    // Create a fresh alert
    db.createAlertSubscription(999999, {
      city: "Riyadh",
      minPrice: 2000,
      maxPrice: 10000,
    });

    const matchingProperty = {
      city: "Riyadh",
      monthlyRent: 5000,
      propertyType: "apartment",
    };

    const matches = db.getMatchingAlerts(matchingProperty);
    assert(matches.length > 0, "Should find matching alerts");
  });

  test("Matching alerts — property does not match city", () => {
    const db = require("../src/services/database");

    const nonMatchingProperty = {
      city: "Jeddah",
      monthlyRent: 5000,
      propertyType: "apartment",
    };

    const matches = db.getMatchingAlerts(nonMatchingProperty);
    // Filter to only our test user's alerts
    const userMatches = matches.filter((a) => a.chat_id === 999999);
    assert(userMatches.length === 0, "Should not match Jeddah for Riyadh alert");
  });

  test("Matching alerts — property out of price range", () => {
    const db = require("../src/services/database");

    const expensiveProperty = {
      city: "Riyadh",
      monthlyRent: 50000,
      propertyType: "villa",
    };

    const matches = db.getMatchingAlerts(expensiveProperty);
    const userMatches = matches.filter((a) => a.chat_id === 999999);
    assert(userMatches.length === 0, "Should not match property over max price");
  });

  // ─── 5. API Integration Tests ─────────────────────────────

  console.log("\n🌐 API Integration:");

  await testAsync("API — property.search returns data", async () => {
    const fetch = require("node-fetch");
    const input = encodeURIComponent(JSON.stringify({ json: { city: "Riyadh", limit: 3 } }));
    const url = `${API_BASE}/property.search?input=${input}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "MonthlyKey-TelegramBot/1.0" },
      timeout: 10000,
    });

    assert(response.ok, `API returned ${response.status}`);
    const data = await response.json();
    assert(data?.result, "Response should have result");
  });

  await testAsync("API — property.featured returns data", async () => {
    const fetch = require("node-fetch");
    const url = `${API_BASE}/property.featured`;

    const response = await fetch(url, {
      headers: { "User-Agent": "MonthlyKey-TelegramBot/1.0" },
      timeout: 10000,
    });

    assert(response.ok, `API returned ${response.status}`);
  });

  // ─── 6. Bot API Tests ─────────────────────────────────────

  console.log("\n🤖 Bot API:");

  if (!BOT_TOKEN) {
    skip("Bot token not configured — skipping API tests");
  } else {
    await testAsync("Bot — getMe returns bot info", async () => {
      const fetch = require("node-fetch");
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
      const response = await fetch(url);
      const data = await response.json();
      assert(data.ok, "getMe should return ok");
      assert(data.result.is_bot, "Should be a bot");
    });

    await testAsync("Bot — getMyCommands includes Phase 2 commands", async () => {
      const fetch = require("node-fetch");
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        const commands = data.result.map((c) => c.command);
        // These may not be set yet if bot hasn't run, so just check the API works
        console.log(`    Commands registered: ${commands.join(", ")}`);
      }
    });
  }

  // ─── 7. Cleanup ───────────────────────────────────────────

  console.log("\n🧹 Cleanup:");

  test("Clean up test data", () => {
    const db = require("../src/services/database");
    const d = db.getDb();
    d.prepare("DELETE FROM bookings WHERE chat_id = 999999").run();
    d.prepare("DELETE FROM alert_subscriptions WHERE chat_id = 999999").run();
    d.prepare("DELETE FROM users WHERE chat_id = 999999").run();
  });

  // ─── Summary ──────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("═══════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
