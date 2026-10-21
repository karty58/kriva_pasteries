"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatINR } from "@/lib/money";
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidWhatsAppNumber, makeEnquiryRef } from "@/lib/whatsapp";
import { useCart } from "./CartProvider";
import { useQuote } from "./useQuote";

export function CartView({
  whatsappNumber,
  deliveryEnabled,
  pickupEnabled,
  checkoutAvailable,
}: {
  whatsappNumber: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  checkoutAvailable: boolean;
}) {
  const { lines, ready, setQuantity, remove } = useCart();
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">(pickupEnabled ? "pickup" : "delivery");
  const { quote, loading, failed } = useQuote(lines, fulfilment, ready);
  const [enquiryRef, setEnquiryRef] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setEnquiryRef(makeEnquiryRef()), []);

  const hasIssues = !!quote && Object.keys(quote.lineIssues).length > 0;

  const whatsappHref = useMemo(() => {
    if (!isValidWhatsAppNumber(whatsappNumber) || lines.length === 0) return null;
    const msg = buildWhatsAppMessage({
      enquiryRef,
      fulfilment,
      lines: lines.map((l, i) => ({
        name: l.display.name,
        variantLabel: l.display.variantLabel,
        flavourName: l.display.flavourName,
        quantity: l.quantity,
        // prefer server-verified unit prices when we have them
        unitPricePaise: quote?.lines?.[i]?.unit_price_paise ?? l.display.unitPricePaise,
        customMessage: l.customMessage,
        instructions: l.instructions,
      })),
    });
    return buildWhatsAppUrl(whatsappNumber, msg);
  }, [whatsappNumber, lines, enquiryRef, fulfilment, quote]);

  if (!ready) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-muted" role="status">Loading your cart…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-5xl text-burgundy">Your cart is empty</h1>
        <p className="mt-4 text-muted">Pick a cake or a box of pastries to get started.</p>
        <Link href="/collection" className="btn btn-primary mt-8">Explore the collection</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-5xl text-burgundy">Your cart</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y divide-cream-deep border-y border-cream-deep">
          {lines.map((l, i) => {
            const serverLine = quote?.lines?.[i];
            const issue = quote?.lineIssues[i];
            const unit = serverLine?.unit_price_paise ?? l.display.unitPricePaise;
            return (
              <li key={l.key} className="grid grid-cols-[5rem_1fr] gap-4 py-6 sm:grid-cols-[6rem_1fr_auto]">
                <div className="arch relative aspect-[4/5] bg-cream">
                  {l.display.imageUrl && (
                    <Image src={l.display.imageUrl} alt="" fill sizes="96px" className="object-cover" unoptimized={l.display.imageUrl.endsWith(".svg")} />
                  )}
                </div>
                <div>
                  <Link href={`/product/${l.display.slug}`} className="font-display text-xl hover:text-burgundy">{l.display.name}</Link>
                  <p className="text-sm text-muted">
                    {[l.display.variantLabel, l.display.flavourName].filter(Boolean).join(", ")}
                  </p>
                  {l.customMessage && <p className="mt-1 text-sm">Message: “{l.customMessage}”</p>}
                  {l.instructions && <p className="mt-1 text-sm text-muted">Notes: {l.instructions}</p>}
                  <p className="mt-1 text-sm">{formatINR(unit)} each</p>
                  {issue && <p className="mt-2 text-sm font-medium text-danger" role="alert">{issue}</p>}
                  <div className="mt-3 flex items-center gap-4">
                    <label className="sr-only" htmlFor={`qty-${l.key}`}>Quantity for {l.display.name}</label>
                    <div className="flex items-center rounded-full border border-cream-deep">
                      <button type="button" className="h-10 w-10" aria-label="Decrease quantity" disabled={l.quantity <= 1} onClick={() => setQuantity(l.key, l.quantity - 1)}>−</button>
                      <input id={`qty-${l.key}`} type="number" min={1} max={100} value={l.quantity}
                        onChange={(e) => setQuantity(l.key, Number(e.target.value) || 1)}
                        className="w-10 bg-transparent text-center [appearance:textfield]" />
                      <button type="button" className="h-10 w-10" aria-label="Increase quantity" onClick={() => setQuantity(l.key, l.quantity + 1)}>+</button>
                    </div>
                    <button type="button" className="text-sm text-muted underline underline-offset-4 hover:text-danger" onClick={() => remove(l.key)}>
                      Remove
                    </button>
                  </div>
                </div>
                <p className="col-start-2 font-medium sm:col-start-3 sm:text-right">{formatINR(serverLine?.line_total_paise ?? unit * l.quantity)}</p>
              </li>
            );
          })}
        </ul>

        <aside aria-labelledby="summary-title" className="h-fit rounded-md bg-cream p-6">
          <h2 id="summary-title" className="font-display text-2xl">Order summary</h2>

          {pickupEnabled && deliveryEnabled && (
            <fieldset className="mt-5">
              <legend className="label">How would you like it?</legend>
              <div className="flex gap-2">
                {(["pickup", "delivery"] as const).map((m) => (
                  <label key={m} className={`flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-burgundy ${fulfilment === m ? "border-burgundy bg-burgundy text-ivory" : "border-cream-deep bg-ivory"}`}>
                    <input type="radio" className="sr-only" name="fulfilment" checked={fulfilment === m} onChange={() => setFulfilment(m)} />
                    {m === "pickup" ? "Pickup" : "Delivery"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <dl className="mt-6 space-y-2 text-[0.95rem]" aria-busy={loading}>
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{quote && !quote.error ? formatINR(quote.subtotalPaise) : "—"}</dd></div>
            <div className="flex justify-between">
              <dt>{fulfilment === "delivery" ? "Delivery" : "Pickup"}</dt>
              <dd>{quote && !quote.error ? (quote.deliveryFeePaise ? formatINR(quote.deliveryFeePaise) : "Free") : "—"}</dd>
            </div>
            <div className="flex justify-between border-t border-cream-deep pt-3 text-lg font-medium">
              <dt>Total</dt><dd>{quote && !quote.error ? formatINR(quote.totalPaise) : "—"}</dd>
            </div>
          </dl>
          {loading && <p className="hint mt-2" role="status">Checking latest prices…</p>}
          {failed && <p className="mt-3 text-sm text-danger" role="alert">We couldn&apos;t check prices just now. Please refresh the page.</p>}
          {quote?.error && !hasIssues && <p className="mt-3 text-sm text-danger" role="alert">{quote.error.message}</p>}

          <div className="mt-6 space-y-3">
            {checkoutAvailable ? (
              <Link
                href={`/checkout?fulfilment=${fulfilment}`}
                className="btn btn-primary w-full"
                aria-disabled={hasIssues || !!quote?.error || !quote}
                onClick={(e) => (hasIssues || quote?.error || !quote) && e.preventDefault()}
              >
                Proceed to checkout
              </Link>
            ) : (
              <p className="rounded-md bg-ivory px-3 py-2 text-sm text-muted">
                Website checkout is not connected yet — please order on WhatsApp.
              </p>
            )}
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full">Order on WhatsApp</a>
            ) : (
              <p className="hint">WhatsApp ordering appears once KRIVA adds its WhatsApp number.</p>
            )}
            <p className="hint">
              WhatsApp orders are enquiries: KRIVA replies to confirm availability, the final price and how to pay. Nothing is charged until then.
            </p>
            <Link href="/collection" className="block pt-2 text-center text-sm underline underline-offset-4">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
