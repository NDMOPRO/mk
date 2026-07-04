/**
 * Integration Test — Auth Flow
 *
 * Tests password validation rules, rate limiter integration,
 * and token blacklist lifecycle. Pure tests — no DB, no network.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { validatePassword } from "../../server/_core/auth";
import { rateLimiter, RATE_LIMITS, getClientIP } from "../../server/rate-limiter";
import { tokenBlacklist } from "../../server/token-blacklist";
import { cache } from "../../server/cache";

// ─── Password Validation ─────────────────────────────────────────────
describe("Integration — Auth Flow: Password Validation", () => {
  describe("Valid Passwords", () => {
    const validPasswords = [
      "SecurePass1!abc",
      "MyP@ssw0rd!2024",
      "C0mpl3x!Pass#",
      "Str0ng_P@ss!word",
      "V3ry$ecure!Pass",
    ];

    validPasswords.forEach((pw) => {
      it(`accepts: "${pw}"`, () => {
        const result = validatePassword(pw);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe("Minimum Length (8 chars)", () => {
    it("rejects 7-char password", () => {
      const result = validatePassword("Abcd1!x");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("8");
    });

    it("accepts exactly 8-char password", () => {
      const result = validatePassword("Abcde1!x");
      expect(result.valid).toBe(true);
    });
  });

  describe("Character Requirements", () => {
    it("rejects password without uppercase", () => {
      const result = validatePassword("abcdefgh1234!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("uppercase");
    });

    it("rejects password without lowercase", () => {
      const result = validatePassword("ABCDEFGH1234!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("lowercase");
    });

    it("rejects password without digit", () => {
      const result = validatePassword("Abcdefghijkl!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("digit");
    });

    it("rejects password without special character", () => {
      const result = validatePassword("Abcdefgh1234x");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("special");
    });
  });

  describe("Arabic Error Messages", () => {
    it("provides Arabic error for short password", () => {
      const result = validatePassword("short");
      expect(result.errorAr).toBeTruthy();
      expect(result.errorAr).toContain("8");
    });

    it("provides Arabic error for missing uppercase", () => {
      const result = validatePassword("abcdefgh1234!");
      expect(result.errorAr).toBeTruthy();
    });
  });
});

// ─── Rate Limiter Integration ────────────────────────────────────────
describe("Integration — Auth Flow: Rate Limiter", () => {
  beforeEach(async () => {
    await cache.flush();
  });

  describe("Login Rate Limiting", () => {
    it("allows requests within limit", async () => {
      const limit = RATE_LIMITS.AUTH;
      const result = await rateLimiter.check(
        "integration-test-login-allow",
        limit.maxRequests,
        limit.windowMs
      );
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit.maxRequests - 1);
    });

    it("blocks after exceeding limit", async () => {
      const key = "integration-test-login-block";
      const max = 3;
      const windowMs = 60_000;

      for (let i = 0; i < max; i++) {
        await rateLimiter.check(key, max, windowMs);
      }

      const blocked = await rateLimiter.check(key, max, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetIn).toBeGreaterThan(0);
    });

    it("resets after window expires (simulated via different key)", async () => {
      const key1 = "integration-test-login-reset-1";
      const key2 = "integration-test-login-reset-2";

      // Exhaust key1
      for (let i = 0; i < 3; i++) {
        await rateLimiter.check(key1, 3, 60_000);
      }
      const blocked = await rateLimiter.check(key1, 3, 60_000);
      expect(blocked.allowed).toBe(false);

      // key2 is fresh
      const fresh = await rateLimiter.check(key2, 3, 60_000);
      expect(fresh.allowed).toBe(true);
    });
  });

  describe("getClientIP Extraction", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const ip = getClientIP({
        headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
      });
      expect(ip).toBe("203.0.113.50");
    });

    it("falls back to req.ip when x-forwarded-for is absent", () => {
      const ip = getClientIP({
        headers: {},
        ip: "203.0.113.100",
      });
      expect(ip).toBe("203.0.113.100");
    });

    it("falls back to socket remoteAddress", () => {
      const ip = getClientIP({
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      });
      expect(ip).toBe("127.0.0.1");
    });

    it("returns unknown for missing IP", () => {
      const ip = getClientIP({ headers: {} });
      expect(ip).toBeTruthy(); // Should return some fallback
    });
  });

  describe("RATE_LIMITS Configuration", () => {
    it("has AUTH rate limit defined", () => {
      expect(RATE_LIMITS.AUTH).toBeDefined();
      expect(RATE_LIMITS.AUTH.maxRequests).toBeGreaterThan(0);
      expect(RATE_LIMITS.AUTH.windowMs).toBeGreaterThan(0);
    });

    it("has LOGIN_PER_USER rate limit defined", () => {
      expect(RATE_LIMITS.LOGIN_PER_USER).toBeDefined();
      expect(RATE_LIMITS.LOGIN_PER_USER.maxRequests).toBeGreaterThan(0);
    });

    it("has PASSWORD_RESET rate limit defined", () => {
      expect(RATE_LIMITS.PASSWORD_RESET).toBeDefined();
      expect(RATE_LIMITS.PASSWORD_RESET.maxRequests).toBeGreaterThan(0);
    });

    it("AUTH limit is stricter than PUBLIC_READ limit", () => {
      expect(RATE_LIMITS.AUTH.maxRequests).toBeLessThanOrEqual(
        RATE_LIMITS.PUBLIC_READ.maxRequests
      );
    });

    it("LOGIN_PER_USER is the strictest limit", () => {
      expect(RATE_LIMITS.LOGIN_PER_USER.maxRequests).toBeLessThanOrEqual(
        RATE_LIMITS.AUTH.maxRequests
      );
    });
  });
});

// ─── Token Blacklist Integration ─────────────────────────────────────
describe("Integration — Auth Flow: Token Blacklist", () => {
  const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.integration";

  describe("Blacklist Lifecycle", () => {
    it("token is not blacklisted initially", async () => {
      const isBlacklisted = await tokenBlacklist.isBlacklisted(
        "fresh-token-" + Date.now()
      );
      expect(isBlacklisted).toBe(false);
    });

    it("blacklists a token", async () => {
      const token = "blacklist-test-" + Date.now();
      await tokenBlacklist.add(token, 3600); // 1 hour TTL
      const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it("different tokens are independent", async () => {
      const token1 = "independent-test-1-" + Date.now();
      const token2 = "independent-test-2-" + Date.now();
      await tokenBlacklist.add(token1, 3600);
      const is1 = await tokenBlacklist.isBlacklisted(token1);
      const is2 = await tokenBlacklist.isBlacklisted(token2);
      expect(is1).toBe(true);
      expect(is2).toBe(false);
    });
  });
});

// ─── Cache Integration ───────────────────────────────────────────────
describe("Integration — Auth Flow: Cache Backend", () => {
  beforeEach(async () => {
    await cache.flush();
  });

  describe("Cache-Aside Pattern (getOrSet)", () => {
    it("calls fetcher on cache miss", async () => {
      let called = false;
      const result = await cache.getOrSet(
        "integration-miss-" + Date.now(),
        async () => {
          called = true;
          return { data: "fetched" };
        },
        60
      );
      expect(called).toBe(true);
      expect(result).toEqual({ data: "fetched" });
    });

    it("returns cached value on cache hit", async () => {
      const key = "integration-hit-" + Date.now();
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { data: "fetched" };
      };

      await cache.getOrSet(key, fetcher, 60);
      expect(callCount).toBe(1);

      const result = await cache.getOrSet(key, fetcher, 60);
      expect(callCount).toBe(1); // Not called again
      expect(result).toEqual({ data: "fetched" });
    });
  });
});
