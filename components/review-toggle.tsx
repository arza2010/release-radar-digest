"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setReviewedAction } from "@/app/actions";

/** "Mark as reviewed" / "Reviewed ✓ (undo)". Marking never hides a release; it only records that someone has looked. */
export function ReviewToggle({ releaseId, reviewed }: { releaseId: number; reviewed: boolean }) {
  const [done, setDone] = useState(reviewed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLSpanElement>(null);

  // Dim the whole card while it is marked, without needing the server to re-render it.
  useEffect(() => {
    ref.current?.closest("article")?.classList.toggle("opacity-75", done);
  }, [done]);

  return (
    <span ref={ref} className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        aria-pressed={done}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await setReviewedAction(releaseId, !done);
            if (res.ok) setDone(!done);
            else setError(res.error ?? "Couldn't save that.");
          })
        }
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${done ? "border-accent/50 bg-accent-bg text-accent" : "border-line bg-background text-muted hover:border-accent hover:text-foreground"}`}
      >
        {pending ? "Saving…" : done ? "Reviewed ✓ (undo)" : "Mark as reviewed"}
      </button>
      {error && <span className="mt-1 text-xs text-sec">{error}</span>}
    </span>
  );
}
