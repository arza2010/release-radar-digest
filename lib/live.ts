import "server-only";
import { analyzeReleases } from "@/lib/analyze";
import { geminiCallsLeftToday } from "@/lib/budget";
import { collectAll } from "@/lib/collect";
import { windowFor } from "@/lib/dates";
import { getActiveRepos } from "@/lib/repos";
import { supabase } from "@/lib/supabase";

/**
 * Live refresh: pull the last 7 days from GitHub right now, store the releases (with rule flags) and give any
 * genuinely new release an AI summary. Triggered when the dashboard is opened, so the weekly email is no longer
 * the only time data is pulled.
 *
 * Guard rails (the page is public):
 *  - at most one refresh per server instance every 5 minutes (callers just see the age of the last one)
 *  - at most LIVE_MAX_CALLS Gemini calls per refresh, and never beyond the daily cap in lib/budget.ts
 *  - cached releases are never re-sent to Gemini, so repeat visits cost nothing
 */
export const LIVE_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const LIVE_MAX_CALLS = 2;
const LIVE_AI_TIME_BUDGET_MS = 90_000;

export type LiveResult =
  | { ok: true; skipped: boolean; ageSeconds: number; checkedAt: string; newReleases: number; analysed: number; aiPending: number; repoErrors: number; seconds: number }
  | { ok: false; error: string };

let lastRefreshAt = 0;
let lastResult: Extract<LiveResult, { ok: true }> | null = null;
let inFlight: Promise<LiveResult> | null = null;

export function refreshLive(): Promise<LiveResult> {
  const age = Date.now() - lastRefreshAt;
  if (lastResult && age < LIVE_MIN_INTERVAL_MS) return Promise.resolve({ ...lastResult, skipped: true, ageSeconds: Math.round(age / 1000) });
  if (inFlight) return inFlight; // another visitor's refresh is already running: share it
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(): Promise<LiveResult> {
  const t0 = Date.now();
  try {
    const now = new Date();
    const repos = await getActiveRepos();
    const results = await collectAll(repos, windowFor(7, now), now);
    const records = results.flatMap((r) => r.releases);

    // Which of these has the database never seen? Those are the "new" ones.
    const known = new Set<number>();
    const ids = records.map((r) => r.releaseId);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase().from("release_analysis").select("release_id").in("release_id", ids.slice(i, i + 200));
      for (const row of data ?? []) known.add(Number(row.release_id));
    }

    const { left } = await geminiCallsLeftToday();
    const stats = await analyzeReleases(records, { maxCalls: Math.min(left, LIVE_MAX_CALLS), deadline: t0 + LIVE_AI_TIME_BUDGET_MS });

    lastRefreshAt = Date.now();
    lastResult = {
      ok: true,
      skipped: false,
      ageSeconds: 0,
      checkedAt: new Date(lastRefreshAt).toISOString(),
      newReleases: records.filter((r) => !known.has(r.releaseId)).length,
      analysed: stats.analysedNow,
      aiPending: stats.deferred,
      repoErrors: results.filter((r) => !r.ok).length,
      seconds: Math.round((Date.now() - t0) / 100) / 10,
    };
    return lastResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't refresh." };
  }
}
