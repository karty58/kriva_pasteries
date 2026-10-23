"use client";
import { useState } from "react";
import { buildWhatsAppUrl, isValidWhatsAppNumber, makeEnquiryRef } from "@/lib/whatsapp";
import { describeDesign, designFromForm } from "@/lib/cake3d/design";

export function CustomCakeEnquiry({ whatsappNumber }: { whatsappNumber: string | null }) {
  const [error, setError] = useState<string | null>(null);

  if (!isValidWhatsAppNumber(whatsappNumber)) {
    return <p className="mt-5 text-sm text-muted">Custom cake enquiries open here once KRIVA adds its WhatsApp number. Please see the contact page meanwhile.</p>;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (!get("occasion") || !get("date")) {
      setError("Please add the occasion and the date you need the cake.");
      return;
    }
    setError(null);
    const designForm = document.getElementById("cake-design");
    const sketch = designForm instanceof HTMLFormElement ? describeDesign(designFromForm(designForm)) : null;
    const lines = [
      "Hello KRIVA! I'd like to enquire about a custom cake.",
      `Enquiry ref: ${makeEnquiryRef()}`,
      "",
      `Occasion: ${get("occasion")}`,
      `Date needed: ${get("date")}`,
      get("servings") ? `Servings / size: ${get("servings")}` : null,
      get("flavours") ? `Flavours: ${get("flavours")}` : null,
      sketch ? `3D sketch: ${sketch}` : null,
      get("design") ? `Design ideas: ${get("design")}` : null,
      get("name") ? `Name: ${get("name")}` : null,
      "",
      "I can share reference photos here. Please let me know the price and availability.",
    ].filter((l): l is string => typeof l === "string");
    window.open(buildWhatsAppUrl(whatsappNumber!, lines.join("\n")), "_blank", "noopener,noreferrer");
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      <div><label htmlFor="cc-occasion" className="label">Occasion</label><input id="cc-occasion" name="occasion" className="field" maxLength={80} placeholder="Birthday, anniversary…" /></div>
      <div><label htmlFor="cc-date" className="label">Date needed</label><input id="cc-date" name="date" type="date" className="field" /></div>
      <div><label htmlFor="cc-servings" className="label">Servings or size (optional)</label><input id="cc-servings" name="servings" className="field" maxLength={60} placeholder="About 20 people" /></div>
      <div><label htmlFor="cc-flavours" className="label">Flavours (optional)</label><input id="cc-flavours" name="flavours" className="field" maxLength={120} /></div>
      <div><label htmlFor="cc-design" className="label">Design ideas (optional)</label><textarea id="cc-design" name="design" className="field min-h-24" maxLength={500} /></div>
      <div><label htmlFor="cc-name" className="label">Your name (optional)</label><input id="cc-name" name="name" className="field" maxLength={80} autoComplete="name" /></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-whatsapp w-full">Continue on WhatsApp</button>
    </form>
  );
}
