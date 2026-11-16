import { describe, it, expect } from "vitest";
import { omitManagerSecrets } from "./db";

describe("omitManagerSecrets", () => {
  it("removes the self-service edit token and its expiry", () => {
    const m = { id: 1, name: "A", phone: "0500000000", editToken: "t", editTokenExpiresAt: new Date() };
    const out = omitManagerSecrets(m) as Record<string, unknown>;
    expect(out).toEqual({ id: 1, name: "A", phone: "0500000000" });
    expect("editToken" in out).toBe(false);
    expect("editTokenExpiresAt" in out).toBe(false);
  });
  it("passes null through", () => {
    expect(omitManagerSecrets(null)).toBeNull();
  });
});
