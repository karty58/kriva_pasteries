import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { publicEnv } from "@/lib/env";
import "./globals.css";

// Self-hosted (SIL Open Font License) so builds never depend on Google Fonts at build time.
const bodoni = localFont({
  variable: "--font-bodoni",
  display: "swap",
  src: [
    { path: "../fonts/bodoni-moda-latin-opsz-normal.woff2", style: "normal", weight: "400 900" },
    { path: "../fonts/bodoni-moda-latin-opsz-italic.woff2", style: "italic", weight: "400 900" },
  ],
});

const instrument = localFont({
  variable: "--font-instrument",
  display: "swap",
  src: [{ path: "../fonts/instrument-sans-latin-wght-normal.woff2", style: "normal", weight: "400 700" }],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "KRIVA Patisserie — Desserts & Pastries in Coimbatore",
    template: "%s | KRIVA",
  },
  description:
    "KRIVA Patisserie, Coimbatore: French and European-style entremets, pastries and desserts, with eggless and sugar-free choices and custom glazed cakes.",
  openGraph: {
    type: "website",
    siteName: "KRIVA Patisserie",
    locale: "en_IN",
    title: "KRIVA Patisserie — Desserts & Pastries in Coimbatore",
    description: "Beautifully crafted cakes and delicate pastries, thoughtfully made for your sweetest moments.",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "KRIVA" }],
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#2e3c32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${bodoni.variable} ${instrument.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
