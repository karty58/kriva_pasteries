import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getSettings } from "@/lib/catalogue";
import { ProductGrid } from "@/components/ProductCard";
import { CustomCakeEnquiry } from "@/components/CustomCakeEnquiry";
import { CakeDesigner } from "@/components/three/CakeDesigner";

export const metadata: Metadata = {
  title: "Custom cakes",
  description: "Design a custom cake with KRIVA in Coimbatore — tell us your theme, size and flavours.",
};
export const dynamic = "force-dynamic";

export default async function CustomCakesPage() {
  const [products, settings] = await Promise.all([getAllProducts(), getSettings()]);
  const custom = products.filter((p) => p.category?.slug === "custom-cakes");
  return (
    <div>
      <section className="on-dark bg-burgundy text-ivory">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <h1 className="max-w-3xl font-display text-[clamp(2.75rem,6vw,5rem)] leading-[1]">Custom cakes, designed with you</h1>
          <p className="mt-6 max-w-xl text-lg text-ivory/85">
            Share the occasion, the number of guests and any inspiration. KRIVA confirms the design, date and final price before you pay.
          </p>
        </div>
      </section>

      <section aria-labelledby="design-title" className="border-b border-cream-deep">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 id="design-title" className="font-display text-4xl text-burgundy sm:text-5xl">Sketch your cake in 3D</h2>
          <p className="mt-3 max-w-xl text-muted">Choose tiers, frosting, drip and topping, and turn the cake to see it from every side.</p>
          <div className="mt-10">
            <CakeDesigner />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_26rem] lg:px-8">
        <div className="space-y-10">
          <section aria-labelledby="how-title">
            <h2 id="how-title" className="font-display text-4xl text-burgundy">What to tell us</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2">
              {[
                ["Occasion and date", "When you need it and whether you'll pick it up or need delivery."],
                ["Size", "How many people it should serve, or the weight you have in mind."],
                ["Flavours", "Sponge, filling and frosting preferences, and any dietary needs."],
                ["Design", "Colours, theme, toppers or a reference photo you can share on WhatsApp."],
              ].map(([t, d]) => (
                <li key={t} className="border-t border-champagne pt-4">
                  <h3 className="font-display text-2xl">{t}</h3>
                  <p className="mt-1 text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </section>
          {custom.length > 0 && (
            <section aria-labelledby="start-title">
              <h2 id="start-title" className="mb-6 font-display text-4xl text-burgundy">Start from a base</h2>
              <ProductGrid products={custom} />
            </section>
          )}
        </div>

        <aside aria-labelledby="enquire-title" className="h-fit rounded-md bg-cream p-6">
          <h2 id="enquire-title" className="font-display text-3xl">Send an enquiry</h2>
          <p className="mt-2 text-sm text-muted">
            This opens WhatsApp with your details and your 3D sketch filled in. It isn&apos;t an order yet — KRIVA replies to plan your cake.
          </p>
          <CustomCakeEnquiry whatsappNumber={settings.whatsapp_number} />
          <p className="mt-6 text-sm text-muted">
            Prefer to choose online? <Link href="/collection?category=custom-cakes" className="underline">Browse custom cake bases</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
