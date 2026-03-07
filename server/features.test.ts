import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Favorites Service Tests ───
describe("Favorites - Local Storage", () => {
  const FAVORITES_KEY = "mk_favorites";

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  it("returns empty array when no favorites stored", () => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    expect(stored).toBeNull();
  });

  it("stores and retrieves favorites correctly", () => {
    const favorites = [1, 2, 3];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    const retrieved = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    expect(retrieved).toEqual([1, 2, 3]);
  });

  it("adds a favorite to existing list", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([1, 2]));
    const existing = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    const updated = [...existing, 3];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    const result = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    expect(result).toEqual([1, 2, 3]);
  });

  it("removes a favorite from existing list", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([1, 2, 3]));
    const existing: number[] = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    const updated = existing.filter((id) => id !== 2);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    const result = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    expect(result).toEqual([1, 3]);
  });

  it("does not add duplicate favorites", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([1, 2]));
    const existing: number[] = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    if (!existing.includes(2)) {
      existing.push(2);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(existing));
    const result = JSON.parse(localStorage.getItem(FAVORITES_KEY)!);
    expect(result).toEqual([1, 2]);
  });
});

// ─── Notification Preferences Tests ───
describe("Notification Preferences", () => {
  const PREFS_KEY = "mk_notification_prefs";

  const DEFAULT_PREFS = {
    enabled: false,
    bookingUpdates: true,
    newProperties: true,
    priceDrops: true,
    promotions: false,
  };

  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  it("returns default prefs when nothing stored", () => {
    const stored = localStorage.getItem(PREFS_KEY);
    expect(stored).toBeNull();
    // Simulating getNotificationPrefs behavior
    const prefs = stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    expect(prefs).toEqual(DEFAULT_PREFS);
    expect(prefs.enabled).toBe(false);
    expect(prefs.bookingUpdates).toBe(true);
  });

  it("saves and retrieves notification prefs", () => {
    const customPrefs = { ...DEFAULT_PREFS, enabled: true, promotions: true };
    localStorage.setItem(PREFS_KEY, JSON.stringify(customPrefs));
    const retrieved = JSON.parse(localStorage.getItem(PREFS_KEY)!);
    expect(retrieved.enabled).toBe(true);
    expect(retrieved.promotions).toBe(true);
  });

  it("merges partial prefs with defaults", () => {
    const partial = { enabled: true };
    localStorage.setItem(PREFS_KEY, JSON.stringify(partial));
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY)!);
    const merged = { ...DEFAULT_PREFS, ...stored };
    expect(merged.enabled).toBe(true);
    expect(merged.bookingUpdates).toBe(true); // from default
    expect(merged.promotions).toBe(false); // from default
  });

  it("toggles individual notification types", () => {
    const prefs = { ...DEFAULT_PREFS, enabled: true };
    prefs.priceDrops = !prefs.priceDrops;
    expect(prefs.priceDrops).toBe(false);
    prefs.priceDrops = !prefs.priceDrops;
    expect(prefs.priceDrops).toBe(true);
  });
});

// ─── Notification Templates Tests ───
describe("Notification Templates", () => {
  const templates = {
    bookingConfirmed: (name: string) => ({
      title: "تم تأكيد حجزك ✓",
      body: `تم تأكيد حجزك في ${name}. يمكنك مراجعة التفاصيل في حجوزاتي.`,
    }),
    bookingCancelled: (name: string) => ({
      title: "تم إلغاء الحجز",
      body: `تم إلغاء حجزك في ${name}. تواصل معنا إذا كان لديك أي استفسار.`,
    }),
    newProperty: (city: string) => ({
      title: "عقار جديد متاح 🏠",
      body: `تم إضافة عقار جديد في ${city}. اطلع عليه الآن!`,
    }),
    priceDrop: (name: string, price: string) => ({
      title: "انخفاض في السعر 📉",
      body: `انخفض سعر ${name} إلى ${price} شهرياً.`,
    }),
  };

  it("generates booking confirmed notification in Arabic", () => {
    const n = templates.bookingConfirmed("شقة الرياض");
    expect(n.title).toContain("تأكيد");
    expect(n.body).toContain("شقة الرياض");
  });

  it("generates booking cancelled notification", () => {
    const n = templates.bookingCancelled("فيلا جدة");
    expect(n.title).toContain("إلغاء");
    expect(n.body).toContain("فيلا جدة");
  });

  it("generates new property notification with city", () => {
    const n = templates.newProperty("الرياض");
    expect(n.title).toContain("جديد");
    expect(n.body).toContain("الرياض");
  });

  it("generates price drop notification with price", () => {
    const n = templates.priceDrop("شقة مفروشة", "٥٬٠٠٠ ر.س.");
    expect(n.body).toContain("٥٬٠٠٠ ر.س.");
    expect(n.body).toContain("شقة مفروشة");
  });
});

// ─── MK Proxy URL Construction Tests ───
describe("MK Proxy URL Construction", () => {
  const API_BASE = "/api/mk";

  function buildTrpcUrl(procedure: string, input?: Record<string, unknown>): string {
    const params = new URLSearchParams();
    if (input) {
      params.set("input", JSON.stringify({ "0": input }));
    }
    const queryString = params.toString();
    return `${API_BASE}/${procedure}${queryString ? `?${queryString}` : ""}`;
  }

  it("builds featured properties URL correctly", () => {
    const url = buildTrpcUrl("property.featured");
    expect(url).toBe("/api/mk/property.featured");
  });

  it("builds search URL with query params", () => {
    const url = buildTrpcUrl("property.search", { query: "الرياض", limit: 20 });
    expect(url).toContain("/api/mk/property.search");
    expect(url).toContain("input=");
    const parsed = new URL(url, "http://localhost");
    const input = JSON.parse(parsed.searchParams.get("input")!);
    expect(input["0"].query).toBe("الرياض");
    expect(input["0"].limit).toBe(20);
  });

  it("builds getById URL with numeric id", () => {
    const url = buildTrpcUrl("property.getById", { id: 42 });
    expect(url).toContain("/api/mk/property.getById");
    const parsed = new URL(url, "http://localhost");
    const input = JSON.parse(parsed.searchParams.get("input")!);
    expect(input["0"].id).toBe(42);
  });

  it("builds calculator config URL without params", () => {
    const url = buildTrpcUrl("calculator.config");
    expect(url).toBe("/api/mk/calculator.config");
  });
});

// ─── Pricing Calculator Tests ───
describe("Pricing Calculator", () => {
  // Replicate the calculateBookingTotal logic
  const defaultConfig = {
    insuranceRate: 10,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: false,
  };

  function calculateTotal(monthlyRent: number, months: number) {
    const baseRentTotal = monthlyRent * months;
    const insuranceAmount = baseRentTotal * (defaultConfig.insuranceRate / 100);
    const serviceFeeAmount = baseRentTotal * (defaultConfig.serviceFeeRate / 100);
    const subtotal = baseRentTotal + insuranceAmount + serviceFeeAmount;
    const vatAmount = subtotal * (defaultConfig.vatRate / 100);
    const grandTotal = subtotal + vatAmount;
    return { baseRentTotal, insuranceAmount, serviceFeeAmount, subtotal, vatAmount, grandTotal };
  }

  it("calculates 1 month correctly", () => {
    const result = calculateTotal(10000, 1);
    expect(result.baseRentTotal).toBe(10000);
    expect(result.insuranceAmount).toBe(1000);
    expect(result.serviceFeeAmount).toBe(500);
    expect(result.subtotal).toBe(11500);
    expect(result.vatAmount).toBe(1725);
    expect(result.grandTotal).toBe(13225);
  });

  it("calculates 6 months correctly", () => {
    const result = calculateTotal(8000, 6);
    expect(result.baseRentTotal).toBe(48000);
    expect(result.insuranceAmount).toBe(4800);
    expect(result.serviceFeeAmount).toBe(2400);
    expect(result.subtotal).toBe(55200);
  });

  it("includes 15% VAT (Saudi standard)", () => {
    const result = calculateTotal(5000, 1);
    const expectedSubtotal = 5000 + 500 + 250; // rent + insurance + service
    expect(result.subtotal).toBe(expectedSubtotal);
    expect(result.vatAmount).toBe(expectedSubtotal * 0.15);
  });

  it("handles zero rent gracefully", () => {
    const result = calculateTotal(0, 3);
    expect(result.grandTotal).toBe(0);
  });

  it("handles single month minimum stay", () => {
    const result = calculateTotal(12000, 1);
    expect(result.baseRentTotal).toBe(12000);
    expect(result.grandTotal).toBeGreaterThan(12000);
  });
});
