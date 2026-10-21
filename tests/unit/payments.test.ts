import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments/signature";
import { canStartPayment, decidePaymentUpdate, type KnownOrder, type ProviderPayment } from "@/lib/payments/decide";
import { createRazorpayOrder, fetchRazorpayPayment, getRazorpayConfig } from "@/lib/payments/razorpay";

// All secrets here are fake TEST values.
const SECRET = "test_secret_not_real";
const sign = (s: string, k = SECRET) => createHmac("sha256", k).update(s).digest("hex");

describe("signature verification", () => {
  it("accepts a correct checkout signature computed from OUR stored order id", () => {
    const signature = sign("order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature({ serverOrderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: SECRET })).toBe(true);
  });
  it("rejects tampered ids, wrong secrets and malformed signatures", () => {
    const signature = sign("order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature({ serverOrderId: "order_OTHER", paymentId: "pay_XYZ", signature, keySecret: SECRET })).toBe(false);
    expect(verifyCheckoutSignature({ serverOrderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: "wrong" })).toBe(false);
    expect(verifyCheckoutSignature({ serverOrderId: "order_ABC", paymentId: "pay_XYZ", signature: "zz", keySecret: SECRET })).toBe(false);
    expect(verifyCheckoutSignature({ serverOrderId: "order_ABC", paymentId: "pay_XYZ", signature: "", keySecret: SECRET })).toBe(false);
  });
  it("verifies webhooks against the raw body", () => {
    const body = '{"event":"payment.captured","payload":{}}';
    expect(verifyWebhookSignature(body, sign(body, "whsec"), "whsec")).toBe(true);
    expect(verifyWebhookSignature(body + " ", sign(body, "whsec"), "whsec")).toBe(false);
    expect(verifyWebhookSignature(body, null, "whsec")).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, "whsec"), "")).toBe(false);
  });
});

const order: KnownOrder = { total_paise: 189900, currency: "INR", status: "pending", payment_status: "pending", payment_method: "online", paid_payment_id: null };
const tx = { provider_order_id: "order_1", amount_paise: 189900 };
const pay = (over: Partial<ProviderPayment> = {}): ProviderPayment => ({ id: "pay_1", order_id: "order_1", amount: 189900, currency: "INR", status: "captured", ...over });

describe("payment decisions", () => {
  it("marks paid only for a captured payment matching order, amount and currency", () => {
    expect(decidePaymentUpdate(order, tx, pay())).toEqual({ kind: "mark_paid" });
  });
  it("rejects an incorrect amount, currency or order reference", () => {
    expect(decidePaymentUpdate(order, tx, pay({ amount: 100 }))).toMatchObject({ kind: "reject", reason: "AMOUNT_MISMATCH" });
    expect(decidePaymentUpdate(order, tx, pay({ currency: "USD" }))).toMatchObject({ kind: "reject", reason: "CURRENCY_MISMATCH" });
    expect(decidePaymentUpdate(order, tx, pay({ order_id: "order_other" }))).toMatchObject({ kind: "reject", reason: "ORDER_MISMATCH" });
    expect(decidePaymentUpdate({ ...order, payment_method: "offline" }, tx, pay())).toMatchObject({ kind: "reject" });
  });
  it("handles failed and cancelled/abandoned payments", () => {
    expect(decidePaymentUpdate(order, tx, pay({ status: "failed", error_description: "Declined" }))).toEqual({ kind: "mark_failed", reason: "Declined" });
    expect(decidePaymentUpdate(order, tx, pay({ status: "created" }))).toMatchObject({ kind: "noop" });
  });
  it("is idempotent for duplicate webhooks / repeated verification", () => {
    const paid = { ...order, payment_status: "paid" as const, paid_payment_id: "pay_1" };
    expect(decidePaymentUpdate(paid, tx, pay())).toMatchObject({ kind: "noop" });
  });
  it("flags a second successful payment on the same order for refund", () => {
    const paid = { ...order, payment_status: "paid" as const, paid_payment_id: "pay_1" };
    expect(decidePaymentUpdate(paid, tx, pay({ id: "pay_2" }))).toMatchObject({ kind: "record_duplicate" });
  });
  it("handles delayed / out-of-order notifications without regressing state", () => {
    const paid = { ...order, payment_status: "paid" as const, paid_payment_id: "pay_1" };
    expect(decidePaymentUpdate(paid, tx, pay({ id: "pay_0", status: "failed" }))).toMatchObject({ kind: "noop" });
    expect(decidePaymentUpdate(paid, tx, pay({ status: "authorized" }))).toMatchObject({ kind: "noop" });
    // A late capture after an earlier failure still settles the order
    expect(decidePaymentUpdate({ ...order, payment_status: "failed" }, tx, pay())).toEqual({ kind: "mark_paid" });
  });
  it("tracks full refunds and ignores partial ones for automatic status", () => {
    const paid = { ...order, payment_status: "paid" as const, paid_payment_id: "pay_1" };
    expect(decidePaymentUpdate(paid, tx, pay({ status: "refunded", amount_refunded: 189900 }))).toEqual({ kind: "mark_refunded" });
    expect(decidePaymentUpdate(paid, tx, pay({ status: "refunded", amount_refunded: 1000 }))).toMatchObject({ kind: "noop" });
  });
  it("only lets customers pay when allowed", () => {
    const base = { payment_method: "online" as const, status: "pending" as const, payment_status: "pending" as const, requires_approval: false };
    expect(canStartPayment(base).ok).toBe(true);
    expect(canStartPayment({ ...base, requires_approval: true }).ok).toBe(false);
    expect(canStartPayment({ ...base, requires_approval: true, status: "confirmed" }).ok).toBe(true);
    expect(canStartPayment({ ...base, payment_status: "paid" }).ok).toBe(false);
    expect(canStartPayment({ ...base, status: "cancelled" }).ok).toBe(false);
    expect(canStartPayment({ ...base, payment_status: "failed" }).ok).toBe(true);
  });
});

describe("Razorpay client", () => {
  it("refuses live keys in test mode and vice versa", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_FAKE");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "fake");
    vi.stubEnv("PAYMENTS_MODE", "test");
    expect(() => getRazorpayConfig()).toThrow(/live key/);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_FAKE");
    expect(getRazorpayConfig()?.mode).toBe("test");
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    expect(getRazorpayConfig()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("creates orders server-side with integer paise and basic auth", async () => {
    const cfg = { keyId: "rzp_test_FAKE", keySecret: "fake", webhookSecret: "", mode: "test" as const };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify({ id: "order_1", amount: JSON.parse(String(init?.body)).amount, currency: "INR", receipt: "r", status: "created" }), { status: 200 }));
    const r = await createRazorpayOrder(cfg, { amountPaise: 189900, receipt: "KRV-261021-ABCDEF", notes: {} }, fetchMock as unknown as typeof fetch);
    expect(r.amount).toBe(189900);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_FAKE:fake").toString("base64")}`);
    expect(JSON.parse(String(init!.body))).toMatchObject({ amount: 189900, currency: "INR" });
    await expect(createRazorpayOrder(cfg, { amountPaise: 1899.5, receipt: "x", notes: {} }, fetchMock as unknown as typeof fetch)).rejects.toThrow();
    await expect(fetchRazorpayPayment(cfg, "../../admin", fetchMock as unknown as typeof fetch)).rejects.toThrow(/Invalid payment id/);
  });
});
