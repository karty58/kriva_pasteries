import Image from "next/image";
import Link from "next/link";
import { getAllProducts, getSettings } from "@/lib/catalogue";
import { IntroOverlay } from "@/components/IntroOverlay";
import { ProductGrid } from "@/components/ProductCard";
import { ContactLines, HoursList } from "@/components/BusinessInfo";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function Section({
  id,
  title,
  intro,
  href,
  products,
  tone = "ivory",
}: {
  id: string;
  title: string;
  intro?: string;
  href: string;
  products: Product[];
  tone?: "ivory" | "cream";
}) {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tone === "cream" ? "bg-cream" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 id={`${id}-title`} className="font-display text-4xl text-burgundy sm:text-5xl">
              {title}
            </h2>
            {intro && <p className="mt-3 text-muted">{intro}</p>}
          </div>
          <Link href={href} className="btn btn-outline btn-sm">
            View all
          </Link>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </div>
    </section>
  );
}

const inCat = (slugs: string[]) => (p: Product) => !!p.category && slugs.includes(p.category.slug);
const CAKE_CATS = ["birthday-cakes", "celebration-cakes", "custom-cakes", "chocolate-cakes", "cheesecakes", "seasonal-specials"];

export default async function HomePage() {
  const [products, settings] = await Promise.all([getAllProducts(), getSettings()]);
  const heroProduct = products.find((p) => p.is_featured && p.images[0]) ?? products.find((p) => p.images[0]);
  const heroImg = heroProduct?.images[0];

  const bestsellers = products.filter((p) => p.is_bestseller && inCat(CAKE_CATS)(p));
  const signaturePastries = products.filter((p) => p.is_signature && inCat(["pastries"])(p));
  const birthday = products.filter(inCat(["birthday-cakes"]));
  const celebration = products.filter(inCat(["celebration-cakes"]));
  const custom = products.filter(inCat(["custom-cakes"]));
  const minis = products.filter(inCat(["cupcakes", "brownies-and-desserts"]));
  const seasonal = products.filter(inCat(["seasonal-specials"]));
  const recent = [...products].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const gallery = Array.from(new Map(products.flatMap((p) => p.images.slice(0, 1).map((i) => [i.url, { img: i, p }]))).values()).slice(0, 8);

  return (
    <>
      {settings.intro_enabled && (
        <IntroOverlay videoUrl={settings.intro_video_url} posterUrl={settings.intro_poster_url || "/brand/intro-poster.svg"} />
      )}

      {/* Hero */}
      <section className="on-dark relative overflow-hidden bg-burgundy text-ivory">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:grid-cols-[1.15fr_1fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="font-display text-[clamp(3rem,8vw,6.25rem)] leading-[0.98]">A Little Art in Every Bite.</h1>
            <p className="mt-6 max-w-md text-lg text-ivory/85">
              Discover beautifully crafted cakes and delicate pastries, thoughtfully made for your sweetest moments.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/collection" className="btn btn-light">Explore Our Collection</Link>
              <Link href="/collection?sort=featured" className="btn btn-ghost-light">Order Now</Link>
              <Link href="/custom-cakes" className="btn btn-ghost-light">Custom Cakes</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rounded-[999px_999px_0.5rem_0.5rem] border border-champagne/50" aria-hidden="true" />
            <div className="arch relative aspect-[4/5] bg-burgundy-deep">
              {heroImg && (
                <Image
                  src={heroImg.url}
                  alt={heroImg.alt_text ?? heroProduct!.name}
                  fill
                  priority
                  sizes="(min-width: 768px) 28rem, 90vw"
                  className="object-cover"
                  unoptimized={heroImg.url.endsWith(".svg")}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {settings.seasonal_note && (
        <div className="border-b border-cream-deep bg-cream">
          <p className="mx-auto max-w-7xl px-4 py-4 text-center sm:px-6 lg:px-8">{settings.seasonal_note}</p>
        </div>
      )}

      <Section id="bestsellers" title="Bestselling cakes" href="/collection?sort=featured" products={bestsellers} />
      <Section id="signature-pastries" title="Signature pastries" href="/collection?category=pastries" products={signaturePastries} tone="cream" />
      <Section id="birthday" title="Birthday cakes" intro="Choose a size and flavour, and add a message to the cake." href="/collection?category=birthday-cakes" products={birthday} />
      <Section id="celebration" title="Celebration cakes" intro="For anniversaries, engagements and milestones." href="/collection?category=celebration-cakes" products={celebration} tone="cream" />

      {/* Custom cakes feature */}
      <section aria-labelledby="custom-title" className="bg-ivory">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <h2 id="custom-title" className="font-display text-4xl text-burgundy sm:text-5xl">Custom-designed cakes</h2>
            <p className="mt-4 max-w-md text-muted">
              Bring an idea, a colour, a theme or a photo. We design the cake with you and confirm the price and date before you pay.
            </p>
            <ol className="mt-8 space-y-5">
              {[
                ["Share your idea", "Tell us the occasion, servings, flavours and any inspiration — on the website or WhatsApp."],
                ["We confirm the design", "KRIVA checks the date and sends you the design details and final price."],
                ["Pay and schedule", "Pay securely once confirmed, then pick up or receive your cake on the agreed date."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2.25rem_1fr] gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-burgundy font-display text-burgundy">{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="text-[0.95rem] text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/custom-cakes" className="btn btn-primary mt-9">Start a custom cake</Link>
          </div>
          <div>{custom.length > 0 && <ProductGrid products={custom.slice(0, 2)} />}</div>
        </div>
      </section>

      <Section id="minis" title="Cupcakes and mini desserts" href="/collection?category=cupcakes" products={minis} tone="cream" />
      <Section id="seasonal" title="Seasonal specials" href="/collection?category=seasonal-specials" products={seasonal} />
      <Section id="recent" title="Recently added" href="/collection?sort=newest" products={recent} tone="cream" />

      {/* Our story */}
      <section id="our-story" aria-labelledby="story-title" className="on-dark bg-burgundy-deep text-ivory">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.4fr] lg:px-8 lg:py-28">
          <h2 id="story-title" className="font-display text-5xl sm:text-6xl">Our story</h2>
          <div className="prose-kriva max-w-[62ch] text-lg leading-relaxed text-ivory/85">
            {settings.our_story ? (
              settings.our_story.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)
            ) : (
              <p>KRIVA is a cake and pastry shop in {settings.city}, {settings.region}.</p>
            )}
          </div>
        </div>
      </section>

      {/* Why KRIVA — only describes things the site actually offers */}
      <section aria-labelledby="why-title">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 id="why-title" className="font-display text-4xl text-burgundy sm:text-5xl">Why choose KRIVA</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Made for your occasion", "Choose sizes and flavours, add a cake message and share special requests."],
              ["Custom designs", "Work with us on a cake designed around your theme."],
              [
                settings.delivery_enabled ? "Pickup or delivery" : "Easy pickup",
                settings.delivery_enabled
                  ? `Collect from our shop or get delivery${settings.delivery_areas.length ? " in selected areas" : ""}.`
                  : `Collect your order from our shop in ${settings.city}.`,
              ],
              settings.online_payments_enabled
                ? ["Secure UPI payment", "Pay with Google Pay or other UPI apps through a secure payment gateway."]
                : ["Order your way", "Order on the website or message us on WhatsApp."],
            ].map(([t, d]) => (
              <li key={t} className="border-t border-champagne pt-5">
                <h3 className="font-display text-2xl">{t}</h3>
                <p className="mt-2 text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Gallery */}
      {gallery.length > 0 && (
        <section aria-labelledby="gallery-title" className="bg-cream">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <h2 id="gallery-title" className="font-display text-4xl text-burgundy sm:text-5xl">From our kitchen</h2>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {gallery.map(({ img, p }, i) => (
                <li key={img.url} className={i % 5 === 0 ? "sm:row-span-2" : ""}>
                  <Link href={`/product/${p.slug}`} className="relative block h-full min-h-40 overflow-hidden rounded-md bg-cream-deep">
                    <Image src={img.url} alt={img.alt_text ?? p.name} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" loading="lazy" unoptimized={img.url.endsWith(".svg")} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Testimonials: rendered ONLY when genuine reviews are supplied by the owner */}
      {settings.testimonials.length > 0 && (
        <section aria-labelledby="reviews-title">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <h2 id="reviews-title" className="font-display text-4xl text-burgundy sm:text-5xl">Kind words</h2>
            <ul className="mt-10 grid gap-10 md:grid-cols-3">
              {settings.testimonials.slice(0, 6).map((t, i) => (
                <li key={i}>
                  <blockquote className="font-display text-2xl leading-snug">“{t.quote}”</blockquote>
                  <p className="mt-3 text-muted">{t.name}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Visit */}
      <section aria-labelledby="visit-title" className="border-t border-cream-deep">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8 lg:py-20">
          <div>
            <h2 id="visit-title" className="font-display text-4xl text-burgundy">Visit us</h2>
            <p className="mt-3 text-muted">{settings.city}, {settings.region}</p>
            {settings.instagram_url && (
              <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-6">
                Follow on Instagram
              </a>
            )}
          </div>
          <div>
            <h3 className="mb-4 font-display text-2xl">Contact</h3>
            <ContactLines settings={settings} />
          </div>
          <div>
            <h3 className="mb-4 font-display text-2xl">Opening hours</h3>
            <HoursList settings={settings} />
          </div>
        </div>
      </section>
    </>
  );
}
