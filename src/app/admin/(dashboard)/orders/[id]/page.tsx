import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { getRazorpayConfig } from "@/lib/payments/razorpay";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ActionForm } from "@/components/admin/ActionForm";
import { OrderBadge, PageTitle, PaymentBadge, formatIST } from "@/components/admin/ui";
import { recordOfflinePayment, reconcilePayments, refundPayment, updateOrderStatus } from "../../../actions/orders";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed"],
  confirmed: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export default async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [{ data: order }, { data: items }, { data: history }, { data: txs }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("payment_transactions").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const pay = order.payment_status as PaymentStatus;
  let paymentsConfigured = false;
  try { paymentsConfigured = !!getRazorpayConfig(); } catch { /* misconfigured */ }
  const duplicates = (txs ?? []).flatMap((t) => t.duplicate_payment_ids ?? []);
  const waText = `Hello ${order.customer_name}, this is KRIVA about your order ${order.reference}.`;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/orders" className="underline">← All orders</Link></p>
      <PageTitle actions={<div className="flex gap-2"><OrderBadge status={status} /><PaymentBadge status={pay} method={order.payment_method} /></div>}>
        {order.reference}
      </PageTitle>

      {duplicates.length > 0 && (
        <div role="alert" className="mb-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          This order received more than one successful payment ({duplicates.join(", ")}). Refund the extra payment from the Razorpay Dashboard.
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="rounded-md border border-cream-deep bg-white p-5">
            <h2 className="mb-3 font-display text-2xl">Customer</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Name</dt><dd>{order.customer_name}</dd></div>
              <div><dt className="text-muted">Mobile</dt><dd>
                <a className="underline" href={`tel:+91${order.customer_phone}`}>+91 {order.customer_phone}</a>{" · "}
                <a className="underline" href={buildWhatsAppUrl(`91${order.customer_phone}`, waText)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </dd></div>
              {order.customer_email && <div><dt className="text-muted">Email</dt><dd><a className="underline" href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd></div>}
              <div><dt className="text-muted">{order.fulfilment_method === "pickup" ? "Pickup" : "Delivery"} requested</dt><dd>{formatIST(order.requested_for, "full")}</dd></div>
              {order.fulfilment_method === "delivery" && (
                <div className="sm:col-span-2"><dt className="text-muted">Delivery address</dt><dd>{order.delivery_area && <strong>{order.delivery_area}: </strong>}{order.delivery_address}</dd></div>
              )}
              {order.special_instructions && <div className="sm:col-span-2"><dt className="text-muted">Instructions</dt><dd className="whitespace-pre-wrap">{order.special_instructions}</dd></div>}
            </dl>
          </section>

          <section className="rounded-md border border-cream-deep bg-white p-5">
            <h2 className="mb-3 font-display text-2xl">Items</h2>
            <ul className="divide-y divide-cream-deep text-sm">
              {(items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{it.product_name}</p>
                    <p className="text-muted">{[it.variant_label, it.flavour_name].filter(Boolean).join(", ")} · {formatINR(it.unit_price_paise)} × {it.quantity}</p>
                    {it.custom_message && <p>Cake message: “{it.custom_message}”</p>}
                    {it.instructions && <p className="text-muted">Notes: {it.instructions}</p>}
                  </div>
                  <p>{formatINR(it.line_total_paise)}</p>
                </li>
              ))}
            </ul>
            <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal_paise)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(order.delivery_fee_paise)}</dd></div>
              <div className="flex justify-between font-medium"><dt>Total</dt><dd>{formatINR(order.total_paise)}</dd></div>
            </dl>
          </section>

          <section className="rounded-md border border-cream-deep bg-white p-5">
            <h2 className="mb-3 font-display text-2xl">History</h2>
            <ol className="space-y-2 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted">{formatIST(h.created_at)}</span>
                  <span>{h.from_status ? `${ORDER_STATUS_LABEL[h.from_status as OrderStatus]} → ` : ""}{ORDER_STATUS_LABEL[h.to_status as OrderStatus]}</span>
                  <span className="text-muted">payment: {h.payment_status}</span>
                  {h.note && <span className="w-full text-muted">{h.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-md border border-cream-deep bg-white p-5">
            <h2 className="font-display text-2xl">Fulfilment</h2>
            {order.requires_approval && status === "pending" && (
              <p className="mt-2 text-sm text-muted">This order needs your approval. {order.payment_method === "online" ? "The customer can pay once you confirm." : ""}</p>
            )}
            {NEXT[status].map((to) => (
              <ActionForm key={to} action={updateOrderStatus} submitLabel={`Mark ${ORDER_STATUS_LABEL[to].toLowerCase()}`}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="to" value={to} />
              </ActionForm>
            ))}
            {status !== "completed" && status !== "cancelled" && (
              <details className="mt-5 border-t border-cream-deep pt-4">
                <summary className="cursor-pointer text-sm font-medium text-danger">{status === "pending" ? "Reject request" : "Cancel order"}</summary>
                <ActionForm action={updateOrderStatus} submitLabel="Cancel order" buttonClass="btn btn-outline btn-sm" className="mt-3">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="to" value="cancelled" />
                  <label htmlFor="reason" className="label">Reason shown to the customer</label>
                  <textarea id="reason" name="reason" required maxLength={500} className="field min-h-20" placeholder="Sorry, we're fully booked on this date." />
                  {pay === "paid" && <p className="hint mt-2">This order is paid. After cancelling, issue the refund below.</p>}
                </ActionForm>
              </details>
            )}
          </section>

          <section className="rounded-md border border-cream-deep bg-white p-5">
            <h2 className="font-display text-2xl">Payment</h2>
            <p className="mt-1 text-sm text-muted">{order.payment_method === "online" ? "Google Pay / UPI via Razorpay" : "Arranged directly with KRIVA"}</p>
            {(txs ?? []).length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {txs!.map((t) => (
                  <li key={t.id} className="rounded-md bg-cream px-3 py-2">
                    <p><span className="font-medium">{t.status}</span> · {formatINR(t.amount_paise)}{t.method && ` · ${t.method}`}</p>
                    <p className="break-all text-xs text-muted">Razorpay order {t.provider_order_id}{t.provider_payment_id && ` · payment ${t.provider_payment_id}`}</p>
                    {t.refund_id && <p className="text-xs text-muted">Refund {t.refund_id}</p>}
                    {t.error_description && <p className="text-xs text-danger">{t.error_description}</p>}
                  </li>
                ))}
              </ul>
            )}
            {order.payment_method === "online" ? (
              <>
                {paymentsConfigured && (
                  <ActionForm action={reconcilePayments} submitLabel="Refresh from Razorpay" pendingLabel="Checking…" buttonClass="btn btn-outline btn-sm">
                    <input type="hidden" name="id" value={order.id} />
                  </ActionForm>
                )}
                {paymentsConfigured && pay === "paid" && (
                  <details className="mt-4 border-t border-cream-deep pt-4">
                    <summary className="cursor-pointer text-sm font-medium">Refund payment</summary>
                    <ActionForm action={refundPayment} submitLabel="Refund full amount" buttonClass="btn btn-outline btn-sm" className="mt-3">
                      <input type="hidden" name="id" value={order.id} />
                      <label htmlFor="confirm-refund" className="label">Type REFUND to confirm</label>
                      <input id="confirm-refund" name="confirm" className="field" autoComplete="off" />
                    </ActionForm>
                  </details>
                )}
                <p className="hint mt-3">Online payment status changes only from verified Razorpay records — it can&apos;t be edited by hand.</p>
              </>
            ) : (
              <>
                {pay !== "paid" && (
                  <ActionForm action={recordOfflinePayment} submitLabel="Record payment received" buttonClass="btn btn-primary btn-sm">
                    <input type="hidden" name="id" value={order.id} /><input type="hidden" name="to" value="paid" />
                  </ActionForm>
                )}
                {pay === "paid" && (
                  <ActionForm action={recordOfflinePayment} submitLabel="Mark as refunded" buttonClass="btn btn-outline btn-sm">
                    <input type="hidden" name="id" value={order.id} /><input type="hidden" name="to" value="refunded" />
                  </ActionForm>
                )}
                <p className="hint mt-3">Only record a payment after you&apos;ve checked it arrived in your bank or UPI account.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
