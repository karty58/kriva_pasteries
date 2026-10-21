"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { formatINR } from "@/lib/money";
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidWhatsAppNumber, makeEnquiryRef } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";
import { useCart } from "../cart/CartProvider";

export function ProductOptions({ product, whatsappNumber }: { product: Product; whatsappNumber: string | null }) {
  const { add } = useCart();
  const uid = useId();
  const variants = product.variants.filter((v) => v.is_active);
  const flavours = product.flavours.filter((f) => f.is_active);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [flavourId, setFlavourId] = useState<string | null>(flavours[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [added, setAdded] = useState(false);
  const [enquiryRef, setEnquiryRef] = useState("");
  // Generated after mount so server and client HTML match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setEnquiryRef(makeEnquiryRef()), []);

  const variant = variants.find((v) => v.id === variantId);
  const flavour = flavours.find((f) => f.id === flavourId) ?? null;
  const unit = (variant?.price_paise ?? 0) + (flavour?.extra_price_paise ?? 0);
  const available = product.stock_status === "in_stock" && !!variant;
  const maxQty = Math.min(product.max_per_order, product.stock_quantity ?? product.max_per_order);

  const whatsappHref = (() => {
    if (!isValidWhatsAppNumber(whatsappNumber) || !variant) return null;
    const msg = buildWhatsAppMessage({
      enquiryRef,
      lines: [{
        name: product.name,
        variantLabel: variant.label,
        flavourName: flavour?.name,
        quantity: qty,
        unitPricePaise: unit,
        customMessage: message.trim() || null,
        instructions: instructions.trim() || null,
      }],
    });
    return buildWhatsAppUrl(whatsappNumber, msg);
  })();

  function handleAdd() {
    if (!available || !variant) return;
    add({
      productId: product.id,
      variantId: variant.id,
      flavourId: flavour?.id ?? null,
      quantity: qty,
      customMessage: product.allows_custom_message ? message.trim() || undefined : undefined,
      instructions: product.allows_instructions ? instructions.trim() || undefined : undefined,
      display: {
        name: product.name,
        slug: product.slug,
        variantLabel: variant.label,
        flavourName: flavour?.name ?? null,
        unitPricePaise: unit,
        imageUrl: product.images[0]?.url ?? null,
      },
    });
    setAdded(true);
  }

  return (
    <div className="space-y-7">
      <p className="font-display text-4xl" aria-live="polite">
        {variant ? formatINR(unit) : "—"}
      </p>

      {!available && (
        <p className="rounded-md bg-cream px-4 py-3 font-medium">
          {product.stock_status === "sold_out" ? "Sold out for now." : "Currently unavailable."}{" "}
          <span className="font-normal text-muted">You can still ask us on WhatsApp about the next batch.</span>
        </p>
      )}

      {variants.length > 1 && (
        <fieldset>
          <legend className="label">Size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label key={v.id} className={`cursor-pointer rounded-full border px-4 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-burgundy ${variantId === v.id ? "border-burgundy bg-burgundy text-ivory" : "border-cream-deep hover:border-burgundy"}`}>
                <input type="radio" name={`${uid}-size`} value={v.id} checked={variantId === v.id} onChange={() => setVariantId(v.id)} className="sr-only" />
                {v.label} · {formatINR(v.price_paise)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {flavours.length > 0 && (
        <fieldset>
          <legend className="label">Flavour</legend>
          <div className="flex flex-wrap gap-2">
            {flavours.map((f) => (
              <label key={f.id} className={`cursor-pointer rounded-full border px-4 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-burgundy ${flavourId === f.id ? "border-burgundy bg-burgundy text-ivory" : "border-cream-deep hover:border-burgundy"}`}>
                <input type="radio" name={`${uid}-flavour`} value={f.id} checked={flavourId === f.id} onChange={() => setFlavourId(f.id)} className="sr-only" />
                {f.name}
                {f.extra_price_paise > 0 && ` (+${formatINR(f.extra_price_paise)})`}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {product.allows_custom_message && (
        <div>
          <label htmlFor={`${uid}-msg`} className="label">Message on the cake (optional)</label>
          <input id={`${uid}-msg`} className="field" value={message} maxLength={product.max_message_length}
            onChange={(e) => setMessage(e.target.value)} placeholder="Happy Birthday, Anu!" />
          <p className="hint mt-1">{message.length}/{product.max_message_length} characters</p>
        </div>
      )}

      {product.allows_instructions && (
        <div>
          <label htmlFor={`${uid}-notes`} className="label">Special instructions (optional)</label>
          <textarea id={`${uid}-notes`} className="field min-h-20" value={instructions} maxLength={500}
            onChange={(e) => setInstructions(e.target.value)} placeholder="Colours, eggless preference, candles…" />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${uid}-qty`} className="label">Quantity</label>
          <div className="flex items-center rounded-full border border-cream-deep">
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={qty <= 1}>−</button>
            <input id={`${uid}-qty`} type="number" inputMode="numeric" min={1} max={maxQty} value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
              className="w-12 bg-transparent text-center [appearance:textfield]" />
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity" disabled={qty >= maxQty}>+</button>
          </div>
        </div>
        <button type="button" className="btn btn-primary flex-1 sm:flex-none" onClick={handleAdd} disabled={!available}>
          Add to cart · {formatINR(unit * qty)}
        </button>
      </div>

      {added && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-cream px-4 py-3 text-sm">
          Added to your cart.
          <Link href="/cart" className="font-medium text-burgundy underline underline-offset-4">View cart</Link>
          <Link href="/collection" className="underline underline-offset-4">Continue shopping</Link>
        </p>
      )}

      <div className="border-t border-cream-deep pt-6">
        {whatsappHref ? (
          <>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">Order on WhatsApp</a>
            <p className="hint mt-2">
              Opens WhatsApp with your selection filled in. This is an enquiry — KRIVA will reply to confirm availability, price and payment.
            </p>
          </>
        ) : (
          <p className="hint">WhatsApp ordering will appear here once KRIVA adds its WhatsApp number.</p>
        )}
      </div>
    </div>
  );
}
