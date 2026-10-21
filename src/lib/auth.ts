import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./env";
import { createSessionClient } from "./supabase/server";

export class NotAuthorisedError extends Error {
  constructor() {
    super("Not authorised");
  }
}

/**
 * Server-side authorisation check for owner pages and actions.
 * Verifies the session with Supabase Auth (getUser hits the Auth server)
 * and that the user is listed in admin_users.
 */
export async function getAdmin() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!row) return null;
  return { user: data.user, supabase };
}

/** For pages: redirect to login when not an owner. */
export async function requireAdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login?error=not-authorised");
  return admin;
}

/** For server actions / route handlers: throw when not an owner. */
export async function requireAdminAction() {
  const admin = await getAdmin();
  if (!admin) throw new NotAuthorisedError();
  return admin;
}
