import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { normaliseProduct, PRODUCT_SELECT } from "@/lib/catalogue";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Notice, PageTitle } from "@/components/admin/ui";
import { deleteProduct, deleteProductImage, moveProductImage } from "../../../actions/products";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [{ data: row }, { data: categories }] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
  ]);
  if (!row) notFound();
  const product = normaliseProduct(row);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/products" className="underline">← Products</Link></p>
      <PageTitle actions={<Link href={`/product/${product.slug}`} target="_blank" className="btn btn-outline btn-sm">Preview page ↗</Link>}>
        {product.name}
      </PageTitle>
      <div className="mb-6 space-y-3">
        {sp.created && <Notice tone="success">Product created. Add photos below.</Notice>}
        {sp.error === "confirm" && <Notice tone="error">Type DELETE to confirm deletion.</Notice>}
        {sp.error === "delete" && <Notice tone="error">Couldn&apos;t delete this product. Try hiding it instead.</Notice>}
        {product.is_sample && <Notice>This is a sample listing. Saving it marks it as a real product — check every price and detail first.</Notice>}
        {!product.is_active && <Notice>This product is hidden from the website.</Notice>}
      </div>

      <section className="mb-8 rounded-md border border-cream-deep bg-white p-5" aria-labelledby="photos-title">
        <h2 id="photos-title" className="font-display text-2xl">Photos</h2>
        <p className="hint">The first photo is the main one. JPG, PNG, WebP or AVIF, up to 5 MB each. Portrait (4:5) photos look best.</p>
        {product.images.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-4">
            {product.images.map((img, i) => (
              <li key={img.id} className="w-32">
                <div className="relative aspect-[4/5] overflow-hidden rounded bg-cream">
                  <Image src={img.url} alt={img.alt_text ?? ""} fill sizes="128px" className="object-cover" unoptimized={img.url.endsWith(".svg")} />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-burgundy px-1.5 text-xs text-ivory">Main</span>}
                </div>
                <div className="mt-2 flex gap-1">
                  <form action={moveProductImage}><input type="hidden" name="image_id" value={img.id} /><input type="hidden" name="dir" value="up" />
                    <button className="btn btn-sm btn-outline px-2" disabled={i === 0} aria-label="Move earlier">←</button></form>
                  <form action={moveProductImage}><input type="hidden" name="image_id" value={img.id} /><input type="hidden" name="dir" value="down" />
                    <button className="btn btn-sm btn-outline px-2" disabled={i === product.images.length - 1} aria-label="Move later">→</button></form>
                  <form action={deleteProductImage}><input type="hidden" name="image_id" value={img.id} />
                    <button className="btn btn-sm btn-outline px-2">Remove</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No photos yet.</p>
        )}
        <ImageUploader productId={product.id} />
      </section>

      <ProductForm product={product} categories={(categories ?? []) as Category[]} />

      <section className="mt-10 rounded-md border border-danger/40 bg-white p-5" aria-labelledby="delete-title">
        <h2 id="delete-title" className="font-display text-2xl text-danger">Delete product</h2>
        <p className="mt-1 text-sm text-muted">Deleting removes the product and its photos. Past orders keep their item details. To take it off the website temporarily, untick “Show on website” instead.</p>
        <form action={deleteProduct} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={product.id} />
          <div>
            <label htmlFor="confirm" className="label">Type DELETE to confirm</label>
            <input id="confirm" name="confirm" className="field" autoComplete="off" />
          </div>
          <button className="btn btn-outline" type="submit">Delete permanently</button>
        </form>
      </section>
    </>
  );
}
