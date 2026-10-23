import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { EmptyState, OrderBadge, PageTitle, PaymentBadge, formatIST } from "@/components/admin/ui";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  ["", "All"],
  ["pending", "Pending"],
  ["active", "In progress"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const payment = typeof sp.payment === "string" ? sp.payment : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  let query = supabase
    .from("orders")
    .select("id, reference, customer_name, customer_phone, total_paise, status, payment_status, payment_method, fulfilment_method, requested_for, requires_approval, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status === "active") query = query.in("status", ["confirmed", "preparing", "ready"]);
  else if (status) query = query.eq("status", status);
  if (["pending", "paid", "failed", "cancelled", "refunded"].includes(payment)) query = query.eq("payment_status", payment);
  if (q) {
    const safe = q.replace(/[%,()*\\]/g, "");
    const digits = safe.replace(/\D/g, "");
    query = query.or(
      [`reference.ilike.%${safe}%`, `customer_name.ilike.%${safe}%`, digits.length >= 4 ? `customer_phone.ilike.%${digits}%` : null]
        .filter(Boolean)
        .join(","),
    );
  }
  const { data: orders, error } = await query;

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    return `/admin/orders${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageTitle>Orders</PageTitle>
      <form className="mb-4 flex max-w-lg gap-2" action="/admin/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="q" className="sr-only">Search orders</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by reference, name or phone" className="field" />
        <button className="btn btn-primary">Search</button>
      </form>
      <nav aria-label="Filter orders" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([v, l]) => (
            <li key={v}>
              <Link href={href(v)} aria-current={status === v ? "page" : undefined}
                className={`inline-block rounded-full border px-3 py-1.5 text-sm ${status === v ? "border-brand bg-brand text-ivory" : "border-cream-deep bg-white"}`}>
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error ? (
        <p role="alert" className="text-danger">Couldn&apos;t load orders: {error.message}</p>
      ) : !orders?.length ? (
        <EmptyState title={q || status ? "No matching orders" : "No orders yet"}>
          {q || status ? <Link href="/admin/orders" className="underline">Clear filters</Link> : "Website orders appear here when customers place them."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-md border border-cream-deep bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-cream text-left"><tr>
              <th className="px-4 py-2 font-medium">Reference</th><th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Requested for</th><th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Payment</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-cream-deep">
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand underline">{o.reference}</Link>
                    <span className="block text-xs text-muted">{formatIST(o.created_at)}</span>
                  </td>
                  <td className="px-4 py-2">{o.customer_name}<span className="block text-xs text-muted">{o.customer_phone}</span></td>
                  <td className="px-4 py-2">{formatIST(o.requested_for)}<span className="block text-xs text-muted">{o.fulfilment_method === "pickup" ? "Pickup" : "Delivery"}</span></td>
                  <td className="px-4 py-2">{formatINR(o.total_paise)}</td>
                  <td className="px-4 py-2"><OrderBadge status={o.status as OrderStatus} />{o.requires_approval && o.status === "pending" && <span className="mt-1 block text-xs text-muted">Needs approval</span>}</td>
                  <td className="px-4 py-2"><PaymentBadge status={o.payment_status as PaymentStatus} method={o.payment_method} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
