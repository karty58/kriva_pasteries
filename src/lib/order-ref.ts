import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { istParts } from "./schedule";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. KRV-261021-7K3P9Q (date in IST). Uniqueness is enforced by the DB. */
export function generateOrderReference(now = new Date()): string {
  const { date } = istParts(now);
  const yymmdd = date.slice(2).replace(/-/g, "");
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `KRV-${yymmdd}-${suffix}`;
}

export const ORDER_REF_PATTERN = /^KRV-\d{6}-[A-Z0-9]{6}$/;

/** Secret token that lets a customer view their own order. Only its hash is stored. */
export function generateAccessToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string | null | undefined, storedHash: string): boolean {
  if (!token || token.length > 100) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
