import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidWhatsAppNumber, makeEnquiryRef } from "@/lib/whatsapp";

const enquiry = {
  enquiryRef: "ENQ-ABC234",
  fulfilment: "delivery" as const,
  requestedDate: "2026-10-25",
  requestedTime: "16:00",
  lines: [
    { name: "Dark Chocolate Truffle Cake", variantLabel: "1 kg", flavourName: "Hazelnut", quantity: 2, unitPricePaise: 204900, customMessage: "Happy 30th & cheers! #1" },
    { name: "Opera Pastry", variantLabel: "Box of 4", quantity: 1, unitPricePaise: 69900, instructions: "No nuts?" },
  ],
};

describe("WhatsApp ordering", () => {
  it("includes product names, options, quantities, line totals and subtotal", () => {
    const msg = buildWhatsAppMessage(enquiry);
    expect(msg).toContain("Enquiry ref: ENQ-ABC234");
    expect(msg).toContain("1. Dark Chocolate Truffle Cake (1 kg, Hazelnut) x 2 = ₹4,098");
    expect(msg).toContain('Cake message: "Happy 30th & cheers! #1"');
    expect(msg).toContain("2. Opera Pastry (Box of 4) x 1 = ₹699");
    expect(msg).toContain("Subtotal (as shown on website): ₹4,797");
    expect(msg).toContain("Preferred: Delivery");
    expect(msg).toContain("Requested date: 2026-10-25 at 16:00");
  });

  it("asks KRIVA to confirm instead of claiming the order is placed or paid", () => {
    const msg = buildWhatsAppMessage(enquiry);
    expect(msg).toMatch(/order enquiry/i);
    expect(msg).toMatch(/confirm availability, final price and payment/i);
    expect(msg).not.toMatch(/\bpaid\b|order confirmed/i);
  });

  it("encodes the message safely and uses the configured number", () => {
    const url = buildWhatsAppUrl("919876543210", buildWhatsAppMessage(enquiry));
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe(buildWhatsAppMessage(enquiry)); // round-trips exactly (&, #, quotes, newlines, ₹)
    expect(url.split("?text=")[1]).not.toMatch(/[\n #"&]/); // nothing unescaped can break the URL
  });

  it("refuses to build a link without a valid configured number", () => {
    expect(isValidWhatsAppNumber(null)).toBe(false);
    expect(isValidWhatsAppNumber("+91 98765 43210")).toBe(false);
    expect(isValidWhatsAppNumber("919876543210")).toBe(true);
    expect(() => buildWhatsAppUrl("", "hi")).toThrow();
  });

  it("generates readable enquiry references", () => {
    expect(makeEnquiryRef()).toMatch(/^ENQ-[A-Z2-9]{6}$/);
  });
});
