import { NextResponse } from "next/server";
import { z } from "zod";
import { cartItemSchema } from "@/lib/validation";
import { getAllProducts, getSettings } from "@/lib/catalogue";
import { priceCart, PricingError } from "@/lib/pricing";
import { errorResponse, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const quoteSchema = z.object({
  items: z.array(cartItemSchema).max(30),
  fulfilment: z.enum(["pickup", "delivery"]).default("pickup"),
});

/**
 * Returns server-calculated prices for the cart so the customer always
 * sees trusted totals. Also flags lines that are no longer available.
 */
export async function POST(req: Request) {
  try {
    const parsed = quoteSchema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid cart." } }, { status: 400 });
    const [products, settings] = await Promise.all([getAllProducts(), getSettings()]);
    const catalogue = new Map(products.map((p) => [p.id, p]));

    // Per-line availability (so the cart can show which item is the problem)
    const lineIssues: Record<number, string> = {};
    parsed.data.items.forEach((item, idx) => {
      try {
        priceCart([item], catalogue, { ...settings, min_order_paise: 0, pickup_enabled: true, delivery_enabled: true }, "pickup");
      } catch (e) {
        if (e instanceof PricingError) lineIssues[idx] = e.message;
      }
    });

    if (parsed.data.items.length === 0) {
      return NextResponse.json({ lines: [], subtotalPaise: 0, deliveryFeePaise: 0, totalPaise: 0, lineIssues });
    }
    try {
      const priced = priceCart(parsed.data.items, catalogue, settings, parsed.data.fulfilment);
      return NextResponse.json({ ...priced, lineIssues });
    } catch (e) {
      if (e instanceof PricingError) {
        return NextResponse.json({ error: { code: e.code, message: e.message }, lineIssues }, { status: 422 });
      }
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
