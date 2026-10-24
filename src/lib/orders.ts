import "server-only";
import { isDemoMode } from "./env";
import { createServiceClient, isServiceConfigured } from "./supabase/service";
import { normaliseProduct, PRODUCT_SELECT } from "./catalogue";
import { DEFAULT_SETTINGS } from "./demo-data";
import { priceCart, PricingError } from "./pricing";
import { fromIstInput, validateRequestedTime } from "./schedule";
import { generateAccessToken, generateOrderReference, ORDER_REF_PATTERN, tokenMatches } from "./order-ref";
import type { CheckoutInput } from "./validation";
import type { OrderStatus, PaymentStatus, Product, SiteSettings } from "./types";
import { getRazorpayConfig } from "./payments/razorpay";

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true; // fail open on limiter errors, but log them
  }
  return data === true;
}

export async function loadServerSettings(): Promise<SiteSettings> {
  const { data, error } = await createServiceClient().from("site_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new CheckoutError("SETTINGS_UNAVAILABLE", "Ordering is temporarily unavailable.", 503);
  return { ...DEFAULT_SETTINGS, ...data } as SiteSettings;
}

export function onlinePaymentsAvailable(settings: SiteSettings): boolean {
  try {
    return settings.online_payments_enabled && getRazorpayConfig() !== null;
  } catch {
    return false;
  }
}

async function loadProducts(ids: string[]): Promise<Map<string, Product>> {
  const unique = [...new Set(ids)];
  const { data, error } = await createServiceClient().from("products").select(PRODUCT_SELECT).in("id", unique);
  if (error) throw new CheckoutError("CATALOGUE_UNAVAILABLE", "Could not check product availability.", 503);
  return new Map((data ?? []).map((row) => {
    const p = normaliseProduct(row);
    return [p.id, p];
  }));
}

export interface PlacedOrder {
  reference: string;
  token: string;
  requiresApproval: boolean;
  paymentMethod: "online" | "offline";
  totalPaise: number;
  duplicate: boolean;
}

export async function placeOrder(input: CheckoutInput, clientKey: string, now = new Date()): Promise<PlacedOrder> {
  if (isDemoMode()) {
    throw new CheckoutError("DEMO_MODE", "Online ordering is not connected yet. Please order on WhatsApp.", 503);
  }
  if (!isServiceConfigured()) {
    throw new CheckoutError("NOT_READY", "Website ordering opens soon. Please contact KRIVA directly.", 503);
  }
  if (!(await hitRateLimit(`checkout:ip:${clientKey}`, 10, 600)) ||
      !(await hitRateLimit(`checkout:phone:${input.customer.phone}`, 6, 600))) {
    throw new CheckoutError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);
  }

  const settings = await loadServerSettings();
  if (input.paymentMethod === "online" && !onlinePaymentsAvailable(settings)) {
    throw new CheckoutError("PAYMENT_METHOD_UNAVAILABLE", "Online UPI payment is not available right now.");
  }
  if (input.paymentMethod === "offline" && !settings.offline_payments_enabled) {
    throw new CheckoutError("PAYMENT_METHOD_UNAVAILABLE", "Please choose online payment.");
  }

  const catalogue = await loadProducts(input.items.map((i) => i.productId));
  let priced;
  try {
    priced = priceCart(input.items, catalogue, settings, input.fulfilment);
  } catch (e) {
    if (e instanceof PricingError) throw new CheckoutError(e.code, e.message);
    throw e;
  }

  if (input.fulfilment === "delivery" && settings.delivery_areas.length > 0) {
    if (!input.deliveryArea || !settings.delivery_areas.includes(input.deliveryArea)) {
      throw new CheckoutError("DELIVERY_AREA", "Please choose a delivery area we serve.");
    }
  }

  const requestedFor = fromIstInput(input.date, input.time);
  if (!requestedFor) throw new CheckoutError("INVALID_TIME", "Please choose a valid date and time.");
  const sched = validateRequestedTime(requestedFor, now, priced.maxLeadTimeHours, settings);
  if (!sched.ok) throw new CheckoutError(sched.code, sched.message);

  if (input.expectedTotalPaise !== priced.totalPaise) {
    throw new CheckoutError(
      "PRICE_CHANGED",
      "Prices or charges have changed since you added these items. Please review the updated total.",
      409,
      { totalPaise: priced.totalPaise, subtotalPaise: priced.subtotalPaise, deliveryFeePaise: priced.deliveryFeePaise },
    );
  }

  const db = createServiceClient();
  const { token, hash } = generateAccessToken();

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = generateOrderReference(now);
    const { error } = await db.rpc("create_order", {
      p_order: {
        reference,
        access_token_hash: hash,
        idempotency_key: input.idempotencyKey,
        customer_name: input.customer.name,
        customer_phone: input.customer.phone,
        customer_email: input.customer.email ?? "",
        fulfilment_method: input.fulfilment,
        delivery_address: input.fulfilment === "delivery" ? input.deliveryAddress : "",
        delivery_area: input.fulfilment === "delivery" ? input.deliveryArea ?? "" : "",
        requested_for: requestedFor.toISOString(),
        special_instructions: input.specialInstructions ?? "",
        subtotal_paise: priced.subtotalPaise,
        delivery_fee_paise: priced.deliveryFeePaise,
        total_paise: priced.totalPaise,
        payment_method: input.paymentMethod,
        requires_approval: priced.requiresApproval,
      },
      p_items: priced.lines,
    });
    if (!error) {
      return { reference, token, requiresApproval: priced.requiresApproval, paymentMethod: input.paymentMethod,
        totalPaise: priced.totalPaise, duplicate: false };
    }
    if (error.message.includes("idempotency_key")) {
      // Same submission arrived twice (double click / retry): return the existing order.
      const { data: existing } = await db.from("orders")
        .select("id, reference, requires_approval, payment_method, total_paise")
        .eq("idempotency_key", input.idempotencyKey).single();
      if (!existing) break;
      await db.from("orders").update({ access_token_hash: hash }).eq("id", existing.id);
      return { reference: existing.reference, token, requiresApproval: existing.requires_approval,
        paymentMethod: existing.payment_method, totalPaise: existing.total_paise, duplicate: true };
    }
    if (error.message.includes("OUT_OF_STOCK")) {
      throw new CheckoutError("INSUFFICIENT_STOCK", "Sorry, one of your items just sold out. Please review your cart.", 409);
    }
    if (error.message.includes("orders_reference_key")) continue; // reference collision: retry
    console.error("create_order failed", error.message);
    break;
  }
  throw new CheckoutError("ORDER_FAILED", "We could not place your order. Please try again.", 500);
}

// ---------------------------------------------------------------------
// Customer order view (by reference + secret token)
// ---------------------------------------------------------------------
export interface CustomerOrderView {
  id: string;
  reference: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: "online" | "offline";
  requires_approval: boolean;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfilment_method: "pickup" | "delivery";
  delivery_address: string | null;
  requested_for: string;
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  currency: string;
  rejection_reason: string | null;
  created_at: string;
  items: {
    product_name: string;
    variant_label: string;
    flavour_name: string | null;
    quantity: number;
    unit_price_paise: number;
    line_total_paise: number;
    custom_message: string | null;
  }[];
  latestPayment: { status: string; error_description: string | null } | null;
}

export async function getOrderForCustomer(reference: string, token: string | null | undefined) {
  if (isDemoMode() || !ORDER_REF_PATTERN.test(reference) || !token) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("orders")
    .select("*, items:order_items(product_name, variant_label, flavour_name, quantity, unit_price_paise, line_total_paise, custom_message)")
    .eq("reference", reference)
    .maybeSingle();
  if (!data || !tokenMatches(token, data.access_token_hash)) return null;
  const { data: tx } = await db
    .from("payment_transactions")
    .select("status, error_description")
    .eq("order_id", data.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { access_token_hash, idempotency_key, ...safe } = data;
  return { ...safe, latestPayment: tx ?? null } as CustomerOrderView;
}
