import { z } from "zod";

/** Normalise Indian mobile numbers: "+91 98765 43210" -> "9876543210". */
export function normaliseIndianMobile(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const cartItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  flavourId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(100),
  customMessage: optionalText(120),
  instructions: optionalText(500),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.uuid(),
    customer: z.object({
      name: z.string().trim().min(2, "Please enter your name.").max(80),
      phone: z
        .string()
        .transform(normaliseIndianMobile)
        .refine((v) => /^[6-9]\d{9}$/.test(v), "Please enter a valid 10-digit Indian mobile number."),
      email: z
        .union([z.literal(""), z.email("Please enter a valid email address.").max(200)])
        .optional()
        .nullable()
        .transform((v) => (v ? v : null)),
    }),
    fulfilment: z.enum(["pickup", "delivery"]),
    deliveryAddress: optionalText(500),
    deliveryArea: optionalText(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a date."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Please choose a time."),
    specialInstructions: optionalText(1000),
    paymentMethod: z.enum(["online", "offline"]),
    expectedTotalPaise: z.number().int().positive(),
    items: z.array(cartItemSchema).min(1, "Your cart is empty.").max(30),
    // Honeypot: real customers never see or fill this field.
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "delivery" && (!v.deliveryAddress || v.deliveryAddress.length < 10)) {
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Please enter your full delivery address." });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function firstIssue(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  return { field: issue?.path.join(".") ?? "", message: issue?.message ?? "Invalid input." };
}

// ---------------------------------------------------------------------
// Admin forms
// ---------------------------------------------------------------------
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
  .max(120);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Check the declared type, size AND the file's magic bytes. */
export function validateImageUpload(
  file: { type: string; size: number },
  head: Uint8Array,
): { ok: true; ext: string } | { ok: false; message: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, message: "Please upload a JPG, PNG, WebP or AVIF image." };
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Images must be smaller than 5 MB." };
  }
  const b = head;
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
  const isAvif = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70; // "ftyp"
  const matches =
    (file.type === "image/jpeg" && isJpeg) ||
    (file.type === "image/png" && isPng) ||
    (file.type === "image/webp" && isWebp) ||
    (file.type === "image/avif" && isAvif);
  if (!matches) return { ok: false, message: "This file does not look like a valid image." };
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[file.type]!;
  return { ok: true, ext };
}
