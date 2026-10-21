"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

/**
 * First-visit cinematic intro. Never blocks shopping:
 * - the homepage renders underneath and is usable as soon as the intro closes;
 * - "Skip intro" is always visible and Escape closes it;
 * - it closes by itself after the video ends (or after a few seconds);
 * - shown once per browser session;
 * - skipped entirely for prefers-reduced-motion and Save-Data users;
 * - if no video is configured or it fails, the poster + logo is shown briefly.
 */
const SEEN_KEY = "kriva-intro-seen";
const MAX_MS = 9000;
const POSTER_ONLY_MS = 2600;

export function IntroOverlay({ videoUrl, posterUrl }: { videoUrl: string | null; posterUrl: string }) {
  const [state, setState] = useState<"hidden" | "showing" | "leaving">("hidden");
  const [videoFailed, setVideoFailed] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setState((s) => (s === "showing" ? "leaving" : s));
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen && !reduced && !saveData) setState("showing");
  }, []);

  useEffect(() => {
    if (state !== "showing") return;
    skipRef.current?.focus();
    const limit = setTimeout(close, videoUrl && !videoFailed ? MAX_MS : POSTER_ONLY_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(limit);
      window.removeEventListener("keydown", onKey);
    };
  }, [state, close, videoUrl, videoFailed]);

  useEffect(() => {
    if (state !== "leaving") return;
    const t = setTimeout(() => setState("hidden"), 700);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to KRIVA"
      className={`fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-burgundy-deep ${state === "leaving" ? "intro-leaving" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {videoUrl && !videoFailed && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoUrl}
          poster={posterUrl}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onEnded={close}
          onError={() => setVideoFailed(true)}
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-burgundy-deep/30 via-transparent to-burgundy-deep/70" />
      <div className="intro-mark relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="rounded-full bg-ivory/95 px-8 py-5">
          <Logo height={72} />
        </div>
        <p className="font-display text-2xl text-ivory sm:text-3xl">A little art in every bite.</p>
      </div>
      <button
        ref={skipRef}
        type="button"
        onClick={close}
        className="btn btn-sm btn-ghost-light absolute bottom-8 right-6 sm:right-10"
      >
        Skip intro
      </button>
    </div>
  );
}
