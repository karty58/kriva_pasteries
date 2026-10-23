import { requireAdminPage } from "@/lib/auth";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageTitle } from "@/components/admin/ui";
import { moveCategory, saveCategory } from "../../actions/categories";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

function Fields({ c }: { c?: Category }) {
  const p = c?.id ?? "new";
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div><label htmlFor={`n-${p}`} className="label">Name</label><input id={`n-${p}`} name="name" required maxLength={80} defaultValue={c?.name} className="field" /></div>
      <div><label htmlFor={`s-${p}`} className="label">Slug</label><input id={`s-${p}`} name="slug" maxLength={120} defaultValue={c?.slug} placeholder="auto from name" className="field" /></div>
      <div><label htmlFor={`d-${p}`} className="label">Description</label><input id={`d-${p}`} name="description" maxLength={500} defaultValue={c?.description ?? ""} className="field" /></div>
      <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={c ? c.is_active : true} className="accent-brand" /> Visible</label>
    </div>
  );
}

export default async function CategoriesPage() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
  const categories = (data ?? []) as Category[];
  return (
    <>
      <PageTitle>Categories</PageTitle>
      {error && <p role="alert" className="text-danger">{error.message}</p>}
      <ul className="space-y-4">
        {categories.map((c, i) => (
          <li key={c.id} className="rounded-md border border-cream-deep bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{c.name}{!c.is_active && <span className="ml-2 text-xs text-muted">(hidden)</span>}</p>
              <div className="flex gap-1">
                <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" />
                  <button className="btn btn-sm btn-outline px-3" disabled={i === 0} aria-label={`Move ${c.name} up`}>↑</button></form>
                <form action={moveCategory}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" />
                  <button className="btn btn-sm btn-outline px-3" disabled={i === categories.length - 1} aria-label={`Move ${c.name} down`}>↓</button></form>
              </div>
            </div>
            <ActionForm action={saveCategory} submitLabel="Save" buttonClass="btn btn-sm btn-primary"><Fields c={c} /></ActionForm>
          </li>
        ))}
      </ul>
      <section className="mt-10 rounded-md border border-brand/30 bg-white p-4" aria-labelledby="new-cat">
        <h2 id="new-cat" className="mb-3 font-display text-2xl">Add a category</h2>
        <ActionForm action={saveCategory} submitLabel="Add category"><Fields /></ActionForm>
      </section>
      <p className="hint mt-4">Hiding a category removes it from the website menu and filters; its products stay visible in “All”. Hide products individually to remove them.</p>
    </>
  );
}
