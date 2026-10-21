// All amounts are integer paise. Never use floats for money.

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number): string {
  if (!Number.isInteger(paise)) throw new Error("Amount must be integer paise");
  return formatter.format(paise / 100);
}

/** Parse a rupee string typed by the owner ("1,299.50") into integer paise. */
export function rupeesToPaise(input: string | number): number {
  const s = String(input).replace(/[,₹\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Enter an amount like 1299 or 1299.50");
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function paiseToRupeesString(paise: number): string {
  const whole = Math.trunc(paise / 100);
  const frac = paise % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}
