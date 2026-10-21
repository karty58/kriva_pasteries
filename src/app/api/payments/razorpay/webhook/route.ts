import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/signature";
import { fetchRazorpayPayment, getRazorpayConfig } from "@/lib/payments/razorpay";
import { applyProviderPayment } from "@/lib/payments/service";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook. Configure in Razorpay Dashboard → Webhooks with events:
 * payment.authorized, payment.captured, payment.failed, order.paid, refund.processed.
 *
 * Security: signature over the RAW body is verified with RAZORPAY_WEBHOOK_SECRET.
 * Idempotency: x-razorpay-event-id is recorded; repeats are acknowledged and skipped.
 * Truth: the payment is re-fetched from Razorpay's API before we change anything,
 * so out-of-order or stale events cannot regress state.
 */
export async function POST(req: Request) {
  const cfg = getRazorpayConfig();
  if (!cfg?.webhookSecret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"), cfg.webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; payload?: Record<string, { entity?: Record<string, unknown> }> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId) return NextResponse.json({ error: "missing event id" }, { status: 400 });

  const db = createServiceClient();
  const { data: inserted } = await db
    .from("payment_events")
    .upsert({ provider_event_id: eventId, event_type: event.event ?? "unknown", payload: event }, {
      onConflict: "provider_event_id",
      ignoreDuplicates: true,
    })
    .select("provider_event_id");
  if (!inserted?.length) {
    const { data: prior } = await db.from("payment_events").select("processed_at").eq("provider_event_id", eventId).single();
    if (prior?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    // previously received but not processed (e.g. crashed) — fall through and retry
  }

  try {
    const paymentEntity = event.payload?.payment?.entity as { id?: string } | undefined;
    const refundEntity = event.payload?.refund?.entity as { payment_id?: string } | undefined;
    const paymentId = paymentEntity?.id ?? refundEntity?.payment_id;
    let result = "ignored";
    if (paymentId) {
      const payment = await fetchRazorpayPayment(cfg, paymentId);
      const decision = await applyProviderPayment(payment);
      result = decision.kind;
    }
    await db.from("payment_events").update({ processed_at: new Date().toISOString(), result }).eq("provider_event_id", eventId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("webhook processing failed", e);
    // 500 => Razorpay retries later; the event row stays unprocessed.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
