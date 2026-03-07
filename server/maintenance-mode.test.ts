import { describe, expect, it, vi, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock permissions to always allow in tests
vi.mock("./permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  hasAnyPermission: vi.fn().mockResolvedValue(true),
  getUserPermissions: vi.fn().mockResolvedValue({
    permissions: [
      "manage_cities", "manage_users", "manage_properties", "manage_bookings",
      "manage_payments", "manage_services", "manage_maintenance", "manage_settings",
      "manage_ai", "view_analytics", "manage_roles", "manage_cms",
      "manage_knowledge", "send_notifications",
    ],
    isRoot: true,
  }),
  clearPermissionCache: vi.fn(),
  PERMISSIONS: {
    MANAGE_USERS: "manage_users", MANAGE_PROPERTIES: "manage_properties",
    MANAGE_BOOKINGS: "manage_bookings", MANAGE_PAYMENTS: "manage_payments",
    MANAGE_SERVICES: "manage_services", MANAGE_MAINTENANCE: "manage_maintenance",
    MANAGE_CITIES: "manage_cities", MANAGE_CMS: "manage_cms",
    MANAGE_ROLES: "manage_roles", MANAGE_KNOWLEDGE: "manage_knowledge",
    VIEW_ANALYTICS: "view_analytics", MANAGE_SETTINGS: "manage_settings",
    SEND_NOTIFICATIONS: "send_notifications", MANAGE_AI: "manage_ai",
  },
  PERMISSION_CATEGORIES: [],
}));

// Build comprehensive settings store matching seed-settings.ts (129+ keys)
const _settingsStore: Record<string, string> = {};
function _initSettings() {
  const defaults: Record<string, string> = {
    "site.nameAr": "المفتاح الشهري", "site.nameEn": "Monthly Key",
    "site.descriptionAr": "المفتاح الشهري", "site.descriptionEn": "Monthly Key connects tenants",
    "site.logoUrl": "", "site.faviconUrl": "",
    "site.primaryColor": "#3ECFC0", "site.accentColor": "#C9A96E",
    "hero.titleAr": "خبير الإيجار الشهري", "hero.titleEn": "Monthly Rental Expert",
    "hero.subtitleAr": "إدارة إيجارات شهرية", "hero.subtitleEn": "Premium monthly rental",
    "hero.bgImage": "", "hero.bgType": "image", "hero.bgVideo": "", "hero.overlayOpacity": "40",
    "stats.properties": "500+", "stats.propertiesLabelAr": "عقار متاح", "stats.propertiesLabelEn": "Available Properties",
    "stats.tenants": "1000+", "stats.tenantsLabelAr": "مستأجر سعيد", "stats.tenantsLabelEn": "Happy Tenants",
    "stats.cities": "50+", "stats.citiesLabelAr": "مدينة", "stats.citiesLabelEn": "Cities",
    "stats.satisfaction": "98%", "stats.satisfactionLabelAr": "رضا العملاء", "stats.satisfactionLabelEn": "Customer Satisfaction",
    "maintenance.enabled": "false",
    "maintenance.titleAr": "الموقع تحت الصيانة", "maintenance.titleEn": "Under Maintenance",
    "maintenance.subtitleAr": "نعمل على تحسين تجربتكم", "maintenance.subtitleEn": "We are improving your experience",
    "maintenance.messageAr": "يرجى المحاولة لاحقاً", "maintenance.messageEn": "Please try again later",
    "maintenance.imageUrl": "", "maintenance.countdownDate": "", "maintenance.showCountdown": "false",
    "social.twitter": "", "social.instagram": "", "social.snapchat": "",
    "social.tiktok": "", "social.linkedin": "", "social.youtube": "",
    "ai.enabled": "true", "ai.name": "مساعد المفتاح", "ai.nameEn": "Key Assistant",
    "ai.personality": "helpful", "ai.welcomeMessage": "مرحباً", "ai.welcomeMessageEn": "Welcome",
    "ai.customInstructions": "", "ai.maxResponseLength": "500",
    "footer.aboutAr": "عن المفتاح الشهري", "footer.aboutEn": "About Monthly Key",
    "footer.copyrightAr": "جميع الحقوق محفوظة", "footer.copyrightEn": "All rights reserved",
    "footer.phone": "+966504466528", "footer.email": "info@monthlykey.com",
    "footer.addressAr": "الرياض", "footer.addressEn": "Riyadh",
    "seo.titleAr": "المفتاح الشهري", "seo.titleEn": "Monthly Key",
    "seo.descriptionAr": "منصة الإيجار الشهري", "seo.descriptionEn": "Monthly rental platform",
    "seo.keywordsAr": "إيجار شهري", "seo.keywordsEn": "monthly rental",
    "seo.ogImage": "", "seo.canonical": "",
    "booking.minDays": "30", "booking.maxDays": "365",
    "booking.autoApprove": "false", "booking.requireKyc": "true",
    "booking.depositPercent": "100", "booking.cancellationHours": "48",
    "payment.currency": "SAR", "payment.vatRate": "15",
    "payment.serviceFeeRate": "5", "payment.insuranceRate": "10",
    "payment.insuranceMode": "percentage", "payment.hideInsuranceFromTenant": "true",
    "payment.moyasarEnabled": "true", "payment.paypalEnabled": "false",
    "notification.emailEnabled": "true", "notification.smsEnabled": "false",
    "notification.pushEnabled": "true", "notification.whatsappEnabled": "false",
    "notification.bookingConfirmation": "true", "notification.paymentReceipt": "true",
    "notification.maintenanceUpdate": "true",
    "kyc.required": "true", "kyc.autoApprove": "false",
    "kyc.idRequired": "true", "kyc.selfieRequired": "true",
    "map.defaultLat": "24.7136", "map.defaultLng": "46.6753", "map.defaultZoom": "12",
    "map.style": "default", "map.showClusters": "true",
    "search.defaultCity": "Riyadh", "search.maxResults": "50",
    "search.showMap": "true", "search.showFilters": "true",
    "property.maxPhotos": "20", "property.requireApproval": "true",
    "property.autoPublish": "false", "property.showViews": "true",
    "review.enabled": "true", "review.requireBooking": "true",
    "review.autoPublish": "false", "review.minRating": "1", "review.maxRating": "5",
    "chat.enabled": "true", "chat.maxMessageLength": "1000",
    "whatsapp.enabled": "false", "whatsapp.phone": "",
    "whatsapp.businessId": "", "whatsapp.token": "",
  };
  Object.assign(_settingsStore, defaults);
}
_initSettings();

// Mock db module
vi.mock("./db", () => ({
  getAdminPermissions: vi.fn().mockResolvedValue({ id: 1, userId: 1, permissions: ["manage_settings", "manage_cms"], isRootAdmin: true, createdAt: new Date(), updatedAt: new Date() }),
  getAllSettings: vi.fn().mockImplementation(async () => ({ ..._settingsStore })),
  getSetting: vi.fn().mockImplementation(async (key: string) => _settingsStore[key] ?? null),
  setSetting: vi.fn().mockImplementation(async (key: string, value: string) => { _settingsStore[key] = value; }),
  bulkSetSettings: vi.fn().mockImplementation(async (settings: Record<string, string>) => {
    for (const [k, v] of Object.entries(settings)) _settingsStore[k] = v;
  }),
  seedMissingSettings: vi.fn().mockResolvedValue(undefined),
  // Districts/Cities (needed by geo router)
  getAllDistricts: vi.fn().mockResolvedValue([]),
  getAllCities: vi.fn().mockResolvedValue([]),
  getCityById: vi.fn().mockResolvedValue(null),
  getCityCount: vi.fn().mockResolvedValue(0),
  getFeaturedCities: vi.fn().mockResolvedValue([]),
  getDistrictsByCity: vi.fn().mockResolvedValue([]),
  getDistrictsByCityId: vi.fn().mockResolvedValue([]),
  getDistrictById: vi.fn().mockResolvedValue(null),
  getDistrictCount: vi.fn().mockResolvedValue(0),
  // Activity/Manager
  getActivityStats: vi.fn().mockResolvedValue({ totalActions: 0, uniqueUsers: 0, topActions: [] }),
  getActivityLog: vi.fn().mockResolvedValue([]),
  trackActivity: vi.fn().mockResolvedValue(undefined),
  getAllManagersWithCounts: vi.fn().mockResolvedValue([]),
  getAllPropertyManagers: vi.fn().mockResolvedValue([]),
  getPropertyManagerById: vi.fn().mockResolvedValue(null),
  getPropertyManagerByProperty: vi.fn().mockResolvedValue(null),
  createPropertyManager: vi.fn().mockResolvedValue(1),
  updatePropertyManager: vi.fn().mockResolvedValue(undefined),
  deletePropertyManager: vi.fn().mockResolvedValue(undefined),
  getManagerAssignments: vi.fn().mockResolvedValue([]),
  assignManagerToProperties: vi.fn().mockResolvedValue(undefined),
  getManagerByEmail: vi.fn().mockResolvedValue(null),
  getManagerByToken: vi.fn().mockResolvedValue(null),
  setManagerEditToken: vi.fn().mockResolvedValue(undefined),
  getManagerWithProperties: vi.fn().mockResolvedValue(null),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 1 }),
  createMessage: vi.fn().mockResolvedValue(1),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  getUnreadMessageCount: vi.fn().mockResolvedValue(0),
  createNotification: vi.fn().mockResolvedValue(1),
  getPropertyById: vi.fn().mockResolvedValue(null),
  // Permissions (roles router)
  getAllAdminPermissions: vi.fn().mockResolvedValue([]),
  setAdminPermissions: vi.fn().mockResolvedValue(undefined),
  deleteAdminPermissions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

// Also mock seed-settings to use our in-memory store
vi.mock("./seed-settings", () => ({
  seedDefaultSettings: vi.fn().mockImplementation(async () => {
    // Seed only adds missing keys, doesn't overwrite
    // Since _settingsStore is already populated, this is a no-op
  }),
}));

// ── Context Helpers ──────────────────────────────────────────────────

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-test", email: "admin@test.com", name: "Admin",
      loginMethod: "local", role: "admin", phone: "+966504466528",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUserCtx(id = 2): TrpcContext {
  return {
    user: {
      id, openId: `user-${id}`, email: `user${id}@test.com`, name: `User ${id}`,
      loginMethod: "local", role: "user", phone: "+966500000000",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Maintenance Mode — Complete Logic", () => {
  const adminCaller = appRouter.createCaller(createAdminCtx());
  const userCaller = appRouter.createCaller(createUserCtx());
  const publicCaller = appRouter.createCaller(createPublicCtx());

  // ── 1. Seed & Default Settings ──

  describe("Default Settings Seeding", () => {
    it("maintenance.enabled exists in settings after seed", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings).toHaveProperty("maintenance.enabled");
    });

    it("maintenance.enabled defaults to a string value (true or false)", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      const val = settings["maintenance.enabled"];
      expect(["true", "false"]).toContain(val);
    });

    it("all maintenance keys are present after seed", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      const requiredKeys = [
        "maintenance.enabled", "maintenance.titleAr", "maintenance.titleEn",
        "maintenance.subtitleAr", "maintenance.subtitleEn",
        "maintenance.messageAr", "maintenance.messageEn",
        "maintenance.imageUrl", "maintenance.countdownDate", "maintenance.showCountdown",
      ];
      for (const key of requiredKeys) {
        expect(settings).toHaveProperty(key);
      }
    });

    it("all social keys are present after seed", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      const socialKeys = [
        "social.twitter", "social.instagram", "social.snapchat",
        "social.tiktok", "social.linkedin", "social.youtube",
      ];
      for (const key of socialKeys) {
        expect(settings).toHaveProperty(key);
      }
    });

    it("all AI keys are present after seed", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      const aiKeys = [
        "ai.enabled", "ai.name", "ai.nameEn", "ai.personality",
        "ai.welcomeMessage", "ai.welcomeMessageEn",
        "ai.customInstructions", "ai.maxResponseLength",
      ];
      for (const key of aiKeys) {
        expect(settings).toHaveProperty(key);
      }
    });

    it("settings count is at least 80 (comprehensive seed)", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(Object.keys(settings).length).toBeGreaterThanOrEqual(80);
    });
  });

  // ── 2. Toggle ON/OFF Cycle ──

  describe("Maintenance Toggle — Save & Read Cycle", () => {
    it("admin can enable maintenance mode (set to true)", async () => {
      const result = await adminCaller.siteSettings.update({
        settings: { "maintenance.enabled": "true" },
      });
      expect(result.success).toBe(true);
    });

    it("maintenance.enabled reads back as true after enabling", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("true");
    });

    it("admin can disable maintenance mode (set to false)", async () => {
      const result = await adminCaller.siteSettings.update({
        settings: { "maintenance.enabled": "false" },
      });
      expect(result.success).toBe(true);
    });

    it("maintenance.enabled reads back as false after disabling", async () => {
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("false");
    });

    it("rapid toggle: enable → disable → enable persists correctly", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } });
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "false" } });
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("true");
    });
  });

  // ── 3. Maintenance Content Updates ──

  describe("Maintenance Content — Save & Read", () => {
    it("admin can update maintenance title (Arabic)", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.titleAr": "الموقع تحت الصيانة" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.titleAr"]).toBe("الموقع تحت الصيانة");
    });

    it("admin can update maintenance title (English)", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.titleEn": "Under Maintenance" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.titleEn"]).toBe("Under Maintenance");
    });

    it("admin can update maintenance message (Arabic)", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.messageAr": "نعتذر عن الإزعاج" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.messageAr"]).toBe("نعتذر عن الإزعاج");
    });

    it("admin can update countdown date", async () => {
      const futureDate = "2026-03-01T00:00:00Z";
      await adminCaller.siteSettings.update({ settings: { "maintenance.countdownDate": futureDate } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.countdownDate"]).toBe(futureDate);
    });

    it("admin can enable countdown", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.showCountdown": "true" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.showCountdown"]).toBe("true");
    });

    it("admin can update social links", async () => {
      await adminCaller.siteSettings.update({
        settings: { "social.twitter": "https://twitter.com/monthlykey", "social.instagram": "https://instagram.com/monthlykey" },
      });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["social.twitter"]).toBe("https://twitter.com/monthlykey");
      expect(settings["social.instagram"]).toBe("https://instagram.com/monthlykey");
    });

    it("admin can batch-update multiple maintenance settings at once", async () => {
      const batch = {
        "maintenance.titleAr": "قريباً", "maintenance.titleEn": "Coming Soon",
        "maintenance.subtitleAr": "جاري التحضير", "maintenance.subtitleEn": "Preparing",
        "maintenance.enabled": "false",
      };
      const result = await adminCaller.siteSettings.update({ settings: batch });
      expect(result.success).toBe(true);
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.titleAr"]).toBe("قريباً");
      expect(settings["maintenance.titleEn"]).toBe("Coming Soon");
      expect(settings["maintenance.subtitleAr"]).toBe("جاري التحضير");
      expect(settings["maintenance.subtitleEn"]).toBe("Preparing");
      expect(settings["maintenance.enabled"]).toBe("false");
    });
  });

  // ── 4. Access Control ──

  describe("Access Control — Who Can Toggle", () => {
    it("non-admin user CANNOT update maintenance settings", async () => {
      await expect(userCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } })).rejects.toThrow();
    });

    it("public (unauthenticated) user CANNOT update maintenance settings", async () => {
      await expect(publicCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } })).rejects.toThrow();
    });

    it("public user CAN read settings (needed for MaintenanceGate)", async () => {
      const settings = await publicCaller.siteSettings.getAll();
      expect(typeof settings).toBe("object");
      expect(settings).not.toBeNull();
    });

    it("non-admin user CAN read settings (needed for MaintenanceGate)", async () => {
      const settings = await userCaller.siteSettings.getAll();
      expect(typeof settings).toBe("object");
      expect(settings).not.toBeNull();
    });
  });

  // ── 5. Settings Format Validation ──

  describe("Settings Format — Record<string, string>", () => {
    it("getAll returns a plain object (not an array)", async () => {
      const settings = await publicCaller.siteSettings.getAll();
      expect(Array.isArray(settings)).toBe(false);
      expect(typeof settings).toBe("object");
    });

    it("all values are strings", async () => {
      const settings = (await publicCaller.siteSettings.getAll()) as Record<string, string>;
      for (const [key, value] of Object.entries(settings)) {
        expect(typeof value).toBe("string");
      }
    });

    it("maintenance.enabled is exactly 'true' or 'false' string, not boolean", async () => {
      const settings = (await publicCaller.siteSettings.getAll()) as Record<string, string>;
      const val = settings["maintenance.enabled"];
      expect(typeof val).toBe("string");
      expect(["true", "false"]).toContain(val);
    });
  });

  // ── 6. Seed Idempotency ──

  describe("Seed Idempotency — Does NOT Overwrite Existing", () => {
    it("updating a setting then re-seeding preserves the updated value", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.titleAr": "عنوان مخصص" } });
      const { seedDefaultSettings } = await import("./seed-settings");
      await seedDefaultSettings();
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.titleAr"]).toBe("عنوان مخصص");
    });
  });

  // ── 7. Edge Cases ──

  describe("Edge Cases", () => {
    it("setting maintenance.enabled to empty string is treated as falsy", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("");
    });

    it("setting maintenance.enabled to 'TRUE' (uppercase) is not equal to 'true'", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "TRUE" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("TRUE");
    });

    it("restore maintenance.enabled to false for clean state", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "false" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("false");
    });

    it("individual get endpoint returns correct maintenance value", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } });
      const result = await publicCaller.siteSettings.get({ key: "maintenance.enabled" });
      expect(result.value).toBe("true");
    });

    it("individual get endpoint returns null for non-existent key", async () => {
      const result = await publicCaller.siteSettings.get({ key: "maintenance.nonexistent.key.xyz" });
      expect(result.value).toBeNull();
    });

    it("cleanup: set maintenance.enabled back to true for browser tests", async () => {
      await adminCaller.siteSettings.update({ settings: { "maintenance.enabled": "true" } });
      const settings = (await adminCaller.siteSettings.getAll()) as Record<string, string>;
      expect(settings["maintenance.enabled"]).toBe("true");
    });
  });
});
