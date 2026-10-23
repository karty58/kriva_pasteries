import type { Metadata } from "next";
import { getSettings } from "@/lib/catalogue";
import { ContactLines, HoursList } from "@/components/BusinessInfo";

export const metadata: Metadata = { title: "Visit & contact", description: "Find KRIVA in Coimbatore — address, phone, WhatsApp and opening hours." };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <h1 className="font-display text-5xl text-brand sm:text-6xl">Visit &amp; contact</h1>
      <p className="mt-4 max-w-xl text-muted">{s.city}, {s.region}, {s.country}</p>
      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="c-title">
          <h2 id="c-title" className="mb-4 font-display text-3xl">Get in touch</h2>
          <ContactLines settings={s} />
        </section>
        <section aria-labelledby="h-title">
          <h2 id="h-title" className="mb-4 font-display text-3xl">Opening hours</h2>
          <HoursList settings={s} />
        </section>
        <section aria-labelledby="f-title" className="md:col-span-2">
          <h2 id="f-title" className="mb-4 font-display text-3xl">Pickup &amp; delivery</h2>
          <ul className="space-y-2">
            <li>Pickup from the shop: {s.pickup_enabled ? "available" : "currently unavailable"}.</li>
            <li>
              Delivery: {s.delivery_enabled ? "available" : "currently unavailable"}
              {s.delivery_enabled && s.delivery_areas.length > 0 && ` to ${s.delivery_areas.join(", ")}`}.
            </li>
            <li className="text-muted">Requested pickup and delivery times are confirmed by KRIVA.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
