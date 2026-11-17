import { describe, it, expect } from "vitest";
import fs from "fs";
import { isCrossSiteRequest } from "./middleware/csrf-origin";
import { isAllowedOrigin } from "./middleware/security-headers";
import { checkUpload } from "./storage";
import { validatePassword, isLeakedPassword } from "./_core/auth";
import { getClientIP } from "./rate-limiter";

function req(method: string, path: string, headers: Record<string, string>) {
  return { method, path, headers: { host: "monthlykey.com", ...headers } } as any;
}

describe("CSRF origin check", () => {
  it("blocks a POST to the API from another site", () => {
    expect(isCrossSiteRequest(req("POST", "/api/trpc/booking.create", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteRequest(req("POST", "/api/auth/login", { referer: "https://evil.example/page" }))).toBe(true);
    expect(isCrossSiteRequest(req("POST", "/api/auth/login", { origin: "null" }))).toBe(true);
  });
  it("allows same-site, allow-listed and non-browser requests, and webhooks", () => {
    expect(isCrossSiteRequest(req("POST", "/api/trpc/booking.create", { origin: "https://monthlykey.com" }))).toBe(false);
    expect(isCrossSiteRequest(req("POST", "/api/trpc/x", { origin: "https://tg.monthlykey.com", host: "tg.monthlykey.com" }))).toBe(false);
    expect(isCrossSiteRequest(req("POST", "/api/trpc/x", { origin: "https://www.monthlykey.com" }))).toBe(false);
    expect(isCrossSiteRequest(req("POST", "/api/trpc/x", {}))).toBe(false);
    expect(isCrossSiteRequest(req("POST", "/api/webhooks/moyasar", { origin: "https://evil.example" }))).toBe(false);
    expect(isCrossSiteRequest(req("GET", "/api/trpc/x", { origin: "https://evil.example" }))).toBe(false);
  });
});

describe("CORS", () => {
  it("no longer trusts any *.up.railway.app site", () => {
    expect(isAllowedOrigin("https://attacker.up.railway.app")).toBe(false);
    expect(isAllowedOrigin("https://monthlykey.com")).toBe(true);
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });
});

describe("upload checks", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  it("accepts a real image and forces its extension", () => {
    expect(checkUpload("properties/1/abc.html", png, "image/png")).toBe("properties/1/abc.png");
  });
  it("refuses HTML disguised as an image, SVG and unknown types", () => {
    expect(() => checkUpload("x/a.png", Buffer.from("<html><script>alert(1)</script>"), "image/png")).toThrow(/does not match/);
    expect(() => checkUpload("x/a.svg", Buffer.from("<svg onload=alert(1)>"), "image/svg+xml")).toThrow(/not allowed/);
    expect(() => checkUpload("x/a.html", Buffer.from("<html>"), "text/html")).toThrow(/not allowed/);
    expect(() => checkUpload("x/a.txt", Buffer.from("<script>alert(1)</script>"), "text/plain")).toThrow(/does not match/);
  });
});

describe("passwords", () => {
  it("refuses the passwords that were committed to the repository", () => {
    expect(isLeakedPassword("83686571KoKo$")).toBe(true);
    expect(isLeakedPassword("15001500")).toBe(true);
    expect(validatePassword("83686571KoKo$").valid).toBe(false);
  });
  it("hashes with bcrypt (cost 12) everywhere passwords are stored", () => {
    const src = fs.readFileSync("server/_core/auth.ts", "utf-8");
    expect(src).toContain("bcrypt.genSalt(12)");
    expect(src).not.toMatch(/bcrypt\.hash\("[^"]+"/);
  });
});

describe("removed backdoors", () => {
  it("has no public seed-owner route and no hardcoded owner password", () => {
    const src = fs.readFileSync("server/_core/auth.ts", "utf-8");
    expect(src).not.toContain('app.post("/api/auth/seed-owner"');
    expect(fs.existsSync("server/seed-admin.mjs")).toBe(false);
    expect(fs.readFileSync("server/seed-admin.ts", "utf-8")).not.toMatch(/console\.log\([^)]*\$\{(adminPassword|password)\}/);
  });
});

describe("client IP for rate limiting", () => {
  it("prefers X-Real-IP, which Railway's edge sets", () => {
    expect(getClientIP({ headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" } })).toBe("1.2.3.4");
  });
});
