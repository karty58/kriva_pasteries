/**
 * DEMO MODE ONLY (used when Supabase is not configured).
 * Every product is SAMPLE content: names, prices, sizes and ingredients
 * are placeholders, not real KRIVA information. Mirrors supabase/seed.sql.
 */
import type { Category, Product, SiteSettings } from "./types";

export const DEFAULT_SETTINGS: SiteSettings = {
  shop_name: "KRIVA",
  tagline: null,
  address: null,
  city: "Coimbatore",
  region: "Tamil Nadu",
  country: "India",
  maps_url: null,
  phone: null,
  whatsapp_number: null,
  email: null,
  instagram_url: null,
  facebook_url: null,
  our_story: null,
  business_hours: null,
  pickup_enabled: true,
  delivery_enabled: false,
  delivery_areas: [],
  delivery_fee_paise: 0,
  free_delivery_above_paise: null,
  min_order_paise: 0,
  default_lead_time_hours: 24,
  order_cutoff_time: null,
  max_advance_days: 45,
  online_payments_enabled: false,
  offline_payments_enabled: true,
  approval_mode: "pay_immediately",
  intro_enabled: true,
  intro_video_url: null,
  intro_poster_url: null,
  seasonal_note: null,
  testimonials: [],
  timezone: "Asia/Kolkata",
  currency: "INR",
};

const cats: [string, string][] = [
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

export const DEMO_CATEGORIES: Category[] = cats.map(([name, slug], i) => ({
  id: uuid("c0000000", i + 1),
  name,
  slug,
  description: null,
  sort_order: i + 1,
  is_active: true,
}));

interface Def {
  cat: string;
  name: string;
  slug: string;
  desc: string;
  variants: [string, number][];
  flavours?: [string, number][];
  image: string;
  featured?: boolean;
  bestseller?: boolean;
  signature?: boolean;
  message?: boolean;
  lead?: number;
  approval?: boolean;
  stock?: Product["stock_status"];
}

const defs: Def[] = [
  { cat: "birthday-cakes", name: "Sample Vanilla Berry Birthday Cake", slug: "sample-vanilla-berry-birthday-cake",
    desc: "Light vanilla sponge layered with berry compote and whipped cream.",
    variants: [["500 g", 89900], ["1 kg", 169900], ["2 kg", 319900]], flavours: [["Vanilla", 0], ["Strawberry", 0]],
    image: "/samples/berry-cake.svg", featured: true, bestseller: true, message: true },
  { cat: "chocolate-cakes", name: "Sample Dark Chocolate Truffle Cake", slug: "sample-dark-chocolate-truffle-cake",
    desc: "Chocolate sponge with a glossy ganache finish.",
    variants: [["500 g", 99900], ["1 kg", 189900]], flavours: [["Classic", 0], ["Hazelnut", 15000]],
    image: "/samples/chocolate-cake.svg", featured: true, bestseller: true, signature: true, message: true },
  { cat: "celebration-cakes", name: "Sample Rose Pistachio Celebration Cake", slug: "sample-rose-pistachio-celebration-cake",
    desc: "Pistachio sponge with rose cream and a delicate floral finish.",
    variants: [["1 kg", 219900], ["2 kg", 419900]], image: "/samples/rose-cake.svg", featured: true, signature: true, message: true, lead: 48 },
  { cat: "custom-cakes", name: "Sample Custom Designer Cake", slug: "sample-custom-designer-cake",
    desc: "Tell us your theme and we will design it with you. Final price is confirmed by KRIVA before payment.",
    variants: [["1 kg (starting)", 249900], ["2 kg (starting)", 459900]], image: "/samples/custom-cake.svg",
    featured: true, message: true, lead: 72, approval: true },
  { cat: "cheesecakes", name: "Sample Baked Blueberry Cheesecake", slug: "sample-baked-blueberry-cheesecake",
    desc: "Creamy baked cheesecake with blueberry topping.",
    variants: [["Slice", 24900], ["Whole (800 g)", 149900]], image: "/samples/cheesecake.svg", bestseller: true },
  { cat: "pastries", name: "Sample Classic Opera Pastry", slug: "sample-classic-opera-pastry",
    desc: "Almond sponge, coffee buttercream and chocolate glaze.",
    variants: [["Single", 18900], ["Box of 4", 69900]], image: "/samples/pastry.svg", featured: true, bestseller: true, signature: true, lead: 0 },
  { cat: "pastries", name: "Sample Lemon Tart", slug: "sample-lemon-tart", desc: "Buttery tart shell with lemon curd.",
    variants: [["Single", 16900]], image: "/samples/tart.svg", signature: true, lead: 0, stock: "sold_out" },
  { cat: "cupcakes", name: "Sample Red Velvet Cupcakes", slug: "sample-red-velvet-cupcakes",
    desc: "Red velvet cupcakes with cream cheese frosting.",
    variants: [["Box of 6", 54900], ["Box of 12", 104900]], flavours: [["Red Velvet", 0], ["Chocolate", 0]],
    image: "/samples/cupcakes.svg", bestseller: true },
  { cat: "brownies-and-desserts", name: "Sample Fudge Brownie Box", slug: "sample-fudge-brownie-box",
    desc: "Dense chocolate brownies.", variants: [["Box of 4", 39900], ["Box of 9", 84900]], image: "/samples/brownies.svg", lead: 12 },
  { cat: "seasonal-specials", name: "Sample Seasonal Mango Cake", slug: "sample-seasonal-mango-cake",
    desc: "A seasonal special shown as an example of seasonal items.",
    variants: [["1 kg", 179900]], image: "/samples/mango-cake.svg", message: true },
];

export const DEMO_PRODUCTS: Product[] = defs.map((d, i) => {
  const cat = DEMO_CATEGORIES.find((c) => c.slug === d.cat)!;
  const created = new Date(Date.UTC(2026, 9, 1 + i)).toISOString();
  return {
    id: uuid("a0000000", i + 1),
    category_id: cat.id,
    category: { id: cat.id, name: cat.name, slug: cat.slug },
    name: d.name,
    slug: d.slug,
    description: `${d.desc} (Sample product — replace with real KRIVA details.)`,
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
    ingredients: "Sample ingredients — to be supplied by KRIVA.",
    allergens: "Sample allergen note — to be supplied by KRIVA.",
    is_sample: true,
    sort_order: 0,
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
      { id: uuid("e0000000", i + 1), storage_path: d.image, alt_text: `${d.name} (sample illustration)`, sort_order: 0, url: d.image },
    ],
  };
});
