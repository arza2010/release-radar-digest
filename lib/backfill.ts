import "server-only";
import { analyzeReleases } from "@/lib/analyze";
import { geminiCallsLeftToday } from "@/lib/budget";
import { collectAll } from "@/lib/collect";
import { windowFor } from "@/lib/dates";
import { AI_TIME_BUDGET_MS } from "@/lib/pipeline";
import { getActiveRepos } from "@/lib/repos";

/** Gemini calls per click: keeps one click well inside the 300s limit (each call takes ~15–30s). */
export const BACKFILL_CALLS_PER_CLICK = 8;

export interface BackfillResult {
  releases: number;
  alreadyAnalysed: number;
  analysedNow: number;
  failed: number;
  /** Still to analyse (budget, time or failures). Click again to continue. */
  remaining: number;
  geminiCalls: number;
  callsLeftToday: number;
  repoErrors: { repo: string; reason: string }[];
}

/** Analyse uncached releases from the last 90 days, in resumable chunks that respect the daily budget. */
export async function backfill90(): Promise<BackfillResult> {
  const t0 = Date.now();
  const now = new Date();
  const repos = await getActiveRepos();
  const results = await collectAll(repos, windowFor(90, now), now);
  const records = results.flatMap((r) => r.releases);

  const { left } = await geminiCallsLeftToday();
  const stats = await analyzeReleases(records, { maxCalls: Math.min(left, BACKFILL_CALLS_PER_CLICK), deadline: t0 + AI_TIME_BUDGET_MS });
  const after = await geminiCallsLeftToday();

  return {
    releases: stats.total,
    alreadyAnalysed: stats.cached + stats.emptyNotes,
    analysedNow: stats.analysedNow,
    failed: stats.failed,
    remaining: stats.deferred + stats.failed,
    geminiCalls: stats.geminiCalls,
    callsLeftToday: after.left,
    repoErrors: results.filter((r) => !r.ok).map((r) => ({ repo: r.repo, reason: r.error ?? "GitHub error" })),
  };
}
