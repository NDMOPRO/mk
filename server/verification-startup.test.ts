import { describe, it, expect } from "vitest";
import fs from "fs";

// Regression guard: startup code must never mark users as verified.
// A restart used to set emailVerified/phoneVerified for every user with the
// legacy isVerified flag, bypassing the payment verification gate.
describe("startup does not change user verification", () => {
  it("server/db/connection.ts has no UPDATE that sets verification flags", () => {
    const src = fs.readFileSync("server/db/connection.ts", "utf-8");
    expect(src).not.toMatch(/UPDATE\s+`?users`?\s+SET[^`;]*(emailVerified|phoneVerified)\s*=\s*(true|1)/i);
  });
});
