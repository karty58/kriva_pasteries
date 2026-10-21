import type { MetadataRoute } from "next";
import { getAllProducts, getCategories } from "@/lib/catalogue";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [products, categories] = await Promise.all([getAllProducts().catch(() => []), getCategories().catch(() => [])]);
  const statics = ["", "/collection", "/custom-cakes", "/contact", "/privacy", "/terms", "/refund-policy"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly" as const,
  }));
  return [
    ...statics,
    ...categories.map((c) => ({ url: `${base}/collection?category=${c.slug}`, changeFrequency: "weekly" as const })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const })),
  ];
}
