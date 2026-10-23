"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { istParts } from "@/lib/schedule";
import type { ApprovalMode, BusinessHours } from "@/lib/types";
import { useCart } from "../cart/CartProvider";
import { toRequestItems, useQuote } from "../cart/useQuote";
import { formatTime } from "../BusinessInfo";

type Fulfilment = "pickup" | "delivery";

const STEPS = ["Your details", "Pickup or delivery", "Payment", "Review"];

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));
}

export function CheckoutForm(props: {
  initialFulfilment: Fulfilment;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryAreas: string[];
  onlineAvailable: boolean;
  offlineAvailable: boolean;
  approvalMode: ApprovalMode;
  maxAdvanceDays: number;
  businessHours: BusinessHours | null;
}) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const [fulfilment, setFulfilment] = useState<Fulfilment>(
    props.initialFulfilment === "delivery" && props.deliveryEnabled ? "delivery" : props.pickupEnabled ? "pickup" : "delivery",
  );
  const { quote, loading } = useQuote(lines, fulfilment, ready);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "offline">(props.onlineAvailable ? "online" : "offline");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const idempotencyKey = useRef<string>("");
  const errorRef = useRef<HTMLDivElement>(null);

  // A new idempotency key whenever the cart or totals change; the same key is
  // reused for retries/double-clicks of the same submission.
  useEffect(() => {
    idempotencyKey.current = newKey();
  }, [lines, fulfilment, paymentMethod]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const [today, setToday] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(istParts(new Date()).date), []);
  const maxDate = useMemo(() => {
    if (!today) return undefined;
    const d = new Date(`${today}T12:00:00+05:30`);
    d.setDate(d.getDate() + props.maxAdvanceDays);
    return istParts(d).date;
  }, [today, props.maxAdvanceDays]);

  const needsApproval = props.approvalMode === "approve_then_pay" || !!quote?.requiresApproval;
  const lead = quote?.maxLeadTimeHours ?? 0;

  if (!ready) return <div className="mx-auto max-w-5xl px-4 py-20 text-muted" role="status">Loading…</div>;
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-5xl text-brand">Your cart is empty</h1>
        <Link href="/collection" className="btn btn-primary mt-8">Explore the collection</Link>
      </div>
    );
  }
  if (!props.onlineAvailable && !props.offlineAvailable) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl text-brand">Website orders are paused</h1>
        <p className="mt-4 text-muted">Please order on WhatsApp from your cart for now.</p>
        <Link href="/cart" className="btn btn-primary mt-8">Back to cart</Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !quote || quote.error) return;
    setError(null);
    const f = new FormData(e.currentTarget);
    const payload = {
      idempotencyKey: idempotencyKey.current,
      customer: {
        name: String(f.get("name") ?? ""),
        phone: String(f.get("phone") ?? ""),
        email: String(f.get("email") ?? ""),
      },
      fulfilment,
      deliveryAddress: fulfilment === "delivery" ? String(f.get("address") ?? "") : null,
      deliveryArea: fulfilment === "delivery" ? String(f.get("area") ?? "") || null : null,
      date: String(f.get("date") ?? ""),
      time: String(f.get("time") ?? ""),
      specialInstructions: String(f.get("notes") ?? ""),
      paymentMethod,
      expectedTotalPaise: quote.totalPaise,
      items: toRequestItems(lines),
      website: String(f.get("website") ?? ""),
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError({ field: body.error?.field, message: body.error?.message ?? "We could not place your order." });
        setSubmitting(false);
        return;
      }
      clear();
      const startPay = body.paymentMethod === "online" && !body.requiresApproval;
      router.push(`/order/${body.reference}?t=${encodeURIComponent(body.token)}${startPay ? "&pay=1" : ""}`);
    } catch {
      setError({ message: "Network problem — please check your connection and try again." });
      setSubmitting(false);
    }
  }

  const invalid = (name: string) => (error?.field?.endsWith(name) ? true : undefined);
  const hoursHint = props.businessHours && Object.keys(props.businessHours).length > 0
    ? Object.entries(props.businessHours).filter(([, v]) => v).slice(0, 1).map(([, v]) => `Usual hours ${formatTime(v!.open)}–${formatTime(v!.close)}.`)[0]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-5xl text-brand">Checkout</h1>
      <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-brand/40 text-xs text-brand">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-12">
          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-danger">
              {error.message}
            </div>
          )}

          <fieldset className="space-y-5">
            <legend className="mb-2 font-display text-3xl">1. Your details</legend>
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <input id="name" name="name" required minLength={2} maxLength={80} autoComplete="name" className="field" aria-invalid={invalid("name")} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="label">Mobile number</label>
                <input id="phone" name="phone" required inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" className="field" aria-invalid={invalid("phone")} aria-describedby="phone-hint" />
                <p id="phone-hint" className="hint mt-1">We&apos;ll use this only about your order.</p>
              </div>
              <div>
                <label htmlFor="email" className="label">Email (optional)</label>
                <input id="email" name="email" type="email" autoComplete="email" maxLength={200} className="field" aria-invalid={invalid("email")} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-2 font-display text-3xl">2. Pickup or delivery</legend>
            {props.pickupEnabled && props.deliveryEnabled && (
              <div className="flex gap-2">
                {(["pickup", "delivery"] as const).map((m) => (
                  <label key={m} className={`cursor-pointer rounded-full border px-5 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${fulfilment === m ? "border-brand bg-brand text-ivory" : "border-cream-deep"}`}>
                    <input type="radio" className="sr-only" name="fulfilment" checked={fulfilment === m} onChange={() => setFulfilment(m)} />
                    {m === "pickup" ? "Pickup from shop" : "Delivery"}
                  </label>
                ))}
              </div>
            )}
            {fulfilment === "delivery" && (
              <>
                {props.deliveryAreas.length > 0 && (
                  <div>
                    <label htmlFor="area" className="label">Delivery area</label>
                    <select id="area" name="area" required className="field" aria-invalid={invalid("deliveryArea")} defaultValue="">
                      <option value="" disabled>Choose your area</option>
                      {props.deliveryAreas.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="address" className="label">Delivery address</label>
                  <textarea id="address" name="address" required minLength={10} maxLength={500} autoComplete="street-address" className="field min-h-24" aria-invalid={invalid("deliveryAddress")} />
                </div>
              </>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="date" className="label">{fulfilment === "pickup" ? "Pickup" : "Delivery"} date</label>
                <input id="date" name="date" type="date" required min={today || undefined} max={maxDate} className="field" aria-invalid={invalid("date")} />
              </div>
              <div>
                <label htmlFor="time" className="label">Preferred time</label>
                <input id="time" name="time" type="time" required step={900} className="field" aria-invalid={invalid("time")} />
              </div>
            </div>
            <p className="hint">
              {lead > 0 ? `Your items need at least ${lead >= 24 ? `${Math.round(lead / 24)} day(s)` : `${lead} hours`} notice. ` : ""}
              {hoursHint} This is a requested time — KRIVA confirms it with you.
            </p>
            <div>
              <label htmlFor="notes" className="label">Anything else we should know? (optional)</label>
              <textarea id="notes" name="notes" maxLength={1000} className="field min-h-20" />
            </div>
            {/* Honeypot for bots — hidden from people and screen readers */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-display text-3xl">3. Payment</legend>
            {props.onlineAvailable && (
              <label className={`flex cursor-pointer gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${paymentMethod === "online" ? "border-brand bg-cream" : "border-cream-deep"}`}>
                <input type="radio" name="payment" className="mt-1 accent-brand" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} />
                <span>
                  <span className="block font-medium">Google Pay / UPI</span>
                  <span className="hint block">
                    Pay securely through Razorpay with Google Pay or another UPI app. Available options depend on your device and bank.
                    {needsApproval && " You'll be able to pay once KRIVA confirms your order."}
                  </span>
                </span>
              </label>
            )}
            {props.offlineAvailable && (
              <label className={`flex cursor-pointer gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${paymentMethod === "offline" ? "border-brand bg-cream" : "border-cream-deep"}`}>
                <input type="radio" name="payment" className="mt-1 accent-brand" checked={paymentMethod === "offline"} onChange={() => setPaymentMethod("offline")} />
                <span>
                  <span className="block font-medium">Arrange payment with KRIVA</span>
                  <span className="hint block">Send your order request now; KRIVA contacts you to confirm and arrange payment.</span>
                </span>
              </label>
            )}
            {!props.onlineAvailable && (
              <p className="hint">Online UPI payment isn&apos;t available right now.</p>
            )}
          </fieldset>
        </div>

        <aside aria-labelledby="review-title" className="h-fit rounded-md bg-cream p-6 lg:sticky lg:top-24">
          <h2 id="review-title" className="font-display text-2xl">4. Review</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {lines.map((l, i) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span>
                  {l.display.name} <span className="text-muted">({[l.display.variantLabel, l.display.flavourName].filter(Boolean).join(", ")}) × {l.quantity}</span>
                  {quote?.lineIssues[i] && <span className="block text-danger">{quote.lineIssues[i]}</span>}
                </span>
                <span>{quote?.lines?.[i] ? formatINR(quote.lines[i].line_total_paise) : "—"}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-cream-deep pt-4 text-[0.95rem]" aria-busy={loading}>
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{quote && !quote.error ? formatINR(quote.subtotalPaise) : "—"}</dd></div>
            <div className="flex justify-between"><dt>{fulfilment === "delivery" ? "Delivery" : "Pickup"}</dt><dd>{quote && !quote.error ? (quote.deliveryFeePaise ? formatINR(quote.deliveryFeePaise) : "Free") : "—"}</dd></div>
            <div className="flex justify-between border-t border-cream-deep pt-3 text-lg font-medium"><dt>Total</dt><dd>{quote && !quote.error ? formatINR(quote.totalPaise) : "—"}</dd></div>
          </dl>
          {quote?.error && <p className="mt-3 text-sm text-danger" role="alert">{quote.error.message}</p>}
          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={submitting || loading || !quote || !!quote.error}>
            {submitting
              ? "Sending…"
              : paymentMethod === "online" && !needsApproval
                ? "Place order & pay"
                : "Send order request"}
          </button>
          <p className="hint mt-3">
            Your order is confirmed only when KRIVA accepts it. By continuing you agree to our{" "}
            <Link href="/terms" className="underline">terms</Link> and{" "}
            <Link href="/refund-policy" className="underline">cancellation policy</Link>.
          </p>
        </aside>
      </form>
    </div>
  );
}
