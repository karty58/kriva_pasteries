"use client";
import { useRef, useState } from "react";
import { Cake3D } from "./Cake3D";
import { DEFAULT_DESIGN, DRIPS, FROSTINGS, TOPPINGS, describeDesign, designFromForm, type CakeDesign } from "@/lib/cake3d/design";

/** Shared look for option pills: styling follows :checked so it also works without JS state. */
const pill =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border border-cream-deep bg-ivory px-4 py-2 text-sm " +
  "has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-ivory " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand";

/**
 * "Design your cake in 3D". The form is uncontrolled and is read with
 * designFromForm(), so the custom-cake enquiry can read the same form
 * (id="cake-design") and include the design in the WhatsApp message.
 */
export function CakeDesigner() {
  const [design, setDesign] = useState<CakeDesign>(DEFAULT_DESIGN);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <div className="arch relative aspect-[4/5] max-h-[38rem] w-full bg-cream">
          <Cake3D design={design} autoRotate={false} label={`3D sketch: ${describeDesign(design)}. Drag or use the arrow keys to turn it.`} />
        </div>
        <p className="hint mt-3 text-center">Drag the cake to turn it.</p>
      </div>

      <form
        id="cake-design"
        ref={formRef}
        data-cake-designer=""
        onChange={() => formRef.current && setDesign(designFromForm(formRef.current))}
        onSubmit={(e) => e.preventDefault()}
        className="space-y-7"
      >
        <fieldset>
          <legend className="label">Tiers</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <label key={n} className={pill}>
                <input type="radio" name="tiers" value={n} defaultChecked={n === DEFAULT_DESIGN.tiers} className="sr-only" />
                {n} tier{n > 1 ? "s" : ""}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {FROSTINGS.map((f) => (
              <label key={f.value} className={pill}>
                <input type="radio" name="frosting" value={f.value} defaultChecked={f.value === DEFAULT_DESIGN.frosting} className="sr-only" />
                <span aria-hidden="true" className="h-4 w-4 rounded-full border border-charcoal/15" style={{ background: f.hex }} />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Finish</legend>
          <div className="flex flex-wrap gap-2">
            {DRIPS.map((d) => (
              <label key={d.value} className={pill}>
                <input type="radio" name="drip" value={d.value} defaultChecked={d.value === DEFAULT_DESIGN.drip} className="sr-only" />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Topping</legend>
          <div className="flex flex-wrap gap-2">
            {TOPPINGS.map((t) => (
              <label key={t.value} className={pill}>
                <input type="radio" name="topping" value={t.value} defaultChecked={t.value === DEFAULT_DESIGN.topping} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-md bg-cream px-5 py-4">
          <p className="text-sm text-muted">Your sketch</p>
          <p className="mt-1 font-display text-2xl leading-snug" aria-live="polite" data-design-summary="">
            {describeDesign(design).replace(/^./, (c) => c.toUpperCase())}.
          </p>
          <p className="hint mt-2">
            This sketch helps you describe your idea. It&apos;s added to your enquiry below, and KRIVA designs the final cake, size and price with you.
          </p>
        </div>
      </form>
    </div>
  );
}
