export function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-display text-5xl text-brand">{title}</h1>
      <p className="mt-4 rounded-md bg-champagne-soft px-4 py-3 text-sm">
        Template policy — KRIVA should review this with a legal adviser and fill in its own details before launch.
      </p>
      <div className="mt-8 space-y-5 text-[1.05rem] leading-relaxed [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
