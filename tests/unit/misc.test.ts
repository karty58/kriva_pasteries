import { describe, it, expect } from "vitest";
import { formatINR, paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { earliestAllowed, fromIstInput, validateRequestedTime } from "@/lib/schedule";
import { checkoutSchema, normaliseIndianMobile, slugify, validateImageUpload } from "@/lib/validation";
import { generateAccessToken, generateOrderReference, ORDER_REF_PATTERN, tokenMatches } from "@/lib/order-ref";
import { describeOrder } from "@/lib/order-status";

describe("money", () => {
  it("parses rupee input into integer paise without floating point error", () => {
    expect(rupeesToPaise("1,299.50")).toBe(129950);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("₹ 899")).toBe(89900);
    expect(() => rupeesToPaise("12.345")).toThrow();
    expect(() => rupeesToPaise("-5")).toThrow();
    expect(paiseToRupeesString(129950)).toBe("1299.50");
    expect(paiseToRupeesString(89900)).toBe("899");
  });
  it("formats INR", () => {
    expect(formatINR(189900)).toBe("₹1,899");
    expect(formatINR(12345600)).toBe("₹1,23,456");
    expect(() => formatINR(1.5)).toThrow();
  });
});

describe("schedule (IST)", () => {
  const now = new Date("2026-10-21T10:00:00+05:30");
  const hours = { mon: { open: "10:00", close: "21:00" }, tue: { open: "10:00", close: "21:00" }, wed: { open: "10:00", close: "21:00" },
    thu: { open: "10:00", close: "21:00" }, fri: { open: "10:00", close: "21:00" }, sat: { open: "10:00", close: "21:00" }, sun: null };
  const s = { order_cutoff_time: null, max_advance_days: 30, business_hours: hours };

  it("interprets inputs in India time", () => {
    expect(fromIstInput("2026-10-22", "16:30")!.toISOString()).toBe("2026-10-22T11:00:00.000Z");
    expect(fromIstInput("bad", "16:30")).toBeNull();
  });
  it("enforces lead time, opening hours, closed days and booking window", () => {
    expect(validateRequestedTime(fromIstInput("2026-10-21", "15:00")!, now, 24, s)).toMatchObject({ ok: false, code: "TOO_SOON" });
    expect(validateRequestedTime(fromIstInput("2026-10-22", "15:00")!, now, 24, s)).toEqual({ ok: true });
    expect(validateRequestedTime(fromIstInput("2026-10-25", "15:00")!, now, 24, s)).toMatchObject({ ok: false, code: "CLOSED_DAY" });
    expect(validateRequestedTime(fromIstInput("2026-10-22", "22:30")!, now, 24, s)).toMatchObject({ ok: false, code: "OUTSIDE_HOURS" });
    expect(validateRequestedTime(fromIstInput("2026-12-30", "15:00")!, now, 24, s)).toMatchObject({ ok: false, code: "TOO_FAR" });
  });
  it("applies the daily cutoff", () => {
    const late = new Date("2026-10-21T20:00:00+05:30");
    const e = earliestAllowed(late, 12, "18:00");
    expect(e.toISOString()).toBe(new Date("2026-10-22T12:00:00+05:30").toISOString());
  });
});

describe("validation", () => {
  const base = {
    idempotencyKey: "6f1d2c1e-1111-4222-8333-944445555666",
    customer: { name: "Priya", phone: "+91 98765-43210", email: "" },
    fulfilment: "pickup", date: "2026-10-22", time: "15:00", paymentMethod: "online", expectedTotalPaise: 18900,
    items: [{ productId: "6f1d2c1e-1111-4222-8333-944445555666", variantId: "6f1d2c1e-1111-4222-8333-944445555667", flavourId: null, quantity: 1 }],
  };
  it("accepts valid checkout input and normalises the phone", () => {
    const r = checkoutSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data!.customer.phone).toBe("9876543210");
    expect(normaliseIndianMobile("09876543210")).toBe("9876543210");
  });
  it("rejects invalid customer information", () => {
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, phone: "12345" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, name: "A" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, email: "not-an-email" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery", deliveryAddress: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, website: "spam" }).success).toBe(false); // honeypot
    expect(checkoutSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: -1 }] }).success).toBe(false);
  });
  it("slugifies names", () => {
    expect(slugify("Rose & Pistachio Cake!")).toBe("rose-pistachio-cake");
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });
  it("validates image uploads by type, size and file signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const html = new TextEncoder().encode("<html><script>");
    expect(validateImageUpload({ type: "image/png", size: 1000 }, png)).toEqual({ ok: true, ext: "png" });
    expect(validateImageUpload({ type: "image/jpeg", size: 1000 }, jpg)).toEqual({ ok: true, ext: "jpg" });
    expect(validateImageUpload({ type: "image/png", size: 1000 }, html).ok).toBe(false);
    expect(validateImageUpload({ type: "image/jpeg", size: 1000 }, png).ok).toBe(false);
    expect(validateImageUpload({ type: "image/svg+xml", size: 1000 }, html).ok).toBe(false);
    expect(validateImageUpload({ type: "image/png", size: 6 * 1024 * 1024 }, png).ok).toBe(false);
  });
});

describe("order references and access tokens", () => {
  it("generates unique, well-formed references", () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateOrderReference(new Date("2026-10-21T20:00:00Z"))));
    expect(refs.size).toBe(500);
    for (const r of refs) expect(r).toMatch(ORDER_REF_PATTERN);
    expect([...refs][0].startsWith("KRV-261022-")).toBe(true); // IST date
  });
  it("only accepts the matching secret token", () => {
    const { token, hash } = generateAccessToken();
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(token + "x", hash)).toBe(false);
    expect(tokenMatches(null, hash)).toBe(false);
  });
});

describe("customer-facing status wording", () => {
  const o = { status: "pending", payment_status: "pending", payment_method: "offline", requires_approval: false, rejection_reason: null, fulfilment_method: "pickup" } as const;
  it("never claims confirmation for a submitted request", () => {
    expect(describeOrder(o).title).toBe("Order request received");
    expect(describeOrder({ ...o, payment_method: "online", payment_status: "paid" }).title).toBe("Payment successful");
    expect(describeOrder({ ...o, payment_method: "online", payment_status: "paid" }).detail).toMatch(/will confirm/);
  });
  it("distinguishes failed, cancelled and confirmed states", () => {
    expect(describeOrder({ ...o, payment_method: "online", payment_status: "failed" }).title).toMatch(/didn’t go through/);
    expect(describeOrder({ ...o, status: "cancelled", rejection_reason: "Fully booked." }).detail).toContain("Fully booked.");
    expect(describeOrder({ ...o, status: "confirmed", payment_method: "online", payment_status: "pending" }).title).toBe("Confirmed — payment pending");
  });
});
