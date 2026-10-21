import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, queryProducts, type SortKey } from "@/lib/catalogue";
import { ProductGrid } from "@/components/ProductCard";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/collection">): Promise<Metadata> {
  const sp = await searchParams;
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === sp.category);
  return {
    title: cat ? cat.name : "Our collection",
    description: cat?.description ?? "Browse KRIVA cakes, pastries, cupcakes and desserts.",
    alternates: { canonical: cat ? `/collection?category=${cat.slug}` : "/collection" },
  };
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export default async function CollectionPage({ searchParams }: PageProps<"/collection">) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const sort = (SORTS.find((s) => s.value === sp.sort)?.value ?? "featured") as SortKey;

  const [categories, products] = await Promise.all([getCategories(), queryProducts({ category, q, sort })]);
  const active = categories.find((c) => c.slug === category);

  const hrefFor = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("category", slug);
    if (q) p.set("q", q);
    if (sort !== "featured") p.set("sort", sort);
    const s = p.toString();
    return s ? `/collection?${s}` : "/collection";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="font-display text-5xl text-burgundy sm:text-6xl">{active ? active.name : "Our collection"}</h1>
      {active?.description && <p className="mt-3 max-w-xl text-muted">{active.description}</p>}

      <form action="/collection" method="get" className="mt-10 flex flex-col gap-4 border-y border-cream-deep py-5 md:flex-row md:items-end">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="flex-1">
          <label htmlFor="q" className="label">Search by name</label>
          <div className="flex gap-2">
            <input id="q" name="q" type="search" defaultValue={q} placeholder="e.g. chocolate" className="field" maxLength={80} />
            <button type="submit" className="btn btn-primary">Search</button>
          </div>
        </div>
        <div className="md:w-60">
          <label htmlFor="sort" className="label">Sort</label>
          <AutoSubmitSelect id="sort" name="sort" defaultValue={sort} options={SORTS} />
        </div>
      </form>

      <nav aria-label="Categories" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={hrefFor()} aria-current={!category ? "page" : undefined}
              className={`inline-block rounded-full border px-4 py-2 text-sm ${!category ? "border-burgundy bg-burgundy text-ivory" : "border-cream-deep hover:border-burgundy"}`}>
              All
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={hrefFor(c.slug)} aria-current={category === c.slug ? "page" : undefined}
                className={`inline-block rounded-full border px-4 py-2 text-sm ${category === c.slug ? "border-burgundy bg-burgundy text-ivory" : "border-cream-deep hover:border-burgundy"}`}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10">
        <p className="mb-6 text-sm text-muted" aria-live="polite">
          {products.length} {products.length === 1 ? "item" : "items"}
          {q ? ` matching “${q}”` : ""}
        </p>
        {products.length > 0 ? (
          <ProductGrid products={products} priorityCount={4} />
        ) : (
          <div className="rounded-md bg-cream px-6 py-14 text-center">
            <p className="font-display text-3xl text-burgundy">Nothing matches that yet</p>
            <p className="mt-2 text-muted">Try a different word, or browse all cakes and pastries.</p>
            <Link href="/collection" className="btn btn-outline mt-6">Show everything</Link>
          </div>
        )}
      </div>
    </div>
  );
}
