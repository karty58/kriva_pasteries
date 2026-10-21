/**
 * WhatsApp click-to-chat ordering.
 * IMPORTANT: opening WhatsApp with a pre-filled message does NOT send it,
 * does NOT create an order in the database and does NOT take payment.
 * These are ENQUIRIES; KRIVA confirms price, availability and payment.
 */
import { formatINR } from "./money";

export interface WhatsAppLine {
  name: string;
  variantLabel: string;
  flavourName?: string | null;
  quantity: number;
  unitPricePaise: number;
  customMessage?: string | null;
  instructions?: string | null;
}

export interface WhatsAppEnquiry {
  enquiryRef: string;
  lines: WhatsAppLine[];
  customerName?: string | null;
  fulfilment?: "pickup" | "delivery" | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  deliveryArea?: string | null;
  notes?: string | null;
}

/** Short, human-friendly reference like "ENQ-7K3P9Q". Not a database order. */
export function makeEnquiryRef(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return `ENQ-${out}`;
}

export function buildWhatsAppMessage(e: WhatsAppEnquiry): string {
  const rows: string[] = [];
  rows.push("Hello KRIVA! I'd like to place an order enquiry.");
  if (e.enquiryRef) rows.push(`Enquiry ref: ${e.enquiryRef}`);
  rows.push("");
  e.lines.forEach((l, i) => {
    const opts = [l.variantLabel, l.flavourName].filter(Boolean).join(", ");
    rows.push(`${i + 1}. ${l.name} (${opts}) x ${l.quantity} = ${formatINR(l.unitPricePaise * l.quantity)}`);
    if (l.customMessage) rows.push(`   Cake message: "${l.customMessage}"`);
    if (l.instructions) rows.push(`   Notes: ${l.instructions}`);
  });
  const subtotal = e.lines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0);
  rows.push("");
  rows.push(`Subtotal (as shown on website): ${formatINR(subtotal)}`);
  if (e.fulfilment) {
    rows.push(`Preferred: ${e.fulfilment === "delivery" ? "Delivery" : "Pickup"}`);
  }
  if (e.requestedDate) rows.push(`Requested date: ${e.requestedDate}${e.requestedTime ? ` at ${e.requestedTime}` : ""}`);
  if (e.deliveryArea) rows.push(`Area: ${e.deliveryArea}`);
  if (e.customerName) rows.push(`Name: ${e.customerName}`);
  if (e.notes) rows.push(`Other notes: ${e.notes}`);
  rows.push("");
  rows.push("Please confirm availability, final price and payment details. Thank you!");
  return rows.join("\n");
}

/** Digits only, with country code, e.g. "919876543210". */
export function isValidWhatsAppNumber(n: string | null | undefined): n is string {
  return !!n && /^[1-9]\d{9,14}$/.test(n);
}

export function buildWhatsAppUrl(number: string, message: string): string {
  if (!isValidWhatsAppNumber(number)) throw new Error("WhatsApp number is not configured");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
