import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-4xl text-brand">{children}</h1>
      {actions}
    </div>
  );
}

const ORDER_TONE: Record<OrderStatus, string> = {
  pending: "bg-champagne-soft text-charcoal",
  confirmed: "bg-brand/10 text-brand",
  preparing: "bg-brand/10 text-brand",
  ready: "bg-success/10 text-success",
  completed: "bg-cream-deep text-charcoal",
  cancelled: "bg-danger/10 text-danger",
};
const PAY_TONE: Record<PaymentStatus, string> = {
  pending: "bg-champagne-soft text-charcoal",
  paid: "bg-success/10 text-success",
  failed: "bg-danger/10 text-danger",
  cancelled: "bg-cream-deep text-charcoal",
  refunded: "bg-cream-deep text-charcoal",
};

export function OrderBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}
export function PaymentBadge({ status, method }: { status: PaymentStatus; method: "online" | "offline" }) {
  const label = method === "offline" && status === "pending" ? "To arrange" : PAYMENT_STATUS_LABEL[status];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PAY_TONE[status]}`}>{label}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: React.ReactNode }) {
  const cls = tone === "error" ? "border-danger/40 bg-danger/5 text-danger" : tone === "success" ? "border-success/40 bg-success/5 text-success" : "border-cream-deep bg-cream";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-cream-deep px-6 py-12 text-center">
      <p className="font-display text-2xl text-brand">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function formatIST(iso: string, style: "short" | "full" = "short") {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: style === "full" ? "full" : "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
