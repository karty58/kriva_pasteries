"use client";
import { useActionState } from "react";

type State = { ok?: boolean; error?: string; message?: string } | null;

/** Small wrapper that shows pending / success / error states for a server action form. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className = "",
  buttonClass = "btn btn-primary",
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass} disabled={pending}>{pending ? pendingLabel : submitLabel}</button>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.ok && state.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      </div>
    </form>
  );
}
