"use client";

import { useState, useTransition } from "react";
import { getRawNotes } from "@/app/actions";

export function RawNotes({ repo, releaseId }: { repo: string; releaseId: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && text === null) {
      setError(null);
      start(async () => {
        const res = await getRawNotes(repo, releaseId);
        if (res.ok) {
          setText(res.body);
          setTruncated(res.truncated);
        } else {
          setError(res.error);
        }
      });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        {open ? "Hide raw notes" : "Show raw notes"}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-line bg-background p-3">
          {pending && <p className="text-xs text-muted">Loading notes from GitHub…</p>}
          {error && <p className="text-xs text-sec">{error}</p>}
          {text !== null && (
            <>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{text}</pre>
              {truncated && <p className="mt-2 text-xs text-muted">Showing the first part only. Open the release on GitHub for the rest.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
