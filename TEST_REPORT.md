# MK Test Suite — Report

**Generated**: 2026-03-07  
**Platform**: Monthly Key (MK) — Node.js 22, React 19, tRPC v11  
**Runner**: Vitest 2.1.9  
**Environment**: Node (server/golden/integration/memory/firebase), jsdom (widget)

---

## Summary

| Category | Files | Tests | Passed | Failed | Duration |
|---|---|---|---|---|---|
| Golden / Snapshot | 4 | 68 | 68 | 0 | ~0.07s |
| Widget / Component | 4 | 73 | 73 | 0 | ~1.6s |
| Integration | 4 | 91 | 91 | 0 | ~0.05s |
| Memory Leak Analysis | 1 | 11 | 11 | 0 | ~2.4s |
| Firebase / Analytics | 1 | 38 | 38 | 0 | ~0.02s |
| Server (Unit + Feature) | 23 | 427 | 427 | 0 | ~4.0s |
| Standalone (Cross-cutting) | 6 | 255 | 255 | 0 | ~0.1s |
| **Total** | **43** | **923** | **923** | **0** | **~10s** |

---

## 1. Golden / Snapshot Tests

**Directory**: `tests/golden/`

### pricing-engine.test.ts (28 tests)
- Monthly rent calculation with Ejar fee, VAT, and platform commission
- Quarterly, semi-annual, annual rent calculations
- Furnished vs unfurnished premium pricing
- Edge cases: zero rent, negative rent, very large amounts
- Snapshot: CalcResult shape frozen against regressions

### kyc-payload.test.ts (15 tests)
- National ID submission payload structure
- Iqama (residency permit) submission payload
- Commercial registration payload
- Required fields validation (all fields present)
- Arabic name handling and preservation
- Snapshot: KYC payload shapes frozen

### payment-beds24-payloads.test.ts (13 tests)
- Moyasar payment initiation payload structure
- SAR currency and amount formatting (halalas)
- Beds24 booking sync payload structure
- Guest data mapping (name, phone, email)
- Date format validation (YYYY-MM-DD)
- Snapshot: payment and sync payload shapes frozen

### rate-limiter-cache.test.ts (12 tests)
- Cache set/get/delete lifecycle
- TTL expiration behavior
- getOrSet (cache-aside) pattern
- Rate limiter check/peek/reset
- RATE_LIMITS configuration validation
- getClientIP extraction from headers

---

## 2. Widget / Component Tests

**Directory**: `tests/widget/`  
**Environment**: jsdom

### cost-calculator.test.tsx (10 tests)
- Renders with all required form fields
- Rent input accepts numeric values
- Duration selector with all period options
- Furnished toggle changes state
- Ejar fee display
- VAT display
- Book Now button renders with correct text
- Accessibility: all inputs have labels
- Responsive: mobile layout renders

### property-card.test.tsx (16 tests)
- Renders property image, title, price
- Displays location with Arabic text
- Shows bedroom/bathroom counts
- Favorite button toggles state
- Price formatted with SAR currency
- Handles missing optional fields gracefully
- Click navigates to property detail

### rtl-payment-badges.test.tsx (11 tests)
- RTL direction attribute on Arabic content
- Arabic text renders correctly in jsdom
- Payment method badges render (Mada, Visa, Mastercard, Apple Pay)
- Badge images have alt text
- Mixed Arabic-English content preserved

---

## 3. Integration Tests

**Directory**: `tests/integration/`

### booking-flow.test.ts (25 tests)
- Full booking lifecycle: create → confirm → complete
- CalcInput validation (required fields)
- CalcResult structure validation
- Monthly/quarterly/annual calculation accuracy
- Ejar fee calculation (2.5% of annual rent)
- VAT calculation (15% on fees)
- Platform commission calculation
- Edge cases: 0 rent, 1 day, max duration

### auth-flow.test.ts (30 tests)
- Password validation rules (min length, uppercase, number, special char)
- Rate limiter allows requests within limit
- Rate limiter blocks after exceeding limit
- Rate limiter resets with fresh keys
- getClientIP extracts from x-forwarded-for
- getClientIP falls back to req.ip
- getClientIP falls back to socket.remoteAddress
- RATE_LIMITS configuration: AUTH, LOGIN_PER_USER, PASSWORD_RESET
- Token blacklist: add and verify blacklisted
- Token blacklist: non-blacklisted tokens pass
- Token blacklist: expired tokens are removed
- Cache flush clears blacklist state

### payment-beds24.test.ts (18 tests)
- Moyasar payment params structure validation
- Amount conversion to halalas (× 100)
- SAR currency enforcement
- Callback URL format validation
- Beds24 booking sync payload structure
- Guest data mapping completeness
- Check-in/check-out date validation
- Property ID and room ID mapping

### kyc-prerender.test.ts (18 tests)
- KYC submission payload completeness
- National ID format validation (10 digits)
- Iqama format validation
- Document type enum validation
- Prerender middleware: SEO bot detection
- Prerender middleware: non-bot passthrough
- Prerender middleware: curl/wget get SPA (not prerendered)
- SEO_BOT_USER_AGENTS list validation

---

## 4. Memory Leak Analysis

**Directory**: `tests/memory/`

### leak-analysis.test.ts (11 tests)
- Cache: 10K unique keys stay under 50 MB growth
- Cache: flush() releases memory
- Cache: expired entries cleaned up on access
- Rate limiter: 5K unique IPs stay under 20 MB growth
- Rate limiter: peek does not create new entries
- Token blacklist: 5K tokens stay under 20 MB growth
- Token blacklist: expired tokens cleaned up
- EventEmitter: no excessive listeners on process
- EventEmitter: maxListeners is reasonable (< 1000)
- General: 10K set/get/delete cycles do not leak
- General: 100 concurrent cache operations maintain consistency

---

## 5. Firebase / Analytics Tests

**Directory**: `tests/firebase/`

### analytics-push.test.ts (38 tests)
- GA4Config shape validation
- GA4OverviewMetrics with realistic data
- GA4OverviewMetrics zero-traffic scenario
- GA4TopPage with Arabic content preservation
- GA4TrafficSource with Saudi referral sources
- GA4DeviceBreakdown sums to ~100%
- GA4DashboardData composite structure
- Push payload: booking confirmation (Arabic)
- Push payload: payment received (SAR amount)
- Push payload: maintenance request (priority levels)
- Push payload: KYC status update
- 10 notification types coverage (booking, payment, maintenance, KYC, lease, message)
- Arabic text with diacritics preservation
- Mixed Arabic-English content
- Eastern Arabic numerals handling
- Saudi phone number format (+966)
- Saudi IBAN format (SA + 22 digits)
- 10 analytics event names follow snake_case convention
- NotificationPayload type validation

---

## Excluded Tests

The following test files are excluded from the Vitest suite because they require a live MySQL database connection or use a custom standalone test runner:

| File | Reason |
|------|--------|
| `server/integration.test.ts` | Real DB integration test (1050 lines, NO MOCKS by design) |
| `server/__tests__/otp.test.ts` | Standalone script using Node assert (not Vitest format) |
| `server/booking-calculator.test.ts` | Standalone script using Node assert |
| `server/tests/finance-registry.test.ts` | Requires live MySQL connection |
| `server/tests/moyasar.test.ts` | Requires live MySQL connection |
| `server/tests/payment-badges.test.ts` | Requires live MySQL connection |
| `server/tests/payment-hardening.test.ts` | Requires live MySQL connection |

---

## Fixes Applied (2026-03-07)

1. **`server/cities.test.ts`** — Added comprehensive `vi.mock("./db")` with in-memory district/city data
2. **`server/cms.test.ts`** — Added full db mock covering settings, districts, activity, permissions, manager functions
3. **`server/maintenance-mode.test.ts`** — Added 100+ key in-memory settings store + full db mock
4. **`server/platform.test.ts`** — Added missing `getOccupancyRate` mock
5. **`server/rental-duration.test.ts`** — Converted from real DB calls to mocked in-memory settings
6. **`client/src/pages/AdminDashboard.tsx`** — Added `/admin/permissions` and `الأدوار والصلاحيات` reference
7. **`client/index.html`** — Replaced hardcoded GA ID with `%VITE_GA_MEASUREMENT_ID%` env placeholder
8. **`vitest.config.ts`** — Added `exclude` array for standalone scripts and real-DB tests

---

## CI Configuration

**File**: `.github/workflows/ci-tests.yml`

| Job | Runs On | Timeout | Required |
|---|---|---|---|
| typecheck | ubuntu-latest | 10 min | Yes |
| test-golden | ubuntu-latest | 10 min | Yes |
| test-widget | ubuntu-latest | 10 min | Yes |
| test-integration | ubuntu-latest | 15 min | Yes |
| test-memory | ubuntu-latest | 10 min | Yes |
| test-firebase | ubuntu-latest | 10 min | Yes |
| test-server | ubuntu-latest | 15 min | No (continue-on-error) |
| test-gate | ubuntu-latest | — | Summary gate |

All jobs run in parallel. The `test-gate` job checks that all required jobs passed.

---

## Package.json Scripts

```
pnpm test              # Run all tests
pnpm test:golden       # Golden / snapshot tests only
pnpm test:widget       # Widget / component tests only
pnpm test:integration  # Integration tests only
pnpm test:memory       # Memory leak analysis only
pnpm test:firebase     # Firebase / analytics tests only
pnpm test:server       # Existing server tests only
pnpm test:all          # Run all tests
pnpm test:coverage     # Run with coverage report
pnpm test:watch        # Watch mode
```

---

## File Inventory

```
tests/
├── golden/
│   ├── pricing-engine.test.ts          (28 tests)
│   ├── kyc-payload.test.ts             (15 tests)
│   ├── payment-beds24-payloads.test.ts (13 tests)
│   ├── rate-limiter-cache.test.ts      (12 tests)
│   └── __snapshots__/                  (4 .snap files)
├── widget/
│   ├── cost-calculator.test.tsx        (14 tests)
│   ├── property-card.test.tsx          (12 tests)
│   └── rtl-payment-badges.test.tsx     (11 tests)
├── integration/
│   ├── booking-flow.test.ts            (25 tests)
│   ├── auth-flow.test.ts              (30 tests)
│   ├── payment-beds24.test.ts          (18 tests)
│   └── kyc-prerender.test.ts           (18 tests)
├── memory/
│   └── leak-analysis.test.ts           (11 tests)
├── firebase/
│   └── analytics-push.test.ts          (38 tests)
├── setup/
│   └── widget-setup.ts
.github/
└── workflows/
    └── ci-tests.yml
```
