/**
 * Environment helpers. Only NEXT_PUBLIC_* values may reach the browser.
 * Secrets (Supabase secret/service-role key, Razorpay key secret and
 * webhook secret) are read ONLY in server code.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey);
}

/** Demo mode = no Supabase configured. The storefront shows clearly-labelled sample data. */
export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}
