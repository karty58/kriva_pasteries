import type { OrderStatus, PaymentStatus } from "./types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Being prepared",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  cancelled: "Payment cancelled",
  refunded: "Refunded",
};

/** Customer-facing wording. Never says "confirmed" unless KRIVA confirmed it. */
export function describeOrder(o: {
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: "online" | "offline";
  requires_approval: boolean;
  rejection_reason: string | null;
  fulfilment_method: "pickup" | "delivery";
}) {
  const orderLabel = ORDER_STATUS_LABEL[o.status];
  const paymentLabel =
    o.payment_method === "offline" && o.payment_status === "pending"
      ? "To be arranged with KRIVA"
      : PAYMENT_STATUS_LABEL[o.payment_status];

  if (o.status === "cancelled") {
    return {
      orderLabel,
      paymentLabel,
      title: "Order cancelled",
      detail:
        (o.rejection_reason ? `${o.rejection_reason} ` : "") +
        (o.payment_status === "paid"
          ? "Your payment will be refunded to the original payment method."
          : o.payment_status === "refunded"
            ? "Your payment has been refunded."
            : ""),
    };
  }
  if (o.payment_method === "online") {
    if (o.payment_status === "failed") {
      return { orderLabel, paymentLabel, title: "Payment didn’t go through", detail: "No money was taken for this attempt. You can try paying again below." };
    }
    if (o.payment_status === "pending" && o.requires_approval && o.status === "pending") {
      return { orderLabel, paymentLabel, title: "Order request received", detail: "KRIVA will check availability and confirm your order. You’ll be able to pay here once it’s confirmed." };
    }
    if (o.payment_status === "pending") {
      return { orderLabel, paymentLabel, title: o.status === "confirmed" ? "Confirmed — payment pending" : "Payment pending", detail: "Complete your Google Pay / UPI payment below to secure your order." };
    }
    if (o.payment_status === "paid" && o.status === "pending") {
      return { orderLabel, paymentLabel, title: "Payment successful", detail: "We’ve received your payment. KRIVA will confirm your order shortly." };
    }
  } else if (o.status === "pending") {
    return { orderLabel, paymentLabel, title: "Order request received", detail: "KRIVA will contact you to confirm your order and arrange payment." };
  }
  const progress: Record<OrderStatus, string> = {
    pending: "",
    confirmed: "Your order is confirmed.",
    preparing: "Your order is being prepared.",
    ready: o.fulfilment_method === "pickup" ? "Your order is ready for pickup." : "Your order is ready and will be out for delivery.",
    completed: "Your order is complete. Thank you!",
    cancelled: "",
  };
  return { orderLabel, paymentLabel, title: orderLabel, detail: progress[o.status] };
}
