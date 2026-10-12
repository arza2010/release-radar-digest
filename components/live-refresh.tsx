"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { refreshLiveAction } from "@/app/actions";

const POLL_MS = 10 * 60 * 1000;

function ago(seconds: number): string {
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

type Status =
  | { kind: "checking" }
  | { kind: "done"; text: string; warn?: boolean }
  | { kind: "error"; text: string };

/**
 * Pulls fresh releases from GitHub when the dashboard opens, then every 10 minutes while the tab is visible.
 * The server throttles it, so opening many tabs or refreshing repeatedly costs nothing extra.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [pending, start] = useTransition();
  const started = useRef(false);

  const refresh = useCallback(() => {
    setStatus({ kind: "checking" });
    start(async () => {
      try {
        const res = await refreshLiveAction();
        if (!res.ok) {
          setStatus({ kind: "error", text: "Couldn't reach GitHub just now. Showing stored data." });
          return;
        }
        const bits: string[] = [res.skipped ? `Checked GitHub ${ago(res.ageSeconds)}` : "Checked GitHub just now"];
        if (res.newReleases > 0) bits.push(`${res.newReleases} new release${res.newReleases === 1 ? "" : "s"} found`);
        if (res.aiPending > 0) bits.push(`${res.aiPending} awaiting AI summary`);
        if (res.repoErrors > 0) bits.push(`${res.repoErrors} repo${res.repoErrors === 1 ? "" : "s"} couldn't be checked`);
        setStatus({ kind: "done", text: bits.join(" · "), warn: res.repoErrors > 0 });
        if (!res.skipped && (res.newReleases > 0 || res.analysed > 0)) router.refresh();
      } catch {
        setStatus({ kind: "error", text: "Couldn't refresh. Showing stored data." });
      }
    });
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const live = status.kind === "done" && !status.warn;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" aria-live="polite">
      <span className={`relative inline-block size-2 rounded-full ${status.kind === "error" || (status.kind === "done" && status.warn) ? "text-brk" : "text-accent"} ${live ? "pulse-dot" : ""}`}>
        <span className={`absolute inset-0 rounded-full bg-current ${status.kind === "checking" ? "animate-pulse" : ""}`} />
      </span>
      <span>{status.kind === "checking" ? "Checking GitHub for new releases…" : status.text}</span>
      <button type="button" onClick={refresh} disabled={pending} className="font-medium text-foreground underline underline-offset-2 hover:text-accent disabled:opacity-50">
        Refresh
      </button>
    </span>
  );
}
