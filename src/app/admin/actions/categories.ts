"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { slugify, slugSchema } from "@/lib/validation";
import type { ActionState } from "./products";

const schema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  name: z.string().trim().min(1, "Enter a category name.").max(80),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slug = slugSchema.safeParse(parsed.data.slug || slugify(parsed.data.name));
  if (!slug.success || !slug.data) return { error: "Slug: use lowercase letters, numbers and hyphens." };
  const row = {
    name: parsed.data.name,
    slug: slug.data,
    description: parsed.data.description || null,
    is_active: formData.get("is_active") === "on",
  };
  if (parsed.data.id) {
    const { error } = await supabase.from("categories").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.code === "23505" ? "That slug is already in use." : error.message };
  } else {
    const { data: last } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("categories").insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 });
    if (error) return { error: error.code === "23505" ? "That slug is already in use." : error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Category saved." };
}

export async function moveCategory(formData: FormData) {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const { data: all } = await supabase.from("categories").select("id").order("sort_order").order("name");
  const ids = (all ?? []).map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((cid, idx) => supabase.from("categories").update({ sort_order: idx + 1 }).eq("id", cid)));
  revalidatePath("/", "layout");
}
