"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { ORDERED_DAYS } from "@/lib/schedule";
import { normaliseIndianMobile } from "@/lib/validation";
import type { ActionState } from "./products";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const url = z.string().trim().max(500).refine((v) => !v || /^https:\/\/\S+$/.test(v), "Links must start with https://").transform((v) => v || null);

const schema = z.object({
  tagline: text(200),
  address: text(500),
  maps_url: url,
  phone: text(30),
  whatsapp_number: z.string().trim().max(20),
  email: z.union([z.literal(""), z.email("Enter a valid email.")]).transform((v) => v || null),
  instagram_url: url,
  facebook_url: url,
  our_story: text(4000),
  seasonal_note: text(300),
  delivery_areas: z.string().max(2000),
  delivery_fee: z.string().trim(),
  free_delivery_above: z.string().trim(),
  min_order: z.string().trim(),
  default_lead_time_hours: z.coerce.number().int().min(0).max(720),
  order_cutoff_time: z.string().trim().refine((v) => !v || /^\d{2}:\d{2}$/.test(v), "Cutoff time must be HH:MM."),
  max_advance_days: z.coerce.number().int().min(1).max(365),
  approval_mode: z.enum(["pay_immediately", "approve_then_pay"]),
  intro_video_url: url,
  intro_poster_url: url,
  testimonials: z.string().max(8000),
});

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdminAction();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // WhatsApp: digits with country code. Accept "98765 43210" and assume India (+91).
  let whatsapp: string | null = null;
  if (d.whatsapp_number) {
    const digits = d.whatsapp_number.replace(/\D/g, "");
    whatsapp = digits.length === 10 ? `91${normaliseIndianMobile(digits)}` : digits;
    if (!/^[1-9]\d{9,14}$/.test(whatsapp)) return { error: "WhatsApp number: enter it with country code, e.g. 91 98765 43210." };
  }

  const hours: Record<string, { open: string; close: string } | null> = {};
  for (const day of ORDERED_DAYS) {
    const open = String(formData.get(`hours_${day}_open`) ?? "");
    const close = String(formData.get(`hours_${day}_close`) ?? "");
    const closed = formData.get(`hours_${day}_closed`) === "on";
    if (closed) hours[day] = null;
    else if (open && close) {
      if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close) {
        return { error: `Check the opening hours for ${day}.` };
      }
      hours[day] = { open, close };
    }
  }

  let money;
  try {
    money = {
      delivery_fee_paise: d.delivery_fee ? rupeesToPaise(d.delivery_fee) : 0,
      free_delivery_above_paise: d.free_delivery_above ? rupeesToPaise(d.free_delivery_above) : null,
      min_order_paise: d.min_order ? rupeesToPaise(d.min_order) : 0,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }

  const testimonials = d.testimonials
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const name = lines.length > 1 ? lines.pop()!.replace(/^[-—]\s*/, "").trim() : "";
      return { quote: lines.join(" ").trim().slice(0, 500), name: name.slice(0, 80) };
    })
    .slice(0, 12);

  const { error } = await supabase
    .from("site_settings")
    .update({
      tagline: d.tagline,
      address: d.address,
      maps_url: d.maps_url,
      phone: d.phone,
      whatsapp_number: whatsapp,
      email: d.email,
      instagram_url: d.instagram_url,
      facebook_url: d.facebook_url,
      our_story: d.our_story,
      seasonal_note: d.seasonal_note,
      business_hours: Object.keys(hours).length ? hours : null,
      pickup_enabled: formData.get("pickup_enabled") === "on",
      delivery_enabled: formData.get("delivery_enabled") === "on",
      delivery_areas: d.delivery_areas.split(/\n|,/).map((a) => a.trim()).filter(Boolean).slice(0, 100),
      ...money,
      default_lead_time_hours: d.default_lead_time_hours,
      order_cutoff_time: d.order_cutoff_time || null,
      max_advance_days: d.max_advance_days,
      online_payments_enabled: formData.get("online_payments_enabled") === "on",
      offline_payments_enabled: formData.get("offline_payments_enabled") === "on",
      approval_mode: d.approval_mode,
      intro_enabled: formData.get("intro_enabled") === "on",
      intro_video_url: d.intro_video_url,
      intro_poster_url: d.intro_poster_url,
      testimonials,
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. The website is updated." };
}
