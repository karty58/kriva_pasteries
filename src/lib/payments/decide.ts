/**
 * Pure decision logic: given what WE know about an order and what the
 * payment provider reports (from a verified API fetch or verified
 * webhook), decide how the order's payment state should change.
 * Idempotent: replaying the same provider record yields "noop".
 */
import type { OrderStatus, PaymentStatus } from "../types";

export interface ProviderPayment {
  id: string;
  order_id: string | null;
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string | null;
  amount_refunded?: number;
  error_description?: string | null;
}

export interface KnownOrder {
  total_paise: number;
  currency: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: "online" | "offline";
  paid_payment_id: string | null; // provider payment id that already settled this order, if any
}

export interface KnownTransaction {
  provider_order_id: string;
  amount_paise: number;
}

export type PaymentDecision =
  | { kind: "mark_paid" }
  | { kind: "mark_authorized" }
  | { kind: "mark_failed"; reason: string }
  | { kind: "mark_refunded" }
  | { kind: "record_duplicate"; reason: string }
  | { kind: "noop"; reason: string }
  | { kind: "reject"; reason: "ORDER_MISMATCH" | "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "NOT_ONLINE_ORDER" };

export function decidePaymentUpdate(
  order: KnownOrder,
  tx: KnownTransaction,
  payment: ProviderPayment,
): PaymentDecision {
  if (order.payment_method !== "online") return { kind: "reject", reason: "NOT_ONLINE_ORDER" };
  if (!payment.order_id || payment.order_id !== tx.provider_order_id) return { kind: "reject", reason: "ORDER_MISMATCH" };
  if (payment.currency !== "INR" || order.currency !== "INR") return { kind: "reject", reason: "CURRENCY_MISMATCH" };
  if (payment.amount !== tx.amount_paise || payment.amount !== order.total_paise) {
    return { kind: "reject", reason: "AMOUNT_MISMATCH" };
  }

  switch (payment.status) {
    case "captured": {
      if (order.payment_status === "paid") {
        if (order.paid_payment_id === payment.id) return { kind: "noop", reason: "Already recorded" };
        return { kind: "record_duplicate", reason: "Order already paid by another payment; refund this one." };
      }
      if (order.payment_status === "refunded") return { kind: "noop", reason: "Order already refunded" };
      return { kind: "mark_paid" };
    }
    case "authorized":
      if (order.payment_status === "paid") return { kind: "noop", reason: "Already paid" };
      return { kind: "mark_authorized" };
    case "failed":
      if (order.payment_status === "paid" || order.payment_status === "refunded") {
        return { kind: "noop", reason: "A failed attempt does not change a settled order" };
      }
      return { kind: "mark_failed", reason: payment.error_description ?? "Payment failed" };
    case "refunded": {
      const fully = (payment.amount_refunded ?? payment.amount) >= payment.amount;
      if (!fully) return { kind: "noop", reason: "Partial refund — review in dashboard" };
      if (order.paid_payment_id && order.paid_payment_id !== payment.id) {
        return { kind: "noop", reason: "Refund of a duplicate payment" };
      }
      if (order.payment_status === "refunded") return { kind: "noop", reason: "Already refunded" };
      return { kind: "mark_refunded" };
    }
    default:
      return { kind: "noop", reason: "Payment not completed yet" };
  }
}

/** Can the customer start (or retry) an online payment for this order now? */
export function canStartPayment(order: {
  payment_method: "online" | "offline";
  status: OrderStatus;
  payment_status: PaymentStatus;
  requires_approval: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (order.payment_method !== "online") return { ok: false, reason: "This order is not set up for online payment." };
  if (order.status === "cancelled") return { ok: false, reason: "This order has been cancelled." };
  if (order.payment_status === "paid") return { ok: false, reason: "This order has already been paid." };
  if (order.payment_status === "refunded") return { ok: false, reason: "This order has been refunded." };
  if (order.requires_approval && order.status === "pending") {
    return { ok: false, reason: "KRIVA will confirm availability before you pay." };
  }
  return { ok: true };
}
