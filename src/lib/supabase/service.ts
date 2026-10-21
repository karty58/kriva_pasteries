import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "../env";

let cached: SupabaseClient | null = null;

/**
 * PRIVILEGED client (bypasses RLS). Server-only. Used for: creating orders,
 * looking up a customer's order by secret token, and recording verified payments.
 */
export function createServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("Supabase server credentials are not configured (SUPABASE_SECRET_KEY).");
  }
  if (!cached) {
    cached = createClient(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function isServiceConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY));
}
