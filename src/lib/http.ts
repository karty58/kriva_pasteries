import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CheckoutError } from "./orders";
import { PaymentConfigError } from "./payments/razorpay";

/** Hashed client identifier for rate limiting (we don't store raw IPs). */
export function clientKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** Basic CSRF defence for JSON endpoints: same-origin requests only. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; other checks still apply
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof CheckoutError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status });
  }
  if (e instanceof PaymentConfigError) {
    console.error(e.message);
    return NextResponse.json({ error: { code: "PAYMENTS_MISCONFIGURED", message: "Online payment is not available right now." } }, { status: 503 });
  }
  console.error(e);
  return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new CheckoutError("TOO_LARGE", "Request too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new CheckoutError("BAD_JSON", "Invalid request.", 400);
  }
}
