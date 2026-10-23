/**
 * Builds in-memory catalogue data (used by demo mode and by test fixtures).
 * In production the catalogue comes from Supabase instead.
 */
import type { Category, DietaryTag, Product } from "./types";

export const CATEGORY_DEFS: [string, string][] = [
  ["Birthday Cakes", "birthday-cakes"],
  ["Celebration Cakes", "celebration-cakes"],
  ["Custom Cakes", "custom-cakes"],
  ["Chocolate Cakes", "chocolate-cakes"],
  ["Cheesecakes", "cheesecakes"],
  ["Pastries", "pastries"],
  ["Cupcakes", "cupcakes"],
  ["Brownies and Desserts", "brownies-and-desserts"],
  ["Seasonal Specials", "seasonal-specials"],
];

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function buildCategories(defs: [string, string][] = CATEGORY_DEFS): Category[] {
  return defs.map(([name, slug], i) => ({
    id: uuid("c0000000", i + 1),
    name,
    slug,
    description: null,
    sort_order: i + 1,
    is_active: true,
  }));
}

export interface ProductDef {
  cat: string;
  name: string;
  slug: string;
  desc: string | null;
  variants: [string, number][];
  flavours?: [string, number][];
  image: string;
  imageAlt?: string;
  featured?: boolean;
  bestseller?: boolean;
  signature?: boolean;
  message?: boolean;
  lead?: number;
  approval?: boolean;
  stock?: Product["stock_status"];
  diet?: DietaryTag[];
  ingredients?: string | null;
  allergens?: string | null;
  /** true = prices/photo are placeholders still to be confirmed by KRIVA */
  sample?: boolean;
}

export function buildProducts(defs: ProductDef[], categories: Category[]): Product[] {
  return defs.map((d, i) => {
    const cat = categories.find((c) => c.slug === d.cat)!;
    const created = new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString();
    return {
      id: uuid("a0000000", i + 1),
      category_id: cat.id,
      category: { id: cat.id, name: cat.name, slug: cat.slug },
      name: d.name,
      slug: d.slug,
      description: d.desc,
      allows_custom_message: !!d.message,
      max_message_length: 40,
      allows_instructions: true,
      lead_time_hours: d.lead ?? 24,
      stock_status: d.stock ?? "in_stock",
      stock_quantity: null,
      max_per_order: 10,
      requires_approval: !!d.approval,
      is_active: true,
      is_featured: !!d.featured,
      is_bestseller: !!d.bestseller,
      is_signature: !!d.signature,
      dietary_tags: d.diet ?? [],
      ingredients: d.ingredients ?? null,
      allergens: d.allergens ?? null,
      is_sample: d.sample ?? true,
      sort_order: i,
      created_at: created,
      updated_at: created,
      variants: d.variants.map(([label, price], j) => ({
        id: uuid(`b00000${String(i + 1).padStart(2, "0")}`, j + 1),
        label,
        price_paise: price,
        sort_order: j,
        is_active: true,
      })),
      flavours: (d.flavours ?? []).map(([name, extra], j) => ({
        id: uuid(`d00000${String(i + 1).padStart(2, "0")}`, j + 1),
        name,
        extra_price_paise: extra,
        sort_order: j,
        is_active: true,
      })),
      images: [
        { id: uuid("e0000000", i + 1), storage_path: d.image, alt_text: d.imageAlt ?? `${d.name} (illustration)`, sort_order: 0, url: d.image },
      ],
    };
  });
}
