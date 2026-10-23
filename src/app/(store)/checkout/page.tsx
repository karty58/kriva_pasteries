import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/catalogue";
import { isDemoMode } from "@/lib/env";
import { onlinePaymentsAvailable } from "@/lib/orders";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const sp = await searchParams;
  if (isDemoMode()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-5xl text-brand">Checkout isn&apos;t connected yet</h1>
        <p className="mt-4 text-muted">This preview runs on sample data. Please order on WhatsApp from your cart.</p>
        <Link href="/cart" className="btn btn-primary mt-8">Back to cart</Link>
      </div>
    );
  }
  const settings = await getSettings();
  const online = onlinePaymentsAvailable(settings);
  return (
    <CheckoutForm
      initialFulfilment={sp.fulfilment === "delivery" ? "delivery" : "pickup"}
      pickupEnabled={settings.pickup_enabled}
      deliveryEnabled={settings.delivery_enabled}
      deliveryAreas={settings.delivery_areas}
      onlineAvailable={online}
      offlineAvailable={settings.offline_payments_enabled}
      approvalMode={settings.approval_mode}
      maxAdvanceDays={settings.max_advance_days}
      businessHours={settings.business_hours}
    />
  );
}
