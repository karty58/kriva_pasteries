"use client";
import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div>
      <div className="arch relative aspect-[4/5] bg-cream">
        {current ? (
          <Image
            src={current.url}
            alt={current.alt_text ?? name}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            unoptimized={current.url.endsWith(".svg")}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">Photo coming soon</div>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-4 flex gap-3" aria-label="More photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={`relative block h-20 w-16 overflow-hidden rounded-md border-2 ${i === active ? "border-burgundy" : "border-transparent"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" unoptimized={img.url.endsWith(".svg")} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
