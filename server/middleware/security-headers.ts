/**
 * Security Headers Middleware
 * Applies essential HTTP security headers to all responses.
 * These headers protect against common web vulnerabilities without
 * changing the visual design or functionality of the site.
 *
 * Map Support:
 * - Google Maps: maps.googleapis.com, maps.gstatic.com (when API key is set)
 * - OpenStreetMap: tile.openstreetmap.org (free fallback)
 */
import type { Request, Response, NextFunction } from "express";

/** Allowed CORS origins — add your production domains here */
// SEC-5: Added monthlykey.sa origins
const ALLOWED_ORIGINS = new Set([
  "https://monthlykey.com",
  "https://www.monthlykey.com",
  "https://mk.monthlykey.com",
  "https://monthlykey.sa",       // SEC-5
  "https://www.monthlykey.sa",   // SEC-5
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Railway preview deployments
  if (origin.endsWith(".up.railway.app")) return true;
  // Allow localhost in development
  if (process.env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return true;
  }
  return false;
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // ─── CORS ─────────────────────────────────────────────────────────
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // ─── HSTS: Force HTTPS for 1 year ─────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // ─── Prevent MIME type sniffing ────────────────────────────────────
  res.setHeader("X-Content-Type-Options", "nosniff");

  // ─── Clickjacking protection ──────────────────────────────────────
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // ─── Referrer Policy ──────────────────────────────────────────────
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // ─── Permissions Policy ───────────────────────────────────────────
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()"
  );

  // ─── Cross-Origin headers ─────────────────────────────────────────
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  // SEC-9: Add COEP and CORP headers
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // ─── Content Security Policy (Enforcing mode) ─────────────────────
  const csp = [
    "default-src 'self'",
    // Scripts: self + Google Maps + Analytics + CDNs (removed unsafe-eval)
    "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://unpkg.com https://hcaptcha.com https://*.hcaptcha.com",
    // Styles: self + Google Fonts + Leaflet CDN + inline (needed for React)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://hcaptcha.com https://*.hcaptcha.com",
    // Fonts: self + Google Fonts
    "font-src 'self' https://fonts.gstatic.com data:",
    // SEC-6: Images: self + data/blob + OpenStreetMap tiles + Google Maps tiles + HTTPS only (removed http:)
    "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://maps.gstatic.com https://maps.googleapis.com https://*.ggpht.com",
    // Media
    "media-src 'self' https://cdn.jsdelivr.net blob:",
    // Connect: self + Google Maps APIs + OpenStreetMap + Analytics + PayPal + R2 storage
    "connect-src 'self' https://pub-38c4c6d7eb714a07a24cd2d4c7870282.r2.dev https://*.r2.dev https://maps.googleapis.com https://maps.gstatic.com https://*.tile.openstreetmap.org https://*.openstreetmap.org https://www.google-analytics.com https://www.googletagmanager.com https://*.paypal.com https://api.moyasar.com https://hcaptcha.com https://*.hcaptcha.com wss:",
    // Frames: self + PayPal + Google Maps
    "frame-src 'self' https://*.paypal.com https://maps.google.com https://hcaptcha.com https://*.hcaptcha.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    // Workers for Google Maps and Service Worker
    "worker-src 'self' blob:",
    // Manifest
    "manifest-src 'self'",
    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // Use enforcing CSP in production, report-only in development
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Content-Security-Policy", csp);
  } else {
    res.setHeader("Content-Security-Policy-Report-Only", csp);
  }

  // ─── Remove X-Powered-By to reduce fingerprinting ─────────────────
  res.removeHeader("X-Powered-By");

  next();
}
