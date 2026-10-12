"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setManyReviewedAction } from "@/app/actions";

/** Two-step "Mark all as reviewed" for the Still open backlog. */
export function ReviewAll({ releaseIds }: { releaseIds: number[] }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-foreground">
        Mark all {releaseIds.length} as reviewed
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted">Mark all {releaseIds.length} as reviewed?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setManyReviewedAction(releaseIds);
            if (res.ok) router.refresh();
            else setError(res.error ?? "Couldn't save that.");
          })
        }
        className="rounded-full bg-foreground px-3 py-1 font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Saving…" : "Yes, mark all"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="text-muted hover:text-foreground">
        Cancel
      </button>
      {error && <span className="text-sec">{error}</span>}
    </span>
  );
}
