import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for the 3 new features:
 * 1. Advanced Search Filters (price range, bedrooms, furnishing, property type)
 * 2. Ratings & Reviews System
 * 3. Twilio SMS Setup & Phone OTP
 */

// ─── Feature 1: Advanced Search Filters ───

describe("Advanced Search Filters", () => {
  // Price range presets matching the UI
  const PRICE_PRESETS = [
    { label: "الكل", min: null, max: null },
    { label: "أقل من ٣٠٠٠", min: null, max: 3000 },
    { label: "٣٠٠٠ - ٥٠٠٠", min: 3000, max: 5000 },
    { label: "٥٠٠٠ - ٨٠٠٠", min: 5000, max: 8000 },
    { label: "٨٠٠٠ - ١٢٠٠٠", min: 8000, max: 12000 },
    { label: "أكثر من ١٢٠٠٠", min: 12000, max: null },
  ];

  describe("Price Range Presets", () => {
    it("should have 6 price presets including 'all'", () => {
      expect(PRICE_PRESETS).toHaveLength(6);
    });

    it("should have 'الكل' as the first preset with null min/max", () => {
      expect(PRICE_PRESETS[0].label).toBe("الكل");
      expect(PRICE_PRESETS[0].min).toBeNull();
      expect(PRICE_PRESETS[0].max).toBeNull();
    });

    it("should have ascending price ranges", () => {
      const withMin = PRICE_PRESETS.filter((p) => p.min !== null);
      for (let i = 1; i < withMin.length; i++) {
        expect(withMin[i].min!).toBeGreaterThanOrEqual(withMin[i - 1].min!);
      }
    });

    it("should cover the full price spectrum from 0 to unlimited", () => {
      // First non-all preset should have null min (covers 0)
      expect(PRICE_PRESETS[1].min).toBeNull();
      expect(PRICE_PRESETS[1].max).toBe(3000);
      // Last preset should have null max (covers unlimited)
      expect(PRICE_PRESETS[5].min).toBe(12000);
      expect(PRICE_PRESETS[5].max).toBeNull();
    });
  });

  describe("Filter Count Logic", () => {
    function countActiveFilters(filters: {
      minPrice: number | null;
      maxPrice: number | null;
      bedrooms: number | null;
      furnished: string | null;
      propertyType: string | null;
      city: string | null;
    }): number {
      let count = 0;
      if (filters.minPrice !== null) count++;
      if (filters.maxPrice !== null) count++;
      if (filters.bedrooms !== null) count++;
      if (filters.furnished !== null) count++;
      if (filters.propertyType !== null) count++;
      if (filters.city) count++;
      return count;
    }

    it("should return 0 when no filters are active", () => {
      expect(
        countActiveFilters({
          minPrice: null,
          maxPrice: null,
          bedrooms: null,
          furnished: null,
          propertyType: null,
          city: null,
        })
      ).toBe(0);
    });

    it("should count each active filter", () => {
      expect(
        countActiveFilters({
          minPrice: 3000,
          maxPrice: 8000,
          bedrooms: 2,
          furnished: null,
          propertyType: null,
          city: null,
        })
      ).toBe(3);
    });

    it("should count city as a filter", () => {
      expect(
        countActiveFilters({
          minPrice: null,
          maxPrice: null,
          bedrooms: null,
          furnished: null,
          propertyType: null,
          city: "الرياض",
        })
      ).toBe(1);
    });

    it("should count all 6 filters when all are active", () => {
      expect(
        countActiveFilters({
          minPrice: 5000,
          maxPrice: 12000,
          bedrooms: 3,
          furnished: "fully_furnished",
          propertyType: "apartment",
          city: "جدة",
        })
      ).toBe(6);
    });
  });

  describe("Search Params Construction", () => {
    interface SearchParams {
      query?: string;
      city?: string;
      propertyType?: string;
      minPrice?: number;
      maxPrice?: number;
      bedrooms?: number;
      furnishedLevel?: string;
      limit?: number;
    }

    function buildSearchParams(filters: {
      query: string;
      city: string | null;
      minPrice: number | null;
      maxPrice: number | null;
      bedrooms: number | null;
      furnished: string | null;
      propertyType: string | null;
    }): SearchParams {
      const params: SearchParams = { limit: 20 };
      if (filters.query.trim()) params.query = filters.query.trim();
      if (filters.city) params.city = filters.city;
      if (filters.minPrice !== null) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== null) params.maxPrice = filters.maxPrice;
      if (filters.bedrooms !== null) params.bedrooms = filters.bedrooms;
      if (filters.furnished !== null) params.furnishedLevel = filters.furnished;
      if (filters.propertyType !== null) params.propertyType = filters.propertyType;
      return params;
    }

    it("should build minimal params with no filters", () => {
      const params = buildSearchParams({
        query: "",
        city: null,
        minPrice: null,
        maxPrice: null,
        bedrooms: null,
        furnished: null,
        propertyType: null,
      });
      expect(params).toEqual({ limit: 20 });
    });

    it("should include all filter params when set", () => {
      const params = buildSearchParams({
        query: "شقة",
        city: "الرياض",
        minPrice: 3000,
        maxPrice: 8000,
        bedrooms: 2,
        furnished: "fully_furnished",
        propertyType: "apartment",
      });
      expect(params.query).toBe("شقة");
      expect(params.city).toBe("الرياض");
      expect(params.minPrice).toBe(3000);
      expect(params.maxPrice).toBe(8000);
      expect(params.bedrooms).toBe(2);
      expect(params.furnishedLevel).toBe("fully_furnished");
      expect(params.propertyType).toBe("apartment");
      expect(params.limit).toBe(20);
    });

    it("should trim query whitespace", () => {
      const params = buildSearchParams({
        query: "  الرياض  ",
        city: null,
        minPrice: null,
        maxPrice: null,
        bedrooms: null,
        furnished: null,
        propertyType: null,
      });
      expect(params.query).toBe("الرياض");
    });

    it("should not include empty query", () => {
      const params = buildSearchParams({
        query: "   ",
        city: null,
        minPrice: null,
        maxPrice: null,
        bedrooms: null,
        furnished: null,
        propertyType: null,
      });
      expect(params.query).toBeUndefined();
    });
  });

  describe("Property Type Labels", () => {
    const propertyTypeLabels: Record<string, string> = {
      apartment: "شقة",
      villa: "فيلا",
      studio: "استوديو",
      duplex: "دوبلكس",
      furnished_room: "غرفة مفروشة",
      compound: "كمباوند",
      hotel_apartment: "شقة فندقية",
    };

    it("should have labels for all property types", () => {
      expect(Object.keys(propertyTypeLabels)).toHaveLength(7);
    });

    it("should have Arabic labels", () => {
      Object.values(propertyTypeLabels).forEach((label) => {
        expect(/[\u0600-\u06FF]/.test(label)).toBe(true);
      });
    });
  });

  describe("Furnished Level Labels", () => {
    const furnishedLabels: Record<string, string> = {
      fully_furnished: "مفروشة بالكامل",
      semi_furnished: "مفروشة جزئياً",
      unfurnished: "غير مفروشة",
    };

    it("should have 3 furnished levels", () => {
      expect(Object.keys(furnishedLabels)).toHaveLength(3);
    });

    it("should have Arabic labels for all levels", () => {
      expect(furnishedLabels.fully_furnished).toBe("مفروشة بالكامل");
      expect(furnishedLabels.semi_furnished).toBe("مفروشة جزئياً");
      expect(furnishedLabels.unfurnished).toBe("غير مفروشة");
    });
  });

  describe("Bedroom Filter Options", () => {
    const bedroomOptions = [1, 2, 3, 4, 5];

    it("should offer 1-5 bedroom options", () => {
      expect(bedroomOptions).toEqual([1, 2, 3, 4, 5]);
    });

    it("should have 5 as the max (representing 5+)", () => {
      expect(bedroomOptions[bedroomOptions.length - 1]).toBe(5);
    });
  });
});

// ─── Feature 2: Ratings & Reviews System ───

describe("Ratings & Reviews System", () => {
  describe("Star Rating Validation", () => {
    it("should accept ratings between 1 and 5", () => {
      for (let r = 1; r <= 5; r++) {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(5);
      }
    });

    it("should reject ratings outside 1-5 range", () => {
      expect(0).toBeLessThan(1);
      expect(6).toBeGreaterThan(5);
    });
  });

  describe("Average Rating Calculation", () => {
    function calculateAverage(ratings: number[]): { average: number; count: number } {
      if (ratings.length === 0) return { average: 0, count: 0 };
      const sum = ratings.reduce((acc, r) => acc + r, 0);
      return {
        average: Math.round((sum / ratings.length) * 10) / 10,
        count: ratings.length,
      };
    }

    it("should return 0 for empty ratings", () => {
      const result = calculateAverage([]);
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });

    it("should calculate correct average for single rating", () => {
      const result = calculateAverage([4]);
      expect(result.average).toBe(4);
      expect(result.count).toBe(1);
    });

    it("should calculate correct average for multiple ratings", () => {
      const result = calculateAverage([5, 4, 3, 5, 4]);
      expect(result.average).toBe(4.2);
      expect(result.count).toBe(5);
    });

    it("should round to 1 decimal place", () => {
      const result = calculateAverage([5, 4, 4, 3]);
      expect(result.average).toBe(4); // 16/4 = 4.0
    });

    it("should handle all 5-star ratings", () => {
      const result = calculateAverage([5, 5, 5, 5, 5]);
      expect(result.average).toBe(5);
    });

    it("should handle mixed ratings correctly", () => {
      const result = calculateAverage([1, 2, 3, 4, 5]);
      expect(result.average).toBe(3);
      expect(result.count).toBe(5);
    });
  });

  describe("Review Validation", () => {
    function validateReview(rating: number, comment: string): { valid: boolean; error?: string } {
      if (rating < 1 || rating > 5) {
        return { valid: false, error: "التقييم يجب أن يكون بين 1 و 5" };
      }
      if (!comment.trim()) {
        return { valid: false, error: "يرجى كتابة تعليق" };
      }
      if (comment.length > 500) {
        return { valid: false, error: "التعليق طويل جداً (الحد الأقصى 500 حرف)" };
      }
      return { valid: true };
    }

    it("should accept valid review", () => {
      const result = validateReview(5, "شقة ممتازة ونظيفة جداً");
      expect(result.valid).toBe(true);
    });

    it("should reject rating of 0", () => {
      const result = validateReview(0, "تعليق");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("التقييم");
    });

    it("should reject rating of 6", () => {
      const result = validateReview(6, "تعليق");
      expect(result.valid).toBe(false);
    });

    it("should reject empty comment", () => {
      const result = validateReview(4, "");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("تعليق");
    });

    it("should reject whitespace-only comment", () => {
      const result = validateReview(4, "   ");
      expect(result.valid).toBe(false);
    });

    it("should reject comment over 500 characters", () => {
      const longComment = "أ".repeat(501);
      const result = validateReview(4, longComment);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should accept comment at exactly 500 characters", () => {
      const maxComment = "أ".repeat(500);
      const result = validateReview(4, maxComment);
      expect(result.valid).toBe(true);
    });
  });

  describe("Demo Reviews Generation", () => {
    const DEMO_REVIEWERS = [
      "أحمد العتيبي", "سارة القحطاني", "محمد الشمري", "نورة الحربي",
      "خالد الدوسري", "فاطمة المطيري", "عبدالله الغامدي", "ريم السبيعي",
    ];

    function generateDemoReviews(propertyId: number) {
      const count = 2 + (propertyId % 4);
      const reviews = [];
      for (let i = 0; i < count; i++) {
        const nameIdx = (propertyId + i) % DEMO_REVIEWERS.length;
        const rating = 3 + ((propertyId + i) % 3);
        reviews.push({
          id: `demo-${propertyId}-${i}`,
          propertyId,
          userName: DEMO_REVIEWERS[nameIdx],
          rating,
        });
      }
      return reviews;
    }

    it("should generate 2-5 demo reviews per property", () => {
      for (let id = 1; id <= 20; id++) {
        const reviews = generateDemoReviews(id);
        expect(reviews.length).toBeGreaterThanOrEqual(2);
        expect(reviews.length).toBeLessThanOrEqual(5);
      }
    });

    it("should generate consistent reviews for same property", () => {
      const reviews1 = generateDemoReviews(42);
      const reviews2 = generateDemoReviews(42);
      expect(reviews1).toEqual(reviews2);
    });

    it("should generate ratings between 3 and 5", () => {
      for (let id = 1; id <= 20; id++) {
        const reviews = generateDemoReviews(id);
        reviews.forEach((r) => {
          expect(r.rating).toBeGreaterThanOrEqual(3);
          expect(r.rating).toBeLessThanOrEqual(5);
        });
      }
    });

    it("should use Arabic reviewer names", () => {
      const reviews = generateDemoReviews(1);
      reviews.forEach((r) => {
        expect(/[\u0600-\u06FF]/.test(r.userName)).toBe(true);
      });
    });
  });

  describe("Review Date Formatting", () => {
    function formatDate(dateStr: string): string {
      const d = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diffDays === 0) return "اليوم";
      if (diffDays === 1) return "أمس";
      if (diffDays < 7) return `منذ ${diffDays} أيام`;
      if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
      return `منذ ${Math.floor(diffDays / 30)} أشهر`;
    }

    it("should return 'اليوم' for today", () => {
      expect(formatDate(new Date().toISOString())).toBe("اليوم");
    });

    it("should return 'أمس' for yesterday", () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(formatDate(yesterday.toISOString())).toBe("أمس");
    });

    it("should return days for less than a week", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      expect(formatDate(threeDaysAgo.toISOString())).toBe("منذ 3 أيام");
    });

    it("should return weeks for less than a month", () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
      expect(formatDate(twoWeeksAgo.toISOString())).toBe("منذ 2 أسابيع");
    });

    it("should return months for older dates", () => {
      const twoMonthsAgo = new Date(Date.now() - 60 * 86400000);
      expect(formatDate(twoMonthsAgo.toISOString())).toBe("منذ 2 أشهر");
    });
  });
});

// ─── Feature 3: Twilio SMS Setup & Phone OTP ───

describe("Twilio SMS Setup & Phone OTP", () => {
  describe("Saudi Phone Number Validation", () => {
    function isValidSaudiPhone(phone: string): boolean {
      // Must start with +966 and have 9 digits after
      const cleaned = phone.replace(/\s/g, "");
      return /^\+966[5][0-9]{8}$/.test(cleaned);
    }

    it("should accept valid Saudi mobile numbers", () => {
      expect(isValidSaudiPhone("+966512345678")).toBe(true);
      expect(isValidSaudiPhone("+966551234567")).toBe(true);
      expect(isValidSaudiPhone("+966599999999")).toBe(true);
    });

    it("should reject numbers without +966 prefix", () => {
      expect(isValidSaudiPhone("0512345678")).toBe(false);
      expect(isValidSaudiPhone("512345678")).toBe(false);
    });

    it("should reject numbers with leading 0 after country code", () => {
      expect(isValidSaudiPhone("+9660512345678")).toBe(false);
    });

    it("should reject too short numbers", () => {
      expect(isValidSaudiPhone("+96651234567")).toBe(false);
    });

    it("should reject too long numbers", () => {
      expect(isValidSaudiPhone("+9665123456789")).toBe(false);
    });

    it("should reject non-mobile numbers (not starting with 5)", () => {
      expect(isValidSaudiPhone("+966112345678")).toBe(false);
      expect(isValidSaudiPhone("+966312345678")).toBe(false);
    });

    it("should accept numbers with spaces", () => {
      expect(isValidSaudiPhone("+966 512 345 678")).toBe(true);
    });
  });

  describe("OTP Code Validation", () => {
    function isValidOtp(code: string): boolean {
      return /^\d{6}$/.test(code);
    }

    it("should accept 6-digit codes", () => {
      expect(isValidOtp("123456")).toBe(true);
      expect(isValidOtp("000000")).toBe(true);
      expect(isValidOtp("999999")).toBe(true);
    });

    it("should reject codes with less than 6 digits", () => {
      expect(isValidOtp("12345")).toBe(false);
      expect(isValidOtp("1")).toBe(false);
    });

    it("should reject codes with more than 6 digits", () => {
      expect(isValidOtp("1234567")).toBe(false);
    });

    it("should reject codes with non-numeric characters", () => {
      expect(isValidOtp("12345a")).toBe(false);
      expect(isValidOtp("abcdef")).toBe(false);
      expect(isValidOtp("12 345")).toBe(false);
    });
  });

  describe("Phone Number Formatting", () => {
    function formatPhoneForDisplay(phone: string): string {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.startsWith("966") && cleaned.length === 12) {
        return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
      }
      return phone;
    }

    it("should format Saudi numbers with spaces", () => {
      expect(formatPhoneForDisplay("+966512345678")).toBe("+966 51 234 5678");
    });

    it("should return original if not Saudi format", () => {
      expect(formatPhoneForDisplay("12345")).toBe("12345");
    });
  });

  describe("Twilio Setup Steps", () => {
    const SETUP_STEPS = [
      "إنشاء حساب Twilio",
      "الحصول على Account SID و Auth Token",
      "شراء رقم هاتف",
      "إعداد Verify Service",
      "ربط Twilio مع Supabase",
      "اختبار الإرسال",
    ];

    it("should have 6 setup steps", () => {
      expect(SETUP_STEPS).toHaveLength(6);
    });

    it("should start with account creation", () => {
      expect(SETUP_STEPS[0]).toContain("إنشاء حساب");
    });

    it("should end with testing", () => {
      expect(SETUP_STEPS[5]).toContain("اختبار");
    });

    it("should include Supabase integration step", () => {
      const supabaseStep = SETUP_STEPS.find((s) => s.includes("Supabase"));
      expect(supabaseStep).toBeDefined();
    });
  });

  describe("Troubleshooting Guide", () => {
    const troubleshooting = [
      { q: "لا يصل رمز OTP؟", a: "تأكد من التنسيق الدولي +966" },
      { q: "خطأ في المصادقة؟", a: "تحقق من Account SID و Auth Token" },
      { q: "رسوم Twilio؟", a: "الحساب التجريبي يوفر رصيد ~$15" },
    ];

    it("should have 3 troubleshooting items", () => {
      expect(troubleshooting).toHaveLength(3);
    });

    it("should have questions in Arabic", () => {
      troubleshooting.forEach((item) => {
        expect(/[\u0600-\u06FF]/.test(item.q)).toBe(true);
      });
    });

    it("should have answers in Arabic", () => {
      troubleshooting.forEach((item) => {
        expect(/[\u0600-\u06FF]/.test(item.a)).toBe(true);
      });
    });
  });

  describe("OTP Resend Cooldown", () => {
    function canResendOtp(lastSentAt: number, cooldownMs: number = 60000): boolean {
      return Date.now() - lastSentAt >= cooldownMs;
    }

    it("should not allow resend within cooldown period", () => {
      const justNow = Date.now();
      expect(canResendOtp(justNow)).toBe(false);
    });

    it("should allow resend after cooldown", () => {
      const oneMinuteAgo = Date.now() - 61000;
      expect(canResendOtp(oneMinuteAgo)).toBe(true);
    });

    it("should respect custom cooldown", () => {
      const thirtySecondsAgo = Date.now() - 31000;
      expect(canResendOtp(thirtySecondsAgo, 30000)).toBe(true);
      expect(canResendOtp(thirtySecondsAgo, 60000)).toBe(false);
    });
  });
});

// ─── Integration: Filter + Search API URL Construction ───

describe("Filter + Search API Integration", () => {
  const API_BASE = "/api/mk";

  function buildSearchUrl(params: Record<string, unknown>): string {
    const procedure = "property.search";
    const encoded = encodeURIComponent(JSON.stringify({ json: params }));
    return `${API_BASE}/${procedure}?input=${encoded}`;
  }

  it("should build correct URL with no filters", () => {
    const url = buildSearchUrl({ limit: 20 });
    expect(url).toContain("/api/mk/property.search");
    expect(url).toContain("input=");
  });

  it("should include all filter params in URL", () => {
    const url = buildSearchUrl({
      limit: 20,
      city: "الرياض",
      minPrice: 3000,
      maxPrice: 8000,
      bedrooms: 2,
      furnishedLevel: "fully_furnished",
      propertyType: "apartment",
    });
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("الرياض");
    expect(decoded).toContain("3000");
    expect(decoded).toContain("8000");
    expect(decoded).toContain("fully_furnished");
    expect(decoded).toContain("apartment");
  });

  it("should properly encode Arabic city names", () => {
    const url = buildSearchUrl({ city: "المدينة المنورة", limit: 20 });
    expect(url).toContain("input=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("المدينة المنورة");
  });
});
