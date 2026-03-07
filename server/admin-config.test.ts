import { describe, it, expect } from "vitest";

// Test the admin detection logic (mirrors client/src/lib/adminConfig.ts)
const ADMIN_EMAILS = ["hobarti@protonmail.com"];
const ADMIN_PHONES = ["+966504466528"];

function isRootAdmin(email?: string | null, phone?: string | null): boolean {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
    return true;
  }
  if (phone) {
    const normalized = phone.replace(/[\s\-()]/g, "");
    if (ADMIN_PHONES.includes(normalized)) {
      return true;
    }
    if (ADMIN_PHONES.some(p => p.replace("+", "") === normalized.replace("+", ""))) {
      return true;
    }
  }
  return false;
}

describe("Admin Auto-Detection", () => {
  describe("Email-based detection", () => {
    it("should detect admin by exact email match", () => {
      expect(isRootAdmin("hobarti@protonmail.com")).toBe(true);
    });

    it("should detect admin by email case-insensitive", () => {
      expect(isRootAdmin("HOBARTI@PROTONMAIL.COM")).toBe(true);
      expect(isRootAdmin("Hobarti@Protonmail.Com")).toBe(true);
    });

    it("should detect admin by email with whitespace", () => {
      expect(isRootAdmin("  hobarti@protonmail.com  ")).toBe(true);
    });

    it("should NOT detect non-admin email", () => {
      expect(isRootAdmin("random@gmail.com")).toBe(false);
      expect(isRootAdmin("other@protonmail.com")).toBe(false);
    });

    it("should handle null/undefined email", () => {
      expect(isRootAdmin(null)).toBe(false);
      expect(isRootAdmin(undefined)).toBe(false);
    });

    it("should handle empty email", () => {
      expect(isRootAdmin("")).toBe(false);
    });
  });

  describe("Phone-based detection", () => {
    it("should detect admin by exact phone match", () => {
      expect(isRootAdmin(null, "+966504466528")).toBe(true);
    });

    it("should detect admin by phone without + prefix", () => {
      expect(isRootAdmin(null, "966504466528")).toBe(true);
    });

    it("should detect admin by phone with spaces", () => {
      expect(isRootAdmin(null, "+966 504 466 528")).toBe(true);
    });

    it("should detect admin by phone with dashes", () => {
      expect(isRootAdmin(null, "+966-504-466-528")).toBe(true);
    });

    it("should detect admin by phone with parentheses", () => {
      expect(isRootAdmin(null, "+966(504)466528")).toBe(true);
    });

    it("should NOT detect non-admin phone", () => {
      expect(isRootAdmin(null, "+966500000000")).toBe(false);
      expect(isRootAdmin(null, "+1234567890")).toBe(false);
    });

    it("should handle null/undefined phone", () => {
      expect(isRootAdmin(null, null)).toBe(false);
      expect(isRootAdmin(null, undefined)).toBe(false);
    });
  });

  describe("Combined email + phone detection", () => {
    it("should detect admin when email matches", () => {
      expect(isRootAdmin("hobarti@protonmail.com", "+966500000000")).toBe(true);
    });

    it("should detect admin when phone matches", () => {
      expect(isRootAdmin("random@gmail.com", "+966504466528")).toBe(true);
    });

    it("should detect admin when both match", () => {
      expect(isRootAdmin("hobarti@protonmail.com", "+966504466528")).toBe(true);
    });

    it("should NOT detect when neither matches", () => {
      expect(isRootAdmin("random@gmail.com", "+966500000000")).toBe(false);
    });
  });

  describe("Admin visibility rules", () => {
    it("admin panel should only show when logged in AND is admin", () => {
      const isLoggedIn = true;
      const isAdmin = isLoggedIn && isRootAdmin("hobarti@protonmail.com");
      expect(isAdmin).toBe(true);
    });

    it("admin panel should NOT show when not logged in", () => {
      const isLoggedIn = false;
      const isAdmin = isLoggedIn && isRootAdmin("hobarti@protonmail.com");
      expect(isAdmin).toBe(false);
    });

    it("admin panel should NOT show for non-admin logged in user", () => {
      const isLoggedIn = true;
      const isAdmin = isLoggedIn && isRootAdmin("user@gmail.com", "+966500000000");
      expect(isAdmin).toBe(false);
    });
  });
});
