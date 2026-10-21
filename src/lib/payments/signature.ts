import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

/**
 * Razorpay Checkout signature:
 * HMAC_SHA256(<order id stored on OUR server> + "|" + razorpay_payment_id, key_secret)
 */
export function verifyCheckoutSignature(params: {
  serverOrderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!params.serverOrderId || !params.paymentId || !params.signature || !params.keySecret) return false;
  const expected = createHmac("sha256", params.keySecret)
    .update(`${params.serverOrderId}|${params.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, params.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!signature || !webhookSecret) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(expected, signature);
}
