import type { Metadata } from "next";
import { getSettings } from "@/lib/catalogue";
import { isDemoMode } from "@/lib/env";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const settings = await getSettings();
  return (
    <CartView
      whatsappNumber={settings.whatsapp_number}
      deliveryEnabled={settings.delivery_enabled}
      pickupEnabled={settings.pickup_enabled}
      checkoutAvailable={!isDemoMode()}
    />
  );
}
