import { describe, it, expect } from "vitest";
import { priceCart, PricingError, type CartRequestLine } from "@/lib/pricing";
import { DEFAULT_SETTINGS, DEMO_PRODUCTS } from "@/lib/demo-data";
import type { Product } from "@/lib/types";

const catalogue = new Map(DEMO_PRODUCTS.map((p) => [p.id, structuredClone(p)]));
const bySlug = (slug: string) => [...catalogue.values()].find((p) => p.slug === slug)!;
const settings = { ...DEFAULT_SETTINGS, delivery_enabled: true, delivery_fee_paise: 5000, free_delivery_above_paise: 300000 };

const choc = bySlug("sample-dark-chocolate-truffle-cake"); // 500 g 99900 / 1 kg 189900; flavours Classic 0, Hazelnut +15000
const opera = bySlug("sample-classic-opera-pastry"); // Single 18900, Box of 4 69900, no flavours

function line(p: Product, variantIdx = 0, qty = 1, flavourIdx: number | null = p.flavours.length ? 0 : null): CartRequestLine {
  return { productId: p.id, variantId: p.variants[variantIdx].id, flavourId: flavourIdx === null ? null : p.flavours[flavourIdx].id, quantity: qty };
}

function expectCode(fn: () => unknown, code: PricingError["code"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PricingError);
    expect((e as PricingError).code).toBe(code);
    return;
  }
  throw new Error(`Expected PricingError ${code}`);
}

describe("priceCart", () => {
  it("computes quantities, size-specific prices, flavour surcharges and subtotal", () => {
    const r = priceCart([line(choc, 1, 2, 1), line(opera, 0, 3)], catalogue, settings, "pickup");
    expect(r.lines[0].unit_price_paise).toBe(189900 + 15000);
    expect(r.lines[0].line_total_paise).toBe(204900 * 2);
    expect(r.lines[1].line_total_paise).toBe(18900 * 3);
    expect(r.subtotalPaise).toBe(204900 * 2 + 18900 * 3);
    expect(r.deliveryFeePaise).toBe(0);
    expect(r.totalPaise).toBe(r.subtotalPaise);
  });

  it("uses each size's own price", () => {
    const small = priceCart([line(choc, 0)], catalogue, settings, "pickup");
    const large = priceCart([line(choc, 1)], catalogue, settings, "pickup");
    expect(small.totalPaise).toBe(99900);
    expect(large.totalPaise).toBe(189900);
  });

  it("adds a delivery charge, waived above the free-delivery threshold", () => {
    expect(priceCart([line(opera)], catalogue, settings, "delivery").deliveryFeePaise).toBe(5000);
    const big = priceCart([line(choc, 1, 2)], catalogue, settings, "delivery");
    expect(big.deliveryFeePaise).toBe(0);
  });

  it("ignores any price sent by the browser", () => {
    const tampered = { ...line(opera), unitPricePaise: 1, price_paise: 1 } as unknown as CartRequestLine;
    expect(priceCart([tampered], catalogue, settings, "pickup").totalPaise).toBe(18900);
  });

  it("rejects sold-out, inactive and unknown products", () => {
    expectCode(() => priceCart([line(bySlug("sample-lemon-tart"))], catalogue, settings, "pickup"), "PRODUCT_UNAVAILABLE");
    const hidden = new Map(catalogue);
    hidden.set(opera.id, { ...opera, is_active: false });
    expectCode(() => priceCart([line(opera)], hidden, settings, "pickup"), "PRODUCT_UNAVAILABLE");
    expectCode(() => priceCart([{ ...line(opera), productId: "00000000-0000-4000-8000-000000000000" }], catalogue, settings, "pickup"), "PRODUCT_UNAVAILABLE");
  });

  it("rejects options from a different product or disabled options", () => {
    expectCode(() => priceCart([{ ...line(opera), variantId: choc.variants[0].id }], catalogue, settings, "pickup"), "INVALID_OPTION");
    expectCode(() => priceCart([{ ...line(opera), flavourId: choc.flavours[0].id }], catalogue, settings, "pickup"), "INVALID_OPTION");
    expectCode(() => priceCart([{ ...line(choc), flavourId: null }], catalogue, settings, "pickup"), "INVALID_OPTION");
    const off = new Map(catalogue);
    off.set(choc.id, { ...choc, variants: choc.variants.map((v, i) => (i === 1 ? { ...v, is_active: false } : v)) });
    expectCode(() => priceCart([line(choc, 1)], off, settings, "pickup"), "INVALID_OPTION");
  });

  it("rejects invalid quantities", () => {
    expectCode(() => priceCart([line(opera, 0, 0)], catalogue, settings, "pickup"), "INVALID_QUANTITY");
    expectCode(() => priceCart([line(opera, 0, 11)], catalogue, settings, "pickup"), "INVALID_QUANTITY");
    expectCode(() => priceCart([line(opera, 0, 1.5)], catalogue, settings, "pickup"), "INVALID_QUANTITY");
  });

  it("enforces tracked stock across multiple lines of the same product", () => {
    const limited = new Map(catalogue);
    limited.set(opera.id, { ...opera, stock_quantity: 3 });
    expect(() => priceCart([line(opera, 0, 2), line(opera, 1, 1)], limited, settings, "pickup")).not.toThrow();
    expectCode(() => priceCart([line(opera, 0, 2), line(opera, 1, 2)], limited, settings, "pickup"), "INSUFFICIENT_STOCK");
  });

  it("validates cake messages", () => {
    expectCode(() => priceCart([{ ...line(opera), customMessage: "Hi" }], catalogue, settings, "pickup"), "MESSAGE_NOT_ALLOWED");
    expectCode(() => priceCart([{ ...line(choc), customMessage: "x".repeat(41) }], catalogue, settings, "pickup"), "MESSAGE_TOO_LONG");
    const ok = priceCart([{ ...line(choc), customMessage: "  Happy   Birthday  " }], catalogue, settings, "pickup");
    expect(ok.lines[0].custom_message).toBe("Happy Birthday");
  });

  it("enforces minimum order, empty carts and disabled fulfilment", () => {
    expectCode(() => priceCart([], catalogue, settings, "pickup"), "EMPTY_CART");
    expectCode(() => priceCart([line(opera)], catalogue, { ...settings, min_order_paise: 50000 }, "pickup"), "BELOW_MINIMUM");
    expectCode(() => priceCart([line(opera)], catalogue, { ...settings, delivery_enabled: false }, "delivery"), "FULFILMENT_UNAVAILABLE");
  });

  it("flags approval and the longest lead time", () => {
    const custom = bySlug("sample-custom-designer-cake");
    const r = priceCart([line(opera), line(custom)], catalogue, settings, "pickup");
    expect(r.requiresApproval).toBe(true);
    expect(r.maxLeadTimeHours).toBe(72);
    expect(priceCart([line(opera)], catalogue, { ...settings, approval_mode: "approve_then_pay" }, "pickup").requiresApproval).toBe(true);
  });
});
