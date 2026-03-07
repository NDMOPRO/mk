/**
 * Admin Configuration
 * 
 * Root admin accounts are automatically detected by email or phone number.
 * Add admin emails/phones here — no manual Supabase metadata setup needed.
 */

// Admin emails (lowercase for case-insensitive matching)
const ADMIN_EMAILS: string[] = [
  "hobarti@protonmail.com",
];

// Admin phone numbers (with country code, normalized)
const ADMIN_PHONES: string[] = [
  "+966504466528",
];

/**
 * Check if a user is a root admin based on their email or phone.
 * Matches against the configured admin lists above.
 */
export function isRootAdmin(email?: string | null, phone?: string | null): boolean {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  if (phone) {
    // Normalize phone: remove spaces, dashes
    const normalized = phone.replace(/[\s\-()]/g, "");
    if (ADMIN_PHONES.includes(normalized)) {
      return true;
    }
    // Also check without leading +
    if (ADMIN_PHONES.some(p => p.replace("+", "") === normalized.replace("+", ""))) {
      return true;
    }
  }
  return false;
}

/**
 * Get admin display info
 */
export function getAdminInfo() {
  return {
    emails: ADMIN_EMAILS,
    phones: ADMIN_PHONES,
  };
}
