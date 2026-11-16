# المفتاح الشهري (Monthly Key) — Master AI Agent Prompt

> This document is the single source of truth for any AI agent working on this project. It describes the complete architecture, file structure, conventions, integrations, constraints, and rules that must be followed without exception.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name (Arabic)** | المفتاح الشهري |
| **Name (English)** | Monthly Key |
| **Domain** | monthlykey.com |
| **Purpose** | Monthly rental platform for Saudi Arabia — connects tenants with landlords for furnished/unfurnished monthly rentals |
| **Repository** | https://github.com/raneemndmo-collab/mk |
| **Branch** | `main` (single branch, auto-deploy on push) |
| **Deployment** | Railway (Docker-based, auto-deploy from GitHub `main`) |
| **Database** | MySQL (Railway MySQL or TiDB Cloud compatible) |
| **Default Language** | Arabic (RTL-first), with full English (LTR) support |

---

## 2. Absolute Constraints

These rules are non-negotiable. Violating any of them is a critical failure.

1. **No Manus AI resources, APIs, or internal services.** The project must never reference, import, or call any Manus AI endpoint, API, SDK, or resource. This includes `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, and any `manus-analytics.com` references. If these env vars exist in Railway, they must be ignored or removed.
2. **No code breaking.** Every change must preserve all existing functionality. Test before committing.
3. **No dummy/placeholder content.** All outputs must be real and functional. No demo data, no fake pages, no placeholder functions.
4. **No code modification without approval.** Never modify code or packages without explicit prior approval from the user.
5. **No external repositories.** Do not use or reference any external repositories.
6. **Immediate execution.** Do not ask questions. Proceed directly with requested actions.
7. **Bilingual integrity.** All user-facing text must exist in both Arabic and English. Arabic is the primary language.
8. **Mobile responsive.** All designs must work on mobile browsers.
9. **RTL-first.** Arabic layout uses `dir="rtl"`. English uses `dir="ltr"`. Both must render correctly.

---

## 3. Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | React | 19 | SPA with client-side routing |
| **Styling** | Tailwind CSS | 4 | OKLCH color format in `@theme inline` blocks |
| **UI Components** | shadcn/ui | Latest | Import from `@/components/ui/*` |
| **Routing** | wouter | 3.7.1 | Patched version (see `patches/`) |
| **RPC** | tRPC | 11 | End-to-end type safety |
| **Serialization** | Superjson | 1.x | Handles Date, BigInt, etc. |
| **Server** | Express | 4 | Serves both API and static files |
| **ORM** | Drizzle | Latest | MySQL dialect, schema in `drizzle/schema.ts` |
| **Database** | MySQL / TiDB | 8.x | 35+ tables, migrations via `drizzle-kit` |
| **Auth** | JWT (bcrypt + jose) | Custom | Local auth, no OAuth |
| **Storage** | S3-compatible (Cloudflare R2) | AWS SDK v3 | Fallback to local `uploads/` directory |
| **Maps** | Google Maps JS API | Direct key | `GOOGLE_MAPS_API_KEY` env var |
| **Payments** | PayPal + Moyasar | SDKs | PayPal for international, Moyasar for Saudi (mada, Apple Pay) |
| **Email** | Nodemailer | Latest | SMTP configuration |
| **SMS** | Taqnyat | REST API | Saudi SMS provider |
| **WhatsApp** | Meta Cloud API + Taqnyat | REST | Template messages, webhooks |
| **Push** | web-push (VAPID) | Latest | Browser push notifications |
| **AI Assistant** | OpenAI-compatible API | GPT-4o-mini | Optional, disabled if no `OPENAI_API_KEY` |
| **OG Images** | Sharp + SVG | Latest | Dynamic Open Graph image generation |
| **Testing** | Vitest | 2.x | 302+ tests across 17 files |
| **Build** | Vite | 7.x | Frontend build + esbuild for server |
| **Package Manager** | pnpm | 10.4.1 | Lockfile enforced |
| **Runtime** | Node.js | 22 | Docker image: `node:22-slim` |

---

## 4. Project Structure

```
mk/
├── client/                          # Frontend (React SPA)
│   ├── index.html                   # HTML entry point
│   ├── public/                      # Static assets (favicon, sw.js, manifest)
│   └── src/
│       ├── App.tsx                  # Routes & top-level layout (35+ routes)
│       ├── main.tsx                 # React entry point
│       ├── index.css                # Global styles, Tailwind config, RTL rules
│       ├── pages/                   # Page-level components (60+ files)
│       │   ├── Home.tsx             # Homepage with hero, search, cities, CTA
│       │   ├── Search.tsx           # Property search with filters
│       │   ├── MapView.tsx          # Map-based property search (Leaflet)
│       │   ├── PropertyDetail.tsx   # Single property page
│       │   ├── Login.tsx            # Login form
│       │   ├── Register.tsx         # Registration with privacy agreement
│       │   ├── SubmitProperty.tsx   # 5-step property submission form
│       │   ├── CreateProperty.tsx   # Old property form (redirects to SubmitProperty)
│       │   ├── BookingFlow.tsx      # 4-step booking process
│       │   ├── TenantDashboard.tsx  # Tenant portal
│       │   ├── LandlordDashboard.tsx # Landlord portal
│       │   ├── Messages.tsx         # Chat interface
│       │   ├── Admin*.tsx           # Admin pages (20+ files)
│       │   └── ...
│       ├── components/              # Reusable components
│       │   ├── Navbar.tsx           # Main navigation (bilingual, RTL/LTR)
│       │   ├── Footer.tsx           # Site footer
│       │   ├── AiAssistant.tsx      # Floating AI chat widget
│       │   ├── WhatsAppButton.tsx   # WhatsApp FAB
│       │   ├── CookieConsent.tsx    # GDPR/PDPL cookie banner
│       │   ├── PropertyCard.tsx     # Property listing card
│       │   ├── Map.tsx              # Google Maps component
│       │   ├── PinPickerMap.tsx     # Location picker map
│       │   ├── DashboardLayout.tsx  # Admin sidebar layout
│       │   ├── ErrorBoundary.tsx    # Error boundary wrapper
│       │   └── ui/                  # shadcn/ui components
│       ├── contexts/
│       │   ├── SiteSettingsContext.tsx  # CMS settings provider
│       │   └── ThemeContext.tsx         # Light/dark theme
│       ├── hooks/
│       │   ├── useMobile.tsx        # Mobile detection
│       │   ├── useDebounce.ts       # Debounce hook
│       │   ├── useScrollAnimation.ts # Scroll-based animations
│       │   └── usePageTracking.ts   # Analytics tracking
│       └── lib/
│           ├── i18n.tsx             # Internationalization (AR/EN translations)
│           ├── trpc.ts              # tRPC client setup
│           ├── utils.ts             # Utility functions (cn, formatters)
│           ├── image-utils.ts       # Image processing helpers
│           └── hardeningData.ts     # Hardening checklist data
│
├── server/                          # Backend (Express + tRPC)
│   ├── _core/                       # Core server infrastructure
│   │   ├── index.ts                 # Express app setup, middleware, startup
│   │   ├── auth.ts                  # Local auth routes (login, register, logout)
│   │   ├── context.ts              # tRPC context creation
│   │   ├── env.ts                  # Environment variable validation
│   │   ├── sdk.ts                  # JWT session management (local, no OAuth)
│   │   ├── cookies.ts             # Cookie configuration
│   │   ├── trpc.ts                # tRPC router/procedure definitions
│   │   ├── vite.ts                # Vite dev server integration
│   │   ├── llm.ts                 # LLM API client (OpenAI-compatible)
│   │   ├── imageGeneration.ts     # Image generation via OpenAI
│   │   ├── voiceTranscription.ts  # Whisper speech-to-text
│   │   └── map.ts                 # Google Maps proxy
│   ├── routers/                    # tRPC routers (split modules)
│   │   ├── index.ts               # Router aggregation (appRouter)
│   │   ├── admin.router.ts        # Admin operations
│   │   ├── auth.router.ts         # Auth procedures
│   │   ├── booking.router.ts      # Booking CRUD
│   │   ├── cms.router.ts          # CMS/settings management
│   │   ├── geo.router.ts          # Cities, districts, geocoding
│   │   ├── lease.router.ts        # Lease contract generation
│   │   ├── maintenance.router.ts  # Maintenance requests
│   │   ├── manager.router.ts      # Property manager CRUD
│   │   ├── notification.router.ts # Push notifications
│   │   ├── payment.router.ts      # Payment processing
│   │   ├── property.router.ts     # Property CRUD & search
│   │   ├── roles.router.ts        # RBAC roles
│   │   ├── user.router.ts         # User profile management
│   │   └── ai.router.ts           # AI assistant procedures
│   ├── db.ts                       # Database connection & CRUD helpers
│   ├── security.ts                 # Input sanitization, file validation
│   ├── rate-limiter.ts             # Rate limiting (Redis or in-memory)
│   ├── permissions.ts              # RBAC permission system (18 permissions)
│   ├── feature-flags.ts            # Feature flag system (DB-backed)
│   ├── audit-log.ts                # Audit trail for admin actions
│   ├── token-blacklist.ts          # JWT revocation list
│   ├── storage.ts                  # S3/R2 file storage with local fallback
│   ├── otp.ts                      # OTP generation, hashing, verification
│   ├── otp-providers.ts            # SMS/email OTP delivery
│   ├── email.ts                    # SMTP email sending
│   ├── push.ts                     # Web push notifications
│   ├── og-image.ts                 # Dynamic OG image generation (Sharp)
│   ├── shomoos.ts                  # Shomoos (شموس) MOI integration
│   ├── taqnyat.ts                  # Taqnyat SMS & WhatsApp
│   ├── whatsapp-cloud.ts           # Meta WhatsApp Cloud API
│   ├── moyasar.ts                  # Moyasar payment provider
│   ├── paypal.ts                   # PayPal payment provider
│   ├── finance-registry.ts         # Financial ledger & building management
│   ├── finance-routers.ts          # Finance tRPC routers
│   ├── integration-routers.ts      # Integration management routers
│   ├── integration-settings.ts     # Integration config helpers
│   ├── submission-routers.ts       # Property submission routers
│   ├── booking-calculator.ts       # Pricing engine (fees, VAT, insurance)
│   ├── breakglass.ts               # Emergency admin bypass
│   ├── cache.ts                    # Redis cache wrapper
│   ├── encryption.ts               # AES encryption for stored secrets
│   ├── image-optimizer.ts          # Image resizing/optimization (Sharp)
│   ├── maps-service.ts             # Google Maps geocoding service
│   ├── lease-contract.ts           # HTML lease contract generator
│   ├── occupancy.ts                # Unit occupancy tracking
│   ├── renewal.ts                  # Booking renewal logic
│   ├── seed-admin.ts               # Admin user seeding
│   ├── seed-cities.ts              # Saudi cities/districts seeding
│   ├── seed-settings.ts            # Default platform settings
│   └── tests/                      # Server-specific tests
│
├── drizzle/                         # Database schema & migrations
│   ├── schema.ts                   # All table definitions (35+ tables, 1070 lines)
│   ├── 0000_*.sql ... 0025_*.sql   # 26 migration files
│   └── meta/                       # Drizzle migration metadata
│
├── shared/                          # Shared types & constants
│   ├── const.ts                    # COOKIE_NAME, error messages
│   ├── types.ts                    # Shared TypeScript types
│   └── service_areas.ts            # Service area definitions
│
├── services/                        # Microservices (future architecture)
│   ├── hub-api/                    # Central API for multi-brand management
│   ├── cobnb-adapter-api/          # COBNB brand adapter
│   ├── monthlykey-adapter-api/     # Monthly Key brand adapter
│   └── worker/                     # Background job worker
│
├── apps/                            # Additional applications
│   ├── cobnb-web/                  # COBNB web frontend
│   └── monthly-key-mobile/         # React Native mobile app
│
├── tests/                           # Integration & golden tests
│   ├── integration/                # End-to-end flow tests
│   ├── golden/                     # Snapshot tests
│   ├── widget/                     # Component tests
│   └── ...
│
├── Dockerfile                       # Production Docker build
├── start.sh                         # Production boot script
├── vite.config.ts                   # Vite configuration
├── vitest.config.ts                 # Test configuration
├── drizzle.config.ts                # Drizzle ORM configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Dependencies & scripts
└── DEVELOPER_GUIDE.md               # Technical documentation
```

---

## 5. Database Schema (35+ Tables)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, name, email, phone, passwordHash, role (user/tenant/landlord/admin), isVerified, avatarUrl, recoveryEmail |
| `properties` | Property listings | id, userId, titleAr, titleEn, descriptionAr, descriptionEn, type (7 types), city, cityAr, district, districtAr, latitude, longitude, bedrooms, bathrooms, sizeSqm, monthlyRent, photos (JSON), status (active/inactive/pending/rejected), isFeatured, isVerified |
| `bookings` | Rental bookings | id, propertyId, tenantId, landlordId, status (6 states), moveInDate, moveOutDate, durationMonths, monthlyRent, totalAmount, priceBreakdown (JSON), source (BEDS24/LOCAL) |
| `payments` | Payment records | id, bookingId, amount, method, status, paypalOrderId, moyasarPaymentId |
| `conversations` | Chat threads | id, propertyId, participants (JSON) |
| `messages` | Chat messages | id, conversationId, senderId, content, isRead |
| `maintenanceRequests` | Maintenance tickets | id, bookingId, tenantId, category, description, photos (JSON), status, priority |
| `reviews` | Property reviews | id, userId, propertyId, bookingId, rating (1-5), comment, isApproved |

### Property Management

| Table | Purpose |
|-------|---------|
| `propertyAvailability` | Calendar availability blocks |
| `propertyManagers` | Agent/manager profiles with edit tokens |
| `propertyManagerAssignments` | Manager-property links |
| `inspectionRequests` | Property viewing requests |
| `favorites` | User saved properties |
| `savedSearches` | Saved search filters |
| `propertySubmissions` | New property submission requests (5-step form) |
| `submissionPhotos` | Photos attached to submissions |
| `hidden_properties` | Properties hidden by users |
| `property_enquiries` | User enquiries about properties |

### Admin & CMS

| Table | Purpose |
|-------|---------|
| `platformSettings` | CMS key-value store (50+ settings) |
| `roles` | RBAC role definitions |
| `adminPermissions` | Per-user permission overrides + isRootAdmin flag |
| `userActivities` | User activity tracking |
| `auditLog` | Admin action audit trail |
| `cmsContentVersions` | CMS content version history |
| `cmsMedia` | CMS media library |

### Finance & Buildings

| Table | Purpose |
|-------|---------|
| `buildings` | Building records |
| `units` | Individual unit records within buildings |
| `beds24Map` | Beds24 PMS mapping |
| `paymentLedger` | Financial ledger entries |
| `bookingExtensions` | Booking renewal records |
| `unitDailyStatus` | Daily unit occupancy status |
| `paymentMethodSettings` | Payment method configuration |

### Integration & Communication

| Table | Purpose |
|-------|---------|
| `integrationConfigs` | Integration credentials (encrypted) |
| `integrationCredentials` | Additional integration secrets |
| `whatsappMessages` | WhatsApp message log |
| `pushSubscriptions` | Browser push subscriptions |
| `otpCodes` | OTP verification codes |
| `geocodeCache` | Geocoding result cache |

### Compliance

| Table | Purpose |
|-------|---------|
| `kycRequests` | KYC verification requests |
| `kycDocuments` | KYC uploaded documents |
| `contactMessages` | Contact form submissions |

---

## 6. Authentication System

### Flow

1. User registers at `/register` with name, email, phone, password (min 7 chars, must include uppercase, lowercase, digit, special char)
2. Password hashed with bcrypt (12 rounds)
3. User logs in at `/login` — bcrypt compare — JWT cookie set (`httpOnly`, `secure`, `sameSite=lax`)
4. JWT signed with HS256 using `JWT_SECRET` env var (min 32 chars in production)
5. Session TTL: 30 minutes in production, 24 hours in development
6. Every request: JWT extracted from cookie → user loaded into `ctx.user`
7. `protectedProcedure` checks `ctx.user` exists (401 if not)
8. `adminWithPermission(perm)` checks `ctx.user.role === 'admin'` + specific permission

### User Roles

| Role | Access |
|------|--------|
| `user` | Browse, favorite, basic profile |
| `tenant` | Book properties, submit maintenance, message landlords |
| `landlord` | List properties, manage bookings, view revenue |
| `admin` | Full platform access (subject to 18 permission types) |

### Default Admin Account

| Field | Value |
|-------|-------|
| Username | `Hobart` |
| Password | `15001500` |
| Role | `admin` (root) |

### Security Features

- Rate limiting: 5 failed login attempts → 15-minute lockout
- Token blacklist for logout (Redis or in-memory)
- Account lockout per userId (prevents credential stuffing)
- Input sanitization (HTML entities, script tag removal)
- CORS, Helmet, compression middleware
- Security headers (CSP, X-Frame-Options, etc.)
- Break-glass admin bypass via env vars (emergency access)

---

## 7. Permission System (18 Permissions)

```typescript
PERMISSIONS = {
  MANAGE_USERS, MANAGE_PROPERTIES, MANAGE_BOOKINGS,
  MANAGE_PAYMENTS, MANAGE_SERVICES, MANAGE_MAINTENANCE,
  MANAGE_CITIES, MANAGE_CMS, MANAGE_ROLES,
  MANAGE_KNOWLEDGE, VIEW_ANALYTICS, MANAGE_SETTINGS,
  SEND_NOTIFICATIONS, MANAGE_AI, MANAGE_PAYMENTS_OVERRIDE,
  MANAGE_WHATSAPP, MANAGE_KYC, MANAGE_INTEGRATIONS
}
```

Root admins (`isRootAdmin=true` in `adminPermissions` table) bypass all permission checks. Permissions are cached for 60 seconds.

---

## 8. Frontend Routes (35+)

### Public Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Homepage with hero, search, cities, CTA |
| `/search` | Search | Property search with filters |
| `/map` | MapView | Map-based property search |
| `/property/:id` | PropertyDetail | Single property page |
| `/login` | Login | Login form |
| `/register` | Register | Registration with privacy agreement |
| `/forgot-password` | ForgotPassword | Password reset |
| `/faq` | FAQ | Frequently asked questions |
| `/privacy` | PrivacyPolicy | PDPL privacy policy |
| `/terms` | TermsOfService | Terms of service |
| `/contact` | ContactUs | Contact form |
| `/agent/:id` | AgentProfile | Property manager profile |
| `/submit-property` | SubmitProperty | 5-step property submission |

### Protected Routes (require login)

| Path | Component | Description |
|------|-----------|-------------|
| `/tenant` | TenantDashboard | Tenant portal |
| `/landlord` | LandlordDashboard | Landlord portal |
| `/messages` | Messages | Chat interface |
| `/book/:propertyId` | BookingFlow | 4-step booking |
| `/pay/:id` | PaymentPage | Payment processing |
| `/maintenance/new/:bookingId` | MaintenanceRequest | Submit maintenance |
| `/lease/:bookingId` | LeaseContract | View lease contract |

### Admin Routes (require admin role + permissions)

| Path | Component | Description |
|------|-----------|-------------|
| `/admin` | AdminDashboard | Platform overview |
| `/admin/settings` | AdminSettings | CMS management (175K+ lines) |
| `/admin/properties` | AdminProperties | Property moderation |
| `/admin/properties/:id/edit` | AdminPropertyEdit | Edit property |
| `/admin/bookings` | AdminBookings | Booking management |
| `/admin/payments` | AdminPayments | Payment overview |
| `/admin/submissions` | AdminSubmissions | Property submission requests |
| `/admin/cities` | CityDistrictManagement | City/district management |
| `/admin/managers` | AdminManagers | Property manager management |
| `/admin/services` | AdminServices | Platform services |
| `/admin/emergency-maintenance` | AdminEmergencyMaintenance | Emergency cases |
| `/admin/analytics` | AdminAnalytics | Charts & analytics |
| `/admin/permissions` | AdminPermissions | Role & permission management |
| `/admin/integrations` | AdminIntegrations | Integration settings |
| `/admin/whatsapp` | AdminWhatsApp | WhatsApp management |
| `/admin/shomoos` | AdminShomoos | Shomoos MOI integration |
| `/admin/kyc` | AdminKYC | KYC verification |
| `/admin/cms` | AdminCMS | Content management |
| `/admin/feature-flags` | AdminFeatureFlags | Feature flag toggles |
| `/admin/audit-log` | AdminAuditLog | Audit trail viewer |
| `/admin/buildings` | AdminBuildings | Building management |
| `/admin/units/:id` | AdminUnitFinance | Unit finance details |
| `/admin/db-status` | AdminDbStatus | Database health check |
| `/admin/hardening` | AdminHardeningKB | Production hardening checklist |

---

## 9. CMS System

All configurable content is stored in the `platformSettings` table as key-value pairs. The admin panel at `/admin/settings` provides a tabbed interface.

### Setting Categories

| Category | Examples |
|----------|---------|
| **Site Identity** | `site.nameAr`, `site.nameEn`, `site.logoUrl`, `site.faviconUrl` |
| **Hero Section** | `hero.titleAr`, `hero.subtitleEn`, `hero.bgImage`, `hero.ctaText` |
| **Platform Fees** | `fees.serviceFee`, `fees.vat`, `fees.insurance`, `rental.minMonths`, `rental.maxMonths` |
| **Homepage Content** | `howItWorks.steps`, `cta.titleAr`, `services.items` |
| **Footer** | `footer.aboutAr`, `footer.phone`, `footer.email`, `footer.socialLinks` |
| **Payment** | `paypal.clientId`, `paypal.clientSecret`, `paypal.sandbox` |
| **WhatsApp** | `whatsapp.number`, `whatsapp.message` |
| **Legal** | `legal.tourismLicence`, `legal.crNumber`, `legal.vatNumber` |
| **Maintenance** | `maintenance.enabled` (maintenance mode toggle) |
| **Privacy/Terms** | `privacy.policyAr`, `privacy.policyEn`, `terms.contentAr`, `terms.contentEn` |
| **Submission Agreement** | `submission.agreementAr`, `submission.agreementEn` |

### Accessing CMS Settings

**Server-side:**
```typescript
import { getSetting, getAllSettings } from "./db";
const serviceFee = await getSetting("fees.serviceFee");
```

**Client-side:**
```typescript
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
const { get } = useSiteSettings();
const siteName = get("site.nameAr", "المفتاح الشهري");
```

---

## 10. Internationalization (i18n)

The i18n system is defined in `client/src/lib/i18n.tsx`. It uses a context provider with the `useI18n` hook.

### Usage Pattern

```typescript
import { useI18n } from "@/lib/i18n";

function MyComponent() {
  const { t, lang, dir, toggleLang } = useI18n();
  return (
    <div dir={dir}>
      <h1>{t("hero.title")}</h1>
      <button onClick={toggleLang}>{lang === "ar" ? "EN" : "عربي"}</button>
    </div>
  );
}
```

### Translation Keys

All translations are defined inline in `i18n.tsx` as `translations.ar` and `translations.en` objects. Key categories:

- `nav.*` — Navigation labels
- `hero.*` — Homepage hero section
- `search.*` — Search & filters
- `property.*` — Property details
- `booking.*` — Booking flow
- `dashboard.*` — Dashboard labels
- `admin.*` — Admin panel
- `auth.*` — Login/register
- `type.*` — Property types
- `map.*` — Map view

### RTL/LTR Rules

The global CSS in `client/src/index.css` contains RTL-specific rules:

```css
[dir="rtl"] { text-align: right; }
[dir="rtl"] nav .flex:not(.flex-col) { flex-direction: row-reverse; }
[dir="rtl"] .grid { direction: rtl; }
```

The Navbar component handles RTL layout via conditional classes on the main container (not on individual nav link groups).

---

## 11. Navbar Architecture

The Navbar (`client/src/components/Navbar.tsx`) is the most complex UI component. Key behaviors:

1. **Logo**: Horizontal layout — logo image + business name ("المفتاح الشهري" / "Monthly Key") with silver gradient effect
2. **Nav Links (Desktop)**: Home, Search, Map, Dashboard, Messages — displayed in natural DOM order
3. **RTL Layout**: The main navbar container uses `flex-row-reverse` in Arabic mode to position logo on the right and controls on the left. The nav links container does NOT use `flex-row-reverse` — the `dir="rtl"` on the page handles right-to-left reading order naturally.
4. **Mobile**: Hamburger menu with slide-out drawer
5. **Language Toggle**: AR/EN switch button
6. **User Menu**: Login button or user avatar dropdown
7. **Notifications**: Bell icon with unread count badge

### Arabic Nav Order (right to left)

الرئيسية (Home) ← البحث (Search) ← الخريطة (Map) ← لوحة التحكم (Dashboard) ← الرسائل (Messages)

---

## 12. Property Submission System

The new property submission flow (`/submit-property`) uses a 5-step form:

1. **Step 1**: Owner contact info (name, phone, email)
2. **Step 2**: Property location (city, district, address, Google Maps URL)
3. **Step 3**: Property details (type, bedrooms, bathrooms, size, furnished level, desired rent)
4. **Step 4**: Photos upload (up to 10 photos)
5. **Step 5**: Review & submit with mandatory privacy/terms agreement

Features:
- Draft saving to localStorage (auto-resume on return)
- Language-specific data: Arabic users submit Arabic-only fields, English users submit English-only fields
- Mandatory privacy agreement checkbox (text loaded from CMS)
- Admin view at `/admin/submissions` with status management (new → contacted → approved → rejected)
- WhatsApp integration for contacting property owners
- Internal notes for admin communication

---

## 13. Integrations

### Active Integrations

| Integration | Config Source | Description |
|-------------|-------------|-------------|
| **Google Maps** | `GOOGLE_MAPS_API_KEY` env var | Property location, geocoding, map views |
| **S3/R2 Storage** | `integration_configs` table or env vars | File uploads (photos, documents) |
| **SMTP Email** | `SMTP_*` env vars | Transactional emails |
| **PayPal** | CMS settings (`paypal.*`) | International payments |
| **Moyasar** | `integration_configs` table | Saudi payments (mada, Apple Pay, Google Pay) |
| **Taqnyat SMS** | `integration_configs` table | Saudi SMS provider |
| **Taqnyat WhatsApp** | `integration_configs` table | WhatsApp messaging |
| **Meta WhatsApp** | `integration_configs` table | WhatsApp Cloud API |
| **Shomoos** | `integration_configs` table | MOI guest registration |
| **Google Analytics** | `VITE_GA_MEASUREMENT_ID` env var | User analytics |
| **OpenAI** | `OPENAI_API_KEY` env var | AI assistant (optional) |

### Feature Flags

Feature flags are stored in `platformSettings` and controlled via `/admin/feature-flags`:

| Flag | Default | Description |
|------|---------|-------------|
| `USE_DB_INTEGRATIONS` | false | Use DB-stored integration configs |
| `ENABLE_INTEGRATION_PANEL_WRITE` | false | Allow admin to edit integrations |
| `SMS_ENABLED` | true | Enable SMS sending |
| `EMAIL_OTP_ENABLED` | true | Enable email OTP |
| `WHATSAPP_ENABLED` | true | Enable WhatsApp |
| `TAQNYAT_SMS_ENABLED` | false | Enable Taqnyat SMS |
| `TAQNYAT_WHATSAPP_ENABLED` | false | Enable Taqnyat WhatsApp |
| `verification.requireForInstantBook` | false | Require verification for instant booking |
| `verification.requireForPayment` | false | Require verification for payment |
| `kyc.enableGating` | false | Enable KYC gating |
| `kyc.enableSubmission` | false | Enable KYC submission |

---

## 14. Environment Variables

### Required (Production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Session signing key (min 32 chars) |
| `NODE_ENV` | `production` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (for AI features) | _(disabled)_ |
| `OPENAI_BASE_URL` | OpenAI-compatible API URL | `https://api.openai.com/v1` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | _(maps disabled)_ |
| `S3_BUCKET` | S3 bucket name | _(local storage)_ |
| `S3_ACCESS_KEY_ID` | S3 access key | _(local storage)_ |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | _(local storage)_ |
| `S3_ENDPOINT` | S3 endpoint URL | _(AWS default)_ |
| `S3_PUBLIC_BASE_URL` | CDN URL for S3 files | _(auto)_ |
| `REDIS_URL` | Redis connection string | _(in-memory fallback)_ |
| `SMTP_HOST` | SMTP server | `localhost` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | _(empty)_ |
| `SMTP_PASS` | SMTP password | _(empty)_ |
| `VITE_VAPID_PUBLIC_KEY` | Push notification public key | _(auto)_ |
| `VAPID_PRIVATE_KEY` | Push notification private key | _(auto)_ |
| `OTP_SECRET_PEPPER` | OTP hashing pepper | `dev-otp-pepper-...` |
| `SETTINGS_ENCRYPTION_KEY` | AES key for stored secrets (64 hex chars) | _(empty)_ |
| `SESSION_TTL_MS` | Session lifetime in ms | `1800000` (30 min) |

### Variables to NEVER Use

These are Manus AI variables that must be ignored/removed:

- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_OAUTH_PORTAL_URL`
- `OAUTH_SERVER_URL`
- `OWNER_OPEN_ID`

---

## 15. Deployment (Railway)

### Build Process

1. Push to `main` branch triggers Railway auto-deploy
2. Railway builds Docker image using `Dockerfile`
3. Build stages: install deps → build frontend (Vite) → build server (esbuild) → production image
4. `start.sh` runs on container start:
   - Validates `DATABASE_URL` exists
   - Runs `fix-columns.mjs` (safety net for missing DB columns)
   - Runs `drizzle-kit migrate` (applies pending migrations)
   - Starts `node dist/index.js`

### Railway Configuration

- **Service**: Web service with Docker builder
- **Database**: Railway MySQL (auto-injected `DATABASE_URL`)
- **Domain**: Custom domain `monthlykey.com` + Railway subdomain
- **Health check**: HTTP on port 3000
- **Restart policy**: Automatic

### Scripts

```bash
pnpm dev          # Development server (tsx watch)
pnpm build        # Production build (Vite + esbuild)
pnpm start        # Production server
pnpm test         # Run all tests
pnpm db:push      # Generate + apply migrations
```

---

## 16. Coding Conventions

### TypeScript

- Strict mode enabled
- All tRPC inputs validated with Zod
- Types flow end-to-end via tRPC (no manual API type definitions)
- Use `@/` alias for client imports, `@shared/` for shared imports

### React

- Functional components only
- React 19 features (no class components)
- `useEffect` for side effects (never setState in render phase)
- `React.lazy()` for admin pages (code splitting)
- `Suspense` with loading fallback for lazy-loaded routes

### Styling

- Tailwind CSS 4 with OKLCH colors
- `cn()` utility for conditional classes (from `@/lib/utils`)
- RTL handled via `dir="rtl"` attribute + CSS `[dir="rtl"]` selectors
- shadcn/ui components for all interactive elements
- No inline styles unless absolutely necessary

### File Naming

- Pages: PascalCase (`AdminDashboard.tsx`)
- Components: PascalCase (`PropertyCard.tsx`)
- Hooks: camelCase with `use` prefix (`useDebounce.ts`)
- Utilities: camelCase (`formatPrice.ts`)
- Server modules: kebab-case (`rate-limiter.ts`)
- Routers: kebab-case with `.router.ts` suffix (`admin.router.ts`)

### Git

- Commit messages: `type: description` (e.g., `feat:`, `fix:`, `perf:`, `refactor:`)
- Single `main` branch
- Push directly to `main` (auto-deploys to Railway)

---

## 17. Testing

### Test Structure

```bash
tests/
├── integration/          # End-to-end flow tests
├── golden/               # Snapshot tests
├── widget/               # Component tests
└── *.test.ts             # Standalone tests

server/
├── *.test.ts             # Server module tests
└── tests/                # Server-specific tests
```

### Running Tests

```bash
pnpm test                 # All tests
pnpm test:integration     # Integration tests only
pnpm test:golden          # Snapshot tests only
pnpm test:widget          # Component tests only
pnpm test:server          # Server tests only
pnpm test:coverage        # With coverage report
```

### Test Count

302+ tests across 17 files covering: property CRUD, bookings, messaging, maintenance, favorites, notifications, admin operations, PayPal, lease contracts, AI assistant, services, emergency maintenance, analytics, reviews, push notifications, roles, property managers, inspections, contact form, WhatsApp CMS, FAQ, legal compliance, email, auth logout, OTP, finance registry, Moyasar payments, payment badges, payment hardening.

---

## 18. Microservices Architecture (Future)

The `services/` directory contains microservices for a future multi-brand architecture:

| Service | Port | Purpose |
|---------|------|---------|
| `hub-api` | 4000 | Central API for multi-brand management (Beds24 integration) |
| `cobnb-adapter-api` | 4001 | COBNB brand adapter |
| `monthlykey-adapter-api` | 4002 | Monthly Key brand adapter |
| `worker` | — | Background job processing |

These services are NOT currently deployed. The main monolith handles everything.

---

## 19. Key Patterns

### Adding a New Feature

1. **Schema**: Add table to `drizzle/schema.ts`
2. **Migration**: Run `pnpm db:push`
3. **DB Helpers**: Add CRUD functions to `server/db.ts`
4. **Router**: Add tRPC procedures to appropriate router in `server/routers/`
5. **Frontend**: Create page in `client/src/pages/`, register route in `App.tsx`
6. **i18n**: Add translations to `client/src/lib/i18n.tsx`
7. **Tests**: Add test file, run `pnpm test`

### Adding a New Admin Page

1. Create `client/src/pages/AdminFeature.tsx`
2. Add lazy import in `App.tsx`
3. Add route: `<Route path="/admin/feature" component={AdminFeature} />`
4. Add navigation link in `AdminDashboard.tsx` sidebar
5. Protect endpoints with `adminWithPermission(PERMISSIONS.MANAGE_FEATURE)`

### Adding a New CMS Setting

1. Add default value in seed function (`server/seed-settings.ts`)
2. Add UI control in `AdminSettings.tsx`
3. Read via `useSiteSettings().get("key", "default")` in components

---

## 20. Known Issues & TODOs

### Active TODOs

- Bank section: Add second bank account fields, copy-as-image feature
- CMS: Wire remaining homepage sections to CMS keys
- Search: Replace `LIKE` queries with dedicated search engine (Meilisearch/Algolia)
- Redis: Required for production multi-instance rate limiting
- Monitoring: Set up Sentry for error tracking, uptime monitoring
- Image optimization: Ensure WebP/AVIF conversion on upload
- Accessibility: Full WCAG 2.2 AA audit needed

### Recently Completed

- Navbar redesign with bilingual logo and silver gradient
- 5-step property submission form with draft saving
- Privacy/terms agreements in registration and submission flows
- Admin submissions view with status management and WhatsApp
- Password minimum changed from 12 to 7 characters
- RTL/LTR navigation layout fix

---

## 21. Security Checklist

| Area | Status |
|------|--------|
| Password hashing (bcrypt 12 rounds) | Implemented |
| JWT session management (HS256) | Implemented |
| Rate limiting (login, register, OTP) | Implemented |
| Account lockout (5 failed attempts) | Implemented |
| Input sanitization (XSS prevention) | Implemented |
| CORS configuration | Implemented |
| Security headers (CSP, X-Frame-Options) | Implemented |
| File upload validation (type, size) | Implemented |
| SQL injection prevention (Drizzle ORM) | Implemented |
| Token blacklist (logout) | Implemented |
| Audit logging | Implemented |
| HTTPS enforcement | Via Railway |
| Cookie security (httpOnly, secure, sameSite) | Implemented |
| Permission-based access control (18 types) | Implemented |
| Break-glass admin bypass | Implemented |
| Integration credential encryption (AES) | Implemented |

---

## 22. File Size Reference

These are the largest files in the project (for context on complexity):

| File | Lines | Description |
|------|-------|-------------|
| `AdminSettings.tsx` | 175,888 | CMS management (all tabs) |
| `TenantDashboard.tsx` | 79,234 | Tenant portal |
| `PropertyDetail.tsx` | 70,465 | Property page |
| `Home.tsx` | 58,905 | Homepage |
| `AdminAnalytics.tsx` | 58,904 | Analytics dashboard |
| `admin.router.ts` | 59,450 | Admin API endpoints |
| `AdminBookings.tsx` | 53,800 | Booking management |
| `AdminDashboard.tsx` | 49,095 | Admin overview |
| `SubmitProperty.tsx` | 48,363 | Property submission form |
| `AdminProperties.tsx` | 48,885 | Property moderation |
| `drizzle/schema.ts` | 1,070 | Database schema |

---

*Last updated: March 9, 2026*
*Platform version: المفتاح الشهري v2.0*
*Total codebase: ~15,000 lines (server) + ~20,000 lines (client)*
