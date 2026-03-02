/**
 * Break-Glass Admin Bypass
 *
 * Provides an emergency bypass for verification and KYC gates.
 * Reads ONLY from process.env — never from DB, platform_settings, or feature flags.
 * Works even if the database is down or all feature flags are misconfigured.
 *
 * Env vars:
 *   BREAKGLASS_ADMIN_EMAILS   — comma-separated emails (e.g. "admin@mk.com,ceo@mk.com")
 *   BREAKGLASS_ADMIN_USER_IDS — comma-separated userIds (e.g. "Hobart,admin2")
 *
 * If the current user's email matches BREAKGLASS_ADMIN_EMAILS
 * OR the current user's userId matches BREAKGLASS_ADMIN_USER_IDS,
 * all verification and KYC gating is bypassed.
 */

function parseList(envVar: string | undefined): string[] {
  if (!envVar || !envVar.trim()) return [];
  return envVar
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

let _cachedEmails: string[] | null = null;
let _cachedUserIds: string[] | null = null;

function getBreakglassEmails(): string[] {
  if (_cachedEmails === null) {
    _cachedEmails = parseList(process.env.BREAKGLASS_ADMIN_EMAILS);
    if (_cachedEmails.length > 0) {
      console.log(`[Breakglass] Loaded ${_cachedEmails.length} break-glass admin email(s)`);
    }
  }
  return _cachedEmails;
}

function getBreakglassUserIds(): string[] {
  if (_cachedUserIds === null) {
    _cachedUserIds = parseList(process.env.BREAKGLASS_ADMIN_USER_IDS);
    if (_cachedUserIds.length > 0) {
      console.log(`[Breakglass] Loaded ${_cachedUserIds.length} break-glass admin userId(s)`);
    }
  }
  return _cachedUserIds;
}

/**
 * Check if a user is a break-glass admin.
 * Accepts a partial user object — only needs email and/or userId.
 * Returns true if the user matches any break-glass env var entry.
 *
 * This function:
 * - Reads ONLY from process.env (never DB)
 * - Works regardless of feature flag state
 * - Works even if DB is completely down
 * - Is called before every verification and KYC gate
 */
export function isBreakglassAdmin(user: {
  email?: string | null;
  userId?: string | null;
}): boolean {
  if (!user) return false;

  const emails = getBreakglassEmails();
  const userIds = getBreakglassUserIds();

  // No break-glass configured — nobody bypasses
  if (emails.length === 0 && userIds.length === 0) return false;

  // Check email match
  if (user.email && emails.includes(user.email.toLowerCase())) {
    return true;
  }

  // Check userId match
  if (user.userId && userIds.includes(user.userId.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Force-refresh the cached env vars.
 * Call this if env vars are changed at runtime (unlikely but possible).
 */
export function refreshBreakglassCache(): void {
  _cachedEmails = null;
  _cachedUserIds = null;
}

/**
 * Get the list of configured break-glass identifiers (for diagnostics only).
 * Returns masked values — never exposes full emails/IDs in logs.
 */
export function getBreakglassSummary(): { emailCount: number; userIdCount: number } {
  return {
    emailCount: getBreakglassEmails().length,
    userIdCount: getBreakglassUserIds().length,
  };
}
