"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentStatus } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    if (!existing) document.body.appendChild(s);
  });
}

type Phase = "idle" | "starting" | "open" | "verifying" | "checking";

export function OrderPaymentPanel({
  reference,
  token,
  canPay,
  payBlockedReason,
  paymentStatus,
  autoStart,
}: {
  reference: string;
  token: string;
  canPay: boolean;
  payBlockedReason: string | null;
  paymentStatus: PaymentStatus;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const started = useRef(false);

  const post = useCallback(
    async (url: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, token, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      return body;
    },
    [reference, token],
  );

  const checkStatus = useCallback(async () => {
    setPhase("checking");
    try {
      await post("/api/payments/reconcile");
      router.refresh();
      setMessage({ tone: "info", text: "Status updated from the payment provider." });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setPhase("idle");
    }
  }, [post, router]);

  const pay = useCallback(async () => {
    setMessage(null);
    setPhase("starting");
    try {
      const ok = await loadCheckout();
      if (!ok || !window.Razorpay) throw new Error("Couldn't load the secure payment window. Check your connection and try again.");
      const opts = await post("/api/payments/start");
      const rzp = new window.Razorpay({
        key: opts.keyId,
        order_id: opts.providerOrderId,
        amount: opts.amountPaise,
        currency: opts.currency,
        name: opts.name,
        description: opts.description,
        prefill: opts.prefill,
        theme: { color: "#6B1F2E" },
        // Show UPI (Google Pay and other UPI apps) first; other enabled methods stay available.
        config: {
          display: {
            blocks: { upi: { name: "Pay with Google Pay / UPI", instruments: [{ method: "upi" }] } },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // The payment window says it succeeded — we still verify on the server before showing "paid".
          setPhase("verifying");
          try {
            await post("/api/payments/verify", r);
            router.refresh();
          } catch (e) {
            setMessage({
              tone: "error",
              text: `${(e as Error).message} If money left your account, use “Check payment status” — it updates automatically once confirmed.`,
            });
          } finally {
            setPhase("idle");
          }
        },
        modal: {
          ondismiss: () => {
            setPhase("idle");
            setMessage({ tone: "info", text: "Payment window closed. Your order is saved — you can pay whenever you're ready." });
          },
        },
      });
      rzp.on("payment.failed", () => {
        setMessage({ tone: "error", text: "That payment attempt failed. No order is paid yet — you can try again." });
      });
      setPhase("open");
      rzp.open();
    } catch (e) {
      setPhase("idle");
      setMessage({ tone: "error", text: (e as Error).message });
    }
  }, [post, router]);

  useEffect(() => {
    if (autoStart && canPay && !started.current) {
      started.current = true;
      // Remove ?pay=1 so a refresh doesn't reopen the payment window.
      window.history.replaceState(null, "", `/order/${reference}?t=${encodeURIComponent(token)}`);
      pay();
    }
  }, [autoStart, canPay, pay, reference, token]);

  if (paymentStatus === "paid" || paymentStatus === "refunded") return null;

  const busy = phase !== "idle";
  return (
    <section aria-labelledby="pay-title" className="mt-8 rounded-md border border-brand/30 p-6">
      <h2 id="pay-title" className="font-display text-2xl">Payment</h2>
      {canPay ? (
        <>
          <p className="mt-2 text-muted">Pay with Google Pay or another UPI app through Razorpay&apos;s secure window. KRIVA never sees your UPI PIN.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>
              {phase === "starting" ? "Opening secure payment…" : phase === "verifying" ? "Verifying payment…" : paymentStatus === "failed" ? "Try payment again" : "Pay now with Google Pay / UPI"}
            </button>
            <button type="button" className="btn btn-outline" onClick={checkStatus} disabled={busy}>
              {phase === "checking" ? "Checking…" : "Check payment status"}
            </button>
          </div>
          <p className="hint mt-3">If Google Pay isn&apos;t shown on your device, choose any other UPI app or scan the UPI QR code in the payment window.</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">{payBlockedReason ?? "Online payment isn't available right now. KRIVA will contact you about payment."}</p>
          <button type="button" className="btn btn-outline mt-4" onClick={() => router.refresh()}>Refresh status</button>
        </>
      )}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-4 text-sm ${message.tone === "error" ? "text-danger" : "text-charcoal"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
