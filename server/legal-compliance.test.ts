import { describe, it, expect } from "vitest";

describe("Legal Compliance - Saudi Regulations", () => {
  describe("CMS Legal Settings Keys", () => {
    const requiredLegalKeys = [
      "legal.tourismLicence",
      "legal.crNumber",
      "legal.vatNumber",
      "legal.ejarLicence",
      "terms.contentAr",
      "terms.contentEn",
      "privacy.contentAr",
      "privacy.contentEn",
    ];

    it("should have all required legal setting keys defined in seed defaults", async () => {
      // Read the routers file to check seed defaults include legal keys
      const fs = await import("fs");
      const routersContent = fs.readFileSync("./server/routers/cms.router.ts", "utf-8");
      
      for (const key of requiredLegalKeys) {
        expect(routersContent).toContain(`"${key}"`);
      }
    });
  });

  describe("Footer Component - Licence Display", () => {
    it("should reference all licence keys in Footer component", async () => {
      const fs = await import("fs");
      const footerContent = fs.readFileSync("./client/src/components/Footer.tsx", "utf-8");
      
      expect(footerContent).toContain("legal.tourismLicence");
      expect(footerContent).toContain("legal.crNumber");
      expect(footerContent).toContain("legal.vatNumber");
      expect(footerContent).toContain("legal.ejarLicence");
    });

    it("should not contain hardcoded placeholder email or phone", async () => {
      const fs = await import("fs");
      const footerContent = fs.readFileSync("./client/src/components/Footer.tsx", "utf-8");
      
      expect(footerContent).not.toContain("info@monthlykey.sa");
      expect(footerContent).not.toContain("+966500000000");
    });

    it("should have links to privacy and terms pages", async () => {
      const fs = await import("fs");
      const footerContent = fs.readFileSync("./client/src/components/Footer.tsx", "utf-8");
      
      expect(footerContent).toContain('href="/privacy"');
      expect(footerContent).toContain('href="/terms"');
    });
  });

  describe("Routes - Privacy and Terms Pages", () => {
    it("should have privacy and terms routes registered in App.tsx", async () => {
      const fs = await import("fs");
      const appContent = fs.readFileSync("./client/src/App.tsx", "utf-8");
      
      expect(appContent).toContain('path="/privacy"');
      expect(appContent).toContain('path="/terms"');
      expect(appContent).toContain("PrivacyPolicy");
      expect(appContent).toContain("TermsOfService");
    });
  });

  describe("Privacy Policy Content - PDPL Compliance", () => {
    it("should reference PDPL and SDAIA in privacy policy", async () => {
      const fs = await import("fs");
      const privacyContent = fs.readFileSync("./client/src/pages/PrivacyPolicy.tsx", "utf-8");
      
      // Arabic PDPL references
      expect(privacyContent).toContain("نظام حماية البيانات الشخصية");
      expect(privacyContent).toContain("سدايا");
      
      // English PDPL references
      expect(privacyContent).toContain("PDPL");
      expect(privacyContent).toContain("SDAIA");
    });

    it("should include data subject rights section", async () => {
      const fs = await import("fs");
      const privacyContent = fs.readFileSync("./client/src/pages/PrivacyPolicy.tsx", "utf-8");
      
      // Key rights in Arabic
      expect(privacyContent).toContain("حق العلم");
      expect(privacyContent).toContain("حق الوصول");
      expect(privacyContent).toContain("حق التصحيح");
      expect(privacyContent).toContain("حق المحو");
      
      // Key rights in English
      expect(privacyContent).toContain("Right to Know");
      expect(privacyContent).toContain("Right of Access");
      expect(privacyContent).toContain("Right to Rectification");
      expect(privacyContent).toContain("Right to Erasure");
    });

    it("should include cross-border data transfer section", async () => {
      const fs = await import("fs");
      const privacyContent = fs.readFileSync("./client/src/pages/PrivacyPolicy.tsx", "utf-8");
      
      expect(privacyContent).toContain("نقل البيانات خارج المملكة");
      expect(privacyContent).toContain("Cross-Border Data Transfer");
    });

    it("should include data breach notification section", async () => {
      const fs = await import("fs");
      const privacyContent = fs.readFileSync("./client/src/pages/PrivacyPolicy.tsx", "utf-8");
      
      expect(privacyContent).toContain("إشعار خرق البيانات");
      expect(privacyContent).toContain("Data Breach Notification");
    });
  });

  describe("Terms of Service Content - Saudi Compliance", () => {
    it("should reference Ejar system", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("إيجار");
      expect(termsContent).toContain("Ejar");
    });

    it("should reference VAT at 15%", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("15%");
      expect(termsContent).toContain("ZATCA");
    });

    it("should reference Ministry of Tourism", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("وزارة السياحة");
      expect(termsContent).toContain("Ministry of Tourism");
    });

    it("should specify rental duration as 1-2 months", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("شهرين");
      expect(termsContent).toContain("two months");
    });

    it("should reference Saudi governing law", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("المملكة العربية السعودية");
      expect(termsContent).toContain("Kingdom of Saudi Arabia");
    });

    it("should reference E-Commerce Law", async () => {
      const fs = await import("fs");
      const termsContent = fs.readFileSync("./client/src/pages/TermsOfService.tsx", "utf-8");
      
      expect(termsContent).toContain("نظام التجارة الإلكترونية");
      expect(termsContent).toContain("E-Commerce Law");
    });
  });

  describe("AdminSettings - Legal Fields", () => {
    it("should have licence fields in AdminSettings CMS", async () => {
      const fs = await import("fs");
      const adminContent = fs.readFileSync("./client/src/pages/AdminSettings.tsx", "utf-8");
      
      expect(adminContent).toContain("legal.tourismLicence");
      expect(adminContent).toContain("legal.crNumber");
      expect(adminContent).toContain("legal.vatNumber");
      expect(adminContent).toContain("legal.ejarLicence");
    });

    it("should have Arabic labels for licence fields", async () => {
      const fs = await import("fs");
      const adminContent = fs.readFileSync("./client/src/pages/AdminSettings.tsx", "utf-8");
      
      expect(adminContent).toContain("رقم ترخيص وزارة السياحة");
      expect(adminContent).toContain("رقم السجل التجاري");
      expect(adminContent).toContain("الرقم الضريبي");
      expect(adminContent).toContain("رقم ترخيص إيجار");
    });
  });
});
