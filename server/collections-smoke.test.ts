/**
 * Smoke Tests — Collections Feature
 *
 * Tests the full Collections dropdown feature:
 * 1. Schema: hiddenProperties + propertyEnquiries tables exist
 * 2. DB functions: hide/unhide/enquiry CRUD
 * 3. tRPC routes: hidden.toggle, hidden.list, hidden.check, enquiry.create, enquiry.list
 * 4. Navbar: CollectionsDropdown component with all 4 items
 * 5. TenantDashboard: enquiries + hidden tabs, URL param support
 * 6. PropertyDetail: hide button
 * 7. i18n: AR + EN translations for all collection keys
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ─────────────────────────────────────────────────────────
const hiddenStore = new Map<string, boolean>();
const enquiryStore: Array<{ id: number; userId: number; propertyId: number; message?: string; createdAt: Date }> = [];
let enquiryIdCounter = 1;

vi.mock("./db", () => ({
  // ─── Existing mocks needed by router ───
  getAdminPermissions: vi.fn().mockResolvedValue({ id: 1, userId: 1, permissions: ["manage_users", "manage_properties", "manage_bookings", "manage_payments", "manage_services", "manage_maintenance", "manage_settings", "manage_ai", "view_analytics", "manage_roles", "manage_cities", "manage_cms", "manage_knowledge", "send_notifications"], isRootAdmin: true, createdAt: new Date(), updatedAt: new Date() }),
  isFavorite: vi.fn().mockResolvedValue(false),
  addFavorite: vi.fn().mockResolvedValue(undefined),
  removeFavorite: vi.fn().mockResolvedValue(undefined),
  getUserFavorites: vi.fn().mockResolvedValue([]),
  searchProperties: vi.fn().mockResolvedValue([]),
  getPropertyById: vi.fn().mockResolvedValue(null),
  createProperty: vi.fn().mockResolvedValue(1),
  updateProperty: vi.fn().mockResolvedValue(undefined),
  deleteProperty: vi.fn().mockResolvedValue(undefined),
  incrementPropertyViews: vi.fn().mockResolvedValue(undefined),
  getPropertiesByLandlord: vi.fn().mockResolvedValue([]),
  getPropertyAvailability: vi.fn().mockResolvedValue([]),
  setPropertyAvailability: vi.fn().mockResolvedValue(undefined),
  getReviewsByProperty: vi.fn().mockResolvedValue([]),
  getAverageRating: vi.fn().mockResolvedValue(0),
  createBooking: vi.fn().mockResolvedValue(1),
  getBookingById: vi.fn().mockResolvedValue(null),
  updateBooking: vi.fn().mockResolvedValue(undefined),
  getBookingsByTenant: vi.fn().mockResolvedValue([]),
  getBookingsByLandlord: vi.fn().mockResolvedValue([]),
  createPayment: vi.fn().mockResolvedValue(1),
  getPaymentsByTenant: vi.fn().mockResolvedValue([]),
  getPaymentsByLandlord: vi.fn().mockResolvedValue([]),
  getPaymentsByBooking: vi.fn().mockResolvedValue([]),
  getConversationsByUser: vi.fn().mockResolvedValue([]),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 1 }),
  createMessage: vi.fn().mockResolvedValue(1),
  getUnreadMessageCount: vi.fn().mockResolvedValue(0),
  createMaintenanceRequest: vi.fn().mockResolvedValue(1),
  getMaintenanceById: vi.fn().mockResolvedValue(null),
  updateMaintenanceRequest: vi.fn().mockResolvedValue(undefined),
  getMaintenanceByTenant: vi.fn().mockResolvedValue([]),
  getMaintenanceByLandlord: vi.fn().mockResolvedValue([]),
  getNotificationsByUser: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  createNotification: vi.fn().mockResolvedValue(1),
  createReview: vi.fn().mockResolvedValue(1),
  createSavedSearch: vi.fn().mockResolvedValue(1),
  getSavedSearches: vi.fn().mockResolvedValue([]),
  deleteSavedSearch: vi.fn().mockResolvedValue(undefined),
  getUserCount: vi.fn().mockResolvedValue(10),
  getPropertyCount: vi.fn().mockResolvedValue(5),
  getBookingCount: vi.fn().mockResolvedValue(3),
  getTotalRevenue: vi.fn().mockResolvedValue("50000"),
  getOccupancyRate: vi.fn().mockResolvedValue(75),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllProperties: vi.fn().mockResolvedValue([]),
  getAllBookings: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  updateUserRole: vi.fn().mockResolvedValue(undefined),

  // ─── Hidden Properties mocks ───
  isPropertyHidden: vi.fn().mockImplementation(async (userId: number, propertyId: number) => {
    return hiddenStore.get(`${userId}:${propertyId}`) ?? false;
  }),
  hideProperty: vi.fn().mockImplementation(async (userId: number, propertyId: number) => {
    hiddenStore.set(`${userId}:${propertyId}`, true);
  }),
  unhideProperty: vi.fn().mockImplementation(async (userId: number, propertyId: number) => {
    hiddenStore.delete(`${userId}:${propertyId}`);
  }),
  getUserHiddenProperties: vi.fn().mockImplementation(async (userId: number) => {
    const results: Array<{ id: number; title: string }> = [];
    for (const [key, val] of hiddenStore.entries()) {
      if (val && key.startsWith(`${userId}:`)) {
        const propId = parseInt(key.split(":")[1]);
        results.push({ id: propId, title: `Property ${propId}` });
      }
    }
    return results;
  }),

  // ─── Enquiry mocks ───
  createPropertyEnquiry: vi.fn().mockImplementation(async (userId: number, propertyId: number, message?: string) => {
    const id = enquiryIdCounter++;
    enquiryStore.push({ id, userId, propertyId, message, createdAt: new Date() });
    return id;
  }),
  getUserEnquiries: vi.fn().mockImplementation(async (userId: number) => {
    return enquiryStore
      .filter(e => e.userId === userId)
      .map(e => ({ ...e, property: { id: e.propertyId, title: `Property ${e.propertyId}`, titleAr: `عقار ${e.propertyId}` } }));
  }),
  getPropertyEnquiries: vi.fn().mockImplementation(async (propertyId: number) => {
    return enquiryStore.filter(e => e.propertyId === propertyId);
  }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg", key: "test.jpg" }),
}));

// ─── Context Helpers ─────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SCHEMA TESTS — Verify tables exist in schema
// ═══════════════════════════════════════════════════════════════════════
describe("Collections Schema", () => {
  it("should have hiddenProperties table in schema", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schema).toContain('export const hiddenProperties = mysqlTable("hidden_properties"');
    expect(schema).toContain("userId");
    expect(schema).toContain("propertyId");
  });

  it("should have propertyEnquiries table in schema", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schema).toContain('export const propertyEnquiries = mysqlTable("property_enquiries"');
    expect(schema).toContain("userId");
    expect(schema).toContain("propertyId");
    expect(schema).toContain("message");
  });

  it("should export type definitions for both tables", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schema).toContain("export type HiddenProperty");
    expect(schema).toContain("export type InsertHiddenProperty");
    expect(schema).toContain("export type PropertyEnquiry");
    expect(schema).toContain("export type InsertPropertyEnquiry");
  });

  it("should create the hidden_properties table in a migration", async () => {
    const fs = await import("fs");
    const sql = fs.readFileSync("drizzle/0027_runtime_schema_to_migrations.sql", "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS hidden_properties");
  });

  it("should create the property_enquiries table in a migration", async () => {
    const fs = await import("fs");
    const sql = fs.readFileSync("drizzle/0027_runtime_schema_to_migrations.sql", "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS property_enquiries");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. DB FUNCTIONS — Verify all CRUD functions exist
// ═══════════════════════════════════════════════════════════════════════
describe("Collections DB Functions", () => {
  it("should export hideProperty function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function hideProperty");
  });

  it("should export unhideProperty function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function unhideProperty");
  });

  it("should export isPropertyHidden function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function isPropertyHidden");
  });

  it("should export getUserHiddenProperties function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function getUserHiddenProperties");
  });

  it("should export createPropertyEnquiry function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function createPropertyEnquiry");
  });

  it("should export getUserEnquiries function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function getUserEnquiries");
  });

  it("should export getPropertyEnquiries function", async () => {
    const fs = await import("fs");
    const db = fs.readdirSync("server/db").map((f) => fs.readFileSync(`server/db/${f}`, "utf-8")).join("\n");
    expect(db).toContain("export async function getPropertyEnquiries");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. tRPC ROUTES — Hidden Properties
// ═══════════════════════════════════════════════════════════════════════
describe("Hidden Properties tRPC Routes", () => {
  beforeEach(() => {
    hiddenStore.clear();
  });

  it("hidden.check returns false for unhidden property", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.hidden.check({ propertyId: 42 });
    expect(result).toEqual({ isHidden: false });
  });

  it("hidden.toggle hides a property", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.hidden.toggle({ propertyId: 42 });
    expect(result).toEqual({ isHidden: true });
  });

  it("hidden.toggle unhides a previously hidden property", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    // Hide first
    await caller.hidden.toggle({ propertyId: 42 });
    // Toggle again to unhide
    const result = await caller.hidden.toggle({ propertyId: 42 });
    expect(result).toEqual({ isHidden: false });
  });

  it("hidden.check returns true after hiding", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    await caller.hidden.toggle({ propertyId: 99 });
    const result = await caller.hidden.check({ propertyId: 99 });
    expect(result).toEqual({ isHidden: true });
  });

  it("hidden.list returns hidden properties for user", async () => {
    const { ctx } = createUserContext(2);
    const caller = appRouter.createCaller(ctx);
    await caller.hidden.toggle({ propertyId: 10 });
    await caller.hidden.toggle({ propertyId: 20 });
    const list = await caller.hidden.list();
    expect(list).toHaveLength(2);
    expect(list.map((p: any) => p.id)).toContain(10);
    expect(list.map((p: any) => p.id)).toContain(20);
  });

  it("hidden.list is isolated per user", async () => {
    const { ctx: ctx1 } = createUserContext(3);
    const { ctx: ctx2 } = createUserContext(4);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);
    await caller1.hidden.toggle({ propertyId: 50 });
    const list1 = await caller1.hidden.list();
    const list2 = await caller2.hidden.list();
    expect(list1).toHaveLength(1);
    expect(list2).toHaveLength(0);
  });

  it("hidden.toggle requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.hidden.toggle({ propertyId: 1 })).rejects.toThrow();
  });

  it("hidden.check requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.hidden.check({ propertyId: 1 })).rejects.toThrow();
  });

  it("hidden.list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.hidden.list()).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. tRPC ROUTES — Enquiries
// ═══════════════════════════════════════════════════════════════════════
describe("Enquiry tRPC Routes", () => {
  beforeEach(() => {
    enquiryStore.length = 0;
    enquiryIdCounter = 1;
  });

  it("enquiry.create creates an enquiry with message", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.enquiry.create({ propertyId: 42, message: "Is this still available?" });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("enquiry.create works without message", async () => {
    const { ctx } = createUserContext(1);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.enquiry.create({ propertyId: 42 });
    expect(result.success).toBe(true);
  });

  it("enquiry.list returns user's enquiries with property data", async () => {
    const { ctx } = createUserContext(5);
    const caller = appRouter.createCaller(ctx);
    await caller.enquiry.create({ propertyId: 10, message: "Question 1" });
    await caller.enquiry.create({ propertyId: 20, message: "Question 2" });
    const list = await caller.enquiry.list();
    expect(list).toHaveLength(2);
    expect(list[0].property).toBeDefined();
    expect(list[0].property.id).toBe(10);
    expect(list[1].property.id).toBe(20);
  });

  it("enquiry.list is isolated per user", async () => {
    const { ctx: ctx1 } = createUserContext(6);
    const { ctx: ctx2 } = createUserContext(7);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);
    await caller1.enquiry.create({ propertyId: 10 });
    const list1 = await caller1.enquiry.list();
    const list2 = await caller2.enquiry.list();
    expect(list1).toHaveLength(1);
    expect(list2).toHaveLength(0);
  });

  it("enquiry.create requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.enquiry.create({ propertyId: 1 })).rejects.toThrow();
  });

  it("enquiry.list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.enquiry.list()).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. NAVBAR — CollectionsDropdown component
// ═══════════════════════════════════════════════════════════════════════
describe("Navbar CollectionsDropdown", () => {
  it("should have CollectionsDropdown function in Navbar.tsx", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("function CollectionsDropdown");
  });

  it("should render Bookmark icon as trigger", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("<Bookmark");
    expect(navbar).toContain("import");
    expect(navbar).toContain("Bookmark");
  });

  it("should include all 4 collection items", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("collections.saved");
    expect(navbar).toContain("collections.inspections");
    expect(navbar).toContain("collections.enquired");
    expect(navbar).toContain("collections.hidden");
  });

  it("should link to correct tenant dashboard tabs", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("/tenant?tab=favorites");
    expect(navbar).toContain("/tenant?tab=inspections");
    expect(navbar).toContain("/tenant?tab=enquiries");
    expect(navbar).toContain("/tenant?tab=hidden");
  });

  it("should use correct icons for each item", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("Star");
    expect(navbar).toContain("ClipboardList");
    expect(navbar).toContain("Mail");
    expect(navbar).toContain("EyeOff");
  });

  it("should only show for authenticated users", async () => {
    const fs = await import("fs");
    const navbar = fs.readFileSync("client/src/components/Navbar.tsx", "utf-8");
    expect(navbar).toContain("isAuthenticated && <CollectionsDropdown");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. TENANT DASHBOARD — Enquiries + Hidden tabs
// ═══════════════════════════════════════════════════════════════════════
describe("TenantDashboard Collections Tabs", () => {
  it("should have enquiries tab trigger", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain('value="enquiries"');
    expect(td).toContain("الاستفسارات");
    expect(td).toContain("Enquiries");
  });

  it("should have hidden tab trigger", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain('value="hidden"');
    expect(td).toContain("المخفية");
    expect(td).toContain("Hidden");
  });

  it("should have TenantEnquiriesTab component", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("function TenantEnquiriesTab");
    expect(td).toContain("<TenantEnquiriesTab");
  });

  it("should have TenantHiddenTab component", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("function TenantHiddenTab");
    expect(td).toContain("<TenantHiddenTab");
  });

  it("should support URL tab parameter", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("URLSearchParams");
    expect(td).toContain('get("tab")');
  });

  it("should use trpc.enquiry.list in enquiries tab", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("trpc.enquiry.list.useQuery");
  });

  it("should use trpc.hidden.list in hidden tab", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("trpc.hidden.list.useQuery");
  });

  it("should use trpc.hidden.toggle for unhide action", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("trpc.hidden.toggle.useMutation");
  });

  it("should show empty states for both tabs", async () => {
    const fs = await import("fs");
    const td = fs.readFileSync("client/src/pages/TenantDashboard.tsx", "utf-8");
    expect(td).toContain("لا توجد استفسارات");
    expect(td).toContain("No enquiries");
    expect(td).toContain("لا توجد عقارات مخفية");
    expect(td).toContain("No hidden properties");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. PROPERTY DETAIL — Hide button
// ═══════════════════════════════════════════════════════════════════════
describe("PropertyDetail Hide Button", () => {
  it("should have hidden.check query", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    expect(pd).toContain("trpc.hidden.check.useQuery");
  });

  it("should have hidden.toggle mutation", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    expect(pd).toContain("trpc.hidden.toggle.useMutation");
  });

  it("should have enquiry.create mutation", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    expect(pd).toContain("trpc.enquiry.create.useMutation");
  });

  it("should render EyeOff icon for hide button", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    expect(pd).toContain("<EyeOff");
    expect(pd).toContain("toggleHidden.mutate");
  });

  it("should require authentication for hide action", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    // The hide button checks isAuthenticated before mutating
    expect(pd).toContain("isAuthenticated");
    expect(pd).toContain("toggleHidden");
  });

  it("should change button color when property is hidden", async () => {
    const fs = await import("fs");
    const pd = fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8");
    expect(pd).toContain("hiddenCheck.data?.isHidden");
    expect(pd).toContain("#f59e0b"); // amber color for hidden state
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. i18n — Arabic + English translations
// ═══════════════════════════════════════════════════════════════════════
describe("Collections i18n Translations", () => {
  it("should have Arabic translations for all collection keys", async () => {
    const fs = await import("fs");
    const i18n = fs.readFileSync("client/src/lib/i18n.tsx", "utf-8");
    expect(i18n).toContain('"nav.collections": "المجموعات"');
    expect(i18n).toContain('"collections.saved": "العقارات المحفوظة"');
    expect(i18n).toContain('"collections.inspections": "المعاينات المخططة"');
    expect(i18n).toContain('"collections.enquired": "الاستفسارات"');
    expect(i18n).toContain('"collections.hidden": "المخفية"');
  });

  it("should have English translations for all collection keys", async () => {
    const fs = await import("fs");
    const i18n = fs.readFileSync("client/src/lib/i18n.tsx", "utf-8");
    expect(i18n).toContain('"nav.collections": "Collections"');
    expect(i18n).toContain('"collections.saved": "Saved properties"');
    expect(i18n).toContain('"collections.inspections": "Planned inspections"');
    expect(i18n).toContain('"collections.enquired": "Enquired"');
    expect(i18n).toContain('"collections.hidden": "Hidden"');
  });

  it("should have Arabic empty state messages", async () => {
    const fs = await import("fs");
    const i18n = fs.readFileSync("client/src/lib/i18n.tsx", "utf-8");
    expect(i18n).toContain('"collections.noSaved"');
    expect(i18n).toContain('"collections.noInspections"');
    expect(i18n).toContain('"collections.noEnquiries"');
    expect(i18n).toContain('"collections.noHidden"');
  });

  it("should have English empty state messages", async () => {
    const fs = await import("fs");
    const i18n = fs.readFileSync("client/src/lib/i18n.tsx", "utf-8");
    expect(i18n).toContain("No saved properties yet");
    expect(i18n).toContain("No planned inspections");
    expect(i18n).toContain("No enquiries yet");
    expect(i18n).toContain("No hidden properties");
  });

  it("should have hide/unhide action translations", async () => {
    const fs = await import("fs");
    const i18n = fs.readFileSync("client/src/lib/i18n.tsx", "utf-8");
    expect(i18n).toContain('"collections.unhide"');
    expect(i18n).toContain('"collections.hide"');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. ROUTER INTEGRATION — Routes registered in appRouter
// ═══════════════════════════════════════════════════════════════════════
describe("Collections Router Integration", () => {
  it("should have hidden router in user.router.ts", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync("server/routers/user.router.ts", "utf-8");
    expect(router).toContain("hidden: router({");
    // Check procedures exist within the hidden router
    expect(router).toContain("toggle: protectedProcedure");
    expect(router).toContain("list: protectedProcedure");
    expect(router).toContain("check: protectedProcedure");
  });

  it("should have enquiry router in user.router.ts", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync("server/routers/user.router.ts", "utf-8");
    expect(router).toContain("enquiry: router({");
  });

  it("should spread userRouterDefs in appRouter", async () => {
    const fs = await import("fs");
    const index = fs.readFileSync("server/routers/index.ts", "utf-8");
    expect(index).toContain("...userRouterDefs");
  });

  it("hidden and enquiry routes should be accessible on appRouter", () => {
    // Verify the routes exist on the actual router object
    const procedures = Object.keys((appRouter as any)._def.procedures || {});
    // The routes should be namespaced as hidden.toggle, hidden.list, etc.
    expect(procedures).toContain("hidden.toggle");
    expect(procedures).toContain("hidden.list");
    expect(procedures).toContain("hidden.check");
    expect(procedures).toContain("enquiry.create");
    expect(procedures).toContain("enquiry.list");
  });
});
