/**
 * Encryption Module — AES-256-GCM
 *
 * Encrypts integration credentials before storing in DB.
 * Decrypts them at runtime when needed by OTP/SMS/Email providers.
 *
 * Key: SETTINGS_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Format: base64( 12-byte IV || ciphertext || 16-byte authTag )
 *
 * Never logs secrets or decrypted values.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    return null;
  }
  try {
    return Buffer.from(hex, "hex");
  } catch {
    console.error("[Encryption] SETTINGS_ENCRYPTION_KEY is not valid hex");
    return null;
  }
}

/**
 * Encrypt a plaintext string.
 * Returns base64-encoded string containing IV + ciphertext + authTag.
 * Returns null if encryption key is not configured.
 */
export function encrypt(plaintext: string): string | null {
  const key = getKey();
  if (!key) {
    console.warn("[Encryption] SETTINGS_ENCRYPTION_KEY not configured — cannot encrypt");
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: IV || ciphertext || authTag
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded ciphertext.
 * Returns the plaintext string.
 * Returns null if decryption fails or key is not configured.
 */
export function decrypt(ciphertext: string): string | null {
  const key = getKey();
  if (!key) {
    console.warn("[Encryption] SETTINGS_ENCRYPTION_KEY not configured — cannot decrypt");
    return null;
  }

  try {
    const packed = Buffer.from(ciphertext, "base64");

    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      console.error("[Encryption] Ciphertext too short");
      return null;
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[Encryption] Decryption failed (wrong key or corrupted data)");
    return null;
  }
}

/**
 * Compute SHA-256 hash of plaintext for integrity verification.
 */
export function hashConfig(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Mask a secret string for display in admin UI.
 * Shows first 4 and last 4 characters, rest replaced with ****
 * If string is 8 chars or less, shows only last 4 with **** prefix.
 */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) {
    return "****" + value.slice(-4);
  }
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * Check if the encryption key is configured and valid.
 */
export function isEncryptionReady(): boolean {
  return getKey() !== null;
}
