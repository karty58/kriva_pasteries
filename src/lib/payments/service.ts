import "server-only";
import { createServiceClient } from "../supabase/service";
import { canStartPayment, decidePaymentUpdate, type PaymentDecision, type ProviderPayment } from "./decide";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  getRazorpayConfig,
} from "./razorpay";
import { verifyCheckoutSignature } from "./signature";
import { CheckoutError, getOrderForCustomer, hitRateLimit, loadServerSettings, onlinePaymentsAvailable } from "../orders";

function requireConfig() {
  const cfg = getRazorpayConfig();
  if (!cfg) throw new CheckoutError("PAYMENTS_NOT_CONFIGURED", "Online payment is not available right now.", 503);
  return cfg;
}

/** Create (or reuse) a Razorpay order for a KRIVA order and return Checkout options. */
export async function startOnlinePayment(reference: string, token: string) {
  const order = await getOrderForCustomer(reference, token);
  if (!order) throw new CheckoutError("NOT_FOUND", "Order not found.", 404);
  if (!(await hitRateLimit(`pay:${reference}`, 10, 600))) {
    throw new CheckoutError("RATE_LIMITED", "Too many payment attempts. Please wait a few minutes.", 429);
  }
  const settings = await loadServerSettings();
  if (!onlinePaymentsAvailable(settings)) {
    throw new CheckoutError("PAYMENTS_NOT_CONFIGURED", "Online payment is not available right now.", 503);
  }
  const allowed = canStartPayment(order);
  if (!allowed.ok) throw new CheckoutError("PAYMENT_NOT_ALLOWED", allowed.reason, 409);

  const cfg = requireConfig();
  const db = createServiceClient();

  // Reuse an open Razorpay order for the same amount (avoids duplicate provider orders).
  const { data: open } = await db
    .from("payment_transactions")
    .select("provider_order_id, amount_paise")
    .eq("order_id", order.id)
    .in("status", ["created", "failed"])
    .eq("amount_paise", order.total_paise)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let providerOrderId = open?.provider_order_id as string | undefined;
  if (!providerOrderId) {
    const rz = await createRazorpayOrder(cfg, {
      amountPaise: order.total_paise,
      receipt: order.reference,
      notes: { order_reference: order.reference, order_id: order.id },
    });
    if (rz.amount !== order.total_paise || rz.currency !== "INR") {
      throw new CheckoutError("PAYMENT_SETUP_FAILED", "Could not start payment. Please try again.", 502);
    }
    const { error } = await db.from("payment_transactions").insert({
      order_id: order.id,
      provider_order_id: rz.id,
      amount_paise: rz.amount,
      currency: rz.currency,
      status: "created",
    });
    if (error) throw new CheckoutError("PAYMENT_SETUP_FAILED", "Could not start payment. Please try again.", 500);
    providerOrderId = rz.id;
  }

  return {
    keyId: cfg.keyId,
    providerOrderId,
    amountPaise: order.total_paise,
    currency: "INR",
    name: settings.shop_name || "KRIVA",
    description: `Order ${order.reference}`,
    prefill: {
      name: order.customer_name,
      contact: `+91${order.customer_phone}`,
      email: order.customer_email ?? undefined,
    },
    mode: cfg.mode,
  };
}

/**
 * Apply an authoritative provider payment record (fetched from the
 * Razorpay API, never taken from the browser) to our database.
 */
export async function applyProviderPayment(payment: ProviderPayment): Promise<PaymentDecision> {
  const db = createServiceClient();
  if (!payment.order_id) return { kind: "reject", reason: "ORDER_MISMATCH" };
  const { data: tx } = await db
    .from("payment_transactions")
    .select("id, order_id, provider_order_id, amount_paise, status, provider_payment_id, duplicate_payment_ids")
    .eq("provider_order_id", payment.order_id)
    .maybeSingle();
  if (!tx) return { kind: "reject", reason: "ORDER_MISMATCH" };

  const { data: order } = await db
    .from("orders")
    .select("id, total_paise, currency, status, payment_status, payment_method")
    .eq("id", tx.order_id)
    .single();
  if (!order) return { kind: "reject", reason: "ORDER_MISMATCH" };

  const { data: paidTx } = await db
    .from("payment_transactions")
    .select("provider_payment_id")
    .eq("order_id", order.id)
    .in("status", ["captured", "refund_pending", "refunded"])
    .limit(1)
    .maybeSingle();

  const decision = decidePaymentUpdate(
    { ...order, paid_payment_id: paidTx?.provider_payment_id ?? null },
    { provider_order_id: tx.provider_order_id, amount_paise: tx.amount_paise },
    payment,
  );

  const raw = payment as unknown as Record<string, unknown>;
  switch (decision.kind) {
    case "mark_paid": {
      await db.from("payment_transactions").update({
        status: "captured", provider_payment_id: payment.id, method: payment.method ?? null, error_description: null, raw,
      }).eq("id", tx.id);
      const { data: updated } = await db.from("orders").update({ payment_status: "paid" })
        .eq("id", order.id).in("payment_status", ["pending", "failed", "cancelled"]).select("id");
      if (!updated?.length) {
        // Lost a race with another verified payment: treat this one as a duplicate.
        await db.from("payment_transactions").update({
          duplicate_payment_ids: [...new Set([...(tx.duplicate_payment_ids ?? []), payment.id])],
        }).eq("id", tx.id);
      }
      break;
    }
    case "mark_authorized":
      await db.from("payment_transactions").update({ status: "authorized", provider_payment_id: payment.id, raw })
        .eq("id", tx.id).in("status", ["created", "failed"]);
      break;
    case "mark_failed":
      await db.from("payment_transactions").update({
        status: "failed", provider_payment_id: payment.id, error_description: decision.reason, raw,
      }).eq("id", tx.id).in("status", ["created", "authorized", "failed"]);
      await db.from("orders").update({ payment_status: "failed" }).eq("id", order.id).eq("payment_status", "pending");
      break;
    case "mark_refunded":
      await db.from("payment_transactions").update({ status: "refunded", raw }).eq("provider_payment_id", payment.id);
      await db.from("orders").update({ payment_status: "refunded" }).eq("id", order.id).eq("payment_status", "paid");
      break;
    case "record_duplicate":
      await db.from("payment_transactions").update({
        duplicate_payment_ids: [...new Set([...(tx.duplicate_payment_ids ?? []), payment.id])],
      }).eq("id", tx.id);
      break;
    case "reject":
      console.warn("Payment rejected", decision.reason, payment.id);
      await db.from("payment_transactions").update({ error_description: `Rejected: ${decision.reason} (${payment.id})` })
        .eq("id", tx.id);
      break;
    case "noop":
      break;
  }
  return decision;
}

/** Called after Razorpay Checkout's success handler. Verifies, then re-fetches from Razorpay. */
export async function verifyCheckoutPayment(input: {
  reference: string;
  token: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const order = await getOrderForCustomer(input.reference, input.token);
  if (!order) throw new CheckoutError("NOT_FOUND", "Order not found.", 404);
  const cfg = requireConfig();
  const db = createServiceClient();
  const { data: tx } = await db
    .from("payment_transactions")
    .select("provider_order_id")
    .eq("order_id", order.id)
    .eq("provider_order_id", input.razorpayOrderId)
    .maybeSingle();
  if (!tx) throw new CheckoutError("PAYMENT_MISMATCH", "Payment does not match this order.", 400);

  const valid = verifyCheckoutSignature({
    serverOrderId: tx.provider_order_id,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
    keySecret: cfg.keySecret,
  });
  if (!valid) throw new CheckoutError("INVALID_SIGNATURE", "We could not verify this payment.", 400);

  // Signature proves the IDs came from Razorpay; the API record tells us the real status/amount.
  const payment = await fetchRazorpayPayment(cfg, input.razorpayPaymentId);
  return applyProviderPayment(payment);
}

/** Pull the latest state from Razorpay for every payment attempt on an order (delayed payments). */
export async function reconcileOrderPayments(orderId: string) {
  const cfg = requireConfig();
  const db = createServiceClient();
  const { data: txs } = await db.from("payment_transactions").select("provider_order_id").eq("order_id", orderId);
  const results: PaymentDecision[] = [];
  for (const tx of txs ?? []) {
    const payments = await fetchRazorpayOrderPayments(cfg, tx.provider_order_id);
    // Apply failures first, then successes, so a later success wins.
    const rank = (p: ProviderPayment) => ({ failed: 0, created: 1, authorized: 2, captured: 3, refunded: 4 })[p.status] ?? 1;
    for (const p of [...payments].sort((a, b) => rank(a) - rank(b))) {
      results.push(await applyProviderPayment(p));
    }
  }
  return results;
}

export async function reconcileForCustomer(reference: string, token: string) {
  const order = await getOrderForCustomer(reference, token);
  if (!order) throw new CheckoutError("NOT_FOUND", "Order not found.", 404);
  if (!(await hitRateLimit(`reconcile:${reference}`, 12, 600))) {
    throw new CheckoutError("RATE_LIMITED", "Please wait a moment before checking again.", 429);
  }
  if (order.payment_method !== "online") return [];
  return reconcileOrderPayments(order.id);
}

/** Owner-initiated full refund of the captured payment for an order. */
export async function refundOrder(orderId: string) {
  const cfg = requireConfig();
  const db = createServiceClient();
  const { data: tx } = await db
    .from("payment_transactions")
    .select("id, provider_payment_id, amount_paise, status")
    .eq("order_id", orderId)
    .eq("status", "captured")
    .maybeSingle();
  if (!tx?.provider_payment_id) throw new Error("No captured payment found for this order.");
  const refund = await createRazorpayRefund(cfg, tx.provider_payment_id, tx.amount_paise);
  await db.from("payment_transactions").update({ status: "refund_pending", refund_id: refund.id }).eq("id", tx.id);
  return refund;
}
