import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { FakeDb } from "./fake-supabase";
import { FIXTURE_PRODUCTS as DEMO_PRODUCTS } from "../fixtures/sample-catalogue";
import { istParts } from "@/lib/schedule";

// --- Environment (TEST values only; never live credentials) -------------
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.RAZORPAY_KEY_ID = "rzp_test_FAKEKEY";
  process.env.RAZORPAY_KEY_SECRET = "fake_key_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "fake_webhook_secret";
  process.env.PAYMENTS_MODE = "test";
});

let db: FakeDb;
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => db,
  isServiceConfigured: () => true,
}));

// --- Fake Razorpay API ----------------------------------------------------
type RzPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; amount_refunded?: number; error_description?: string };
let rz: { orders: Map<string, { id: string; amount: number; currency: string }>; payments: Map<string, RzPayment> };
const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const url = String(input).replace("https://api.razorpay.com/v1", "");
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  if (url === "/orders" && init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    const o = { id: `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`, amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" };
    rz.orders.set(o.id, o);
    return json(o);
  }
  let m = url.match(/^\/payments\/(pay_\w+)$/);
  if (m) return rz.payments.has(m[1]) ? json(rz.payments.get(m[1])) : json({ error: { description: "not found" } }, 404);
  m = url.match(/^\/orders\/(order_\w+)\/payments$/);
  if (m) return json({ items: [...rz.payments.values()].filter((p) => p.order_id === m![1]) });
  m = url.match(/^\/payments\/(pay_\w+)\/refund$/);
  if (m) return json({ id: "rfnd_1", status: "processed", amount: rz.payments.get(m[1])!.amount });
  return json({ error: { description: `unhandled ${url}` } }, 500);
});
vi.stubGlobal("fetch", fetchMock);

const { POST: checkout } = await import("@/app/api/checkout/route");
const { POST: startPay } = await import("@/app/api/payments/start/route");
const { POST: verifyPay } = await import("@/app/api/payments/verify/route");
const { POST: reconcile } = await import("@/app/api/payments/reconcile/route");
const { POST: webhook } = await import("@/app/api/payments/razorpay/webhook/route");
const { refundOrder } = await import("@/lib/payments/service");

const opera = DEMO_PRODUCTS.find((p) => p.slug === "sample-classic-opera-pastry")!; // Single ₹189
const choc = DEMO_PRODUCTS.find((p) => p.slug === "sample-dark-chocolate-truffle-cake")!;
const tart = DEMO_PRODUCTS.find((p) => p.slug === "sample-lemon-tart")!; // sold out
const custom = DEMO_PRODUCTS.find((p) => p.slug === "sample-custom-designer-cake")!; // requires approval

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function checkoutBody(over: Record<string, unknown> = {}) {
  const day = istParts(new Date(Date.now() + 4 * 86400000)).date;
  return {
    idempotencyKey: randomUUID(),
    customer: { name: "Test Customer", phone: "98765 43210", email: "" },
    fulfilment: "pickup",
    date: day,
    time: "15:00",
    paymentMethod: "online",
    expectedTotalPaise: 18900 * 2,
    items: [{ productId: opera.id, variantId: opera.variants[0].id, flavourId: null, quantity: 2 }],
    ...over,
  };
}

async function placeOnlineOrder() {
  const res = await checkout(req(checkoutBody()));
  expect(res.status).toBe(201);
  return (await res.json()) as { reference: string; token: string };
}

async function startPayment(o: { reference: string; token: string }) {
  const res = await startPay(req({ reference: o.reference, token: o.token }));
  expect(res.status).toBe(200);
  return (await res.json()) as { providerOrderId: string; amountPaise: number; keyId: string };
}

const orderRow = (reference: string) => db.tables.orders.find((o) => o.reference === reference)!;
const sig = (s: string, k: string) => createHmac("sha256", k).update(s).digest("hex");

function webhookReq(event: string, paymentId: string, eventId = `evt_${randomUUID()}`, secret = "fake_webhook_secret") {
  const raw = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId } } } });
  return new Request("http://localhost/api/payments/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": sig(raw, secret), "x-razorpay-event-id": eventId },
    body: raw,
  });
}

beforeEach(() => {
  db = new FakeDb();
  rz = { orders: new Map(), payments: new Map() };
  fetchMock.mockClear();
});

// =========================================================================
describe("website checkout", () => {
  it("creates an order using trusted server prices and returns a reference", async () => {
    const o = await placeOnlineOrder();
    expect(o.reference).toMatch(/^KRV-\d{6}-[A-Z0-9]{6}$/);
    const row = orderRow(o.reference);
    expect(row.total_paise).toBe(37800);
    expect(row.status).toBe("pending");
    expect(row.payment_status).toBe("pending");
    expect(row.customer_phone).toBe("9876543210");
    expect(row.access_token_hash).not.toBe(o.token); // only the hash is stored
    const items = db.tables.order_items.filter((i) => i.order_id === row.id);
    expect(items[0]).toMatchObject({ product_name: opera.name, variant_label: "Single", unit_price_paise: 18900, quantity: 2 });
  });

  it("rejects altered browser totals without creating an order", async () => {
    const res = await checkout(req(checkoutBody({ expectedTotalPaise: 100 })));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "PRICE_CHANGED", totalPaise: 37800 });
    expect(db.tables.orders).toHaveLength(0);
  });

  it("ignores injected price fields", async () => {
    const body = checkoutBody();
    (body.items as Record<string, unknown>[])[0].unitPricePaise = 1;
    const res = await checkout(req(body));
    expect(res.status).toBe(201);
    expect(db.tables.orders[0].total_paise).toBe(37800);
  });

  it("rejects unavailable products and incompatible options", async () => {
    const sold = await checkout(req(checkoutBody({ items: [{ productId: tart.id, variantId: tart.variants[0].id, flavourId: null, quantity: 1 }], expectedTotalPaise: 16900 })));
    expect(sold.status).toBe(400);
    expect((await sold.json()).error.code).toBe("PRODUCT_UNAVAILABLE");
    const wrong = await checkout(req(checkoutBody({ items: [{ productId: opera.id, variantId: choc.variants[0].id, flavourId: null, quantity: 1 }] })));
    expect(wrong.status).toBe(400);
    expect(db.tables.orders).toHaveLength(0);
  });

  it("rejects invalid customer information", async () => {
    for (const customer of [{ name: "A", phone: "9876543210" }, { name: "Test", phone: "12345" }, { name: "Test", phone: "9876543210", email: "nope" }]) {
      const res = await checkout(req(checkoutBody({ customer })));
      expect(res.status).toBe(400);
    }
    const noAddress = await checkout(req(checkoutBody({ fulfilment: "delivery" })));
    expect(noAddress.status).toBe(400);
    const pastDate = await checkout(req(checkoutBody({ date: "2020-01-01" })));
    expect(pastDate.status).toBe(400);
    expect((await pastDate.json()).error.code).toBe("TOO_SOON");
    expect(db.tables.orders).toHaveLength(0);
  });

  it("handles duplicate submissions safely (same idempotency key)", async () => {
    const body = checkoutBody();
    const [a, b] = await Promise.all([checkout(req(body)), checkout(req(body))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 201]);
    const ja = await a.json(); const jb = await b.json();
    expect(ja.reference).toBe(jb.reference);
    expect(db.tables.orders).toHaveLength(1);
  });

  it("rejects cross-origin requests and rate-limits abuse", async () => {
    const res = await checkout(req(checkoutBody(), { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await checkout(req(checkoutBody(), { "x-forwarded-for": "1.2.3.4" }))).status;
    expect(last).toBe(429);
  });

  it("does not let the customer pay before KRIVA approves a custom order", async () => {
    const body = checkoutBody({
      items: [{ productId: custom.id, variantId: custom.variants[0].id, flavourId: null, quantity: 1 }],
      expectedTotalPaise: 249900,
    });
    const res = await checkout(req(body));
    const o = await res.json();
    expect(o.requiresApproval).toBe(true);
    const pay = await startPay(req({ reference: o.reference, token: o.token }));
    expect(pay.status).toBe(409);
    orderRow(o.reference).status = "confirmed";
    expect((await startPay(req({ reference: o.reference, token: o.token }))).status).toBe(200);
  });
});

// =========================================================================
describe("Google Pay / UPI payments (Razorpay)", () => {
  it("creates the gateway order server-side for the trusted amount", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    expect(p.amountPaise).toBe(37800);
    expect(p.keyId).toBe("rzp_test_FAKEKEY");
    expect(JSON.stringify(p)).not.toContain("fake_key_secret");
    expect(rz.orders.get(p.providerOrderId)!.amount).toBe(37800);
    // Re-opening the payment window reuses the same gateway order
    const again = await startPayment(o);
    expect(again.providerOrderId).toBe(p.providerOrderId);
  });

  it("rejects a payment start with the wrong access token", async () => {
    const o = await placeOnlineOrder();
    const res = await startPay(req({ reference: o.reference, token: "wrong-token-1234567890" }));
    expect(res.status).toBe(404);
  });

  it("successful test payment: verified signature + provider record => paid", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_OK1", { id: "pay_OK1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured", method: "upi" });
    const res = await verifyPay(req({ reference: o.reference, token: o.token, razorpay_order_id: p.providerOrderId, razorpay_payment_id: "pay_OK1",
      razorpay_signature: sig(`${p.providerOrderId}|pay_OK1`, "fake_key_secret") }));
    expect(res.status).toBe(200);
    expect(orderRow(o.reference).payment_status).toBe("paid");
    expect(orderRow(o.reference).status).toBe("pending"); // fulfilment is separate from payment
    const tx = db.tables.payment_transactions[0];
    expect(tx).toMatchObject({ status: "captured", provider_payment_id: "pay_OK1", method: "upi" });
  });

  it("invalid checkout signature is rejected and nothing is marked paid", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_OK1", { id: "pay_OK1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    const res = await verifyPay(req({ reference: o.reference, token: o.token, razorpay_order_id: p.providerOrderId, razorpay_payment_id: "pay_OK1",
      razorpay_signature: sig(`${p.providerOrderId}|pay_OK1`, "attacker_guess") }));
    expect(res.status).toBe(400);
    expect(orderRow(o.reference).payment_status).toBe("pending");
  });

  it("a client callback claiming success is not trusted if Razorpay says otherwise", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_F1", { id: "pay_F1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "failed", error_description: "Payment declined" });
    await verifyPay(req({ reference: o.reference, token: o.token, razorpay_order_id: p.providerOrderId, razorpay_payment_id: "pay_F1",
      razorpay_signature: sig(`${p.providerOrderId}|pay_F1`, "fake_key_secret") }));
    expect(orderRow(o.reference).payment_status).toBe("failed");
  });

  it("customer redirect / status check without a verified payment leaves the order unpaid", async () => {
    const o = await placeOnlineOrder();
    await startPayment(o);
    const res = await reconcile(req({ reference: o.reference, token: o.token }));
    expect(res.status).toBe(200);
    expect(orderRow(o.reference).payment_status).toBe("pending");
  });

  it("failed then cancelled attempts keep the order unpaid and allow retry", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_F1", { id: "pay_F1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "failed", error_description: "Cancelled by user" });
    await webhook(webhookReq("payment.failed", "pay_F1"));
    expect(orderRow(o.reference).payment_status).toBe("failed");
    const retry = await startPay(req({ reference: o.reference, token: o.token }));
    expect(retry.status).toBe(200);
  });

  it("webhook with an invalid signature is rejected", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_OK1", { id: "pay_OK1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    const res = await webhook(webhookReq("payment.captured", "pay_OK1", "evt_x", "wrong_secret"));
    expect(res.status).toBe(401);
    expect(orderRow(o.reference).payment_status).toBe("pending");
  });

  it("verified webhook marks paid; duplicate deliveries are processed once", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_OK1", { id: "pay_OK1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    const first = await webhook(webhookReq("payment.captured", "pay_OK1", "evt_dup"));
    expect((await first.json()).result).toBe("mark_paid");
    const fetchesAfterFirst = fetchMock.mock.calls.length;
    const second = await webhook(webhookReq("payment.captured", "pay_OK1", "evt_dup"));
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(fetchMock.mock.calls.length).toBe(fetchesAfterFirst); // not reprocessed
    // Same payment, different event (order.paid) is a harmless no-op
    const third = await webhook(webhookReq("order.paid", "pay_OK1"));
    expect((await third.json()).result).toBe("noop");
    expect(orderRow(o.reference).payment_status).toBe("paid");
  });

  it("delayed payment notification settles an order after an earlier failure", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_F1", { id: "pay_F1", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "failed" });
    await webhook(webhookReq("payment.failed", "pay_F1"));
    rz.payments.set("pay_LATE", { id: "pay_LATE", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    await reconcile(req({ reference: o.reference, token: o.token })); // customer taps "Check payment status"
    expect(orderRow(o.reference).payment_status).toBe("paid");
    // a stale "failed" webhook arriving afterwards does not regress it
    await webhook(webhookReq("payment.failed", "pay_F1"));
    expect(orderRow(o.reference).payment_status).toBe("paid");
  });

  it("incorrect amount or unknown order reference is rejected", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_LOW", { id: "pay_LOW", order_id: p.providerOrderId, amount: 100, currency: "INR", status: "captured" });
    expect((await (await webhook(webhookReq("payment.captured", "pay_LOW"))).json()).result).toBe("reject");
    rz.payments.set("pay_OTHER", { id: "pay_OTHER", order_id: "order_someoneelse", amount: 37800, currency: "INR", status: "captured" });
    expect((await (await webhook(webhookReq("payment.captured", "pay_OTHER"))).json()).result).toBe("reject");
    expect(orderRow(o.reference).payment_status).toBe("pending");
  });

  it("a second successful payment is flagged for refund, not double-counted", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_A", { id: "pay_A", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    rz.payments.set("pay_B", { id: "pay_B", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    await webhook(webhookReq("payment.captured", "pay_A"));
    const r = await webhook(webhookReq("payment.captured", "pay_B"));
    expect((await r.json()).result).toBe("record_duplicate");
    expect(db.tables.payment_transactions[0].duplicate_payment_ids).toEqual(["pay_B"]);
    expect(orderRow(o.reference).payment_status).toBe("paid");
  });

  it("refunds: owner request then provider confirmation marks the order refunded", async () => {
    const o = await placeOnlineOrder();
    const p = await startPayment(o);
    rz.payments.set("pay_A", { id: "pay_A", order_id: p.providerOrderId, amount: 37800, currency: "INR", status: "captured" });
    await webhook(webhookReq("payment.captured", "pay_A"));
    await refundOrder(orderRow(o.reference).id as string);
    expect(db.tables.payment_transactions[0].status).toBe("refund_pending");
    expect(orderRow(o.reference).payment_status).toBe("paid"); // not refunded until confirmed
    rz.payments.set("pay_A", { ...rz.payments.get("pay_A")!, status: "refunded", amount_refunded: 37800 });
    const raw = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { payment_id: "pay_A" } } } });
    await webhook(new Request("http://localhost/w", { method: "POST", headers: { "x-razorpay-signature": sig(raw, "fake_webhook_secret"), "x-razorpay-event-id": "evt_rf" }, body: raw }));
    expect(orderRow(o.reference).payment_status).toBe("refunded");
  });
});
