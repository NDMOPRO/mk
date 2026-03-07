import { describe, expect, it } from "vitest";

/**
 * Tests for Search Results Sorting Feature
 * Sort options: default, price_asc, price_desc, newest, rating
 */

// ─── Mock Property Data ───

interface MockProperty {
  id: number;
  monthlyRent: string;
  createdAt: string;
}

function createMockProperties(): MockProperty[] {
  return [
    { id: 1, monthlyRent: "8000.00", createdAt: "2026-01-15T10:00:00Z" },
    { id: 2, monthlyRent: "3500.00", createdAt: "2026-03-01T10:00:00Z" },
    { id: 3, monthlyRent: "12000.00", createdAt: "2025-11-20T10:00:00Z" },
    { id: 4, monthlyRent: "5000.00", createdAt: "2026-02-10T10:00:00Z" },
    { id: 5, monthlyRent: "15000.00", createdAt: "2026-03-05T10:00:00Z" },
    { id: 6, monthlyRent: "3500.00", createdAt: "2026-01-20T10:00:00Z" },
  ];
}

// ─── Sort Functions (matching MobileApp.tsx logic) ───

type SortOption = "default" | "price_asc" | "price_desc" | "newest" | "rating";

function sortProperties(properties: MockProperty[], sortBy: SortOption): MockProperty[] {
  if (sortBy === "default" || properties.length === 0) return properties;

  const sorted = [...properties];
  switch (sortBy) {
    case "price_asc":
      sorted.sort((a, b) => parseFloat(a.monthlyRent) - parseFloat(b.monthlyRent));
      break;
    case "price_desc":
      sorted.sort((a, b) => parseFloat(b.monthlyRent) - parseFloat(a.monthlyRent));
      break;
    case "newest":
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "rating":
      sorted.sort((a, b) => {
        const ratingA = getDemoRating(a.id);
        const ratingB = getDemoRating(b.id);
        return ratingB - ratingA;
      });
      break;
  }
  return sorted;
}

function getDemoRating(propertyId: number): number {
  // Matches getDemoAverageRating logic from reviews.ts
  const count = 2 + (propertyId % 4);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += 3 + ((propertyId + i) % 3);
  }
  return total / count;
}

// ─── Sort Option Configuration ───

describe("Sort Option Configuration", () => {
  const SORT_OPTIONS = [
    { value: "default", label: "الافتراضي" },
    { value: "price_asc", label: "السعر: الأقل" },
    { value: "price_desc", label: "السعر: الأعلى" },
    { value: "newest", label: "الأحدث" },
    { value: "rating", label: "التقييم" },
  ];

  it("should have 5 sort options", () => {
    expect(SORT_OPTIONS).toHaveLength(5);
  });

  it("should have 'default' as the first option", () => {
    expect(SORT_OPTIONS[0].value).toBe("default");
  });

  it("should have Arabic labels for all options", () => {
    SORT_OPTIONS.forEach((option) => {
      expect(/[\u0600-\u06FF]/.test(option.label)).toBe(true);
    });
  });

  it("should include price ascending and descending", () => {
    const values = SORT_OPTIONS.map((o) => o.value);
    expect(values).toContain("price_asc");
    expect(values).toContain("price_desc");
  });

  it("should include newest and rating options", () => {
    const values = SORT_OPTIONS.map((o) => o.value);
    expect(values).toContain("newest");
    expect(values).toContain("rating");
  });
});

// ─── Sort by Default ───

describe("Sort by Default", () => {
  it("should return properties in original order", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "default");
    expect(sorted.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("should return same reference for default sort", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "default");
    expect(sorted).toBe(properties);
  });

  it("should return empty array for empty input", () => {
    const sorted = sortProperties([], "default");
    expect(sorted).toEqual([]);
  });
});

// ─── Sort by Price (Low to High) ───

describe("Sort by Price: Low to High", () => {
  it("should sort properties by price ascending", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_asc");
    const prices = sorted.map((p) => parseFloat(p.monthlyRent));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it("should place cheapest property first", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_asc");
    expect(parseFloat(sorted[0].monthlyRent)).toBe(3500);
  });

  it("should place most expensive property last", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_asc");
    expect(parseFloat(sorted[sorted.length - 1].monthlyRent)).toBe(15000);
  });

  it("should handle equal prices", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_asc");
    // Properties 2 and 6 both have 3500
    const cheapest = sorted.filter((p) => parseFloat(p.monthlyRent) === 3500);
    expect(cheapest).toHaveLength(2);
  });

  it("should not mutate original array", () => {
    const properties = createMockProperties();
    const originalIds = properties.map((p) => p.id);
    sortProperties(properties, "price_asc");
    expect(properties.map((p) => p.id)).toEqual(originalIds);
  });
});

// ─── Sort by Price (High to Low) ───

describe("Sort by Price: High to Low", () => {
  it("should sort properties by price descending", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_desc");
    const prices = sorted.map((p) => parseFloat(p.monthlyRent));
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it("should place most expensive property first", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_desc");
    expect(parseFloat(sorted[0].monthlyRent)).toBe(15000);
  });

  it("should place cheapest property last", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "price_desc");
    expect(parseFloat(sorted[sorted.length - 1].monthlyRent)).toBe(3500);
  });

  it("should have opposite order from price_asc for distinct prices", () => {
    const properties = createMockProperties();
    const asc = sortProperties(properties, "price_asc");
    const desc = sortProperties(properties, "price_desc");
    // First element of desc should be last distinct-price element of asc
    expect(parseFloat(desc[0].monthlyRent)).toBe(15000);
    expect(parseFloat(asc[0].monthlyRent)).toBe(3500);
    // Verify ordering directions are opposite
    const ascPrices = asc.map((p) => parseFloat(p.monthlyRent));
    const descPrices = desc.map((p) => parseFloat(p.monthlyRent));
    for (let i = 1; i < ascPrices.length; i++) {
      expect(ascPrices[i]).toBeGreaterThanOrEqual(ascPrices[i - 1]);
      expect(descPrices[i]).toBeLessThanOrEqual(descPrices[i - 1]);
    }
  });
});

// ─── Sort by Date Listed (Newest First) ───

describe("Sort by Date Listed: Newest First", () => {
  it("should sort properties by date descending (newest first)", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "newest");
    const dates = sorted.map((p) => new Date(p.createdAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it("should place the newest property first", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "newest");
    // Property 5 has the newest date (2026-03-05)
    expect(sorted[0].id).toBe(5);
  });

  it("should place the oldest property last", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "newest");
    // Property 3 has the oldest date (2025-11-20)
    expect(sorted[sorted.length - 1].id).toBe(3);
  });

  it("should correctly order all dates", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "newest");
    // Expected order: 5 (Mar 5), 2 (Mar 1), 4 (Feb 10), 6 (Jan 20), 1 (Jan 15), 3 (Nov 20)
    expect(sorted.map((p) => p.id)).toEqual([5, 2, 4, 6, 1, 3]);
  });
});

// ─── Sort by User Ratings ───

describe("Sort by User Ratings: Highest First", () => {
  it("should sort properties by rating descending", () => {
    const properties = createMockProperties();
    const sorted = sortProperties(properties, "rating");
    const ratings = sorted.map((p) => getDemoRating(p.id));
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
    }
  });

  it("should generate ratings between 3 and 5 for all properties", () => {
    const properties = createMockProperties();
    properties.forEach((p) => {
      const rating = getDemoRating(p.id);
      expect(rating).toBeGreaterThanOrEqual(3);
      expect(rating).toBeLessThanOrEqual(5);
    });
  });

  it("should produce consistent ratings for same property", () => {
    expect(getDemoRating(42)).toBe(getDemoRating(42));
    expect(getDemoRating(1)).toBe(getDemoRating(1));
  });

  it("should not mutate original array", () => {
    const properties = createMockProperties();
    const originalIds = properties.map((p) => p.id);
    sortProperties(properties, "rating");
    expect(properties.map((p) => p.id)).toEqual(originalIds);
  });
});

// ─── Edge Cases ───

describe("Sorting Edge Cases", () => {
  it("should handle single property", () => {
    const single = [{ id: 1, monthlyRent: "5000.00", createdAt: "2026-01-01T00:00:00Z" }];
    expect(sortProperties(single, "price_asc")).toHaveLength(1);
    expect(sortProperties(single, "price_desc")).toHaveLength(1);
    expect(sortProperties(single, "newest")).toHaveLength(1);
    expect(sortProperties(single, "rating")).toHaveLength(1);
  });

  it("should handle empty array for all sort options", () => {
    const sortOptions: SortOption[] = ["default", "price_asc", "price_desc", "newest", "rating"];
    sortOptions.forEach((option) => {
      expect(sortProperties([], option)).toEqual([]);
    });
  });

  it("should handle properties with same price", () => {
    const samePrice = [
      { id: 1, monthlyRent: "5000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 2, monthlyRent: "5000.00", createdAt: "2026-02-01T00:00:00Z" },
      { id: 3, monthlyRent: "5000.00", createdAt: "2026-03-01T00:00:00Z" },
    ];
    const sorted = sortProperties(samePrice, "price_asc");
    expect(sorted).toHaveLength(3);
    sorted.forEach((p) => expect(parseFloat(p.monthlyRent)).toBe(5000));
  });

  it("should handle properties with same date", () => {
    const sameDate = [
      { id: 1, monthlyRent: "3000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 2, monthlyRent: "5000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 3, monthlyRent: "8000.00", createdAt: "2026-01-01T00:00:00Z" },
    ];
    const sorted = sortProperties(sameDate, "newest");
    expect(sorted).toHaveLength(3);
  });

  it("should preserve sort stability for equal values", () => {
    const properties = [
      { id: 10, monthlyRent: "5000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 20, monthlyRent: "5000.00", createdAt: "2026-01-01T00:00:00Z" },
    ];
    const sorted = sortProperties(properties, "price_asc");
    // JavaScript sort is stable, so equal elements maintain original order
    expect(sorted[0].id).toBe(10);
    expect(sorted[1].id).toBe(20);
  });
});

// ─── Sort Persistence ───

describe("Sort Persistence Across Searches", () => {
  it("should apply same sort to different property sets", () => {
    const set1 = [
      { id: 1, monthlyRent: "8000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 2, monthlyRent: "3000.00", createdAt: "2026-02-01T00:00:00Z" },
    ];
    const set2 = [
      { id: 3, monthlyRent: "12000.00", createdAt: "2026-01-01T00:00:00Z" },
      { id: 4, monthlyRent: "5000.00", createdAt: "2026-02-01T00:00:00Z" },
    ];

    const sorted1 = sortProperties(set1, "price_asc");
    const sorted2 = sortProperties(set2, "price_asc");

    expect(parseFloat(sorted1[0].monthlyRent)).toBe(3000);
    expect(parseFloat(sorted2[0].monthlyRent)).toBe(5000);
  });

  it("should correctly switch between sort options", () => {
    const properties = createMockProperties();

    const byPriceAsc = sortProperties(properties, "price_asc");
    expect(parseFloat(byPriceAsc[0].monthlyRent)).toBe(3500);

    const byPriceDesc = sortProperties(properties, "price_desc");
    expect(parseFloat(byPriceDesc[0].monthlyRent)).toBe(15000);

    const byNewest = sortProperties(properties, "newest");
    expect(byNewest[0].id).toBe(5);

    const byDefault = sortProperties(properties, "default");
    expect(byDefault[0].id).toBe(1);
  });
});
