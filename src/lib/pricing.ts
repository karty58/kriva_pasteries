/**
 * Server-side cart pricing. The browser only sends IDs and quantities;
 * every price, option and availability check happens here against
 * trusted database records. Pure function => fully unit-tested.
 */
import type { FulfilmentMethod, Product, SiteSettings } from "./types";

export interface CartRequestLine {
  productId: string;
  variantId: string;
  flavourId: string | null;
  quantity: number;
  customMessage?: string | null;
  instructions?: string | null;
}

export interface PricedLine {
  product_id: string;
  variant_id: string;
  flavour_id: string | null;
  product_name: string;
  variant_label: string;
  flavour_name: string | null;
  unit_price_paise: number;
  quantity: number;
  line_total_paise: number;
  custom_message: string | null;
  instructions: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  requiresApproval: boolean;
  maxLeadTimeHours: number;
}

export class PricingError extends Error {
  constructor(
    public code:
      | "EMPTY_CART"
      | "TOO_MANY_LINES"
      | "PRODUCT_UNAVAILABLE"
      | "INVALID_OPTION"
      | "INVALID_QUANTITY"
      | "INSUFFICIENT_STOCK"
      | "MESSAGE_NOT_ALLOWED"
      | "MESSAGE_TOO_LONG"
      | "INSTRUCTIONS_TOO_LONG"
      | "BELOW_MINIMUM"
      | "FULFILMENT_UNAVAILABLE",
    message: string,
    public productName?: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export const MAX_CART_LINES = 30;
export const MAX_INSTRUCTIONS = 500;

function clean(s: string | null | undefined): string | null {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

export function priceCart(
  request: CartRequestLine[],
  catalogue: Map<string, Product>,
  settings: Pick<
    SiteSettings,
    | "delivery_fee_paise"
    | "free_delivery_above_paise"
    | "min_order_paise"
    | "approval_mode"
    | "default_lead_time_hours"
    | "pickup_enabled"
    | "delivery_enabled"
  >,
  fulfilment: FulfilmentMethod,
): PricedCart {
  if (!Array.isArray(request) || request.length === 0) {
    throw new PricingError("EMPTY_CART", "Your cart is empty.");
  }
  if (request.length > MAX_CART_LINES) {
    throw new PricingError("TOO_MANY_LINES", `Please order at most ${MAX_CART_LINES} different items at once.`);
  }
  if (fulfilment === "pickup" && !settings.pickup_enabled) {
    throw new PricingError("FULFILMENT_UNAVAILABLE", "Pickup is currently unavailable.");
  }
  if (fulfilment === "delivery" && !settings.delivery_enabled) {
    throw new PricingError("FULFILMENT_UNAVAILABLE", "Delivery is currently unavailable.");
  }

  const qtyByProduct = new Map<string, number>();
  const lines: PricedLine[] = [];
  let requiresApproval = settings.approval_mode === "approve_then_pay";
  let maxLead = settings.default_lead_time_hours;

  for (const req of request) {
    const product = catalogue.get(req.productId);
    if (!product || !product.is_active || product.stock_status !== "in_stock") {
      throw new PricingError(
        "PRODUCT_UNAVAILABLE",
        `${product?.name ?? "An item in your cart"} is no longer available. Please remove it to continue.`,
        product?.name,
      );
    }

    const variant = product.variants.find((v) => v.id === req.variantId && v.is_active);
    if (!variant) {
      throw new PricingError("INVALID_OPTION", `Please choose a valid size for ${product.name}.`, product.name);
    }

    const activeFlavours = product.flavours.filter((f) => f.is_active);
    let flavour = null as (typeof activeFlavours)[number] | null;
    if (req.flavourId) {
      flavour = activeFlavours.find((f) => f.id === req.flavourId) ?? null;
      if (!flavour) {
        throw new PricingError("INVALID_OPTION", `Please choose a valid flavour for ${product.name}.`, product.name);
      }
    } else if (activeFlavours.length > 0) {
      throw new PricingError("INVALID_OPTION", `Please choose a flavour for ${product.name}.`, product.name);
    }

    if (!Number.isInteger(req.quantity) || req.quantity < 1 || req.quantity > product.max_per_order) {
      throw new PricingError(
        "INVALID_QUANTITY",
        `Quantity for ${product.name} must be between 1 and ${product.max_per_order}.`,
        product.name,
      );
    }

    const runningQty = (qtyByProduct.get(product.id) ?? 0) + req.quantity;
    qtyByProduct.set(product.id, runningQty);
    if (product.stock_quantity !== null && runningQty > product.stock_quantity) {
      throw new PricingError(
        "INSUFFICIENT_STOCK",
        product.stock_quantity === 0
          ? `${product.name} is sold out.`
          : `Only ${product.stock_quantity} of ${product.name} available.`,
        product.name,
      );
    }

    const message = clean(req.customMessage);
    if (message && !product.allows_custom_message) {
      throw new PricingError("MESSAGE_NOT_ALLOWED", `${product.name} does not support a cake message.`, product.name);
    }
    if (message && message.length > product.max_message_length) {
      throw new PricingError(
        "MESSAGE_TOO_LONG",
        `Cake message for ${product.name} must be at most ${product.max_message_length} characters.`,
        product.name,
      );
    }
    const instructions = product.allows_instructions ? clean(req.instructions) : null;
    if (instructions && instructions.length > MAX_INSTRUCTIONS) {
      throw new PricingError("INSTRUCTIONS_TOO_LONG", `Instructions must be at most ${MAX_INSTRUCTIONS} characters.`);
    }

    const unit = variant.price_paise + (flavour?.extra_price_paise ?? 0);
    lines.push({
      product_id: product.id,
      variant_id: variant.id,
      flavour_id: flavour?.id ?? null,
      product_name: product.name,
      variant_label: variant.label,
      flavour_name: flavour?.name ?? null,
      unit_price_paise: unit,
      quantity: req.quantity,
      line_total_paise: unit * req.quantity,
      custom_message: message,
      instructions,
    });

    if (product.requires_approval) requiresApproval = true;
    maxLead = Math.max(maxLead, product.lead_time_hours);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.line_total_paise, 0);
  if (subtotal < settings.min_order_paise) {
    throw new PricingError("BELOW_MINIMUM", "Your order is below the minimum order value.");
  }

  let deliveryFee = 0;
  if (fulfilment === "delivery") {
    const free = settings.free_delivery_above_paise !== null && subtotal >= settings.free_delivery_above_paise;
    deliveryFee = free ? 0 : settings.delivery_fee_paise;
  }

  return {
    lines,
    subtotalPaise: subtotal,
    deliveryFeePaise: deliveryFee,
    totalPaise: subtotal + deliveryFee,
    requiresApproval,
    maxLeadTimeHours: maxLead,
  };
}
