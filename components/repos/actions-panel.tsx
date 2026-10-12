"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { backfillAction, runNowAction, type BackfillState, type RunNowState } from "@/app/repos/actions";

function Result({ children, ok }: { children: React.ReactNode; ok: boolean }) {
  return (
    <div aria-live="polite" className={`mt-3 rounded-md border px-3 py-2 text-sm ${ok ? "border-accent/40 bg-accent-bg" : "border-sec-line bg-sec-bg text-sec"}`}>
      {children}
    </div>
  );
}

export function ActionsPanel() {
  const [run, setRun] = useState<RunNowState | null>(null);
  const [fill, setFill] = useState<BackfillState | null>(null);
  const [runPending, startRun] = useTransition();
  const [fillPending, startFill] = useTransition();
  const busy = runPending || fillPending;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">Actions</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        These are open to anyone with the link (there is no login). To protect the free AI quota, manual runs have a 10-minute cooldown and a daily cap, and results are cached so repeats cost nothing.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-background p-4">
          <h3 className="font-semibold">Run digest now</h3>
          <p className="mt-1 text-sm text-muted">Fetches live from GitHub, analyses anything new, saves the digest. Takes up to ~2 minutes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => startRun(async () => setRun(await runNowAction(false)))} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60">
              {runPending ? "Running…" : "Dry run (no email)"}
            </button>
            <button type="button" disabled={busy} onClick={() => startRun(async () => setRun(await runNowAction(true)))} className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-60">
              {runPending ? "Running…" : "Run and email"}
            </button>
          </div>
          {run && (
            <Result ok={run.ok}>
              {run.ok ? (
                <>
                  <p className="font-medium">{run.summary}</p>
                  <p className="mt-1 text-xs text-muted">
                    {run.status} · {run.seconds}s · Gemini calls {run.geminiCalls} · cache hits {run.cacheHits} · AI failures {run.aiFailed} · email {run.email}
                  </p>
                  <Link href="/" className="mt-1 inline-block text-xs font-semibold text-accent underline underline-offset-2">View the dashboard →</Link>
                </>
              ) : (
                run.error
              )}
            </Result>
          )}
        </div>

        <div className="rounded-lg border border-line bg-background p-4">
          <h3 className="font-semibold">Backfill 90 days</h3>
          <p className="mt-1 text-sm text-muted">Analyses releases from the last 90 days that haven&apos;t been analysed yet, in chunks. Click again to continue until nothing is left.</p>
          <div className="mt-3">
            <button type="button" disabled={busy} onClick={() => startFill(async () => setFill(await backfillAction()))} className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-60">
              {fillPending ? "Backfilling…" : "Backfill 90 days"}
            </button>
          </div>
          {fill && (
            <Result ok={fill.ok}>
              {fill.ok ? (
                <>
                  <p className="font-medium">
                    {fill.remaining === 0 ? "Done: every release in the last 90 days is analysed." : `${fill.remaining} release${fill.remaining === 1 ? "" : "s"} left. Click again to continue.`}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {fill.releases} releases · {fill.alreadyAnalysed} already analysed · {fill.analysedNow} analysed now · {fill.failed} failed · Gemini calls {fill.geminiCalls} · {fill.callsLeftToday} calls left today
                  </p>
                  {fill.repoErrors.length > 0 && <p className="mt-1 text-xs">Couldn&apos;t check: {fill.repoErrors.map((e) => `${e.repo} (${e.reason})`).join(", ")}</p>}
                </>
              ) : (
                fill.error
              )}
            </Result>
          )}
        </div>
      </div>
    </section>
  );
}
