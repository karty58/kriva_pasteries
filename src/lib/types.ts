// Shared domain types. Money is always integer paise.

export type StockStatus = "in_stock" | "sold_out" | "unavailable";
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type PaymentMethod = "online" | "offline";
export type FulfilmentMethod = "pickup" | "delivery";
export type ApprovalMode = "pay_immediately" | "approve_then_pay";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Variant {
  id: string;
  label: string;
  price_paise: number;
  sort_order: number;
  is_active: boolean;
}

export interface Flavour {
  id: string;
  name: string;
  extra_price_paise: number;
  sort_order: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  url: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  category?: Pick<Category, "id" | "name" | "slug"> | null;
  name: string;
  slug: string;
  description: string | null;
  allows_custom_message: boolean;
  max_message_length: number;
  allows_instructions: boolean;
  lead_time_hours: number;
  stock_status: StockStatus;
  stock_quantity: number | null;
  max_per_order: number;
  requires_approval: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_signature: boolean;
  ingredients: string | null;
  allergens: string | null;
  is_sample: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  variants: Variant[];
  flavours: Flavour[];
  images: ProductImage[];
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BusinessHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

export interface SiteSettings {
  shop_name: string;
  tagline: string | null;
  address: string | null;
  city: string;
  region: string;
  country: string;
  maps_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  our_story: string | null;
  business_hours: BusinessHours | null;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_areas: string[];
  delivery_fee_paise: number;
  free_delivery_above_paise: number | null;
  min_order_paise: number;
  default_lead_time_hours: number;
  order_cutoff_time: string | null;
  max_advance_days: number;
  online_payments_enabled: boolean;
  offline_payments_enabled: boolean;
  approval_mode: ApprovalMode;
  intro_enabled: boolean;
  intro_video_url: string | null;
  intro_poster_url: string | null;
  seasonal_note: string | null;
  testimonials: { quote: string; name: string }[];
  timezone: string;
  currency: "INR";
}

/** What the browser keeps in its cart. Contains NO trusted prices. */
export interface CartLine {
  key: string;
  productId: string;
  variantId: string;
  flavourId: string | null;
  quantity: number;
  customMessage?: string;
  instructions?: string;
  // Display-only snapshot (never trusted by the server):
  display: {
    name: string;
    slug: string;
    variantLabel: string;
    flavourName: string | null;
    unitPricePaise: number;
    imageUrl: string | null;
  };
}
