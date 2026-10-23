"use client";
import { useActionState, useRef, useState } from "react";
import { uploadProductImages, type ActionState } from "@/app/admin/actions/products";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function ImageUploader({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadProductImages, null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="mt-6 flex flex-wrap items-end gap-3 border-t border-cream-deep pt-5">
      <input type="hidden" name="product_id" value={productId} />
      <div>
        <label htmlFor="images" className="label">Add photos</label>
        <input
          id="images"
          name="images"
          type="file"
          multiple
          accept={TYPES.join(",")}
          className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-ivory"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX);
            setClientError(bad ? `${bad.name}: use JPG, PNG, WebP or AVIF under 5 MB.` : null);
            setCount(files.length);
          }}
        />
      </div>
      <div>
        <label htmlFor="alt_text" className="label">Photo description (for accessibility)</label>
        <input id="alt_text" name="alt_text" className="field" maxLength={200} placeholder="Chocolate cake with gold leaf" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending || !!clientError || count === 0}>
        {pending ? "Uploading…" : "Upload"}
      </button>
      {(clientError || state?.error) && <p role="alert" className="w-full text-sm text-danger">{clientError ?? state?.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm text-success">{state.message}</p>}
    </form>
  );
}
