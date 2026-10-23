import { requireAdminPage } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/demo-data";
import { paiseToRupeesString } from "@/lib/money";
import { getRazorpayConfig } from "@/lib/payments/razorpay";
import { ORDERED_DAYS, dayLabel } from "@/lib/schedule";
import { ActionForm } from "@/components/admin/ActionForm";
import { Notice, PageTitle } from "@/components/admin/ui";
import { saveSettings } from "../../actions/settings";
import type { SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

function Field({ name, label, defaultValue, hint, type = "text", ...rest }: { name: string; label: string; defaultValue?: string | number | null; hint?: string; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} className="field" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
      {hint && <p id={`${name}-hint`} className="hint mt-1">{hint}</p>}
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} className="accent-brand" /> {label}</label>;
}

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  const s = { ...DEFAULT_SETTINGS, ...(data ?? {}) } as SiteSettings;
  let gateway: { ok: boolean; text: string };
  try {
    const cfg = getRazorpayConfig();
    gateway = cfg
      ? { ok: true, text: `Razorpay keys found (${cfg.mode} mode)${cfg.webhookSecret ? "" : " — webhook secret missing"}.` }
      : { ok: false, text: "Razorpay keys are not configured on the server. See docs/PAYMENTS.md." };
  } catch (e) {
    gateway = { ok: false, text: (e as Error).message };
  }

  const sectionCls = "space-y-4 rounded-md border border-cream-deep bg-white p-5";
  return (
    <>
      <PageTitle>Shop settings</PageTitle>
      <ActionForm action={saveSettings} submitLabel="Save settings" className="space-y-8">
        <section className={sectionCls}>
          <h2 className="font-display text-2xl">Contact &amp; location</h2>
          <p className="hint">Shown on the website. City: {s.city}, {s.region}, {s.country} · Currency INR · Time zone Asia/Kolkata.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="address" className="label">Shop address</label>
              <textarea id="address" name="address" maxLength={500} defaultValue={s.address ?? ""} className="field min-h-20" />
            </div>
            <Field name="maps_url" label="Google Maps link" defaultValue={s.maps_url} placeholder="https://maps.app.goo.gl/…" />
            <Field name="phone" label="Phone number" defaultValue={s.phone} placeholder="+91 …" />
            <Field name="whatsapp_number" label="WhatsApp business number" defaultValue={s.whatsapp_number} hint="With country code, e.g. 91 98765 43210. Used for every “Order on WhatsApp” button." />
            <Field name="email" label="Email" type="email" defaultValue={s.email} />
            <Field name="instagram_url" label="Instagram link" defaultValue={s.instagram_url} placeholder="https://instagram.com/…" />
            <Field name="facebook_url" label="Facebook link" defaultValue={s.facebook_url} />
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-display text-2xl">Opening hours</h2>
          <p className="hint">Used to validate requested pickup/delivery times. Leave all blank to skip the check.</p>
          <ul className="space-y-2">
            {ORDERED_DAYS.map((d) => {
              const slot = s.business_hours?.[d];
              const closed = s.business_hours ? s.business_hours[d] === null : false;
              return (
                <li key={d} className="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-2">
                  <span className="text-sm">{dayLabel(d)}</span>
                  <input aria-label={`${dayLabel(d)} opens`} type="time" name={`hours_${d}_open`} defaultValue={slot?.open ?? ""} className="field" />
                  <input aria-label={`${dayLabel(d)} closes`} type="time" name={`hours_${d}_close`} defaultValue={slot?.close ?? ""} className="field" />
                  <Check name={`hours_${d}_closed`} label="Closed" checked={closed} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className={sectionCls}>
          <h2 className="font-display text-2xl">Pickup, delivery &amp; timing</h2>
          <div className="flex flex-wrap gap-6"><Check name="pickup_enabled" label="Offer pickup" checked={s.pickup_enabled} /><Check name="delivery_enabled" label="Offer delivery" checked={s.delivery_enabled} /></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="delivery_fee" label="Delivery charge (₹)" defaultValue={paiseToRupeesString(s.delivery_fee_paise)} inputMode="decimal" />
            <Field name="free_delivery_above" label="Free delivery above (₹)" defaultValue={s.free_delivery_above_paise ? paiseToRupeesString(s.free_delivery_above_paise) : ""} inputMode="decimal" hint="Blank = never free" />
            <Field name="min_order" label="Minimum order (₹)" defaultValue={paiseToRupeesString(s.min_order_paise)} inputMode="decimal" />
            <Field name="default_lead_time_hours" label="Default notice (hours)" type="number" min={0} max={720} defaultValue={s.default_lead_time_hours} />
            <Field name="order_cutoff_time" label="Daily order cutoff" type="time" defaultValue={s.order_cutoff_time?.slice(0, 5)} hint="Orders after this count from the next day." />
            <Field name="max_advance_days" label="Book up to (days ahead)" type="number" min={1} max={365} defaultValue={s.max_advance_days} />
          </div>
          <div>
            <label htmlFor="delivery_areas" className="label">Delivery areas</label>
            <textarea id="delivery_areas" name="delivery_areas" defaultValue={s.delivery_areas.join("\n")} className="field min-h-24" aria-describedby="areas-hint" />
            <p id="areas-hint" className="hint mt-1">One area per line, e.g. RS Puram. Leave blank to accept any address.</p>
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-display text-2xl">Payments</h2>
          <Notice tone={gateway.ok ? "success" : "error"}>{gateway.text}</Notice>
          <div className="space-y-2">
            <Check name="online_payments_enabled" label="Accept Google Pay / UPI online (Razorpay)" checked={s.online_payments_enabled} />
            <Check name="offline_payments_enabled" label="Allow “arrange payment with KRIVA” orders" checked={s.offline_payments_enabled} />
          </div>
          <div>
            <label htmlFor="approval_mode" className="label">When do customers pay online?</label>
            <select id="approval_mode" name="approval_mode" defaultValue={s.approval_mode} className="field max-w-md">
              <option value="pay_immediately">Immediately at checkout (products marked “I confirm first” still wait for you)</option>
              <option value="approve_then_pay">Only after I confirm each order</option>
            </select>
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-display text-2xl">Homepage</h2>
          <div>
            <label htmlFor="our_story" className="label">Our story</label>
            <textarea id="our_story" name="our_story" maxLength={4000} defaultValue={s.our_story ?? ""} className="field min-h-32" />
          </div>
          <Field name="seasonal_note" label="Seasonal note (banner)" defaultValue={s.seasonal_note} maxLength={300} placeholder="Diwali gift boxes now available — order 3 days ahead." />
          <Field name="tagline" label="Tagline" defaultValue={s.tagline} maxLength={200} />
          <div>
            <label htmlFor="testimonials" className="label">Customer reviews (genuine only)</label>
            <textarea id="testimonials" name="testimonials" className="field min-h-32" aria-describedby="t-hint"
              defaultValue={s.testimonials.map((t) => `${t.quote}\n— ${t.name}`).join("\n\n")} />
            <p id="t-hint" className="hint mt-1">Paste real reviews you have permission to use. One per block: the quote, then “— Name” on the last line; blank line between reviews. The section is hidden when empty.</p>
          </div>
          <Check name="intro_enabled" label="Show the intro video on first visit" checked={s.intro_enabled} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="intro_video_url" label="Intro video URL (MP4/WebM)" defaultValue={s.intro_video_url} hint="A licensed, short (6–10 s), compressed video under ~4 MB. Leave blank to show the poster only." />
            <Field name="intro_poster_url" label="Intro poster image URL" defaultValue={s.intro_poster_url} />
          </div>
        </section>
      </ActionForm>
    </>
  );
}
