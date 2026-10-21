import { NextResponse } from "next/server";
import { z } from "zod";
import { startOnlinePayment } from "@/lib/payments/service";
import { errorResponse, isSameOrigin, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().max(40), token: z.string().min(10).max(100) });

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid request." } }, { status: 400 });
    const options = await startOnlinePayment(parsed.data.reference, parsed.data.token);
    return NextResponse.json(options);
  } catch (e) {
    return errorResponse(e);
  }
}
