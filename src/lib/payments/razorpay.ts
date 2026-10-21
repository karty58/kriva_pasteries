import "server-only";
import type { ProviderPayment } from "./decide";

/**
 * Minimal Razorpay REST client (no SDK needed). All calls are server-side
 * and use Basic auth with key_id:key_secret, which are NEVER sent to the browser.
 * Docs: https://razorpay.com/docs/api/
 */
const API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: "test" | "live";
}

export class PaymentConfigError extends Error {}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const mode = (process.env.PAYMENTS_MODE ?? "test") as "test" | "live";
  if (!keyId || !keySecret) return null;
  // Safety: refuse mismatched keys (e.g. live keys while PAYMENTS_MODE=test).
  const keyMode = keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : null;
  if (!keyMode) throw new PaymentConfigError("RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_.");
  if (keyMode !== mode) {
    throw new PaymentConfigError(`PAYMENTS_MODE is "${mode}" but RAZORPAY_KEY_ID is a ${keyMode} key.`);
  }
  return { keyId, keySecret, webhookSecret, mode };
}

type FetchLike = typeof fetch;

async function call<T>(cfg: RazorpayConfig, path: string, init: RequestInit = {}, f: FetchLike = fetch): Promise<T> {
  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64");
  const res = await f(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    throw new Error(`Razorpay ${path} failed (${res.status}): ${body?.error?.description ?? "unknown error"}`);
  }
  return body;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export async function createRazorpayOrder(
  cfg: RazorpayConfig,
  input: { amountPaise: number; receipt: string; notes: Record<string, string> },
  f?: FetchLike,
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    throw new Error("Amount must be integer paise and at least ₹1");
  }
  return call<RazorpayOrder>(
    cfg,
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
    },
    f,
  );
}

export async function fetchRazorpayPayment(cfg: RazorpayConfig, paymentId: string, f?: FetchLike) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Invalid payment id");
  return call<ProviderPayment>(cfg, `/payments/${paymentId}`, {}, f);
}

export async function fetchRazorpayOrderPayments(cfg: RazorpayConfig, orderId: string, f?: FetchLike) {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) throw new Error("Invalid order id");
  const r = await call<{ items: ProviderPayment[] }>(cfg, `/orders/${orderId}/payments`, {}, f);
  return r.items ?? [];
}

export async function createRazorpayRefund(cfg: RazorpayConfig, paymentId: string, amountPaise: number, f?: FetchLike) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Invalid payment id");
  return call<{ id: string; status: string; amount: number }>(
    cfg,
    `/payments/${paymentId}/refund`,
    { method: "POST", body: JSON.stringify({ amount: amountPaise, speed: "normal" }) },
    f,
  );
}
