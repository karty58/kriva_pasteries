/**
 * The options a customer can choose in the 3D cake designer.
 * Kept free of three.js so it can be used on the server and in tests.
 */
export type Tiers = 1 | 2 | 3;
export type Frosting = "ivory" | "blush" | "burgundy" | "chocolate" | "pistachio";
export type Drip = "none" | "chocolate" | "gold" | "mirror";
export type Topping = "berries" | "rosettes" | "gold-leaf" | "none";

export interface CakeDesign {
  tiers: Tiers;
  frosting: Frosting;
  drip: Drip;
  topping: Topping;
}

export const FROSTINGS: { value: Frosting; label: string; hex: string }[] = [
  { value: "ivory", label: "Ivory", hex: "#f7efe2" },
  { value: "blush", label: "Blush pink", hex: "#efc9cd" },
  { value: "pistachio", label: "Pistachio", hex: "#cfdcae" },
  { value: "chocolate", label: "Chocolate", hex: "#5a3426" },
  { value: "burgundy", label: "Burgundy", hex: "#5c1525" },
];

/** Finish over the frosting colour. "mirror" is KRIVA's signature marble mirror glaze. */
export const DRIPS: { value: Drip; label: string }[] = [
  { value: "mirror", label: "Marble mirror glaze" },
  { value: "none", label: "Smooth frosting" },
  { value: "chocolate", label: "Chocolate ganache drip" },
  { value: "gold", label: "Gold drip" },
];

export const TOPPINGS: { value: Topping; label: string }[] = [
  { value: "berries", label: "Fresh berries" },
  { value: "rosettes", label: "Piped rosettes" },
  { value: "gold-leaf", label: "Gold leaf" },
  { value: "none", label: "Clean finish" },
];

export const DEFAULT_DESIGN: CakeDesign = { tiers: 1, frosting: "blush", drip: "mirror", topping: "berries" };
export const HERO_DESIGN: CakeDesign = { tiers: 1, frosting: "burgundy", drip: "mirror", topping: "gold-leaf" };

const pick = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** Validate anything (form data, JSON attribute) into a safe design. */
export function normaliseDesign(input: Partial<Record<keyof CakeDesign, unknown>>): CakeDesign {
  return {
    tiers: pick(Number(input.tiers), [1, 2, 3] as const, DEFAULT_DESIGN.tiers),
    frosting: pick(input.frosting, FROSTINGS.map((f) => f.value), DEFAULT_DESIGN.frosting),
    drip: pick(input.drip, DRIPS.map((d) => d.value), DEFAULT_DESIGN.drip),
    topping: pick(input.topping, TOPPINGS.map((t) => t.value), DEFAULT_DESIGN.topping),
  };
}

/** Read the designer form (works for React and for plain DOM). */
export function designFromForm(form: HTMLFormElement): CakeDesign {
  const data = new FormData(form);
  return normaliseDesign({
    tiers: data.get("tiers"),
    frosting: data.get("frosting"),
    drip: data.get("drip"),
    topping: data.get("topping"),
  });
}

/** Plain-English summary used on the page and in the WhatsApp enquiry. */
export function describeDesign(d: CakeDesign): string {
  const colour = FROSTINGS.find((f) => f.value === d.frosting)!.label.toLowerCase();
  const tiers = `${d.tiers} tier${d.tiers > 1 ? "s" : ""}`;
  const parts =
    d.drip === "mirror" ? [`${tiers} in a ${colour} marble mirror glaze`] : [`${tiers} with ${colour} frosting`];
  if (d.drip === "gold" || d.drip === "chocolate") parts.push(d.drip === "gold" ? "a gold drip" : "a chocolate ganache drip");
  const topping = d.topping === "none" ? null : TOPPINGS.find((t) => t.value === d.topping)!.label.toLowerCase();
  if (d.drip === "mirror") return topping ? `${parts[0]}, finished with ${topping}` : parts[0];
  if (topping) parts.push(topping);
  const last = parts.pop()!;
  return parts.length ? `${parts.join(", ")} and ${last}` : last;
}
