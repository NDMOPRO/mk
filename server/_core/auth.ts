/**
 * Local Authentication Routes
 *
 * All authentication is handled via userId + password.
 * No external OAuth provider is used.
 * Rate limiting is applied to login and register endpoints.
 * Authentication events are logged for auditing.
 *
 * Security hardening (2026-02-26):
 * - Password policy: 8+ chars, uppercase, lowercase, digit, special char (SEC-7)
 * - Session TTL: 30 min in production (configurable via SESSION_TTL_MS)
 * - JWT fail-fast: server refuses to start without strong JWT_SECRET in production
 * - hCaptcha on registration (SEC-1)
 * - Common password blacklist (SEC-7)
 * - Registration toggle via ALLOW_REGISTRATION env (SEC-1)
 */
import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { rateLimiter, RATE_LIMITS, getClientIP, recordFailedLogin, resetLoginAttempts } from "../rate-limiter";
import { sendOtp, verifyOtp } from "../otp";
import { ENV } from "./env";
import { verifyCaptcha } from "../middleware/captcha"; // SEC-1
import { zxcvbnAsync, zxcvbnOptions } from "@zxcvbn-ts/core"; // SEC-7
import * as zxcvbnCommon from "@zxcvbn-ts/language-common"; // SEC-7
import * as zxcvbnEn from "@zxcvbn-ts/language-en"; // SEC-7
import { COMMON_PASSWORDS } from "../common-passwords"; // SEC-7

// SEC-7: Initialize zxcvbn with dictionaries
zxcvbnOptions.setOptions({
  graphs: zxcvbnCommon.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommon.dictionary,
    ...zxcvbnEn.dictionary,
  },
});

// ─── Auth Event Logger ────────────────────────────────────────────
function logAuthEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[Auth Event] ${timestamp} | ${event} |`, JSON.stringify(details));
}

// ─── Password Validation ──────────────────────────────────────────
export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  errorAr?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  // SEC-7: Minimum 8 characters (raised from 7)
  if (password.length < 8) {
    return {
      valid: false,
      error: "Password must be at least 8 characters",
      errorAr: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
      errorAr: "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
      errorAr: "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one digit",
      errorAr: "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل",
    };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character",
      errorAr: "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل",
    };
  }
  // SEC-7: Check against common passwords blacklist (case-insensitive)
  if (COMMON_PASSWORDS.has(password) || COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid: false,
      error: "This password is too common. Please choose a stronger password.",
      errorAr: "كلمة المرور شائعة جداً. يرجى اختيار كلمة مرور أقوى.",
    };
  }
  return { valid: true };
}

// SEC-7: Async password strength check using zxcvbn (for enhanced validation)
export async function validatePasswordStrength(password: string): Promise<PasswordValidationResult> {
  const basicCheck = validatePassword(password);
  if (!basicCheck.valid) return basicCheck;

  try {
    const result = await zxcvbnAsync(password);
    // Score 0-1 = too weak, require at least score 2
    if (result.score < 2) {
      return {
        valid: false,
        error: "Password is too weak. Avoid common patterns and dictionary words.",
        errorAr: "كلمة المرور ضعيفة جداً. تجنب الأنماط الشائعة وكلمات القاموس.",
      };
    }
  } catch {
    // If zxcvbn fails, fall through to basic validation only
  }
  return { valid: true };
}

export function registerAuthRoutes(app: Express) {
  // ─── Local Login ─────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // Rate limiting: 10 attempts per 5 minutes per IP
    const rl = await Promise.resolve(rateLimiter.check(`auth:login:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs));
    if (!rl.allowed) {
      logAuthEvent("LOGIN_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many login attempts. Please try again later.",
        errorAr: "محاولات دخول كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        res.status(400).json({
          error: "userId and password are required",
          errorAr: "معرف المستخدم وكلمة المرور مطلوبان",
        });
        return;
      }

      const user = await db.getUserByUserId(userId);
      if (!user || !user.passwordHash) {
        logAuthEvent("LOGIN_FAILED", { userId, ip, reason: "user_not_found" });
        res.status(401).json({
          error: "Invalid credentials",
          errorAr: "بيانات الدخول غير صحيحة",
        });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        // Record failed attempt and check for account lockout
        const lockout = await recordFailedLogin(userId);
        logAuthEvent("LOGIN_FAILED", { userId, ip, reason: "wrong_password", attemptsRemaining: lockout.attemptsRemaining, locked: lockout.locked });
        if (lockout.locked) {
          const lockoutMinutes = Math.ceil(lockout.resetIn / 60_000);
          res.status(429).json({
            error: `Account temporarily locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`,
            errorAr: `تم قفل الحساب مؤقتاً بسبب محاولات دخول كثيرة. حاول مرة أخرى بعد ${lockoutMinutes} دقيقة.`,
            retryAfterMs: lockout.resetIn,
          });
          return;
        }
        res.status(401).json({
          error: "Invalid credentials",
          errorAr: "بيانات الدخول غير صحيحة",
        });
        return;
      }

      // Reset login attempts on successful login
      await resetLoginAttempts(userId);

      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      // Create JWT session with configurable TTL (default: 30 min in production)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.displayName || user.name || userId,
        expiresInMs: ENV.sessionTtlMs,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ENV.sessionTtlMs });

      logAuthEvent("LOGIN_SUCCESS", { userId, userDbId: user.id, ip, role: user.role, sessionTtlMs: ENV.sessionTtlMs });

      res.json({
        success: true,
        user: {
          id: user.id,
          userId: user.userId,
          displayName: user.displayName,
          name: user.name,
          email: user.email,
          role: user.isOwner ? 'admin' : user.role,
          isOwner: user.isOwner || false,
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[Auth] Login failed:", errMsg);
      console.error("[Auth] Login error stack:", (error as any)?.stack);
      logAuthEvent("LOGIN_ERROR", { ip, error: errMsg });
      res.status(500).json({
        error: "Login failed",
        errorAr: "فشل تسجيل الدخول",
      });
    }
  });

  // ─── Local Register ──────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // SEC-1: Check if registration is enabled
    if (process.env.ALLOW_REGISTRATION === "false") {
      logAuthEvent("REGISTER_DISABLED", { ip });
      res.status(403).json({
        error: "Registration is currently disabled",
        errorAr: "التسجيل معطل حالياً",
      });
      return;
    }

    // Rate limiting: 10 attempts per 5 minutes per IP
    const rl = await Promise.resolve(rateLimiter.check(`auth:register:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs));
    if (!rl.allowed) {
      logAuthEvent("REGISTER_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many registration attempts. Please try again later.",
        errorAr: "محاولات تسجيل كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password, displayName, name, nameAr, email, phone, captchaToken } = req.body;

      // SEC-1: Verify hCaptcha token
      const captchaResult = await verifyCaptcha(captchaToken);
      if (!captchaResult.success) {
        logAuthEvent("REGISTER_CAPTCHA_FAILED", { ip });
        res.status(400).json({
          error: captchaResult.error,
          errorAr: captchaResult.errorAr,
        });
        return;
      }

      if (!userId || !password || !displayName) {
        res.status(400).json({
          error: "userId, password, and displayName are required",
          errorAr: "معرف المستخدم وكلمة المرور واسم العرض مطلوبان",
        });
        return;
      }

      // SEC-7: Enforce 8+ char password with complexity + strength requirements
      const pwCheck = await validatePasswordStrength(password);
      if (!pwCheck.valid) {
        res.status(400).json({ error: pwCheck.error, errorAr: pwCheck.errorAr });
        return;
      }

      // Check if userId already exists — use generic message to mitigate enumeration
      const existing = await db.getUserByUserId(userId);
      if (existing) {
        logAuthEvent("REGISTER_DUPLICATE", { userId, ip });
        res.status(400).json({
          error: "Registration failed. Please check your details and try again.",
          errorAr: "فشل التسجيل. يرجى التحقق من بياناتك والمحاولة مرة أخرى.",
        });
        return;
      }

      // Hash password with bcrypt (cost factor 12)
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const newUserId = await db.createLocalUser({
        userId,
        passwordHash,
        displayName,
        name: name || displayName,
        nameAr,
        email,
        phone,
        role: "user",
      });

      if (!newUserId) {
        res.status(500).json({
          error: "Failed to create user",
          errorAr: "فشل إنشاء الحساب",
        });
        return;
      }

      // Auto-login after register with configurable TTL
      const openId = `local_${userId}`;
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ENV.sessionTtlMs,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ENV.sessionTtlMs });

      logAuthEvent("REGISTER_SUCCESS", { userId, newUserId, ip });

      res.json({
        success: true,
        user: {
          id: newUserId,
          userId,
          displayName,
          name: name || displayName,
          email,
          role: "user",
        },
      });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      logAuthEvent("REGISTER_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Registration failed",
        errorAr: "فشل التسجيل",
      });
    }
  });

  // ─── Change Password ─────────────────────────────────────────────
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    try {
      const cookies = req.headers.cookie;
      if (!cookies) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { parse } = await import("cookie");
      const parsed = parse(cookies);
      const session = await sdk.verifySession(parsed[COOKIE_NAME]);
      if (!session) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current and new passwords required" });
        return;
      }

      // SEC-7: Enforce 8+ char password with complexity + strength requirements
      const pwCheck = await validatePasswordStrength(newPassword);
      if (!pwCheck.valid) {
        res.status(400).json({ error: pwCheck.error, errorAr: pwCheck.errorAr });
        return;
      }

      if (user.passwordHash) {
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          logAuthEvent("PASSWORD_CHANGE_FAILED", { userId: user.userId, ip, reason: "wrong_current_password" });
          res.status(401).json({
            error: "Current password is incorrect",
            errorAr: "كلمة المرور الحالية غير صحيحة",
          });
          return;
        }
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      await db.updateUserPassword(user.id, passwordHash);

      logAuthEvent("PASSWORD_CHANGE_SUCCESS", { userId: user.userId, userDbId: user.id, ip });

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Change password failed:", error);
      logAuthEvent("PASSWORD_CHANGE_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ─── Reset Password (via OTP) ───────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        res.status(400).json({
          error: "Email, code, and new password are required",
          errorAr: "البريد الإلكتروني والرمز وكلمة المرور الجديدة مطلوبة",
        });
        return;
      }

      // Verify the OTP first
      const otpResult = await verifyOtp({
        channel: "email",
        destination: email,
        code,
        purpose: "password_reset",
        ip,
      });

      if (!otpResult.success) {
        res.status(400).json({
          error: otpResult.error || "Invalid or expired code",
          errorAr: otpResult.errorAr || "رمز التحقق غير صالح أو منتهي الصلاحية",
        });
        return;
      }

      // SEC-7: Validate new password with strength check
      const pwCheck = await validatePasswordStrength(newPassword);
      if (!pwCheck.valid) {
        res.status(400).json({ error: pwCheck.error, errorAr: pwCheck.errorAr });
        return;
      }

      // Find user by email
      const user = await db.getUserByEmail(email);
      if (!user) {
        // Don't reveal whether user exists
        res.json({ success: true });
        return;
      }

      // Hash and update password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      await db.updateUserPassword(user.id, passwordHash);

      logAuthEvent("PASSWORD_RESET_SUCCESS", { userId: user.userId, userDbId: user.id, ip });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Reset password failed:", error);
      logAuthEvent("PASSWORD_RESET_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Failed to reset password",
        errorAr: "فشل إعادة تعيين كلمة المرور",
      });
    }
  });

  // ─── OTP Send ────────────────────────────────────────────────────
  app.post("/api/v1/auth/otp/send", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      const { channel, destination, purpose, lang } = req.body;

      if (!channel || !destination || !purpose) {
        res.status(400).json({
          error: "channel, destination, and purpose are required",
          errorAr: "القناة والوجهة والغرض مطلوبة",
        });
        return;
      }

      if (channel !== "phone" && channel !== "email") {
        res.status(400).json({ error: "channel must be phone or email", errorAr: "القناة يجب أن تكون هاتف أو إيميل" });
        return;
      }

      // Basic validation
      if (channel === "phone") {
        // Must be E.164 format
        if (!/^\+[1-9]\d{6,14}$/.test(destination)) {
          res.status(400).json({
            error: "Phone must be in E.164 format (e.g., +966501234567)",
            errorAr: "رقم الهاتف يجب أن يكون بصيغة دولية (مثال: +966501234567)",
          });
          return;
        }
      } else {
        // Basic email check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
          res.status(400).json({ error: "Invalid email address", errorAr: "بريد إلكتروني غير صالح" });
          return;
        }
      }

      const result = await sendOtp({
        channel,
        destination,
        purpose,
        ip,
        lang: lang || "ar",
      });

      if (!result.success) {
        res.status(429).json(result);
        return;
      }

      const response: Record<string, unknown> = { success: true };
      // In dev mode, return the code for testing
      if (result.devCode) {
        response.devCode = result.devCode;
      }

      logAuthEvent("OTP_SENT", { channel, destination, purpose, ip });
      res.json(response);
    } catch (error) {
      console.error("[Auth] OTP send failed:", error);
      logAuthEvent("OTP_SEND_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to send OTP", errorAr: "فشل إرسال رمز التحقق" });
    }
  });

  // ─── OTP Verify ──────────────────────────────────────────────────
  app.post("/api/v1/auth/otp/verify", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      const { channel, destination, code, purpose } = req.body;

      if (!channel || !destination || !code || !purpose) {
        res.status(400).json({
          error: "channel, destination, code, and purpose are required",
          errorAr: "القناة والوجهة والرمز والغرض مطلوبة",
        });
        return;
      }

      const result = await verifyOtp({ channel, destination, code, purpose, ip });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      // Update emailVerified/phoneVerified for ANY purpose (registration, verification, etc.)
      // This ensures the granular verification fields are always kept in sync.
      {
        const verifyUser = channel === "phone"
          ? await db.getUserByPhone(destination)
          : await db.getUserByEmail(destination);
        if (verifyUser) {
          const updates: Record<string, any> = {};
          if (channel === "email" && !verifyUser.emailVerified) {
            updates.emailVerified = true;
            updates.emailVerifiedAt = new Date();
          }
          if (channel === "phone" && !verifyUser.phoneVerified) {
            updates.phoneVerified = true;
            updates.phoneVerifiedAt = new Date();
          }
          // Derive isVerified: both email and phone must be verified
          const emailOk = channel === "email" ? true : !!verifyUser.emailVerified;
          const phoneOk = channel === "phone" ? true : !!verifyUser.phoneVerified;
          if (emailOk && phoneOk) {
            updates.isVerified = true;
          }
          if (Object.keys(updates).length > 0) {
            await db.updateUserProfile(verifyUser.id, updates as any);
            // Audit log for verification event
            try {
              const { logAudit } = await import("../audit-log");
              await logAudit({
                userId: verifyUser.id,
                userName: verifyUser.displayName || verifyUser.name || verifyUser.userId || "User",
                action: "UPDATE" as any,
                entityType: "USER_VERIFICATION" as any,
                entityId: verifyUser.id,
                entityLabel: channel === "email" ? destination : `phone:${destination}`,
                changes: updates,
                metadata: { purpose, channel },
                ipAddress: ip,
              });
            } catch (e) { /* audit should not break flow */ }
          }
        }
      }

      // If purpose is registration, update user verification status
      if (purpose === "registration") {
        const user = channel === "phone"
          ? await db.getUserByPhone(destination)
          : await db.getUserByEmail(destination);

        if (user) {
          // Mark user as verified after OTP confirmation (legacy field)
          await db.updateUserProfile(user.id, { isVerified: true } as any);

          // Auto-login after verification with configurable TTL
          const updatedUser = await db.getUserById(user.id);
          if (updatedUser) {
            const openId = updatedUser.openId;
            const sessionToken = await sdk.createSessionToken(openId, {
              name: updatedUser.displayName || updatedUser.name || updatedUser.userId || "User",
              expiresInMs: ENV.sessionTtlMs,
            });
            const cookieOptions = getSessionCookieOptions(req);
            res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ENV.sessionTtlMs });

            logAuthEvent("OTP_VERIFY_FULL", { channel, destination, purpose, userId: user.id, ip });
            res.json({
              success: true,
              fullyVerified: true,
              user: {
                id: updatedUser.id,
                userId: updatedUser.userId,
                displayName: updatedUser.displayName,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
              },
            });
            return;
          }
        }
      }

      logAuthEvent("OTP_VERIFIED", { channel, destination, purpose, ip });
      res.json({ success: true, fullyVerified: false });
    } catch (error) {
      console.error("[Auth] OTP verify failed:", error);
      logAuthEvent("OTP_VERIFY_ERROR", { ip, error: String(error) });
      res.status(500).json({ error: "Failed to verify OTP", errorAr: "فشل التحقق من الرمز" });
    }
  });

  // ─── V1 Register (with pending verification) ─────────────────────
  app.post("/api/v1/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIP(req);

    // SEC-1: Check if registration is enabled
    if (process.env.ALLOW_REGISTRATION === "false") {
      logAuthEvent("REGISTER_V1_DISABLED", { ip });
      res.status(403).json({
        error: "Registration is currently disabled",
        errorAr: "التسجيل معطل حالياً",
      });
      return;
    }

    const rl = await Promise.resolve(rateLimiter.check(`auth:register:${ip}`, RATE_LIMITS.AUTH.maxRequests, RATE_LIMITS.AUTH.windowMs));
    if (!rl.allowed) {
      logAuthEvent("REGISTER_V1_RATE_LIMITED", { ip, resetIn: rl.resetIn });
      res.status(429).json({
        error: "Too many registration attempts. Please try again later.",
        errorAr: "محاولات تسجيل كثيرة. يرجى المحاولة لاحقاً.",
        retryAfterMs: rl.resetIn,
      });
      return;
    }

    try {
      const { userId, password, displayName, name, nameAr, email, phone, captchaToken } = req.body;

      // SEC-1: Verify hCaptcha token
      const captchaResult = await verifyCaptcha(captchaToken);
      if (!captchaResult.success) {
        logAuthEvent("REGISTER_V1_CAPTCHA_FAILED", { ip });
        res.status(400).json({
          error: captchaResult.error,
          errorAr: captchaResult.errorAr,
        });
        return;
      }

      if (!userId || !password || !displayName || !email || !phone) {
        res.status(400).json({
          error: "userId, password, displayName, email, and phone are required",
          errorAr: "معرف المستخدم وكلمة المرور واسم العرض والإيميل ورقم الهاتف مطلوبة",
        });
        return;
      }

      // SEC-7: Enforce 8+ char password with complexity + strength requirements
      const pwCheck = await validatePasswordStrength(password);
      if (!pwCheck.valid) {
        res.status(400).json({ error: pwCheck.error, errorAr: pwCheck.errorAr });
        return;
      }

      // Validate phone E.164
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        res.status(400).json({
          error: "Phone must be in E.164 format (e.g., +966501234567)",
          errorAr: "رقم الهاتف يجب أن يكون بصيغة دولية",
        });
        return;
      }

      // Check if userId already exists — use generic message to mitigate enumeration
      const existing = await db.getUserByUserId(userId);
      if (existing) {
        logAuthEvent("REGISTER_DUPLICATE", { userId, ip });
        res.status(400).json({
          error: "Registration failed. Please check your details and try again.",
          errorAr: "فشل التسجيل. يرجى التحقق من بياناتك والمحاولة مرة أخرى.",
        });
        return;
      }

      // Check if phone already exists — generic message to mitigate enumeration
      const existingPhone = await db.getUserByPhone(phone);
      if (existingPhone) {
        logAuthEvent("REGISTER_DUPLICATE_PHONE", { phone, ip });
        res.status(400).json({
          error: "Registration failed. Please check your details and try again.",
          errorAr: "فشل التسجيل. يرجى التحقق من بياناتك والمحاولة مرة أخرى.",
        });
        return;
      }
      // Check if email already exists — generic message to mitigate enumeration
      const existingEmail = await db.getUserByEmail(email);
      if (existingEmail) {
        logAuthEvent("REGISTER_DUPLICATE_EMAIL", { email, ip });
        res.status(400).json({
          error: "Registration failed. Please check your details and try again.",
          errorAr: "فشل التسجيل. يرجى التحقق من بياناتك والمحاولة مرة أخرى.",
        });;
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user in pending_verification status
      const newUserId = await db.createLocalUser({
        userId,
        passwordHash,
        displayName,
        name: name || displayName,
        nameAr,
        email,
        phone,
        role: "user",
      });

      if (!newUserId) {
        res.status(500).json({
          error: "Failed to create user",
          errorAr: "فشل إنشاء الحساب",
        });
        return;
      }

      logAuthEvent("REGISTER_V1_SUCCESS", { userId, newUserId, ip, status: "pending_verification" });

      res.json({
        success: true,
        userId: newUserId,
        verificationStatus: "pending",
        phone,
        email,
      });
    } catch (error) {
      console.error("[Auth] V1 Register failed:", error);
      logAuthEvent("REGISTER_V1_ERROR", { ip, error: String(error) });
      res.status(500).json({
        error: "Registration failed",
        errorAr: "فشل التسجيل",
      });
    }
  });

  // ─── Seed System Owner ──────────────────────────────────────────
  app.post("/api/auth/seed-owner", async (req: Request, res: Response) => {
    const ip = getClientIP(req);
    try {
      // Check if an owner already exists
      const existingOwner = await db.getUserByUserId("Hobart");
      if (existingOwner && existingOwner.isOwner) {
        logAuthEvent("SEED_OWNER_SKIPPED", { ip, reason: "owner_already_exists", userId: existingOwner.id });
        res.json({ success: true, message: "Owner already exists", userId: existingOwner.id });
        return;
      }

      // If user exists but isOwner is not set, update it
      if (existingOwner && !existingOwner.isOwner) {
        await db.updateUserProfile(existingOwner.id, { isOwner: true, role: "admin" } as any);
        logAuthEvent("SEED_OWNER_UPGRADED", { ip, userId: existingOwner.id });
        res.json({ success: true, message: "Existing user upgraded to owner", userId: existingOwner.id });
        return;
      }

      // Create new owner user
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash("83686571KoKo$", salt);
      const newUserId = await db.createLocalUser({
        userId: "Hobart",
        passwordHash,
        displayName: "Hobart",
        name: "Hobart",
        nameAr: "هوبارت",
        email: "hobarti@protonmail.com",
        phone: "+966504466528",
        role: "admin",
      });

      if (newUserId) {
        // Set isOwner flag
        await db.updateUserProfile(newUserId, { isOwner: true } as any);
        logAuthEvent("SEED_OWNER_CREATED", { ip, userId: newUserId });
        res.json({ success: true, message: "Owner created", userId: newUserId });
      } else {
        res.status(500).json({ success: false, error: "Failed to create owner" });
      }
    } catch (error) {
      console.error("[Auth] Seed owner failed:", error);
      logAuthEvent("SEED_OWNER_ERROR", { ip, error: String(error) });
      res.status(500).json({ success: false, error: "Failed to seed owner" });
    }
  });

  // ─── Protect Owner Middleware (applied to admin user management) ──
  app.use("/api/admin/users/:id", async (req: Request, res: Response, next) => {
    if (req.method === "DELETE" || req.method === "PATCH" || req.method === "PUT") {
      try {
        const targetId = parseInt(req.params.id);
        if (!isNaN(targetId)) {
          const targetUser = await db.getUserById(targetId);
          if (targetUser && (targetUser as any).isOwner) {
            // Block deletion or status changes on owner
            if (req.method === "DELETE" || req.body?.status === "INACTIVE" || req.body?.status === "SUSPENDED" || req.body?.role) {
              logAuthEvent("PROTECT_OWNER_BLOCKED", { targetId, method: req.method, ip: getClientIP(req) });
              res.status(403).json({
                success: false,
                error: "Cannot modify system owner account",
                errorAr: "لا يمكن تعديل حساب مالك النظام",
              });
              return;
            }
          }
        }
      } catch (e) {
        // Don't block on middleware errors, just log
        console.warn("[ProtectOwner] Middleware error:", e);
      }
    }
    next();
  });

  // ─── OAuth callback removed ──────────────────────────────────────
  // No OAuth routes exist. Any request to /api/oauth/* returns 404 (default Express behavior).
}
