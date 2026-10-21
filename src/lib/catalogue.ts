import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { isDemoMode, publicEnv } from "./env";
import { DEFAULT_SETTINGS, DEMO_CATEGORIES, DEMO_PRODUCTS } from "./demo-data";
import type { Category, Product, ProductImage, SiteSettings } from "./types";

export const PRODUCT_SELECT =
  "*, category:categories(id,name,slug), variants:product_variants(*), flavours:product_flavours(*), images:product_images(*)";

/** Anonymous client: the public website reads only what RLS allows. */
function publicClient() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function imageUrl(storagePath: string): string {
  if (storagePath.startsWith("/") || storagePath.startsWith("http")) return storagePath;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/product-images/${storagePath}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseProduct(row: any): Product {
  const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;
  return {
    ...row,
    variants: [...(row.variants ?? [])].sort(bySort),
    flavours: [...(row.flavours ?? [])].sort(bySort),
    images: [...(row.images ?? [])]
      .sort(bySort)
      .map((img: Omit<ProductImage, "url">) => ({ ...img, url: imageUrl(img.storage_path) })),
  } as Product;
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (isDemoMode()) return DEFAULT_SETTINGS;
  const { data, error } = await publicClient().from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    console.error("Failed to load settings", error);
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...data } as SiteSettings;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (isDemoMode()) return DEMO_CATEGORIES;
  const { data, error } = await publicClient().from("categories").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return data as Category[];
});

export const getAllProducts = cache(async (): Promise<Product[]> => {
  if (isDemoMode()) return DEMO_PRODUCTS;
  const { data, error } = await publicClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data ?? []).map(normaliseProduct).filter((p) => p.variants.length > 0);
});

import { minPrice } from "./catalogue-utils";
export { minPrice };

export type SortKey = "featured" | "price-asc" | "price-desc" | "newest";

export async function queryProducts(opts: { category?: string; q?: string; sort?: SortKey }) {
  let list = await getAllProducts();
  if (opts.category) list = list.filter((p) => p.category?.slug === opts.category);
  if (opts.q) {
    const q = opts.q.toLowerCase().trim();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  const sorted = [...list];
  switch (opts.sort) {
    case "price-asc":
      sorted.sort((a, b) => minPrice(a) - minPrice(b));
      break;
    case "price-desc":
      sorted.sort((a, b) => minPrice(b) - minPrice(a));
      break;
    case "newest":
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    default:
      sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order);
  }
  return sorted;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getAllProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const all = await getAllProducts();
  const same = all.filter((p) => p.id !== product.id && p.category_id === product.category_id);
  const others = all.filter((p) => p.id !== product.id && p.category_id !== product.category_id && p.is_bestseller);
  return [...same, ...others].slice(0, limit);
}
