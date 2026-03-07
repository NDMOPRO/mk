import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// In-memory settings store
let settingsStore: Record<string, string> = {
  "site.name": "Monthly Key",
  "maintenance.enabled": "false",
};



// Mock permissions
vi.mock("./permissions", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  hasAnyPermission: vi.fn().mockResolvedValue(true),
  getUserPermissions: vi.fn().mockResolvedValue({ permissions: ["manage_cities", "manage_users", "manage_properties", "manage_bookings", "manage_payments", "manage_services", "manage_maintenance", "manage_settings", "manage_ai", "view_analytics", "manage_roles", "manage_cms", "manage_knowledge", "send_notifications"], isRoot: true }),
  clearPermissionCache: vi.fn(),
  PERMISSIONS: {
    MANAGE_USERS: "manage_users", MANAGE_PROPERTIES: "manage_properties", MANAGE_BOOKINGS: "manage_bookings",
    MANAGE_PAYMENTS: "manage_payments", MANAGE_SERVICES: "manage_services", MANAGE_MAINTENANCE: "manage_maintenance",
    MANAGE_CITIES: "manage_cities", MANAGE_CMS: "manage_cms", MANAGE_ROLES: "manage_roles",
    MANAGE_KNOWLEDGE: "manage_knowledge", VIEW_ANALYTICS: "view_analytics", MANAGE_SETTINGS: "manage_settings",
    SEND_NOTIFICATIONS: "send_notifications", MANAGE_AI: "manage_ai",
  },
  PERMISSION_CATEGORIES: [],
}));

// Mock db module
vi.mock("./db", () => ({
  getAdminPermissions: vi.fn().mockResolvedValue({ id: 1, userId: 1, permissions: ["manage_cities", "manage_settings", "manage_cms", "view_analytics", "manage_roles", "send_notifications"], isRootAdmin: true, createdAt: new Date(), updatedAt: new Date() }),
  // Settings
  getAllSettings: vi.fn().mockImplementation(async () => ({ ...settingsStore })),
  getSetting: vi.fn().mockImplementation(async (key: string) => settingsStore[key] ?? null),
  setSetting: vi.fn().mockImplementation(async (key: string, value: string) => { settingsStore[key] = value; }),
  bulkSetSettings: vi.fn().mockImplementation(async (settings: Record<string, string>) => {
    for (const [k, v] of Object.entries(settings)) settingsStore[k] = v;
  }),
  seedMissingSettings: vi.fn().mockResolvedValue(undefined),
  // Districts (used by districts.all)
  getAllDistricts: vi.fn().mockImplementation(async () => [
    { id: 1, cityId: 1, city: "Riyadh", cityAr: "الرياض", nameEn: "Al Olaya", nameAr: "العليا", latitude: "24.7", longitude: "46.7", isActive: true, sortOrder: 1 },
    { id: 2, cityId: 1, city: "Riyadh", cityAr: "الرياض", nameEn: "Al Malaz", nameAr: "الملز", latitude: "24.6", longitude: "46.7", isActive: true, sortOrder: 2 },
    { id: 3, cityId: 2, city: "Jeddah", cityAr: "جدة", nameEn: "Al Hamra", nameAr: "الحمراء", latitude: "21.5", longitude: "39.2", isActive: true, sortOrder: 1 },
    { id: 4, cityId: 3, city: "Madinah", cityAr: "المدينة", nameEn: "Al Haram", nameAr: "الحرم", latitude: "24.4", longitude: "39.6", isActive: true, sortOrder: 1 },
  ]),
  getDistrictsByCity: vi.fn().mockResolvedValue([]),
  getDistrictsByCityId: vi.fn().mockResolvedValue([]),
  getDistrictById: vi.fn().mockResolvedValue(null),
  getDistrictCount: vi.fn().mockResolvedValue(4),
  // Cities
  getAllCities: vi.fn().mockResolvedValue([]),
  getCityById: vi.fn().mockResolvedValue(null),
  getCityCount: vi.fn().mockResolvedValue(0),
  getFeaturedCities: vi.fn().mockResolvedValue([]),
  // Activity
  getActivityStats: vi.fn().mockResolvedValue({ totalActions: 42, uniqueUsers: 5, topActions: [{ action: "login", count: 20 }] }),
  getActivityLog: vi.fn().mockResolvedValue([]),
  trackActivity: vi.fn().mockResolvedValue(undefined),
  // Permissions (roles router)
  getAllAdminPermissions: vi.fn().mockResolvedValue([]),
  getAdminPermissionsById: vi.fn().mockResolvedValue(null),
  setAdminPermissions: vi.fn().mockResolvedValue(undefined),
  deleteAdminPermissions: vi.fn().mockResolvedValue(undefined),
  // Manager
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
  // Conversations
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 1 }),
  createMessage: vi.fn().mockResolvedValue(1),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  getUnreadMessageCount: vi.fn().mockResolvedValue(0),
  createNotification: vi.fn().mockResolvedValue(1),
  getPropertyById: vi.fn().mockResolvedValue(null),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "local",
      role: "admin",
      phone: "+966504466528",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUserCtx(id = 2): TrpcContext {
  return {
    user: {
      id,
      openId: `user-${id}`,
      email: `user${id}@test.com`,
      name: `User ${id}`,
      loginMethod: "local",
      role: "user",
      phone: "+966500000000",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
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

describe("Districts API", () => {
  it("returns all districts from the database", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const districts = await caller.districts.all();
    expect(Array.isArray(districts)).toBe(true);
    expect(districts.length).toBeGreaterThan(0);
  });

  it("each district has required fields", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const districts = await caller.districts.all();
    const first = districts[0] as any;
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("city");
    expect(first).toHaveProperty("cityAr");
    expect(first).toHaveProperty("nameEn");
    expect(first).toHaveProperty("nameAr");
  });

  it("includes districts from major Saudi cities", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const districts = await caller.districts.all();
    const cities = new Set((districts as any[]).map((d: any) => d.city));
    expect(cities.has("Riyadh")).toBe(true);
    expect(cities.has("Jeddah")).toBe(true);
    expect(cities.has("Madinah")).toBe(true);
  });
});

describe("Site Settings API", () => {
  const adminCaller = appRouter.createCaller(createAdminCtx());

  it("admin can get all settings as a record", async () => {
    const settings = await adminCaller.siteSettings.getAll();
    expect(typeof settings).toBe("object");
    expect(settings).not.toBeNull();
  });

  it("admin can set a setting", async () => {
    const result = await adminCaller.siteSettings.update({
      settings: { "test.key": "test-value-123" },
    });
    expect(result.success).toBe(true);
  });

  it("admin can read back the setting", async () => {
    const settings = await adminCaller.siteSettings.getAll() as Record<string, string>;
    expect(settings["test.key"]).toBe("test-value-123");
  });

  it("admin can update an existing setting", async () => {
    await adminCaller.siteSettings.update({
      settings: { "test.key": "updated-value-456" },
    });
    const settings = await adminCaller.siteSettings.getAll() as Record<string, string>;
    expect(settings["test.key"]).toBe("updated-value-456");
  });

  it("non-admin cannot update settings", async () => {
    const userCaller = appRouter.createCaller(createUserCtx());
    await expect(userCaller.siteSettings.update({ settings: { "x": "y" } })).rejects.toThrow();
  });
});

describe("User Activity Tracking API", () => {
  it("admin can get activity stats", async () => {
    const adminCaller = appRouter.createCaller(createAdminCtx());
    const stats = await adminCaller.activity.stats();
    expect(stats).toHaveProperty("totalActions");
    expect(stats).toHaveProperty("uniqueUsers");
    expect(stats).toHaveProperty("topActions");
    expect(Array.isArray(stats.topActions)).toBe(true);
  });

  it("admin can get activity log", async () => {
    const adminCaller = appRouter.createCaller(createAdminCtx());
    const result = await adminCaller.activity.log({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("non-admin cannot access activity stats", async () => {
    const userCaller = appRouter.createCaller(createUserCtx());
    await expect(userCaller.activity.stats()).rejects.toThrow();
  });
});

describe("Admin Permissions API", () => {
  const adminCaller = appRouter.createCaller(createAdminCtx());

  it("admin can list permissions", async () => {
    const permissions = await adminCaller.permissions.list();
    expect(Array.isArray(permissions)).toBe(true);
  });

  it("non-admin cannot access permissions", async () => {
    const userCaller = appRouter.createCaller(createUserCtx());
    await expect(userCaller.permissions.list()).rejects.toThrow();
  });
});

describe("Public Settings API", () => {
  it("public users can access site settings", async () => {
    const publicCaller = appRouter.createCaller(createPublicCtx());
    const settings = await publicCaller.siteSettings.getAll();
    expect(typeof settings).toBe("object");
    expect(settings).not.toBeNull();
  });
});
