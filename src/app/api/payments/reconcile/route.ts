import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileForCustomer } from "@/lib/payments/service";
import { errorResponse, isSameOrigin, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().max(40), token: z.string().min(10).max(100) });

/** "Check payment status" — asks Razorpay directly (handles delayed UPI confirmations). */
export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid request." } }, { status: 400 });
    await reconcileForCustomer(parsed.data.reference, parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
