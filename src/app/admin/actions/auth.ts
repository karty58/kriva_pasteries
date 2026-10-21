"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createSessionClient } from "@/lib/supabase/server";
import { hitRateLimit } from "@/lib/orders";
import { isServiceConfigured } from "@/lib/supabase/service";

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };

  if (isServiceConfigured()) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const okIp = await hitRateLimit(`login:ip:${ipKey}`, 10, 900);
    const okEmail = await hitRateLimit(`login:email:${email}`, 5, 900);
    if (!okIp || !okEmail) return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email or password is incorrect." };

  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have owner access." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
