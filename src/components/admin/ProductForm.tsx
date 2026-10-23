"use client";
import { useActionState, useState } from "react";
import { saveProduct, type ActionState } from "@/app/admin/actions/products";
import { paiseToRupeesString } from "@/lib/money";
import { slugify } from "@/lib/validation";
import type { Category, Product } from "@/lib/types";

type VariantRow = { id: string | null; label: string; price: string; is_active: boolean };
type FlavourRow = { id: string | null; name: string; extra: string; is_active: boolean };

export function ProductForm({ product, categories }: { product: Product | null; categories: Category[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProduct, null);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.length
      ? product.variants.map((v) => ({ id: v.id, label: v.label, price: paiseToRupeesString(v.price_paise), is_active: v.is_active }))
      : [{ id: null, label: "Standard", price: "", is_active: true }],
  );
  const [flavours, setFlavours] = useState<FlavourRow[]>(
    (product?.flavours ?? []).map((f) => ({ id: f.id, name: f.name, extra: paiseToRupeesString(f.extra_price_paise), is_active: f.is_active })),
  );

  const check = (k: keyof Product, fallback: boolean) => (product ? Boolean(product[k]) : fallback);

  return (
    <form action={action} className="space-y-8">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <input type="hidden" name="flavours" value={JSON.stringify(flavours)} />

      <section className="space-y-4 rounded-md border border-cream-deep bg-white p-5">
        <h2 className="font-display text-2xl">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Product name</label>
            <input id="name" name="name" required maxLength={120} className="field" value={name}
              onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
          </div>
          <div>
            <label htmlFor="slug" className="label">Web address (slug)</label>
            <input id="slug" name="slug" className="field" value={slug} maxLength={120}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} aria-describedby="slug-hint" />
            <p id="slug-hint" className="hint mt-1">kriva…/product/{slug || "your-product"}</p>
          </div>
        </div>
        <div>
          <label htmlFor="category_id" className="label">Category</label>
          <select id="category_id" name="category_id" className="field" defaultValue={product?.category_id ?? ""}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (hidden)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" name="description" maxLength={4000} className="field min-h-28" defaultValue={product?.description ?? ""} />
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-cream-deep bg-white p-5">
        <h2 className="font-display text-2xl">Sizes &amp; prices</h2>
        <p className="hint">Each product needs at least one size. For a fixed price, keep one row (e.g. “Standard”). Prices in ₹.</p>
        <ul className="space-y-3">
          {variants.map((v, i) => (
            <li key={i} className="grid grid-cols-[1fr_8rem_auto_auto] items-end gap-2">
              <div><label className="label" htmlFor={`vl-${i}`}>Size</label>
                <input id={`vl-${i}`} className="field" value={v.label} maxLength={60} placeholder="1 kg"
                  onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} /></div>
              <div><label className="label" htmlFor={`vp-${i}`}>Price ₹</label>
                <input id={`vp-${i}`} className="field" inputMode="decimal" value={v.price} placeholder="1299"
                  onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))} /></div>
              <label className="flex items-center gap-1 pb-3 text-sm">
                <input type="checkbox" checked={v.is_active} onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, is_active: e.target.checked } : r)))} /> On sale
              </label>
              <button type="button" className="btn btn-sm btn-outline mb-1" disabled={variants.length === 1}
                onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))} aria-label={`Remove size ${v.label || i + 1}`}>Remove</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setVariants((r) => [...r, { id: null, label: "", price: "", is_active: true }])}>Add size</button>
      </section>

      <section className="space-y-4 rounded-md border border-cream-deep bg-white p-5">
        <h2 className="font-display text-2xl">Flavours</h2>
        <p className="hint">Optional. If you add flavours, customers must choose one. Extra charge is added to the size price.</p>
        <ul className="space-y-3">
          {flavours.map((f, i) => (
            <li key={i} className="grid grid-cols-[1fr_8rem_auto_auto] items-end gap-2">
              <div><label className="label" htmlFor={`fn-${i}`}>Flavour</label>
                <input id={`fn-${i}`} className="field" value={f.name} maxLength={60}
                  onChange={(e) => setFlavours((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} /></div>
              <div><label className="label" htmlFor={`fe-${i}`}>Extra ₹</label>
                <input id={`fe-${i}`} className="field" inputMode="decimal" value={f.extra}
                  onChange={(e) => setFlavours((rows) => rows.map((r, j) => (j === i ? { ...r, extra: e.target.value } : r)))} /></div>
              <label className="flex items-center gap-1 pb-3 text-sm">
                <input type="checkbox" checked={f.is_active} onChange={(e) => setFlavours((rows) => rows.map((r, j) => (j === i ? { ...r, is_active: e.target.checked } : r)))} /> Offered
              </label>
              <button type="button" className="btn btn-sm btn-outline mb-1" onClick={() => setFlavours((rows) => rows.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setFlavours((r) => [...r, { id: null, name: "", extra: "0", is_active: true }])}>Add flavour</button>
      </section>

      <section className="space-y-4 rounded-md border border-cream-deep bg-white p-5">
        <h2 className="font-display text-2xl">Ordering</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="stock_status" className="label">Availability</label>
            <select id="stock_status" name="stock_status" className="field" defaultValue={product?.stock_status ?? "in_stock"}>
              <option value="in_stock">In stock</option><option value="sold_out">Sold out</option><option value="unavailable">Unavailable</option>
            </select>
          </div>
          <div>
            <label htmlFor="stock_quantity" className="label">Stock count (optional)</label>
            <input id="stock_quantity" name="stock_quantity" inputMode="numeric" className="field" defaultValue={product?.stock_quantity ?? ""} aria-describedby="stock-hint" />
            <p id="stock-hint" className="hint mt-1">Leave blank if made to order.</p>
          </div>
          <div>
            <label htmlFor="lead_time_hours" className="label">Notice needed (hours)</label>
            <input id="lead_time_hours" name="lead_time_hours" type="number" min={0} max={720} className="field" defaultValue={product?.lead_time_hours ?? 24} />
          </div>
          <div>
            <label htmlFor="max_per_order" className="label">Max per order</label>
            <input id="max_per_order" name="max_per_order" type="number" min={1} max={100} className="field" defaultValue={product?.max_per_order ?? 10} />
          </div>
          <div>
            <label htmlFor="max_message_length" className="label">Cake message length</label>
            <input id="max_message_length" name="max_message_length" type="number" min={1} max={120} className="field" defaultValue={product?.max_message_length ?? 40} />
          </div>
          <div>
            <label htmlFor="sort_order" className="label">Display order</label>
            <input id="sort_order" name="sort_order" type="number" className="field" defaultValue={product?.sort_order ?? 0} />
          </div>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Options</legend>
          {([
            ["is_active", "Show on website", true],
            ["is_featured", "Feature on homepage", false],
            ["is_bestseller", "Bestseller", false],
            ["is_signature", "Signature item", false],
            ["allows_custom_message", "Allow a message on the cake", false],
            ["allows_instructions", "Allow special instructions", true],
            ["requires_approval", "I confirm before the customer pays (custom work)", false],
          ] as const).map(([k, l, def]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={k} defaultChecked={check(k, def)} className="accent-brand" /> {l}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="space-y-4 rounded-md border border-cream-deep bg-white p-5">
        <h2 className="font-display text-2xl">Dietary, ingredients &amp; allergens</h2>
        <fieldset className="flex flex-wrap gap-6">
          <legend className="label">Dietary options (shown as badges and filters)</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="diet_eggless" defaultChecked={product?.dietary_tags.includes("eggless") ?? false} className="accent-brand" /> Eggless available
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="diet_sugar-free" defaultChecked={product?.dietary_tags.includes("sugar-free") ?? false} className="accent-brand" /> Sugar-free
          </label>
        </fieldset>
        <div>
          <label htmlFor="ingredients" className="label">Ingredients (optional)</label>
          <textarea id="ingredients" name="ingredients" maxLength={2000} className="field min-h-20" defaultValue={product?.ingredients ?? ""} />
        </div>
        <div>
          <label htmlFor="allergens" className="label">Allergen information (optional)</label>
          <textarea id="allergens" name="allergens" maxLength={1000} className="field min-h-20" defaultValue={product?.allergens ?? ""} />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-cream-deep bg-ivory/95 px-4 py-3 sm:-mx-8 sm:px-8">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : product ? "Save changes" : "Create product"}</button>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-success">{state.message}</p>}
      </div>
    </form>
  );
}
