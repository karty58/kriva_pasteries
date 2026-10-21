/**
 * Pickup / delivery time validation in India Standard Time.
 * The customer REQUESTS a time; KRIVA still confirms it.
 */
import type { BusinessHours, DayKey, SiteSettings } from "./types";

export const TIMEZONE = "Asia/Kolkata";
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
    day: weekday,
  };
}

/** "2026-10-25" + "16:30" interpreted in IST. */
export function fromIstInput(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfNextIstDay(now: Date): Date {
  const { date } = istParts(now);
  const start = new Date(`${date}T00:00:00+05:30`);
  return new Date(start.getTime() + 24 * 3600 * 1000);
}

export function earliestAllowed(now: Date, leadHours: number, cutoff: string | null): Date {
  let earliest = new Date(now.getTime() + leadHours * 3600 * 1000);
  if (cutoff) {
    const nowTime = istParts(now).time;
    if (nowTime > cutoff.slice(0, 5)) {
      const fromTomorrow = new Date(startOfNextIstDay(now).getTime() + leadHours * 3600 * 1000);
      if (fromTomorrow > earliest) earliest = fromTomorrow;
    }
  }
  return earliest;
}

export type ScheduleError =
  | "INVALID_TIME"
  | "TOO_SOON"
  | "TOO_FAR"
  | "CLOSED_DAY"
  | "OUTSIDE_HOURS";

export function validateRequestedTime(
  requested: Date,
  now: Date,
  leadHours: number,
  settings: Pick<SiteSettings, "order_cutoff_time" | "max_advance_days" | "business_hours">,
): { ok: true } | { ok: false; code: ScheduleError; message: string } {
  if (Number.isNaN(requested.getTime())) {
    return { ok: false, code: "INVALID_TIME", message: "Please choose a valid date and time." };
  }
  const earliest = earliestAllowed(now, leadHours, settings.order_cutoff_time);
  if (requested < earliest) {
    return {
      ok: false,
      code: "TOO_SOON",
      message: `This order needs at least ${leadHours} hours' notice. Please choose a later time.`,
    };
  }
  const latest = new Date(now.getTime() + settings.max_advance_days * 24 * 3600 * 1000);
  if (requested > latest) {
    return { ok: false, code: "TOO_FAR", message: `Orders can be placed up to ${settings.max_advance_days} days ahead.` };
  }
  const hours: BusinessHours | null = settings.business_hours;
  if (hours && Object.keys(hours).length > 0) {
    const { day, time } = istParts(requested);
    const slot = hours[day];
    if (!slot) {
      return { ok: false, code: "CLOSED_DAY", message: "KRIVA is closed on the selected day." };
    }
    if (time < slot.open || time > slot.close) {
      return {
        ok: false,
        code: "OUTSIDE_HOURS",
        message: `Please choose a time between ${slot.open} and ${slot.close}.`,
      };
    }
  }
  return { ok: true };
}

export function dayLabel(day: DayKey): string {
  return { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" }[day];
}

export const ORDERED_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export { DAY_KEYS };
