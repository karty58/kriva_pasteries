import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { isDemoMode } from "@/lib/env";
import { isServiceConfigured } from "@/lib/supabase/service";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {isDemoMode() ? (
        <div className="bg-champagne-soft px-4 py-2 text-center text-sm text-charcoal">
          Preview: menu prices and photos are placeholders until KRIVA confirms them. Website checkout opens once the shop&apos;s
          database and payments are connected.
        </div>
      ) : (
        !isServiceConfigured() && (
          <div className="bg-champagne-soft px-4 py-2 text-center text-sm text-charcoal">
            Menu prices shown are placeholders until KRIVA confirms them. Website ordering opens soon.
          </div>
        )
      )}
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
