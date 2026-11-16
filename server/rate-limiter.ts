/**
 * Rate limiter with swappable backends
 * - Redis (when REDIS_URL is set): shared state across Railway instances
 * - In-memory (default): single-instance fallback
 *
 * API surface is identical for both backends: check(), peek(), reset().
 *
 * Security hardening (2026-02-26):
 * - Account lockout after 5 failed login attempts (15 min lockout)
 * - Per-userId rate limiting for login (prevents credential stuffing)
 * - Separate rate limit tiers for different endpoint categories
 *
 * Redis upgrade (2026-03-04):
 * - Redis INCR + EXPIRE for distributed rate limiting
 * - Graceful fallback to in-memory when Redis is unavailable
 */

import Redis from "ioredis";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

interface RateLimitBackend {
  check(key: string, maxRequests: number, windowMs: number): RateLimitResult | Promise<RateLimitResult>;
  peek(key: string): number | Promise<number>;
  reset(key: string): void | Promise<void>;
  destroy(): void;
}

// ─── In-Memory Backend ───────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter implements RateLimitBackend {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.store.entries());
      for (const [key, entry] of entries) {
        if (now > entry.resetAt) {
          this.store.delete(key);
        }
      }
    }, 60_000);
  }

  check(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now };
  }

  peek(key: string): number {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.resetAt) return 0;
    return entry.count;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// ─── Redis Backend ───────────────────────────────────────────────────────────
// Uses atomic INCR + EXPIRE for distributed rate limiting.
// Falls back to in-memory if Redis is unreachable.

class RedisRateLimiter implements RateLimitBackend {
  private client: Redis;
  private fallback: MemoryRateLimiter;
  private namespace: string;
  private _connected = false;

  constructor(redisUrl: string, namespace = "mk:rl") {
    this.namespace = namespace;
    this.fallback = new MemoryRateLimiter();

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.error("[RateLimiter/Redis] Max retries exceeded — giving up reconnection");
          return null;
        }
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10_000,
      commandTimeout: 5_000,
    });

    this.client.on("error", (err: Error) => {
      if (this._connected) {
        console.error("[RateLimiter/Redis] Connection lost:", err.message);
        this._connected = false;
      }
    });
    this.client.on("connect", () => {
      console.log("[RateLimiter/Redis] Connected successfully");
      this._connected = true;
    });
    this.client.on("close", () => {
      if (this._connected) {
        console.warn("[RateLimiter/Redis] Connection closed");
        this._connected = false;
      }
    });

    this.client.connect().catch((err: Error) => {
      console.error("[RateLimiter/Redis] Initial connection failed:", err.message);
      console.warn("[RateLimiter/Redis] Falling back to in-memory rate limiter");
    });
  }

  private prefixKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    if (!this._connected) return this.fallback.check(key, maxRequests, windowMs);

    const redisKey = this.prefixKey(key);
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

    try {
      // Atomic INCR + conditional EXPIRE via Lua script
      // This ensures the window starts on first request and is atomic
      const luaScript = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        local ttl = redis.call('PTTL', KEYS[1])
        return {current, ttl}
      `;

      const result = await this.client.eval(luaScript, 1, redisKey, windowSec) as [number, number];
      const [count, ttlMs] = result;
      const resetIn = ttlMs > 0 ? ttlMs : windowMs;

      if (count > maxRequests) {
        return { allowed: false, remaining: 0, resetIn };
      }

      return { allowed: true, remaining: maxRequests - count, resetIn };
    } catch (err) {
      console.error("[RateLimiter/Redis] CHECK error:", (err as Error).message);
      return this.fallback.check(key, maxRequests, windowMs);
    }
  }

  async peek(key: string): Promise<number> {
    if (!this._connected) return this.fallback.peek(key);

    try {
      const val = await this.client.get(this.prefixKey(key));
      return val ? parseInt(val, 10) : 0;
    } catch (err) {
      console.error("[RateLimiter/Redis] PEEK error:", (err as Error).message);
      return this.fallback.peek(key);
    }
  }

  async reset(key: string): Promise<void> {
    this.fallback.reset(key);
    if (!this._connected) return;

    try {
      await this.client.del(this.prefixKey(key));
    } catch (err) {
      console.error("[RateLimiter/Redis] RESET error:", (err as Error).message);
    }
  }

  destroy(): void {
    this.fallback.destroy();
    this.client.disconnect();
  }
}

// ─── Factory & Singleton ─────────────────────────────────────────────────────

function createRateLimiter(): RateLimitBackend {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log("[RateLimiter] REDIS_URL detected — using Redis distributed rate limiter");
    return new RedisRateLimiter(redisUrl, "mk:rl");
  }
  console.warn("[RateLimiter] ⚠ Redis not configured — using in-memory rate limiter. State will be lost on restart.");
  return new MemoryRateLimiter();
}

export const rateLimiter = createRateLimiter();

// ─── Rate limit presets ──────────────────────────────────────────────────────

export const RATE_LIMITS = {
  // Public endpoints (search, browse)
  PUBLIC_READ: { maxRequests: 120, windowMs: 60_000 },     // 120 req/min
  // Authenticated reads
  AUTH_READ: { maxRequests: 200, windowMs: 60_000 },       // 200 req/min
  // Write operations (create, update)
  WRITE: { maxRequests: 30, windowMs: 60_000 },            // 30 req/min
  // Auth operations (login, register) — per IP
  AUTH: { maxRequests: 10, windowMs: 300_000 },             // 10 per 5 min
  // Account lockout — per userId (stricter)
  LOGIN_PER_USER: { maxRequests: 5, windowMs: 900_000 },   // 5 per 15 min → lockout
  // File uploads
  UPLOAD: { maxRequests: 20, windowMs: 300_000 },           // 20 per 5 min
  // AI operations
  AI: { maxRequests: 15, windowMs: 60_000 },                // 15 req/min
  // Admin operations
  ADMIN: { maxRequests: 100, windowMs: 60_000 },            // 100 req/min
  // Password reset / change
  PASSWORD_RESET: { maxRequests: 3, windowMs: 900_000 },    // 3 per 15 min
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get client IP from request
 */
export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  // Railway's edge overwrites X-Real-IP and X-Forwarded-For with the real
  // client address, so callers cannot spoof them to dodge rate limits.
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Check if a userId is currently locked out due to too many failed login attempts.
 * Returns { locked: boolean, resetIn: number (ms) }
 */
export async function checkAccountLockout(userId: string): Promise<{ locked: boolean; resetIn: number }> {
  const key = `auth:login:user:${userId}`;
  const result = await Promise.resolve(
    rateLimiter.check(key, RATE_LIMITS.LOGIN_PER_USER.maxRequests, RATE_LIMITS.LOGIN_PER_USER.windowMs)
  );
  return { locked: !result.allowed, resetIn: result.resetIn };
}

/**
 * Record a failed login attempt for a userId.
 */
export async function recordFailedLogin(userId: string): Promise<{ locked: boolean; attemptsRemaining: number; resetIn: number }> {
  const key = `auth:login:user:${userId}`;
  const result = await Promise.resolve(
    rateLimiter.check(key, RATE_LIMITS.LOGIN_PER_USER.maxRequests, RATE_LIMITS.LOGIN_PER_USER.windowMs)
  );
  return {
    locked: !result.allowed,
    attemptsRemaining: result.remaining,
    resetIn: result.resetIn,
  };
}

/**
 * Reset login attempts after successful login.
 */
export async function resetLoginAttempts(userId: string): Promise<void> {
  await Promise.resolve(rateLimiter.reset(`auth:login:user:${userId}`));
}
