/**
 * WWW → Non-WWW Redirect Middleware
 * SEC-8: Redirects www.monthlykey.com → monthlykey.com
 *        and www.monthlykey.sa → monthlykey.sa with HTTP 301.
 *
 * Only active in production to avoid interfering with local development.
 */
import type { Request, Response, NextFunction } from "express";

export function wwwRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  // SEC-8: Only redirect in production
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const host = req.headers.host;
  if (!host) {
    next();
    return;
  }

  // Check if the host starts with "www."
  if (host.startsWith("www.")) {
    const nonWwwHost = host.slice(4); // Remove "www."
    const protocol = req.protocol || "https";
    const redirectUrl = `${protocol}://${nonWwwHost}${req.originalUrl}`;
    res.redirect(301, redirectUrl);
    return;
  }

  next();
}
