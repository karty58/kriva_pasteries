import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { imageUrl } from "@/lib/catalogue";
import { formatINR } from "@/lib/money";
import { EmptyState, Notice, PageTitle } from "@/components/admin/ui";
import { quickUpdateProduct } from "../../actions/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  let query = supabase
    .from("products")
    .select("id, name, slug, stock_status, is_active, is_featured, is_bestseller, is_sample, category:categories(name), variants:product_variants(price_paise), images:product_images(storage_path, sort_order)")
    .order("updated_at", { ascending: false });
  if (filter === "available") query = query.eq("is_active", true).eq("stock_status", "in_stock");
  if (filter === "sold_out") query = query.eq("stock_status", "sold_out");
  if (filter === "hidden") query = query.eq("is_active", false);
  if (filter === "sample") query = query.eq("is_sample", true);
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "")}%`);
  const { data: products, error } = await query;

  return (
    <>
      <PageTitle actions={<Link href="/admin/products/new" className="btn btn-primary">Add product</Link>}>Products</PageTitle>
      {sp.deleted && <div className="mb-4"><Notice tone="success">Product deleted.</Notice></div>}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form action="/admin/products" className="flex gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="q" className="sr-only">Search products</label>
          <input id="q" name="q" defaultValue={q} className="field" placeholder="Search by name" />
          <button className="btn btn-outline btn-sm">Search</button>
        </form>
        <ul className="flex flex-wrap gap-2 text-sm">
          {[["", "All"], ["available", "Available"], ["sold_out", "Sold out"], ["hidden", "Hidden"], ["sample", "Placeholder prices"]].map(([v, l]) => (
            <li key={v}>
              <Link href={v ? `/admin/products?filter=${v}` : "/admin/products"} aria-current={filter === v ? "page" : undefined}
                className={`inline-block rounded-full border px-3 py-1.5 ${filter === v ? "border-brand bg-brand text-ivory" : "border-cream-deep bg-white"}`}>{l}</Link>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="text-danger">Couldn&apos;t load products: {error.message}</p>
      ) : !products?.length ? (
        <EmptyState title="No products here">
          <Link href="/admin/products/new" className="underline">Add your first product</Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-cream-deep rounded-md border border-cream-deep bg-white">
          {products.map((p) => {
            const img = [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
            const prices = (p.variants ?? []).map((v) => v.price_paise);
            const cat = Array.isArray(p.category) ? p.category[0] : p.category;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="relative h-16 w-14 overflow-hidden rounded bg-cream">
                  {img && <Image src={imageUrl(img.storage_path)} alt="" fill sizes="56px" className="object-cover" unoptimized={img.storage_path.endsWith(".svg")} />}
                </div>
                <div className="min-w-48 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="font-medium text-brand underline">{p.name}</Link>
                  <p className="text-xs text-muted">
                    {cat?.name ?? "No category"} · {prices.length ? `from ${formatINR(Math.min(...prices))}` : "no price"}
                    {p.is_sample && " · PLACEHOLDER PRICE"}{!p.is_active && " · hidden"}{p.is_featured && " · featured"}
                  </p>
                </div>
                <form action={quickUpdateProduct} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="field" value="stock_status" />
                  <input type="hidden" name="value" value={p.stock_status === "in_stock" ? "sold_out" : "in_stock"} />
                  <span className={`text-xs ${p.stock_status === "in_stock" ? "text-success" : "text-danger"}`}>
                    {p.stock_status === "in_stock" ? "In stock" : p.stock_status === "sold_out" ? "Sold out" : "Unavailable"}
                  </span>
                  <button className="btn btn-outline btn-sm">{p.stock_status === "in_stock" ? "Mark sold out" : "Mark in stock"}</button>
                </form>
                <form action={quickUpdateProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="field" value="is_featured" />
                  <input type="hidden" name="value" value={String(!p.is_featured)} />
                  <button className="btn btn-outline btn-sm">{p.is_featured ? "Unfeature" : "Feature"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
