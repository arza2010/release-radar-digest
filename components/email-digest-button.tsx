"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { emailLatestDigestAction, type EmailNowState } from "@/app/actions";

/** Sends the latest saved digest by email right now. */
export function EmailDigestButton() {
  const [result, setResult] = useState<EmailNowState | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          start(async () => setResult(await emailLatestDigestAction()));
        }}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-accent disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        {pending ? "Sending…" : "Email me this digest"}
      </button>
      <div aria-live="polite" className="max-w-xs text-xs sm:text-right">
        {result?.ok && <span className="text-accent">Sent to {result.to}. It should arrive within a minute.</span>}
        {result && !result.ok && <span className="text-sec">{result.error}</span>}
        {!result && !pending && (
          <span className="text-muted">
            Sends the latest saved digest now.{" "}
            <Link href="/repos" className="underline underline-offset-2 hover:text-foreground">
              Run a fresh one →
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}
