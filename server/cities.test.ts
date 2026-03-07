import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// In-memory store for cities and districts
let cityStore: any[] = [
  { id: 1, nameEn: "Riyadh", nameAr: "الرياض", region: "Riyadh Region", regionAr: "منطقة الرياض", latitude: "24.7", longitude: "46.7", imageUrl: "", isActive: true, isFeatured: true, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, nameEn: "Jeddah", nameAr: "جدة", region: "Makkah Region", regionAr: "منطقة مكة", latitude: "21.5", longitude: "39.2", imageUrl: "", isActive: true, isFeatured: false, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
];
let districtStore: any[] = [
  { id: 1, cityId: 1, city: "Riyadh", cityAr: "الرياض", nameEn: "Al Olaya", nameAr: "العليا", latitude: "24.7", longitude: "46.7", isActive: true, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, cityId: 1, city: "Riyadh", cityAr: "الرياض", nameEn: "Al Malaz", nameAr: "الملز", latitude: "24.6", longitude: "46.7", isActive: true, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
];
let nextCityId = 3;
let nextDistrictId = 3;

// Mock permissions to always allow in tests
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

// Mock db module with in-memory store
vi.mock("./db", () => ({
  getAdminPermissions: vi.fn().mockResolvedValue({ id: 1, userId: 1, permissions: ["manage_cities"], isRootAdmin: true, createdAt: new Date(), updatedAt: new Date() }),
  getAllCities: vi.fn().mockImplementation(async (activeOnly = true) => {
    if (activeOnly) return cityStore.filter(c => c.isActive);
    return [...cityStore];
  }),
  getCityById: vi.fn().mockImplementation(async (id: number) => {
    return cityStore.find(c => c.id === id) || null;
  }),
  getCityCount: vi.fn().mockImplementation(async () => cityStore.length),
  createCity: vi.fn().mockImplementation(async (data: any) => {
    const id = nextCityId++;
    cityStore.push({ id, ...data, createdAt: new Date(), updatedAt: new Date() });
    return id;
  }),
  updateCity: vi.fn().mockImplementation(async (id: number, data: any) => {
    const idx = cityStore.findIndex(c => c.id === id);
    if (idx >= 0) cityStore[idx] = { ...cityStore[idx], ...data, updatedAt: new Date() };
  }),
  toggleCityActive: vi.fn().mockImplementation(async (id: number, isActive: boolean) => {
    const idx = cityStore.findIndex(c => c.id === id);
    if (idx >= 0) cityStore[idx].isActive = isActive;
  }),
  deleteCity: vi.fn().mockImplementation(async (id: number) => {
    cityStore = cityStore.filter(c => c.id !== id);
  }),
  getFeaturedCities: vi.fn().mockImplementation(async () => cityStore.filter(c => c.isFeatured && c.isActive)),
  getAllDistricts: vi.fn().mockImplementation(async (activeOnly = true) => {
    if (activeOnly) return districtStore.filter(d => d.isActive);
    return [...districtStore];
  }),
  getDistrictById: vi.fn().mockImplementation(async (id: number) => {
    return districtStore.find(d => d.id === id) || null;
  }),
  getDistrictsByCity: vi.fn().mockImplementation(async (city: string) => {
    return districtStore.filter(d => d.city === city);
  }),
  getDistrictsByCityId: vi.fn().mockImplementation(async (cityId: number) => {
    return districtStore.filter(d => d.cityId === cityId);
  }),
  getDistrictCount: vi.fn().mockImplementation(async () => districtStore.length),
  createDistrict: vi.fn().mockImplementation(async (data: any) => {
    const id = nextDistrictId++;
    districtStore.push({ id, ...data, createdAt: new Date(), updatedAt: new Date() });
    return id;
  }),
  updateDistrict: vi.fn().mockImplementation(async (id: number, data: any) => {
    const idx = districtStore.findIndex(d => d.id === id);
    if (idx >= 0) districtStore[idx] = { ...districtStore[idx], ...data, updatedAt: new Date() };
  }),
  toggleDistrictActive: vi.fn().mockImplementation(async (id: number, isActive: boolean) => {
    const idx = districtStore.findIndex(d => d.id === id);
    if (idx >= 0) districtStore[idx].isActive = isActive;
  }),
  deleteDistrict: vi.fn().mockImplementation(async (id: number) => {
    districtStore = districtStore.filter(d => d.id !== id);
  }),
  bulkCreateDistricts: vi.fn().mockImplementation(async (districts: any[]) => {
    for (const d of districts) {
      const id = nextDistrictId++;
      districtStore.push({ id, ...d, createdAt: new Date(), updatedAt: new Date() });
    }
  }),
  deleteDistrictsByCity: vi.fn().mockImplementation(async (city: string) => {
    districtStore = districtStore.filter(d => d.city !== city);
  }),
  getPropertyById: vi.fn().mockResolvedValue(null),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-test",
      email: "user@test.com",
      name: "User",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("Cities & Districts Management", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());

  describe("Cities", () => {
    it("should list all cities (public)", async () => {
      const cities = await userCaller.cities.all({ activeOnly: false });
      expect(Array.isArray(cities)).toBe(true);
    });

    it("should list only active cities when activeOnly is true", async () => {
      const cities = await userCaller.cities.all({ activeOnly: true });
      expect(Array.isArray(cities)).toBe(true);
      for (const city of cities) {
        expect(city.isActive).toBe(true);
      }
    });

    it("should create a city (admin only)", async () => {
      const result = await adminCaller.cities.create({
        nameAr: "مدينة اختبار",
        nameEn: "Test City",
        region: "Test Region",
        regionAr: "منطقة اختبار",
        latitude: "25.0",
        longitude: "45.0",
        imageUrl: "",
        sortOrder: 99,
        isActive: true,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);

      const city = await adminCaller.cities.byId({ id: result.id });
      expect(city?.nameEn).toBe("Test City");
      expect(city?.nameAr).toBe("مدينة اختبار");
    });

    it("should toggle city active status (admin only)", async () => {
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Test City");
      expect(testCity).toBeDefined();

      const result = await adminCaller.cities.toggle({ id: testCity!.id, isActive: false });
      expect(result.success).toBe(true);

      const updated = await adminCaller.cities.byId({ id: testCity!.id });
      expect(updated?.isActive).toBe(false);

      await adminCaller.cities.toggle({ id: testCity!.id, isActive: true });
    });

    it("should update a city (admin only)", async () => {
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Test City");
      expect(testCity).toBeDefined();

      const result = await adminCaller.cities.update({
        id: testCity!.id,
        nameAr: "مدينة اختبار محدثة",
        nameEn: "Updated Test City",
        region: "Updated Region",
        regionAr: "منطقة محدثة",
        latitude: "26.0",
        longitude: "46.0",
        imageUrl: "",
        sortOrder: 100,
        isActive: true,
      });
      expect(result.success).toBe(true);

      const updated = await adminCaller.cities.byId({ id: testCity!.id });
      expect(updated?.nameEn).toBe("Updated Test City");
    });

    it("should delete a city (admin only)", async () => {
      const cities = await adminCaller.cities.all({ activeOnly: false });
      const testCity = cities.find((c: any) => c.nameEn === "Updated Test City");
      expect(testCity).toBeDefined();

      const result = await adminCaller.cities.delete({ id: testCity!.id });
      expect(result.success).toBe(true);
    });
  });

  describe("Districts", () => {
    it("should list all districts (public)", async () => {
      const districts = await userCaller.districts.all({ activeOnly: false });
      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBeGreaterThan(0);
    });

    it("should list only active districts", async () => {
      const districts = await userCaller.districts.all({ activeOnly: true });
      expect(Array.isArray(districts)).toBe(true);
      for (const d of districts) {
        expect(d.isActive).toBe(true);
      }
    });

    it("should filter districts by city", async () => {
      const districts = await userCaller.districts.byCity({ city: "Riyadh" });
      expect(Array.isArray(districts)).toBe(true);
      for (const d of districts) {
        expect(d.city).toBe("Riyadh");
      }
    });

    it("should create a district (admin only)", async () => {
      const result = await adminCaller.districts.create({
        cityId: 1,
        city: "Riyadh",
        cityAr: "الرياض",
        nameAr: "حي اختبار",
        nameEn: "Test District",
        latitude: "24.7",
        longitude: "46.7",
        sortOrder: 999,
        isActive: true,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);

      const district = await adminCaller.districts.byId({ id: result.id });
      expect(district?.nameEn).toBe("Test District");
    });

    it("should toggle district active status (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.toggle({ id: testDistrict!.id, isActive: false });
      expect(result.success).toBe(true);

      const updated = await adminCaller.districts.byId({ id: testDistrict!.id });
      expect(updated?.isActive).toBe(false);

      await adminCaller.districts.toggle({ id: testDistrict!.id, isActive: true });
    });

    it("should update a district (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.update({
        id: testDistrict!.id,
        cityId: 1,
        city: "Riyadh",
        cityAr: "الرياض",
        nameAr: "حي اختبار محدث",
        nameEn: "Updated Test District",
        latitude: "24.8",
        longitude: "46.8",
        sortOrder: 1000,
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("should delete a district (admin only)", async () => {
      const districts = await adminCaller.districts.all({ activeOnly: false });
      const testDistrict = districts.find((d: any) => d.nameEn === "Updated Test District");
      expect(testDistrict).toBeDefined();

      const result = await adminCaller.districts.delete({ id: testDistrict!.id });
      expect(result.success).toBe(true);
    });
  });
});
