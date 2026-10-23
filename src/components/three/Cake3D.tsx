"use client";
import { useEffect, useRef, useState } from "react";
import type { CakeDesign } from "@/lib/cake3d/design";
import type { CakeSceneHandle } from "@/lib/cake3d/scene";

/**
 * Interactive 3D cake. three.js (~150 KB gzipped) is loaded only in the
 * browser and only for pages that show it. Until it's ready — or if the
 * device has no WebGL — the `fallback` (usually an image) is shown.
 */
export function Cake3D({
  design,
  fallback,
  label = "3D illustration of a cake. Drag or use the arrow keys to turn it.",
  className = "",
  autoRotate = true,
}: {
  design: CakeDesign;
  fallback?: React.ReactNode;
  label?: string;
  className?: string;
  autoRotate?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<CakeSceneHandle | null>(null);
  const latest = useRef(design);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    latest.current = design;
    handle.current?.setDesign(design);
  }, [design]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [THREE, { createCakeScene }] = await Promise.all([import("three"), import("@/lib/cake3d/scene")]);
        if (cancelled || !canvasRef.current) return;
        const h = createCakeScene(THREE, canvasRef.current, latest.current, { autoRotate });
        if (!h) {
          setStatus("failed");
          return;
        }
        handle.current = h;
        setStatus("ready");
      } catch (e) {
        console.warn("3D cake unavailable", e);
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, [autoRotate]);

  return (
    <div className={`relative h-full w-full ${className}`} data-cake3d={JSON.stringify(design)} data-autorotate={autoRotate ? "1" : "0"}>
      <canvas
        ref={canvasRef}
        tabIndex={status === "ready" ? 0 : -1}
        role="img"
        aria-label={label}
        className={`absolute inset-0 h-full w-full outline-offset-[-3px] transition-opacity duration-500 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {status !== "ready" && fallback && <div className="absolute inset-0" data-cake3d-fallback="">{fallback}</div>}
    </div>
  );
}
