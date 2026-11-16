import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Booking 10: tenant 5, landlord 6. Outsider is user 7.
const booking = { id: 10, tenantId: 5, landlordId: 6, totalAmount: "5000", priceBreakdown: { grandTotal: 5750 } };

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getBookingById: vi.fn(async (id: number) => (id === 10 ? booking : undefined)),
    getPaymentsByBooking: vi.fn(async () => [{ id: 1, bookingId: 10, paypalOrderId: "ORDER-OK" }]),
    updateBookingPayment: vi.fn(async () => undefined),
  };
});

vi.mock("./lease-contract", () => ({
  generateLeaseContractHTML: vi.fn(async () => ({ html: "<html/>", data: { contractNumber: "C-1" } })),
}));

vi.mock("./paypal", () => ({
  getPayPalSettings: vi.fn(async () => ({ enabled: true, cashEnabled: false, mode: "sandbox", currency: "SAR", clientId: "x", secret: "y" })),
  createPayPalOrder: vi.fn(async (p: { amount: number }) => ({ orderId: "ORDER-OK", approvalUrl: "https://paypal/approve", amount: p.amount })),
  capturePayPalOrder: vi.fn(async () => ({ status: "COMPLETED", amount: "1.00", captureId: "C", payerEmail: "", payerId: "" })),
}));

const { appRouter } = await import("./routers");
const paypal = await import("./paypal");

function ctxFor(id: number, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: { id, openId: `u${id}`, email: `u${id}@t.com`, name: `U${id}`, loginMethod: "local", role,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as any,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("lease.generate access", () => {
  it("rejects a user who is not party to the booking", async () => {
    await expect(appRouter.createCaller(ctxFor(7)).lease.generate({ bookingId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows tenant, landlord and admin", async () => {
    for (const ctx of [ctxFor(5), ctxFor(6), ctxFor(99, "admin")]) {
      const r = await appRouter.createCaller(ctx).lease.generate({ bookingId: 10 });
      expect(r.contractNumber).toBe("C-1");
    }
  });
});

describe("payment.byBooking access", () => {
  it("rejects outsiders and allows participants", async () => {
    await expect(appRouter.createCaller(ctxFor(7)).payment.byBooking({ bookingId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctxFor(5)).payment.byBooking({ bookingId: 10 })).resolves.toHaveLength(1);
  });
});

describe("PayPal order integrity", () => {
  it("only the tenant can create an order, and the amount comes from the booking", async () => {
    const input = { bookingId: 10, amount: 1, description: "rent", origin: "https://evil.example" };
    await expect(appRouter.createCaller(ctxFor(7)).payment.createPayPalOrder(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await appRouter.createCaller(ctxFor(5)).payment.createPayPalOrder(input);
    const call = vi.mocked(paypal.createPayPalOrder).mock.calls[0][0] as { amount: number };
    expect(call.amount).toBe(5750);
  });
  it("capture rejects outsiders, foreign order IDs and underpayment", async () => {
    await expect(appRouter.createCaller(ctxFor(7)).payment.capturePayPalOrder({ orderId: "ORDER-OK", bookingId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(ctxFor(5)).payment.capturePayPalOrder({ orderId: "OTHER", bookingId: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // mocked capture returns 1.00 SAR against 5750 due
    await expect(appRouter.createCaller(ctxFor(5)).payment.capturePayPalOrder({ orderId: "ORDER-OK", bookingId: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
