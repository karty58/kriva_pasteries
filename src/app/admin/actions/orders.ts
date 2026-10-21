"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { reconcileOrderPayments, refundOrder } from "@/lib/payments/service";
import type { ActionState } from "./products";

const NEXT_STATUS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
} as const;

export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  const to = z.enum(["confirmed", "preparing", "ready", "completed", "cancelled"]).parse(formData.get("to"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  const { data: order } = await supabase.from("orders").select("status").eq("id", id).single();
  if (!order) return { error: "Order not found." };
  const allowed = NEXT_STATUS[order.status as keyof typeof NEXT_STATUS] as readonly string[];
  if (!allowed.includes(to)) return { error: `An order that is ${order.status} can't be moved to ${to}.` };
  if (to === "cancelled" && !reason) return { error: "Add a short reason the customer will see." };

  const { error } = await supabase
    .from("orders")
    .update({ status: to, ...(to === "cancelled" ? { rejection_reason: reason } : {}) })
    .eq("id", id)
    .eq("status", order.status); // optimistic concurrency
  if (error) return { error: error.message };
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: `Order marked ${to}.` };
}

/** For "arrange with KRIVA" orders only. Online payments are gateway-controlled (enforced in the database too). */
export async function recordOfflinePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  const to = z.enum(["paid", "pending", "refunded"]).parse(formData.get("to"));
  const { data: order } = await supabase.from("orders").select("payment_method").eq("id", id).single();
  if (!order) return { error: "Order not found." };
  if (order.payment_method !== "offline") return { error: "Online payments update automatically from Razorpay." };
  const { error } = await supabase.from("orders").update({ payment_status: to }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: `Payment recorded as ${to}.` };
}

export async function reconcilePayments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  try {
    const results = await reconcileOrderPayments(id);
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: results.length ? "Payment status refreshed from Razorpay." : "No payment attempts found on Razorpay yet." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function refundPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminAction();
  const id = z.uuid().parse(formData.get("id"));
  if (formData.get("confirm") !== "REFUND") return { error: 'Type REFUND to confirm.' };
  try {
    await refundOrder(id);
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: "Refund requested. The order updates to Refunded when Razorpay confirms it." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
