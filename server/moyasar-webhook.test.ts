import { describe, it, expect, vi, beforeEach } from "vitest";

// The webhook must accept Moyasar's real event format ({ type, secret_token,
// data: <payment> }) and must take status and amount from Moyasar's API, not
// from the request body.

const ledger = { id: 7, bookingId: 3, amount: "1150.00", status: "DUE", providerRef: "pay_1" };
const query = vi.fn();
const settings: Record<string, string> = {
  "moyasar.secretKey": "sk_test_x",
  "moyasar.publishableKey": "pk_test_x",
  "moyasar.webhookSecret": "whsec",
  "moyasar.enabled": "true",
};

vi.mock("./db", () => ({
  getAllSettings: async () => settings,
  getPool: () => ({ query }),
}));
const updateLedgerStatusSafe = vi.fn();
vi.mock("./finance-registry", () => ({ updateLedgerStatusSafe, createLedgerEntry: vi.fn() }));
vi.mock("./renewal", () => ({ activateExtension: vi.fn() }));
vi.mock("./availability-blocks.js", () => ({ createBookingBlock: vi.fn() }));

const { handleMoyasarWebhookVerified } = await import("./moyasar");

function mockMoyasarApi(payment: { status: string; amount: number; currency?: string }) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ id: "pay_1", currency: "SAR", source: { type: "creditcard" }, metadata: {}, ...payment }),
  })));
}

function call(body: unknown) {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return handleMoyasarWebhookVerified({ body, headers: {} } as any, res).then(() => res);
}

const event = (extra: object = {}) => ({
  id: "evt_1", type: "payment_paid", secret_token: "whsec", live: false,
  data: { id: "pay_1", status: "paid", amount: 115000 }, ...extra,
});

beforeEach(() => {
  query.mockReset();
  updateLedgerStatusSafe.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM payment_ledger")) return [[ledger]];
    if (sql.includes("FROM bookings")) return [[{ id: 3, status: "approved", paymentStatus: "unpaid" }]];
    return [[]];
  });
});

describe("Moyasar webhook", () => {
  it("marks the invoice PAID for a genuine payment_paid event", async () => {
    mockMoyasarApi({ status: "paid", amount: 115000 });
    const res = await call(event());
    expect(res.statusCode).toBe(200);
    expect(updateLedgerStatusSafe).toHaveBeenCalledWith(7, "PAID", expect.objectContaining({ providerRef: "pay_1", webhookVerified: true }));
  });

  it("rejects an event with the wrong secret token", async () => {
    mockMoyasarApi({ status: "paid", amount: 115000 });
    const res = await call(event({ secret_token: "nope" }));
    expect(res.statusCode).toBe(401);
    expect(updateLedgerStatusSafe).not.toHaveBeenCalled();
  });

  it("uses Moyasar's status, not the body's", async () => {
    mockMoyasarApi({ status: "failed", amount: 115000 });
    await call(event());
    expect(updateLedgerStatusSafe).toHaveBeenCalledWith(7, "FAILED", expect.anything());
  });

  it("refuses PAID when Moyasar's amount differs from the invoice", async () => {
    mockMoyasarApi({ status: "paid", amount: 100 });
    const res = await call(event());
    expect(res.body).toMatchObject({ error: "amount_mismatch" });
    expect(updateLedgerStatusSafe).not.toHaveBeenCalled();
  });

  it("asks Moyasar to retry when the payment cannot be verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const res = await call(event());
    expect(res.statusCode).toBe(502);
  });

  it("answers the webhook_verification handshake", async () => {
    const res = await call({ type: "webhook_verification", data: { verification_code: "123456" } });
    expect(res.statusCode).toBe(200);
  });
});
