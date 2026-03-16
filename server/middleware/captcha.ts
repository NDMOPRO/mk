/**
 * hCaptcha Server-Side Verification Middleware
 * SEC-1: Validates hCaptcha tokens on registration endpoints.
 *
 * Env vars:
 *   HCAPTCHA_SECRET       – hCaptcha secret key (required in production)
 *   HCAPTCHA_ENABLED      – "true" to enforce (default: "false")
 *
 * When HCAPTCHA_ENABLED is "false", the middleware is a no-op so that
 * local development and tests are not blocked.
 */

const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

/**
 * Verify an hCaptcha response token with the hCaptcha API.
 * Returns { success: true } on valid token, { success: false, error } otherwise.
 */
export async function verifyCaptcha(
  token: string | undefined
): Promise<{ success: boolean; error?: string; errorAr?: string }> {
  // SEC-1: Skip if hCaptcha is disabled (dev / staging)
  const enabled = process.env.HCAPTCHA_ENABLED === "true";
  if (!enabled) {
    return { success: true };
  }

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    console.error("[Captcha] HCAPTCHA_ENABLED=true but HCAPTCHA_SECRET is not set");
    return {
      success: false,
      error: "Server misconfiguration: CAPTCHA secret missing",
      errorAr: "خطأ في إعدادات الخادم: مفتاح CAPTCHA مفقود",
    };
  }

  if (!token) {
    return {
      success: false,
      error: "CAPTCHA verification is required",
      errorAr: "التحقق من CAPTCHA مطلوب",
    };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };

    if (!data.success) {
      const codes = data["error-codes"]?.join(", ") || "unknown";
      console.warn(`[Captcha] Verification failed: ${codes}`);
      return {
        success: false,
        error: "CAPTCHA verification failed. Please try again.",
        errorAr: "فشل التحقق من CAPTCHA. يرجى المحاولة مرة أخرى.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[Captcha] API call failed:", err);
    return {
      success: false,
      error: "CAPTCHA verification service unavailable",
      errorAr: "خدمة التحقق من CAPTCHA غير متاحة",
    };
  }
}
