/**
 * CSRF protection for state-changing API requests.
 *
 * Session cookies are SameSite=Lax, which already stops most cross-site
 * requests from carrying the session. This adds the standard second layer:
 * a POST/PUT/PATCH/DELETE to /api that comes from a browser on another site
 * (its Origin, or Referer when Origin is absent) is refused.
 *
 * Requests without either header (server-to-server calls, payment and
 * messaging webhooks, curl) are not browser CSRF and pass through; webhooks
 * authenticate themselves separately.
 */
import type { Request, Response, NextFunction } from "express";
import { isAllowedOrigin } from "./security-headers";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestHost(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.headers.host;
  return host?.split(",")[0].trim().toLowerCase();
}

function sourceOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (origin && origin !== "null") return origin;
  if (origin === "null") return "null";
  const referer = req.headers.referer;
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return "null";
  }
}

export function isCrossSiteRequest(req: Request): boolean {
  if (!UNSAFE_METHODS.has(req.method)) return false;
  if (!req.path.startsWith("/api/") || req.path.startsWith("/api/webhooks/")) return false;
  const origin = sourceOrigin(req);
  if (origin === undefined) return false;
  if (origin === "null") return true;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return true;
  }
  if (host === requestHost(req)) return false;
  return !isAllowedOrigin(origin);
}

export function csrfOriginCheck(req: Request, res: Response, next: NextFunction): void {
  if (isCrossSiteRequest(req)) {
    console.warn(`[CSRF] Blocked ${req.method} ${req.path} from origin ${req.headers.origin || req.headers.referer}`);
    res.status(403).json({ error: "Cross-site request blocked", errorAr: "تم رفض طلب من موقع آخر" });
    return;
  }
  next();
}
