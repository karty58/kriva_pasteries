import type { Product } from "./types";

export function minPrice(p: Product): number {
  return Math.min(...p.variants.map((v) => v.price_paise));
}
