import { ORDERED_DAYS, dayLabel } from "@/lib/schedule";
import type { SiteSettings } from "@/lib/types";

export const NOT_SET = "To be added by KRIVA";

export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export function HoursList({ settings, tone = "dark" }: { settings: SiteSettings; tone?: "dark" | "light" }) {
  const hours = settings.business_hours;
  if (!hours || Object.keys(hours).length === 0) {
    return <p className={tone === "light" ? "text-ivory/70" : "text-muted"}>Opening hours: to be added by KRIVA.</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[0.95rem]">
      {ORDERED_DAYS.map((d) => {
        const slot = hours[d];
        return (
          <div key={d} className="contents">
            <dt>{dayLabel(d)}</dt>
            <dd className={tone === "light" ? "text-ivory/80" : "text-muted"}>
              {slot ? `${formatTime(slot.open)} – ${formatTime(slot.close)}` : "Closed"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function ContactLines({ settings, tone = "dark" }: { settings: SiteSettings; tone?: "dark" | "light" }) {
  const muted = tone === "light" ? "text-ivory/70" : "text-muted";
  const link = tone === "light" ? "underline decoration-ivory/40 underline-offset-4 hover:decoration-ivory" : "underline decoration-brand/30 underline-offset-4 hover:decoration-brand";
  return (
    <ul className="space-y-2 text-[0.95rem]">
      <li>
        <span className={muted}>Address: </span>
        {settings.address ? (
          <>
            {settings.address}
            {settings.maps_url && (
              <>
                {" "}
                <a className={link} href={settings.maps_url} target="_blank" rel="noopener noreferrer">
                  Open in Maps
                </a>
              </>
            )}
          </>
        ) : (
          <span className={muted}>{settings.city}, {settings.region} (exact address to be added by KRIVA)</span>
        )}
      </li>
      <li>
        <span className={muted}>Phone: </span>
        {settings.phone ? <a className={link} href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a> : <span className={muted}>{NOT_SET}</span>}
      </li>
      <li>
        <span className={muted}>WhatsApp: </span>
        {settings.whatsapp_number ? (
          <a className={link} href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
            +{settings.whatsapp_number}
          </a>
        ) : (
          <span className={muted}>{NOT_SET}</span>
        )}
      </li>
      <li>
        <span className={muted}>Email: </span>
        {settings.email ? <a className={link} href={`mailto:${settings.email}`}>{settings.email}</a> : <span className={muted}>{NOT_SET}</span>}
      </li>
    </ul>
  );
}
