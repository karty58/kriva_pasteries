import Link from "next/link";
import { getSettings } from "@/lib/catalogue";
import { ContactLines, HoursList } from "./BusinessInfo";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const settings = await getSettings();
  const year = new Date().getFullYear();
  return (
    <footer className="on-dark bg-brand-deep text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div className="space-y-5">
          <Logo height={48} tone="light" />
          <p className="max-w-sm text-ivory/75">
            {settings.tagline ?? `Cakes and pastries from ${settings.city}, ${settings.region}.`}
          </p>
          {(settings.instagram_url || settings.facebook_url) && (
            <ul className="flex gap-5 text-sm">
              {settings.instagram_url && (
                <li>
                  <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="underline decoration-ivory/40 underline-offset-4 hover:decoration-ivory">
                    Instagram
                  </a>
                </li>
              )}
              {settings.facebook_url && (
                <li>
                  <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="underline decoration-ivory/40 underline-offset-4 hover:decoration-ivory">
                    Facebook
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-4 font-display text-xl">Find us</h2>
          <ContactLines settings={settings} tone="light" />
        </div>
        <div>
          <h2 className="mb-4 font-display text-xl">Hours</h2>
          <HoursList settings={settings} tone="light" />
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-ivory/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} {settings.shop_name}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/privacy" className="hover:text-ivory">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:text-ivory">Terms</Link></li>
            <li><Link href="/refund-policy" className="hover:text-ivory">Cancellation &amp; refunds</Link></li>
            <li><Link href="/contact" className="hover:text-ivory">Contact</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
