"use client";

import { useActionState } from "react";
import { addRepoAction, type FormState } from "@/app/repos/actions";

export function AddRepoForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addRepoAction, null);

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <label htmlFor="repo-name" className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Add a repo
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          key={state?.nonce ?? 0}
          defaultValue={state && !state.ok ? state.input : ""}
          id="repo-name"
          name="name"
          required
          maxLength={300}
          placeholder="owner/name or a github.com link"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <select name="tag" defaultValue="dependency" aria-label="Tag" className="rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          <option value="dependency">dependency</option>
          <option value="evaluating">evaluating</option>
        </select>
        <button type="submit" disabled={pending} className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity disabled:opacity-60">
          {pending ? "Checking GitHub…" : "Add repo"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">We check the repo exists on GitHub, and store it as lowercase owner/name.</p>
      <div aria-live="polite">
        {state && (
          <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${state.ok ? "border-accent/40 bg-accent-bg text-accent" : "border-sec-line bg-sec-bg text-sec"}`}>{state.message}</p>
        )}
        {state?.ok && state.warnings?.map((w) => (
          <p key={w} className="mt-2 rounded-md border border-brk-line bg-brk-bg px-3 py-2 text-sm text-brk">
            {w}
          </p>
        ))}
      </div>
    </form>
  );
}
