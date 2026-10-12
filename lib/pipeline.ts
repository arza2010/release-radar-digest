import "server-only";
import { analyzeReleases, type AnalyzeStats } from "@/lib/analyze";
import { collectAll } from "@/lib/collect";
import { windowFor } from "@/lib/dates";
import { buildDigest } from "@/lib/digest";
import type { Digest } from "@/lib/digest-types";
import { rowToRelease, type AnalysisRow } from "@/lib/digest-rows";
import { getStillOpen } from "@/lib/reviewed";
import { getActiveRepos } from "@/lib/repos";
import { buildWatch } from "@/lib/snapshots";
import { supabase } from "@/lib/supabase";

export type DigestStatus = "success" | "partial" | "failed";

export interface RunResult {
  digestId: number;
  digest: Digest;
  status: DigestStatus;
  analysis: AnalyzeStats;
  durationMs: number;
}

/**
 * The weekly pipeline (steps 1-7 of the spec): load repos → fetch → rules → AI (cached) → merge → build → save.
 * Emailing is a separate step done by the caller (Phase 5).
 */
/** No new Gemini batch starts after this many ms, leaving room to save and email within Vercel's 300s limit. */
export const AI_TIME_BUDGET_MS = 200_000;

export async function runDigest(opts: { trigger: "cron" | "manual"; windowDays?: number; maxGeminiCalls?: number }): Promise<RunResult> {
  const t0 = Date.now();
  const now = new Date();
  const windowDays = opts.windowDays ?? 7;
  const window = windowFor(windowDays, now);

  const repos = await getActiveRepos();
  const results = await collectAll(repos, window, now);
  const records = results.flatMap((r) => r.releases);

  const analysis = await analyzeReleases(records, { maxCalls: opts.maxGeminiCalls, deadline: t0 + AI_TIME_BUDGET_MS });

  // Read back the stored verdicts so the digest and the cache view can never disagree.
  const db = supabase();
  const tagByRepo = new Map(results.map((r) => [r.repo, r.tag]));
  const rows: AnalysisRow[] = [];
  const ids = records.map((r) => r.releaseId);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("release_analysis").select("*").in("release_id", ids.slice(i, i + 200));
    if (error) throw new Error(`read analysis: ${error.message}`);
    rows.push(...((data ?? []) as AnalysisRow[]));
  }
  const releases = rows.map((row) => rowToRelease(row, tagByRepo.get(row.repo_full_name) ?? "dependency"));

  const okRepos = results.filter((r) => r.ok);
  const digest = buildDigest({
    generatedAt: now,
    window,
    windowDays,
    source: "run",
    releases,
    reposChecked: results.length,
    quiet: okRepos.filter((r) => r.releases.length === 0).map((r) => r.repo),
    couldntCheck: results.filter((r) => !r.ok).map((r) => ({ repo: r.repo, reason: r.error ?? "GitHub error" })),
    evaluationWatch: await buildWatch(results, now),
    stillOpen: await getStillOpen(window.start, new Map(repos.map((r) => [r.full_name, r.tag]))),
  });

  const allReposFailed = results.length > 0 && okRepos.length === 0;
  const status: DigestStatus = allReposFailed ? "failed" : digest.couldntCheck.length || analysis.failed || analysis.deferred ? "partial" : "success";
  const durationMs = Date.now() - t0;

  const { data, error } = await db
    .from("digests")
    .insert({
      run_at: now.toISOString(),
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      trigger: opts.trigger,
      status,
      payload: digest,
      stats: { ...digest.stats, ...analysis, durationMs, reposFailed: digest.couldntCheck.length },
    })
    .select("id")
    .single();
  if (error) throw new Error(`save digest: ${error.message}`);

  return { digestId: Number(data.id), digest, status, analysis, durationMs };
}
