import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Owner login", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-md bg-ivory p-8 shadow-[0_1px_0_var(--color-cream-deep)]">
        <div className="flex justify-center"><Logo height={44} /></div>
        <h1 className="mt-6 text-center font-display text-3xl text-brand">Owner login</h1>
        {sp.error === "not-authorised" && (
          <p role="alert" className="mt-4 rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">
            This account doesn&apos;t have owner access. Sign in with the owner account.
          </p>
        )}
        {isSupabaseConfigured() ? (
          <LoginForm />
        ) : (
          <p className="mt-6 text-sm text-muted">
            Supabase isn&apos;t configured yet. Follow docs/SUPABASE_SETUP.md, then create the owner account.
          </p>
        )}
      </div>
    </main>
  );
}
