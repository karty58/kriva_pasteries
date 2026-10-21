import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="font-display text-5xl text-burgundy">We couldn&apos;t find that page</h1>
      <p className="mt-4 text-muted">The cake may have sold out or moved. Have a look at what&apos;s available today.</p>
      <Link href="/collection" className="btn btn-primary mt-8">Browse the collection</Link>
    </div>
  );
}
