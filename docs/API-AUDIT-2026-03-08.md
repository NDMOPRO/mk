# Monthly Key (MK) — Full API Security Audit Report

**Date:** 2026-03-08
**Scope:** All server-side code in `/server/` — tRPC routers, REST endpoints, Express middleware, webhooks, integrations, database access, authentication, authorization, encryption, and rate limiting.

---

## 1. Executive Summary

The MK platform is a full-stack property management and rental marketplace built on Express + tRPC + MySQL (Drizzle ORM). The audit examined **13 tRPC routers** exposing **100+ procedures**, **8 REST endpoints** (auth, webhooks, health, debug, OG images, image proxy, sitemap), and **6 integration modules** (Beds24, Moyasar, WhatsApp Cloud, Shomoos, PayPal, Storage/R2).

Overall, the codebase demonstrates a mature security posture with proper authentication tiers, granular RBAC, rate limiting, input validation via Zod, AES-256-GCM encryption for credentials, HMAC webhook verification, and comprehensive security headers. However, the audit identified **7 critical findings**, **5 high-severity findings**, and **12 medium-severity findings** that should be addressed.

---

## 2. Architecture Overview

### 2.1 Authentication Tiers

The platform uses four tRPC procedure tiers, each building on the previous:

| Tier | Middleware | Description |
|------|-----------|-------------|
| `publicProcedure` | None | No authentication required. Used for property search, geo data, CMS pages, lease calculator, and contact form. |
| `protectedProcedure` | `requireUser` | Requires a valid JWT session cookie. Used for bookings, favorites, profile updates, AI chat. |
| `adminProcedure` | `requireUser` + role check | Requires `user.role === "admin"`. Blocks non-admin users. |
| `adminWithPermission(perm)` | `adminProcedure` + permission check | Requires admin role AND a specific permission from the `adminPermissions` table. Root admins bypass permission checks. |

### 2.2 Session Management

Sessions are JWT-based (HS256) stored in HTTP-only cookies. Key properties:

- **Production TTL:** 30 minutes (configurable via `SESSION_TTL_MS`)
- **Development TTL:** 24 hours
- **Token Blacklist:** SHA-256 hashed tokens stored in Redis (or in-memory fallback) for logout revocation
- **Cookie Options:** `httpOnly`, `secure` (production), `sameSite: lax`, path `/`

### 2.3 Middleware Stack (in order)

1. Security Headers (HSTS, CSP, X-Frame-Options, etc.)
2. Compression (gzip, level 6, threshold 1KB)
3. Body Parser (JSON + URL-encoded, 50MB limit)
4. Static file serving (`/uploads/` with R2 fallback)
5. Service Worker route
6. Sitemap handler
7. Health check
8. OG image generation
9. Debug endpoints
10. OG cache invalidation
11. Image proxy
12. Payment webhooks (Moyasar, Tabby, Tamara)
13. WhatsApp webhooks
14. Auth routes (login, register, password)
15. tRPC middleware

---

## 3. Critical Findings

### 3.1 CRITICAL — `passwordHash` Exposed via `auth.me` and `auth.getFullProfile`

**Location:** `server/routers/auth.router.ts` lines 38 and 91
**Severity:** Critical
**CVSS Estimate:** 7.5

The `auth.me` endpoint returns `opts.ctx.user` directly, and `auth.getFullProfile` returns `db.getUserById(ctx.user.id)`. Both functions use `db.select().from(users)` which returns **all columns** including `passwordHash`. This means the bcrypt hash of the user's password is sent to the browser in every authenticated API response.

```typescript
// auth.router.ts:38
me: publicProcedure.query(opts => opts.ctx.user),

// auth.router.ts:91
getFullProfile: protectedProcedure.query(async ({ ctx }) => {
  return await db.getUserById(ctx.user.id);  // Returns ALL columns including passwordHash
}),
```

**Impact:** An attacker who intercepts any authenticated response (or any XSS vulnerability) gains access to bcrypt password hashes. While bcrypt is resistant to brute-force, this is a severe data exposure violation.

**Recommendation:** Strip `passwordHash` from all user objects before returning to the client. Create a `sanitizeUser()` helper:

```typescript
function sanitizeUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}
```

### 3.2 CRITICAL — `/api/debug-proof` Endpoint Exposed in Production

**Location:** `server/_core/index.ts` line 233
**Severity:** Critical
**CVSS Estimate:** 8.0

The `/api/debug-proof` endpoint is an unauthenticated GET route that returns raw database rows including property data, booking details (with tenant IDs, amounts, rejection reasons), ledger entries (with payment methods, provider references, paid amounts), and payment configuration status. There is no authentication check and no environment guard.

```typescript
app.get("/api/debug-proof", async (req, res) => {
  // Returns properties, units, bookings, ledger entries, payment config
  // NO AUTH CHECK
});
```

**Impact:** Any anonymous user can access sensitive financial and booking data by visiting `/api/debug-proof`.

**Recommendation:** Either remove this endpoint entirely or gate it behind admin authentication. At minimum, add an environment check: `if (ENV.isProduction) return res.status(404).end();`

### 3.3 CRITICAL — `/api/og/invalidate` Has No Authentication

**Location:** `server/_core/index.ts` line 451
**Severity:** High
**CVSS Estimate:** 6.5

The OG cache invalidation endpoint accepts POST requests without any authentication. An attacker can repeatedly flush the OG image cache, forcing the server to regenerate images on every social media crawler request, potentially causing a denial-of-service through resource exhaustion.

```typescript
app.post("/api/og/invalidate", (req, res) => {
  const key = req.body?.key as string | undefined;
  invalidateOGCache(key);  // No auth check
  res.json({ success: true });
});
```

**Recommendation:** Gate behind admin authentication or at minimum add rate limiting and an API key check.

### 3.4 CRITICAL — Tabby and Tamara Webhooks Have No Signature Verification

**Location:** `server/payment-webhooks.ts` — `handleTabbyWebhook` and `handleTamaraWebhook`
**Severity:** Critical
**CVSS Estimate:** 9.0

Unlike the Moyasar webhook handler (which properly verifies HMAC-SHA256 signatures), the Tabby and Tamara webhook handlers accept any POST request without verifying the sender's identity. An attacker can forge webhook payloads to mark payments as "PAID" without actual payment.

```typescript
// Tabby — NO signature verification
export async function handleTabbyWebhook(req: Request, res: Response) {
  const { id, status, payment } = req.body;
  // Directly processes payment status changes
}

// Tamara — NO signature verification
export async function handleTamaraWebhook(req: Request, res: Response) {
  const { order_id, event_type, data } = req.body;
  // Directly processes payment status changes
}
```

**Impact:** An attacker can craft a POST to `/api/webhooks/tabby` or `/api/webhooks/tamara` with a valid `providerRef` and `status: "AUTHORIZED"` to mark any pending payment as paid, effectively stealing services.

**Recommendation:** Implement HMAC signature verification for both providers, similar to the Moyasar implementation. Both Tabby and Tamara provide webhook signing secrets.

### 3.5 CRITICAL — WhatsApp Webhook Does Not Verify Signature

**Location:** `server/whatsapp-cloud.ts` — `handleWhatsAppWebhook` (line 305)
**Severity:** High
**CVSS Estimate:** 6.0

The `verifyWebhookSignature` function exists in the module but is **never called** by `handleWhatsAppWebhook`. The webhook handler processes all incoming POST requests without verifying the `X-Hub-Signature-256` header from Meta.

```typescript
export async function handleWhatsAppWebhook(req: Request, res: Response) {
  res.status(200).json({ status: "ok" });
  // verifyWebhookSignature is NEVER called here
  const statuses = parseDeliveryStatuses(req.body);
  // ...processes statuses directly
}
```

**Impact:** An attacker can send forged delivery status updates, potentially manipulating message tracking data.

**Recommendation:** Call `verifyWebhookSignature(rawBody, req.headers['x-hub-signature-256'], appSecret)` before processing any webhook data.

### 3.6 CRITICAL — Image Proxy SSRF Vulnerability

**Location:** `server/_core/index.ts` line 458
**Severity:** High
**CVSS Estimate:** 7.0

The `/api/img-proxy` endpoint fetches any HTTPS URL provided in the query parameter. The only validation is `url.startsWith("https://")`. This allows Server-Side Request Forgery (SSRF) attacks against internal services, cloud metadata endpoints (e.g., `https://169.254.169.254/`), or any external target using the server as a proxy.

```typescript
app.get("/api/img-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url || !url.startsWith("https://")) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }
  const response = await fetch(url);  // Fetches ANY https URL
  // ...returns the response body
});
```

**Impact:** Attackers can use this endpoint to probe internal networks, access cloud metadata services, or use the server as an open proxy.

**Recommendation:** Implement a URL allowlist (e.g., only `images.unsplash.com`, `*.r2.dev`, `maps.gstatic.com`). Additionally, validate that the resolved IP is not in private ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x).

### 3.7 CRITICAL — Moyasar Webhook Signature Verification is Optional

**Location:** `server/moyasar.ts` line 316
**Severity:** High
**CVSS Estimate:** 7.5

When `webhookSecret` is not configured, the Moyasar webhook handler logs a warning but **continues processing the request** without signature verification. This means if the admin has not yet configured the webhook secret, the endpoint is completely unprotected.

```typescript
if (settings.webhookSecret) {
  const isValid = verifyMoyasarSignature(rawBody, signature, settings.webhookSecret);
  if (!isValid) return res.status(401).json({ error: "Invalid signature" });
} else {
  console.warn("[Moyasar Webhook] No webhook secret configured — skipping signature verification");
  // CONTINUES PROCESSING — no rejection
}
```

**Recommendation:** Reject webhook requests when the secret is not configured: `if (!settings.webhookSecret) return res.status(503).json({ error: "Webhook not configured" });`

---

## 4. High-Severity Findings

### 4.1 HIGH — Storage Path Traversal in `normalizeKey`

**Location:** `server/storage.ts` — `normalizeKey` function
**Severity:** High

The `normalizeKey` function only strips leading slashes but does not prevent path traversal sequences like `../`. An attacker who can control the storage key (e.g., through a crafted filename) could write files outside the uploads directory.

```typescript
function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");  // Only strips leading slashes
}
// Later: path.join(uploadDir, key)  — key could contain "../"
```

**Recommendation:** Add path traversal protection: `key.replace(/\.\./g, '').replace(/\/+/g, '/')` and verify the resolved path starts with the upload directory.

### 4.2 HIGH — AI Conversation Deletion Without Ownership Check

**Location:** `server/routers/ai.router.ts` — `deleteConversation`
**Severity:** High

The `deleteConversation` mutation accepts any conversation ID and deletes it without verifying that the authenticated user owns it. Any authenticated user can delete any other user's AI conversations.

```typescript
deleteConversation: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input }) => {
    await db.deleteAiConversation(input.id);  // No ownership check
    return { success: true };
  }),
```

The same issue exists for `ai.messages` — any authenticated user can read any conversation's messages.

**Recommendation:** Add ownership verification: `const conv = await db.getAiConversation(input.id); if (conv.userId !== ctx.user.id) throw FORBIDDEN;`

### 4.3 HIGH — Renewal `checkEligibility` Missing Authorization

**Location:** `server/finance-routers.ts` line 402
**Severity:** High

The `renewals.checkEligibility` endpoint is `protectedProcedure` (any authenticated user) and does not verify that the requesting user is the booking's tenant or landlord. Any authenticated user can check renewal eligibility for any booking ID, potentially leaking booking details (end date, renewal count, pricing).

**Recommendation:** Add a booking participant check similar to `booking.getById`.

### 4.4 HIGH — Contact Form Missing Rate Limiting

**Location:** `server/routers/notification.router.ts` line 393
**Severity:** High

The `contactForm.submit` mutation is a public endpoint with no rate limiting. An attacker can flood the contact form, generating unlimited email notifications to the owner and filling the database with spam entries.

**Recommendation:** Add IP-based rate limiting similar to the submission endpoint: `rateLimiter.check('contact:${ip}', 5, 3600000)`

### 4.5 HIGH — `updateProfile` Passes Unsanitized Data to DB

**Location:** `server/routers/auth.router.ts` line 53
**Severity:** High

The `updateProfile` mutation spreads the entire input object into the database update without sanitization. While Zod validates types, string fields like `name`, `address`, `bio` are not sanitized for XSS before storage. The `sanitizeText` and `sanitizeObject` functions exist in `security.ts` but are not used here.

```typescript
const profileData: any = { ...input };
// No sanitizeObject(profileData) call
await db.updateUserProfile(ctx.user.id, profileData);
```

**Recommendation:** Apply `sanitizeObject(profileData)` before the database update.

---

## 5. Medium-Severity Findings

### 5.1 MEDIUM — `switchRole` Allows Tenant/Landlord Toggle Without Verification

**Location:** `server/routers/auth.router.ts` line 93

Any authenticated user can switch their role between "tenant" and "landlord" without any verification. While admin role is excluded from the enum, this allows users to self-assign the landlord role and potentially access landlord-specific features.

**Recommendation:** Consider requiring admin approval for landlord role assignment, or add property ownership verification.

### 5.2 MEDIUM — Manager Self-Edit Token Has No Expiration

**Location:** `server/routers/manager.router.ts` line 130

The `requestEditLink` mutation generates a `nanoid(32)` token for manager self-service profile editing, but there is no TTL or expiration mechanism. Once generated, the token remains valid indefinitely.

**Recommendation:** Add a `tokenExpiresAt` column and check expiration in `getByToken`.

### 5.3 MEDIUM — CMS Media Query Uses String Interpolation for LIMIT/OFFSET

**Location:** `server/routers/cms.router.ts` line 303

The media list query interpolates `input.limit` and `offset` directly into the SQL string. While Zod validates these as numbers, this is a risky pattern that bypasses parameterized queries.

```typescript
await pool.execute(
  `SELECT * FROM cms_media ${where} ORDER BY createdAt DESC LIMIT ${input.limit} OFFSET ${offset}`,
  params
);
```

**Recommendation:** Use parameterized queries for LIMIT and OFFSET: `LIMIT ? OFFSET ?` with `[...params, input.limit, offset]`.

### 5.4 MEDIUM — `getAllUsers` Exposes `recoveryEmail` to Admin

**Location:** `server/db.ts` — `getAllUsers` function

The admin user list includes `recoveryEmail` in the selected fields. While this is admin-only, recovery emails are sensitive PII that should be masked or excluded from list views.

### 5.5 MEDIUM — No CORS Configuration

**Location:** `server/_core/index.ts`

The Express application does not configure CORS middleware. While the CSP `connect-src` directive provides some protection, the absence of explicit CORS headers means the API relies entirely on browser same-origin policy. If the API is ever accessed from a different domain (e.g., mobile app API calls), there is no CORS protection.

**Recommendation:** Add explicit CORS configuration with an allowlist of trusted origins.

### 5.6 MEDIUM — In-Memory Fallbacks Lose State on Restart

**Location:** `server/rate-limiter.ts`, `server/token-blacklist.ts`, `server/cache.ts`

When Redis is not configured, the platform falls back to in-memory stores for rate limiting, token blacklisting, and caching. On Railway restart or redeployment:
- All rate limit counters reset (allowing burst attacks)
- All blacklisted tokens are forgotten (revoked sessions become valid again)
- All cached data is lost

The code logs warnings but continues operating. In production without Redis, this is a significant security gap.

**Recommendation:** Make Redis mandatory for production deployments. Add a startup check that exits if `REDIS_URL` is not set in production.

### 5.7 MEDIUM — `SETTINGS_ENCRYPTION_KEY` Not Enforced in Production

**Location:** `server/_core/env.ts`

The `SETTINGS_ENCRYPTION_KEY` is loaded with a simple fallback (`process.env.SETTINGS_ENCRYPTION_KEY ?? ""`). Unlike `JWT_SECRET` which uses `requireProductionSecret`, the encryption key has no production enforcement. If not set, integration credentials are stored in plaintext in the database.

**Recommendation:** Use `requireProductionSecret("SETTINGS_ENCRYPTION_KEY", ...)` to enforce in production.

### 5.8 MEDIUM — `activity.track` Public Endpoint Accepts Arbitrary Metadata

**Location:** `server/routers/manager.router.ts` line 17

The `activity.track` mutation is public and accepts `metadata: z.record(z.string(), z.unknown())`. An attacker can send arbitrarily large metadata objects to fill the database.

**Recommendation:** Add size limits to the metadata field and rate limit the endpoint.

### 5.9 MEDIUM — `requestEditLink` Returns Success Even for Non-Existent Emails

**Location:** `server/routers/manager.router.ts` line 130

The endpoint throws `NOT_FOUND` when the email doesn't match a manager, which enables email enumeration. An attacker can test whether specific email addresses belong to property managers.

**Recommendation:** Return a generic success message regardless of whether the email exists: "If this email is registered, an edit link has been sent."

### 5.10 MEDIUM — CSP Allows `unsafe-inline` and `unsafe-eval` for Scripts

**Location:** `server/middleware/security-headers.ts`

The Content Security Policy includes `'unsafe-inline'` and `'unsafe-eval'` in the `script-src` directive, which significantly weakens XSS protection. While these are often needed for React applications, they should be replaced with nonce-based CSP when possible.

### 5.11 MEDIUM — Body Parser Limit Set to 50MB

**Location:** `server/_core/index.ts` line 110

The JSON body parser limit is set to 50MB (`express.json({ limit: "50mb" })`). This is very generous and could be exploited for memory exhaustion attacks. Most API endpoints only need a few KB; only file upload endpoints need larger limits.

**Recommendation:** Set a lower default limit (e.g., 1MB) and use route-specific limits for upload endpoints.

### 5.12 MEDIUM — `svg+xml` in Allowed Image Types

**Location:** `server/security.ts`

SVG files are included in `ALLOWED_IMAGE_TYPES`. SVG files can contain embedded JavaScript, which creates a stored XSS vector if SVGs are served with `Content-Type: image/svg+xml` and rendered in the browser.

**Recommendation:** Either remove SVG from allowed types or sanitize SVG content before storage (strip `<script>`, event handlers, `xlink:href` with `javascript:`).

---

## 6. Positive Security Patterns

The following security measures are well-implemented and should be maintained:

| Pattern | Implementation | Assessment |
|---------|---------------|------------|
| **Password Policy** | 12+ chars, uppercase, lowercase, digit, special character | Strong |
| **Password Hashing** | bcrypt with cost factor 12 | Industry standard |
| **Account Lockout** | 5 failed attempts per 15 minutes per user | Effective |
| **Login Rate Limiting** | 10 attempts per 5 minutes per IP | Effective |
| **JWT Secret Enforcement** | `requireProductionSecret` with min 32 chars, blocks dev fallbacks in production | Strong |
| **Token Blacklist** | SHA-256 hashed, Redis-backed with in-memory fallback | Well-designed |
| **RBAC** | Granular permissions (18 keys) with root admin bypass, 60s permission cache | Comprehensive |
| **Input Validation** | Zod schemas on all tRPC inputs with type, length, and enum constraints | Thorough |
| **Pagination Caps** | `capLimit` (max 100) and `capOffset` (max 100,000) helpers | Prevents data dumping |
| **Encryption** | AES-256-GCM for integration credentials with IV + authTag | Correct implementation |
| **Moyasar Webhook** | HMAC-SHA256 with `timingSafeEqual` | Timing-attack resistant |
| **Security Headers** | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | Comprehensive |
| **Audit Logging** | All admin CRUD operations logged with user, action, entity, changes, IP | Good traceability |
| **File Validation** | Content-type allowlist, extension validation, size limits | Multi-layer |
| **Image Optimization** | Automatic resize/compress on upload with thumbnail generation | Good practice |
| **Beds24 Guard** | Prevents local mutations on Beds24-controlled units | Domain-specific safety |
| **Drizzle ORM** | Parameterized queries by default, preventing SQL injection | Safe by default |
| **X-Powered-By** | Removed to reduce fingerprinting | Good practice |

---

## 7. Complete API Inventory

### 7.1 tRPC Routers

| Router | File | Public | Protected | Admin | Total |
|--------|------|--------|-----------|-------|-------|
| `auth` | `auth.router.ts` | 2 (`me`, `logout`) | 3 (`updateProfile`, `getFullProfile`, `switchRole`) | 0 | 5 |
| `property` | `property.router.ts` | 6 (`getById`, `search`, `featured`, `mapData`, `getAvailability`, `getReviews`) | 2 (`getByLandlord`, `create`) | 10+ | 18+ |
| `booking` | `booking.router.ts` | 0 | 4 (`create`, `updateStatus`, `getById`, `myBookings`, `landlordBookings`) | 5+ | 9+ |
| `payment` | `payment.router.ts` | 1 (`getPaymentSettings`) | 2+ | 3+ | 6+ |
| `user` | `user.router.ts` | 0 | 8 (`favorite.*`, `savedSearch.*`, `hidden.*`) | 0 | 8 |
| `admin` | `admin.router.ts` | 0 | 0 | 25+ | 25+ |
| `cms` | `cms.router.ts` | 2 (`getAll`, `get`) | 0 | 6+ | 8+ |
| `geo` | `geo.router.ts` | 10 (`cities.*`, `districts.*`, `maps.*`) | 0 | 5+ | 15+ |
| `lease` | `lease.router.ts` | 2 (`getConfig`, `calculate`) | 3 | 0 | 5 |
| `maintenance` | `maintenance.router.ts` | 2 (`listActive`, `getTimeSlots`) | 3 | 5+ | 10+ |
| `manager` | `manager.router.ts` | 7 (`track`, `list`, `getById`, etc.) | 0 | 3+ | 10+ |
| `notification` | `notification.router.ts` | 1 (`contactForm.submit`) | 2+ | 5+ | 8+ |
| `ai` | `ai.router.ts` | 0 | 5 (`conversations`, `chat`, `messages`, etc.) | 3+ | 8+ |
| `roles` | `roles.router.ts` | 1 (`categories`) | 0 | 6 | 7 |
| `integration` | `integration-routers.ts` | 0 | 0 | 15+ | 15+ |
| `finance` | `finance-routers.ts` | 3 (`enabled`, `getAvailableMethods`, `getEnabledBadges`) | 2 | 10+ | 15+ |
| `submission` | `submission-routers.ts` | 2 (`create`, `uploadPhoto`) | 0 | 3+ | 5+ |

### 7.2 REST Endpoints

| Method | Path | Auth | Rate Limited | Purpose |
|--------|------|------|-------------|---------|
| POST | `/api/auth/login` | None | Yes (10/5min IP + 5/15min user) | Local login |
| POST | `/api/auth/register` | None | Yes (10/5min IP) | Local registration |
| POST | `/api/auth/change-password` | Session | No | Change password |
| POST | `/api/auth/forgot-password` | None | Yes (3/15min) | Password reset request |
| POST | `/api/auth/reset-password` | Token | No | Password reset execution |
| GET | `/api/health` | None | No | Health check |
| GET | `/api/debug-proof` | **None** | **No** | **Debug data (CRITICAL)** |
| POST | `/api/og/invalidate` | **None** | **No** | **OG cache flush (CRITICAL)** |
| GET | `/api/img-proxy` | None | No | Image proxy |
| GET | `/api/og/:slug` | None | No | OG image generation |
| POST | `/api/webhooks/moyasar` | HMAC (optional) | No | Moyasar payment callback |
| POST | `/api/webhooks/tabby` | **None** | **No** | **Tabby payment callback (CRITICAL)** |
| POST | `/api/webhooks/tamara` | **None** | **No** | **Tamara payment callback (CRITICAL)** |
| GET | `/api/webhooks/whatsapp` | Verify token | No | WhatsApp verification |
| POST | `/api/webhooks/whatsapp` | **None** | **No** | **WhatsApp webhook (HIGH)** |
| GET | `/sitemap.xml` | None | No | Dynamic sitemap |
| GET | `/sw.js` | None | No | Service worker |

---

## 8. Remediation Priority Matrix

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 3.1 | `passwordHash` exposed in API responses | Critical | Low (1 hour) | **P0 — Immediate** |
| 3.2 | `/api/debug-proof` exposed in production | Critical | Low (15 min) | **P0 — Immediate** |
| 3.4 | Tabby/Tamara webhooks no signature verification | Critical | Medium (4 hours) | **P0 — Immediate** |
| 3.6 | Image proxy SSRF | High | Low (1 hour) | **P0 — Immediate** |
| 3.3 | OG invalidation no auth | High | Low (30 min) | **P1 — This week** |
| 3.5 | WhatsApp webhook no signature verification | High | Low (1 hour) | **P1 — This week** |
| 3.7 | Moyasar webhook secret optional | High | Low (30 min) | **P1 — This week** |
| 4.1 | Storage path traversal | High | Low (30 min) | **P1 — This week** |
| 4.2 | AI conversation IDOR | High | Low (1 hour) | **P1 — This week** |
| 4.4 | Contact form no rate limit | High | Low (15 min) | **P1 — This week** |
| 4.5 | Profile update no sanitization | High | Low (30 min) | **P1 — This week** |
| 4.3 | Renewal eligibility no auth check | High | Low (30 min) | **P1 — This week** |
| 5.1 | Self-service role switching | Medium | Medium | **P2 — This sprint** |
| 5.2 | Manager edit token no expiry | Medium | Low | **P2 — This sprint** |
| 5.3 | CMS SQL string interpolation | Medium | Low | **P2 — This sprint** |
| 5.6 | In-memory fallbacks in production | Medium | Medium | **P2 — This sprint** |
| 5.7 | Encryption key not enforced | Medium | Low | **P2 — This sprint** |
| 5.8 | Activity track arbitrary metadata | Medium | Low | **P2 — This sprint** |
| 5.9 | Manager email enumeration | Medium | Low | **P2 — This sprint** |
| 5.10 | CSP unsafe-inline/unsafe-eval | Medium | High | **P3 — Backlog** |
| 5.11 | 50MB body parser limit | Medium | Low | **P3 — Backlog** |
| 5.12 | SVG in allowed image types | Medium | Low | **P3 — Backlog** |
| 5.4 | Recovery email in admin list | Medium | Low | **P3 — Backlog** |
| 5.5 | No CORS configuration | Medium | Low | **P3 — Backlog** |

---

## 9. Conclusion

The MK platform has a solid security foundation with proper authentication tiers, granular RBAC, rate limiting, and encryption. The most critical issues are the `passwordHash` exposure in API responses, the unauthenticated debug endpoint, and the missing webhook signature verification for Tabby and Tamara payment providers. These should be addressed immediately as they represent active attack vectors in the production environment.

The platform's use of Drizzle ORM effectively prevents SQL injection in most queries, and the Zod validation layer provides strong input validation. The security headers middleware is comprehensive and the audit logging system provides good traceability for admin actions.

Addressing the P0 and P1 findings would bring the platform to a strong security posture suitable for handling financial transactions and personal data in the Saudi Arabian market.
