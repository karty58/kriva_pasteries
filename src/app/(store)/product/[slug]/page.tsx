import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, getSettings } from "@/lib/catalogue";
import { ProductGrid } from "@/components/ProductCard";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductOptions } from "@/components/product/ProductOptions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  const img = product.images[0];
  return {
    title: product.name,
    description: product.description?.slice(0, 160) ?? undefined,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, images: img && !img.url.endsWith(".svg") ? [{ url: img.url }] : undefined },
  };
}

function leadTimeText(hours: number) {
  if (hours === 0) return "Usually available the same day — subject to confirmation.";
  if (hours < 24) return `Please order at least ${hours} hours ahead.`;
  const days = Math.round(hours / 24);
  return `Please order at least ${days} day${days === 1 ? "" : "s"} ahead.`;
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(product), getSettings()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/collection" className="hover:text-burgundy">Collection</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li><Link href={`/collection?category=${product.category.slug}`} className="hover:text-burgundy">{product.category.name}</Link></li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          <h1 className="font-display text-4xl leading-tight text-burgundy sm:text-5xl">{product.name}</h1>
          {product.is_sample && (
            <p className="mt-3 inline-block rounded-full bg-champagne-soft px-3 py-1 text-xs">
              Sample listing — details and prices are placeholders
            </p>
          )}
          {product.description && <p className="mt-5 max-w-prose text-[1.05rem] text-charcoal/90">{product.description}</p>}
          <p className="mt-4 text-sm text-muted">{leadTimeText(product.lead_time_hours)}</p>
          {product.requires_approval && (
            <p className="mt-2 text-sm text-muted">KRIVA confirms the design, date and final price before you pay.</p>
          )}

          <div className="mt-8">
            <ProductOptions product={product} whatsappNumber={settings.whatsapp_number} />
          </div>

          {(product.ingredients || product.allergens) && (
            <div className="mt-10 space-y-2 border-t border-cream-deep pt-6">
              {product.ingredients && (
                <details className="group">
                  <summary className="cursor-pointer py-2 font-medium">Ingredients</summary>
                  <p className="pb-3 text-muted">{product.ingredients}</p>
                </details>
              )}
              {product.allergens && (
                <details className="group">
                  <summary className="cursor-pointer py-2 font-medium">Allergen information</summary>
                  <p className="pb-3 text-muted">{product.allergens}</p>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-20 border-t border-cream-deep pt-14">
          <h2 id="related-title" className="mb-8 font-display text-4xl text-burgundy">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
