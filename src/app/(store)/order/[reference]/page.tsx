import type { Metadata } from "next";
import Link from "next/link";
import { getOrderForCustomer, onlinePaymentsAvailable } from "@/lib/orders";
import { getSettings } from "@/lib/catalogue";
import { canStartPayment } from "@/lib/payments/decide";
import { formatINR } from "@/lib/money";
import { OrderPaymentPanel } from "@/components/checkout/OrderPaymentPanel";
import { describeOrder } from "@/lib/order-status";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: PageProps<"/order/[reference]">) {
  const { reference } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;
  const order = await getOrderForCustomer(reference, token);

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl text-burgundy">We couldn&apos;t find that order</h1>
        <p className="mt-4 text-muted">
          Please open the exact link from your order confirmation. If you&apos;ve lost it, contact KRIVA with your order reference.
        </p>
        <Link href="/contact" className="btn btn-primary mt-8">Contact KRIVA</Link>
      </div>
    );
  }

  const settings = await getSettings();
  const status = describeOrder(order);
  const payAllowed = canStartPayment(order);
  const canPay = payAllowed.ok && onlinePaymentsAvailable(settings);
  const requested = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })
    .format(new Date(order.requested_for));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm text-muted">Order reference</p>
      <p className="font-display text-3xl tracking-wide">{order.reference}</p>
      <h1 className="mt-6 font-display text-5xl text-burgundy">{status.title}</h1>
      <p className="mt-3 max-w-prose text-lg">{status.detail}</p>

      <dl className="mt-8 grid gap-4 rounded-md bg-cream p-6 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Order status</dt><dd className="font-medium">{status.orderLabel}</dd></div>
        <div><dt className="text-sm text-muted">Payment</dt><dd className="font-medium">{status.paymentLabel}</dd></div>
        <div><dt className="text-sm text-muted">{order.fulfilment_method === "pickup" ? "Pickup" : "Delivery"} requested for</dt><dd>{requested}</dd></div>
        {order.fulfilment_method === "delivery" && order.delivery_address && (
          <div><dt className="text-sm text-muted">Delivery address</dt><dd>{order.delivery_address}</dd></div>
        )}
      </dl>

      {order.payment_method === "online" && order.status !== "cancelled" && (
        <OrderPaymentPanel
          reference={order.reference}
          token={token!}
          canPay={canPay}
          payBlockedReason={payAllowed.ok ? null : payAllowed.reason}
          paymentStatus={order.payment_status}
          autoStart={sp.pay === "1"}
        />
      )}

      <section aria-labelledby="items-title" className="mt-10">
        <h2 id="items-title" className="font-display text-3xl">Your items</h2>
        <ul className="mt-4 divide-y divide-cream-deep border-y border-cream-deep">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{it.product_name}</p>
                <p className="text-sm text-muted">{[it.variant_label, it.flavour_name].filter(Boolean).join(", ")} × {it.quantity}</p>
                {it.custom_message && <p className="text-sm">Message: “{it.custom_message}”</p>}
              </div>
              <p>{formatINR(it.line_total_paise)}</p>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-xs space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal_paise)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.delivery_fee_paise ? formatINR(order.delivery_fee_paise) : "—"}</dd></div>
          <div className="flex justify-between border-t border-cream-deep pt-2 text-lg font-medium"><dt>Total</dt><dd>{formatINR(order.total_paise)}</dd></div>
        </dl>
      </section>

      <p className="mt-10 rounded-md border border-cream-deep p-4 text-sm text-muted">
        Bookmark this page — it&apos;s your private link to check this order. Don&apos;t share it publicly.
      </p>
    </div>
  );
}
