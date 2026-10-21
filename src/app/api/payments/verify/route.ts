import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCheckoutPayment } from "@/lib/payments/service";
import { errorResponse, isSameOrigin, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().max(40),
  token: z.string().min(10).max(100),
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Receives Razorpay Checkout's success callback. The client's claim is NOT
 * trusted: we verify the HMAC signature and then fetch the payment from
 * Razorpay's API before changing anything.
 */
export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid payment response." } }, { status: 400 });
    const d = parsed.data;
    const decision = await verifyCheckoutPayment({
      reference: d.reference,
      token: d.token,
      razorpayOrderId: d.razorpay_order_id,
      razorpayPaymentId: d.razorpay_payment_id,
      razorpaySignature: d.razorpay_signature,
    });
    return NextResponse.json({ result: decision.kind });
  } catch (e) {
    return errorResponse(e);
  }
}
