/**
 * Input Sanitization Middleware
 * SEC-2: Strips HTML/JS from all string fields in POST/PUT/PATCH request bodies.
 *
 * Uses the `xss` library to remove dangerous markup while preserving
 * safe text content. Applied globally before route handlers.
 */
import type { Request, Response, NextFunction } from "express";
import xss, { IFilterXSSOptions } from "xss";

// Configure xss to strip ALL tags (whitelist nothing)
const xssOptions: IFilterXSSOptions = {
  whiteList: {},          // No tags allowed
  stripIgnoreTag: true,   // Strip tags not in whitelist
  stripIgnoreTagBody: ["script", "style"], // Remove <script>/<style> and their content
};

/**
 * Recursively sanitize all string values in an object or array.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    // SEC-2: Skip password fields — they must not be mutated
    if (key === "password" || key === "currentPassword" || key === "newPassword" || key === "passwordHash") {
      result[key] = val;
    } else {
      result[key] = sanitizeValue(val);
    }
  }
  return result;
}

/**
 * Express middleware: sanitize req.body for mutation requests.
 * Only applies to POST, PUT, PATCH methods with a JSON body.
 */
export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // SEC-2: Only sanitize mutation requests with a body
  if (
    (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") &&
    req.body &&
    typeof req.body === "object"
  ) {
    req.body = sanitizeObject(req.body);
  }
  next();
}
