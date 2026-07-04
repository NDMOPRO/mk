/**
 * Security Hardening Tests
 * Tests for: password policy, account lockout, rate limiting, env validation, cache backend
 *
 * Run: pnpm test -- tests/security-hardening.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════
// A) Password Policy (8+ chars, uppercase, lowercase, digit, special)
// ═══════════════════════════════════════════════════════════════════════
import { validatePassword } from "../server/_core/auth";

describe("Password Policy (SEC-02)", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePassword("Abc1!de");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("8");
  });

  it("rejects passwords without uppercase letter", () => {
    const result = validatePassword("abcdefgh1234!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("uppercase");
  });

  it("rejects passwords without lowercase letter", () => {
    const result = validatePassword("ABCDEFGH1234!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("lowercase");
  });

  it("rejects passwords without digit", () => {
    const result = validatePassword("Abcdefghijkl!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("digit");
  });

  it("rejects passwords without special character", () => {
    const result = validatePassword("Abcdefgh1234");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("special");
  });

  it("accepts a valid strong password", () => {
    const result = validatePassword("MyStr0ng!Pass");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts an 8-character minimum password", () => {
    const result = validatePassword("Abcde1!x");
    expect(result.valid).toBe(true);
  });

  it("provides Arabic error messages", () => {
    const result = validatePassword("short");
    expect(result.valid).toBe(false);
    expect(result.errorAr).toBeDefined();
    expect(result.errorAr).toContain("8");
  });

  it("rejects the old hardcoded admin password '15001500'", () => {
    const result = validatePassword("15001500");
    expect(result.valid).toBe(false);
  });

  it("rejects common weak passwords", () => {
    const weakPasswords = ["password", "123456789012", "qwertyuiopas", "aaaaaaaaaaaa"];
    for (const pw of weakPasswords) {
      expect(validatePassword(pw).valid).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// B) Account Lockout (5 failed attempts → 15 min lock)
// ═══════════════════════════════════════════════════════════════════════
import { checkAccountLockout, recordFailedLogin, resetLoginAttempts } from "../server/rate-limiter";

describe("Account Lockout (SEC-04)", () => {
  const testUserId = "test-lockout-user-" + Date.now();

  beforeEach(async () => {
    await resetLoginAttempts(testUserId);
  });

  it("allows login when no failed attempts", async () => {
    const result = await checkAccountLockout(testUserId);
    expect(result.locked).toBe(false);
  });

  it("allows login after 1-4 failed attempts", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await recordFailedLogin(testUserId);
      expect(r.locked).toBe(false);
      expect(r.attemptsRemaining).toBe(4 - i);
    }
  });

  it("locks account after 5 failed attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(testUserId);
    }
    const result = await checkAccountLockout(testUserId);
    expect(result.locked).toBe(true);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("reports remaining attempts correctly", async () => {
    const r1 = await recordFailedLogin(testUserId);
    expect(r1.attemptsRemaining).toBe(4);
    const r2 = await recordFailedLogin(testUserId);
    expect(r2.attemptsRemaining).toBe(3);
  });

  it("resets lockout after resetLoginAttempts()", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(testUserId);
    }
    expect((await checkAccountLockout(testUserId)).locked).toBe(true);
    await resetLoginAttempts(testUserId);
    expect((await checkAccountLockout(testUserId)).locked).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C) ENV Validation (JWT_SECRET fail-fast)
// ═══════════════════════════════════════════════════════════════════════
describe("ENV Validation (SEC-01)", () => {
  it("ENV module exports required fields", async () => {
    const { ENV } = await import("../server/_core/env");
    expect(ENV).toBeDefined();
    expect(typeof ENV.cookieSecret).toBe("string");
    expect(ENV.cookieSecret.length).toBeGreaterThan(0);
    expect(typeof ENV.sessionTtlMs).toBe("number");
    expect(ENV.sessionTtlMs).toBeGreaterThan(0);
  });

  it("sessionTtlMs is less than 1 year (old default)", async () => {
    const { ENV } = await import("../server/_core/env");
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    // Must be less than the old 1-year value
    expect(ENV.sessionTtlMs).toBeLessThan(oneYear);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D) Rate Limiter
// ═══════════════════════════════════════════════════════════════════════
import { rateLimiter, RATE_LIMITS } from "../server/rate-limiter";

describe("Rate Limiter", () => {
  it("allows requests within limit", () => {
    const key = "test-rl-" + Date.now();
    const result = rateLimiter.check(key, 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const key = "test-rl-block-" + Date.now();
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(key, 5, 60000);
    }
    const result = rateLimiter.check(key, 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("has correct rate limit constants", () => {
    expect(RATE_LIMITS.AUTH).toBeDefined();
    expect(RATE_LIMITS.AUTH.maxRequests).toBeGreaterThan(0);
    expect(RATE_LIMITS.AUTH.windowMs).toBeGreaterThan(0);
    expect(RATE_LIMITS.PUBLIC_READ).toBeDefined();
    expect(RATE_LIMITS.LOGIN_PER_USER).toBeDefined();
    expect(RATE_LIMITS.LOGIN_PER_USER.maxRequests).toBe(5);
    expect(RATE_LIMITS.PASSWORD_RESET).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// E) Cache Backend Interface
// ═══════════════════════════════════════════════════════════════════════
import { cache, CACHE_TTL, CACHE_KEYS } from "../server/cache";

describe("Cache Backend", () => {
  it("stores and retrieves values", () => {
    const key = "test-cache-" + Date.now();
    cache.set(key, { hello: "world" }, 5000);
    const result = cache.get(key);
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for missing keys", () => {
    const result = cache.get("nonexistent-key-" + Date.now());
    expect(result).toBeNull();
  });

  it("invalidates by prefix", () => {
    const prefix = "test-prefix-" + Date.now();
    cache.set(`${prefix}:a`, "a", 5000);
    cache.set(`${prefix}:b`, "b", 5000);
    cache.invalidatePrefix(`${prefix}:`);
    expect(cache.get(`${prefix}:a`)).toBeNull();
    expect(cache.get(`${prefix}:b`)).toBeNull();
  });

  it("has correct TTL constants", () => {
    expect(CACHE_TTL.SETTINGS).toBeGreaterThan(0);
    expect(CACHE_TTL.SEARCH_RESULTS).toBeGreaterThan(0);
    expect(CACHE_TTL.HOMEPAGE_DATA).toBeGreaterThan(0);
  });

  it("has correct cache key generators", () => {
    // settings may be a string or function depending on implementation
    const settingsKey = typeof CACHE_KEYS.settings === "function"
      ? (CACHE_KEYS.settings as Function)()
      : CACHE_KEYS.settings;
    expect(typeof settingsKey).toBe("string");
    expect(typeof CACHE_KEYS.searchResults("test")).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F) Migration Journal Integrity
// ═══════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";

describe("Migration Journal Integrity", () => {
  it("has sequential migration indexes", () => {
    const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entries = journal.entries;

    for (let i = 0; i < entries.length; i++) {
      expect(entries[i].idx).toBe(i);
    }
  });

  it("all migration SQL files exist", () => {
    const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

    for (const entry of journal.entries) {
      const sqlPath = path.resolve(__dirname, `../drizzle/${entry.tag}.sql`);
      expect(fs.existsSync(sqlPath)).toBe(true);
    }
  });

  it("migration 0015 includes FK constraints", () => {
    const sqlPath = path.resolve(__dirname, "../drizzle/0015_db_integrity_fk_indexes.sql");
    const content = fs.readFileSync(sqlPath, "utf-8");
    expect(content).toContain("FOREIGN KEY");
    expect(content).toContain("CREATE INDEX");
    expect(content).toContain("ON DELETE CASCADE");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// G) Transaction Helper
// ═══════════════════════════════════════════════════════════════════════
describe("Transaction Helper (withTransaction)", () => {
  it("withTransaction is exported from db module", async () => {
    const dbModule = await import("../server/db");
    expect(typeof dbModule.withTransaction).toBe("function");
  });
});
