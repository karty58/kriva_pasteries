import Image from "next/image";
import Link from "next/link";
import { formatINR } from "@/lib/money";
import { minPrice } from "@/lib/catalogue-utils";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const img = product.images[0];
  const soldOut = product.stock_status !== "in_stock";
  const from = product.variants.length > 1;
  return (
    <article className="group relative flex flex-col">
      <div className="arch relative aspect-[4/5] bg-cream">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt_text ?? product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${soldOut ? "opacity-60 grayscale-[30%]" : ""}`}
            priority={priority}
            unoptimized={img.url.endsWith(".svg")}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">Photo coming soon</div>
        )}
        {soldOut && (
          <span className="absolute bottom-3 left-3 rounded-full bg-charcoal/85 px-3 py-1 text-xs font-medium text-ivory">
            {product.stock_status === "sold_out" ? "Sold out" : "Unavailable"}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-1">
        <h3 className="font-display text-xl leading-snug">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 hover:text-burgundy">
            {product.name}
          </Link>
        </h3>
        <p className="text-[0.95rem] text-muted">
          {from ? "From " : ""}
          <span className="font-medium text-charcoal">{formatINR(minPrice(product))}</span>
        </p>
        {product.is_sample && <p className="text-xs text-muted">Sample listing</p>}
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
