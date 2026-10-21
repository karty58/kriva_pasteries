import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { EmptyState, OrderBadge, PageTitle, PaymentBadge, formatIST } from "@/components/admin/ui";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const { supabase } = await requireAdminPage();
  const count = async (table: string, filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count } = await filter(base(table));
    return count ?? 0;
  };
  function base(table: string) {
    return supabase.from(table).select("id", { count: "exact", head: true });
  }

  const [total, available, soldOut, pending, confirmed, paid, recent, samples] = await Promise.all([
    count("products", (q) => q),
    count("products", (q) => q.eq("is_active", true).eq("stock_status", "in_stock")),
    count("products", (q) => q.eq("stock_status", "sold_out")),
    count("orders", (q) => q.eq("status", "pending")),
    count("orders", (q) => q.in("status", ["confirmed", "preparing", "ready"])),
    count("orders", (q) => q.eq("payment_status", "paid")),
    supabase.from("orders").select("id, reference, customer_name, total_paise, status, payment_status, payment_method, requested_for, created_at")
      .order("created_at", { ascending: false }).limit(8),
    count("products", (q) => q.eq("is_sample", true)),
  ]);

  const stats: [string, number, string][] = [
    ["Pending orders", pending, "/admin/orders?status=pending"],
    ["Confirmed / in progress", confirmed, "/admin/orders?status=active"],
    ["Paid orders", paid, "/admin/orders?payment=paid"],
    ["Products", total, "/admin/products"],
    ["Available", available, "/admin/products?filter=available"],
    ["Sold out", soldOut, "/admin/products?filter=sold_out"],
  ];

  return (
    <>
      <PageTitle>Overview</PageTitle>
      {samples > 0 && (
        <div className="mb-6 rounded-md border border-champagne bg-champagne-soft/40 px-4 py-3 text-sm">
          {samples} sample product{samples > 1 ? "s are" : " is"} still listed with placeholder prices.{" "}
          <Link href="/admin/products?filter=sample" className="font-medium underline">Review sample products</Link>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="block rounded-md border border-cream-deep bg-white px-4 py-4 hover:border-burgundy">
              <span className="block font-display text-4xl text-burgundy">{n}</span>
              <span className="text-sm text-muted">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12" aria-labelledby="recent-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-title" className="font-display text-2xl">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm underline">All orders</Link>
        </div>
        {recent.error ? (
          <p role="alert" className="text-danger">Couldn&apos;t load orders: {recent.error.message}</p>
        ) : !recent.data?.length ? (
          <EmptyState title="No orders yet">Website orders appear here as soon as customers place them.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-md border border-cream-deep bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cream text-left"><tr>
                <th className="px-4 py-2 font-medium">Reference</th><th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">For</th><th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Payment</th>
              </tr></thead>
              <tbody>
                {recent.data.map((o) => (
                  <tr key={o.id} className="border-t border-cream-deep">
                    <td className="px-4 py-2"><Link href={`/admin/orders/${o.id}`} className="font-medium text-burgundy underline">{o.reference}</Link></td>
                    <td className="px-4 py-2">{o.customer_name}</td>
                    <td className="px-4 py-2">{formatIST(o.requested_for)}</td>
                    <td className="px-4 py-2">{formatINR(o.total_paise)}</td>
                    <td className="px-4 py-2"><OrderBadge status={o.status as OrderStatus} /></td>
                    <td className="px-4 py-2"><PaymentBadge status={o.payment_status as PaymentStatus} method={o.payment_method} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
