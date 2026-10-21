import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { signOut } from "../actions/auth";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | KRIVA admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/settings", label: "Shop settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdminPage();
  return (
    <div className="flex min-h-dvh flex-col bg-ivory lg:flex-row">
      <aside className="border-b border-cream-deep bg-cream lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block">
          <Link href="/admin" aria-label="Dashboard"><Logo height={34} /></Link>
          <p className="hidden truncate pt-2 text-xs text-muted lg:block">{user.email}</p>
        </div>
        <nav aria-label="Admin">
          <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-cream-deep">{n.label}</Link>
              </li>
            ))}
            <li><Link href="/" target="_blank" className="block whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted hover:bg-cream-deep">View website ↗</Link></li>
            <li>
              <form action={signOut}>
                <button type="submit" className="w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-cream-deep">Sign out</button>
              </form>
            </li>
          </ul>
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
