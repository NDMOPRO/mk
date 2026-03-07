import { describe, it, expect, beforeAll, vi } from "vitest";

// In-memory settings store
const settingsStore: Record<string, string> = {};

// Mock db module
vi.mock("./db", () => ({
  bulkSetSettings: vi.fn().mockImplementation(async (settings: Record<string, string>) => {
    for (const [k, v] of Object.entries(settings)) settingsStore[k] = v;
  }),
  getSetting: vi.fn().mockImplementation(async (key: string) => settingsStore[key] ?? null),
  setSetting: vi.fn().mockImplementation(async (key: string, value: string) => { settingsStore[key] = value; }),
  getAllSettings: vi.fn().mockImplementation(async () => ({ ...settingsStore })),
}));

import * as db from "./db";

describe("Rental Duration Settings", () => {
  beforeAll(async () => {
    // Seed rental duration settings
    await db.bulkSetSettings({
      "rental.minMonths": "1",
      "rental.maxMonths": "2",
    });
  });

  it("should return rental.minMonths setting", async () => {
    const val = await db.getSetting("rental.minMonths");
    expect(val).toBe("1");
  });

  it("should return rental.maxMonths setting", async () => {
    const val = await db.getSetting("rental.maxMonths");
    expect(val).toBe("2");
  });

  it("should update rental.minMonths setting", async () => {
    await db.bulkSetSettings({ "rental.minMonths": "2" });
    const val = await db.getSetting("rental.minMonths");
    expect(val).toBe("2");
    // Reset
    await db.bulkSetSettings({ "rental.minMonths": "1" });
  });

  it("should update rental.maxMonths setting", async () => {
    await db.bulkSetSettings({ "rental.maxMonths": "6" });
    const val = await db.getSetting("rental.maxMonths");
    expect(val).toBe("6");
    // Reset
    await db.bulkSetSettings({ "rental.maxMonths": "2" });
  });

  it("should handle both min and max update together", async () => {
    await db.bulkSetSettings({
      "rental.minMonths": "2",
      "rental.maxMonths": "3",
    });
    const min = await db.getSetting("rental.minMonths");
    const max = await db.getSetting("rental.maxMonths");
    expect(min).toBe("2");
    expect(max).toBe("3");
    // Reset
    await db.bulkSetSettings({
      "rental.minMonths": "1",
      "rental.maxMonths": "2",
    });
  });

  it("should return null for non-existent rental setting", async () => {
    const val = await db.getSetting("rental.nonexistent");
    expect(val).toBeNull();
  });
});
