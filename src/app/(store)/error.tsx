"use client";

export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center" role="alert">
      <h1 className="font-display text-4xl text-burgundy">This page didn&apos;t load</h1>
      <p className="mt-4 text-muted">Please try again. If it keeps happening, contact KRIVA directly.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">Try again</button>
    </div>
  );
}
