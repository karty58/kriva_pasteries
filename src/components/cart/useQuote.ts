"use client";
import { useEffect, useState } from "react";
import type { CartLine } from "@/lib/types";

export interface Quote {
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  requiresApproval?: boolean;
  maxLeadTimeHours?: number;
  lines?: { unit_price_paise: number; line_total_paise: number }[];
  lineIssues: Record<number, string>;
  error?: { code: string; message: string };
}

export function toRequestItems(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    flavourId: l.flavourId,
    quantity: l.quantity,
    customMessage: l.customMessage ?? null,
    instructions: l.instructions ?? null,
  }));
}

/** Server-calculated totals for the current cart (the browser's prices are display-only). */
export function useQuote(lines: CartLine[], fulfilment: "pickup" | "delivery", ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: toRequestItems(lines), fulfilment }),
          signal: ctrl.signal,
        });
        const body = await res.json();
        if (res.ok) setQuote(body);
        else if (res.status === 422) setQuote({ subtotalPaise: 0, deliveryFeePaise: 0, totalPaise: 0, lineIssues: body.lineIssues ?? {}, error: body.error });
        else setFailed(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [lines, fulfilment, ready]);

  return { quote, loading, failed };
}
