"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Renders the official KRIVA logo from /public/brand/kriva-logo.png
 * (override with NEXT_PUBLIC_LOGO_PATH). The logo is never stretched:
 * only its height is set and the width follows its natural proportions.
 * Until the real file is added, a plain text placeholder is shown so the
 * site still works — it is NOT a recreation of the logo.
 */
const LOGO_PATH = process.env.NEXT_PUBLIC_LOGO_PATH || "/brand/kriva-logo.png";

export function Logo({ height = 44, tone = "dark" }: { height?: number; tone?: "dark" | "light" }) {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The image may fail before React hydrates (so onError never runs) — check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  if (missing) {
    return (
      <span
        className="font-display tracking-[0.18em]"
        style={{ fontSize: height * 0.55, lineHeight: `${height}px`, color: tone === "light" ? "var(--color-ivory)" : "var(--color-burgundy)" }}
        title="Logo placeholder — add public/brand/kriva-logo.png"
      >
        KRIVA
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={LOGO_PATH}
      alt="KRIVA"
      style={{ height, width: "auto", objectFit: "contain" }}
      onError={() => setMissing(true)}
    />
  );
}
