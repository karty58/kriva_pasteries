"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { slugify, slugSchema, validateImageUpload } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

const variantSchema = z.object({
  id: z.uuid().optional().nullable(),
  label: z.string().trim().min(1, "Each size needs a name.").max(60),
  price: z.string().trim().min(1, "Each size needs a price."),
  is_active: z.boolean().default(true),
});
const flavourSchema = z.object({
  id: z.uuid().optional().nullable(),
  name: z.string().trim().min(1, "Each flavour needs a name.").max(60),
  extra: z.string().trim().default("0"),
  is_active: z.boolean().default(true),
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  category_id: z.union([z.uuid(), z.literal("")]).optional(),
  lead_time_hours: z.coerce.number().int().min(0).max(720),
  max_per_order: z.coerce.number().int().min(1).max(100),
  stock_status: z.enum(["in_stock", "sold_out", "unavailable"]),
  stock_quantity: z.string().trim().optional(),
  max_message_length: z.coerce.number().int().min(1).max(120),
  ingredients: z.string().trim().max(2000).optional(),
  allergens: z.string().trim().max(1000).optional(),
  sort_order: z.coerce.number().int().min(-10000).max(10000).default(0),
});

const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

function revalidateStore(slug?: string) {
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const id = String(formData.get("id") ?? "") || null;

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  const slugResult = slugSchema.safeParse(p.slug ? p.slug : slugify(p.name));
  if (!slugResult.success || !slugResult.data) return { error: "Slug: use lowercase letters, numbers and hyphens." };

  let variants, flavours;
  try {
    variants = z.array(variantSchema).min(1, "Add at least one size and price.").max(20)
      .parse(JSON.parse(String(formData.get("variants") ?? "[]")));
    flavours = z.array(flavourSchema).max(20).parse(JSON.parse(String(formData.get("flavours") ?? "[]")));
  } catch (e) {
    return { error: e instanceof z.ZodError ? e.issues[0].message : "Check the sizes and flavours." };
  }
  let variantRows, flavourRows;
  try {
    variantRows = variants.map((v, i) => ({ id: v.id || randomUUID(), label: v.label, price_paise: rupeesToPaise(v.price), sort_order: i, is_active: v.is_active }));
    flavourRows = flavours.map((f, i) => ({ id: f.id || randomUUID(), name: f.name, extra_price_paise: rupeesToPaise(f.extra || "0"), sort_order: i, is_active: f.is_active }));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (variantRows.some((v) => v.price_paise <= 0)) return { error: "Prices must be more than ₹0." };
  if (new Set(variantRows.map((v) => v.label.toLowerCase())).size !== variantRows.length) return { error: "Size names must be different." };
  if (new Set(flavourRows.map((f) => f.name.toLowerCase())).size !== flavourRows.length) return { error: "Flavour names must be different." };

  const stockQty = p.stock_quantity ? Number(p.stock_quantity) : null;
  if (stockQty !== null && (!Number.isInteger(stockQty) || stockQty < 0)) return { error: "Stock quantity must be a whole number, or blank for untracked." };

  const row = {
    name: p.name,
    slug: slugResult.data,
    description: p.description || null,
    category_id: p.category_id || null,
    lead_time_hours: p.lead_time_hours,
    max_per_order: p.max_per_order,
    stock_status: p.stock_status,
    stock_quantity: stockQty,
    max_message_length: p.max_message_length,
    ingredients: p.ingredients || null,
    allergens: p.allergens || null,
    sort_order: p.sort_order,
    allows_custom_message: bool(formData, "allows_custom_message"),
    allows_instructions: bool(formData, "allows_instructions"),
    requires_approval: bool(formData, "requires_approval"),
    is_active: bool(formData, "is_active"),
    is_featured: bool(formData, "is_featured"),
    is_bestseller: bool(formData, "is_bestseller"),
    is_signature: bool(formData, "is_signature"),
    dietary_tags: (["eggless", "sugar-free"] as const).filter((t) => bool(formData, `diet_${t}`)),
    is_sample: false, // once the owner saves it, it's their real listing
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return { error: error.code === "23505" ? "That slug is already used by another product." : error.message };
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error) return { error: error.code === "23505" ? "That slug is already used by another product." : error.message };
    productId = data.id;
  }

  // Sync variants & flavours (remove deleted ones, upsert the rest)
  const keepV = variantRows.map((v) => v.id);
  const keepF = flavourRows.map((f) => f.id);
  const delV = supabase.from("product_variants").delete().eq("product_id", productId!);
  const { error: dvErr } = keepV.length ? await delV.not("id", "in", `(${keepV.join(",")})`) : await delV;
  const delF = supabase.from("product_flavours").delete().eq("product_id", productId!);
  const { error: dfErr } = keepF.length ? await delF.not("id", "in", `(${keepF.join(",")})`) : await delF;
  if (dvErr || dfErr) return { error: (dvErr ?? dfErr)!.message };

  // (label uniqueness is a deferred constraint, so swapping two labels is fine)
  const { error: vErr } = await supabase.from("product_variants")
    .upsert(variantRows.map((v) => ({ ...v, product_id: productId })), { onConflict: "id" });
  if (vErr) return { error: vErr.code === "23505" ? "Size names must be different." : vErr.message };
  if (flavourRows.length) {
    const { error: fErr } = await supabase.from("product_flavours")
      .upsert(flavourRows.map((f) => ({ ...f, product_id: productId })), { onConflict: "id" });
    if (fErr) return { error: fErr.code === "23505" ? "Flavour names must be different." : fErr.message };
  }

  revalidateStore(row.slug);
  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: true, message: "Saved. Changes are live on the website." };
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  if (formData.get("confirm") !== "DELETE") redirect(`/admin/products/${id}?error=confirm`);
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  const paths = (images ?? []).map((i) => i.storage_path).filter((p) => !p.startsWith("/"));
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) redirect(`/admin/products/${id}?error=delete`);
  revalidateStore();
  redirect("/admin/products?deleted=1");
}

export async function quickUpdateProduct(formData: FormData) {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  const field = z.enum(["stock_status", "is_featured", "is_active"]).parse(formData.get("field"));
  const value = String(formData.get("value"));
  const update =
    field === "stock_status"
      ? { stock_status: z.enum(["in_stock", "sold_out", "unavailable"]).parse(value) }
      : { [field]: value === "true" };
  await supabase.from("products").update(update).eq("id", id);
  revalidateStore();
  revalidatePath("/admin/products");
}

// ---------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------
export async function uploadProductImages(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const productId = z.uuid().parse(formData.get("product_id"));
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one photo." };
  if (files.length > 8) return { error: "Upload up to 8 photos at a time." };

  const { data: product } = await supabase.from("products").select("slug").eq("id", productId).single();
  if (!product) return { error: "Product not found." };
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  let order = count ?? 0;

  for (const file of files) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const check = validateImageUpload(file, head);
    if (!check.ok) return { error: `${file.name}: ${check.message}` };
    const path = `${productId}/${randomUUID()}.${check.ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (upErr) return { error: `Upload failed: ${upErr.message}` };
    const alt = String(formData.get("alt_text") ?? "").trim().slice(0, 200) || null;
    const { error: rowErr } = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, alt_text: alt, sort_order: order++ });
    if (rowErr) {
      await supabase.storage.from("product-images").remove([path]);
      return { error: rowErr.message };
    }
  }
  revalidateStore(product.slug);
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: `${files.length} photo${files.length > 1 ? "s" : ""} uploaded.` };
}

export async function deleteProductImage(formData: FormData) {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("image_id"));
  const { data: img } = await supabase.from("product_images").select("storage_path, product_id").eq("id", id).single();
  if (!img) return;
  await supabase.from("product_images").delete().eq("id", id);
  if (!img.storage_path.startsWith("/")) await supabase.storage.from("product-images").remove([img.storage_path]);
  revalidateStore();
  revalidatePath(`/admin/products/${img.product_id}`);
}

export async function moveProductImage(formData: FormData) {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("image_id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const { data: img } = await supabase.from("product_images").select("product_id").eq("id", id).single();
  if (!img) return;
  const { data: all } = await supabase.from("product_images").select("id").eq("product_id", img.product_id).order("sort_order");
  const ids = (all ?? []).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((imgId, idx) => supabase.from("product_images").update({ sort_order: idx }).eq("id", imgId)));
  revalidateStore();
  revalidatePath(`/admin/products/${img.product_id}`);
}
