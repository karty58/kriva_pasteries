import { NextResponse } from "next/server";
import { checkoutSchema, firstIssue } from "@/lib/validation";
import { placeOrder } from "@/lib/orders";
import { clientKey, errorResponse, isSameOrigin, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
    const parsed = checkoutSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      const issue = firstIssue(parsed.error);
      return NextResponse.json({ error: { code: "INVALID_INPUT", ...issue } }, { status: 400 });
    }
    const placed = await placeOrder(parsed.data, clientKey(req));
    return NextResponse.json(placed, { status: placed.duplicate ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
