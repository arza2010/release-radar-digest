import "server-only";
import { connection } from "next/server";
import { buildDigest } from "@/lib/digest";
import type { Digest } from "@/lib/digest-types";
import { rowToRelease, type AnalysisRow } from "@/lib/digest-rows";
import { windowFor } from "@/lib/dates";
import { getActiveRepos } from "@/lib/repos";
import { getStillOpen, reviewTrackingEnabled } from "@/lib/reviewed";
import { supabase } from "@/lib/supabase";

export interface SavedDigest {
  id: number;
  runAt: string;
  status: "success" | "partial" | "failed";
  trigger: "cron" | "manual";
  emailStatus: string | null;
  digest: Digest;
}

function toSaved(row: Record<string, unknown>): SavedDigest {
  return {
    id: Number(row.id),
    runAt: row.run_at as string,
    status: row.status as SavedDigest["status"],
    trigger: row.trigger as SavedDigest["trigger"],
    emailStatus: (row.email_status as string | null) ?? null,
    digest: row.payload as Digest,
  };
}

/** The newest digest that was not a total failure. */
export async function getLatestDigest(): Promise<SavedDigest | null> {
  const { data, error } = await supabase().from("digests").select("*").neq("status", "failed").order("run_at", { ascending: false }).limit(1);
  if (error) throw new Error(`load digest: ${error.message}`);
  return data?.length ? toSaved(data[0]) : null;
}

export interface Dashboard {
  latest: SavedDigest | null;
  digest: Digest;
  reviewEnabled: boolean;
  /** Releases in `digest.needsLook` that have been marked reviewed. */
  reviewedIds: number[];
}

/**
 * Everything the dashboard needs, built from stored results only: no GitHub and no Gemini calls.
 * Releases that no run has stored yet are simply absent; stored-but-unanalysed ones show rules-only flags.
 * Evaluation watch and "couldn't check" are carried over from the latest run, since they are as-of-that-run.
 *
 * Every independent query runs in parallel: the database is a network hop away, so waiting on queries one
 * after another was the biggest cost of a page view.
 */
export async function loadDashboard(days: number): Promise<Dashboard> {
  await connection(); // "now" below must be read at request time, never frozen at prerender
  const now = new Date();
  const window = windowFor(days, now);
  const [latest, repos, reviewEnabled] = await Promise.all([getLatestDigest(), getActiveRepos(), reviewTrackingEnabled()]);
  const tagByRepo = new Map(repos.map((r) => [r.full_name, r.tag]));

  const [rowsRes, stillOpen] = await Promise.all([
    supabase()
      .from("release_analysis")
      .select("*")
      .gte("published_at", window.start.toISOString())
      .lte("published_at", window.end.toISOString())
      .in("repo_full_name", repos.map((r) => r.full_name)),
    days === 7 ? getStillOpen(window.start, tagByRepo) : Promise.resolve(undefined),
  ]);
  if (rowsRes.error) throw new Error(`load cache: ${rowsRes.error.message}`);

  const rows = (rowsRes.data ?? []) as AnalysisRow[];
  const releases = rows.map((row) => rowToRelease(row, tagByRepo.get(row.repo_full_name) ?? "dependency"));
  const withReleases = new Set(releases.map((r) => r.repo));
  const failed = latest?.digest.couldntCheck ?? [];
  const failedNames = new Set(failed.map((f) => f.repo));

  const digest = buildDigest({
    generatedAt: now,
    window,
    windowDays: days,
    source: "cache",
    releases,
    reposChecked: repos.length,
    quiet: repos.filter((r) => !withReleases.has(r.full_name) && !failedNames.has(r.full_name)).map((r) => r.full_name),
    couldntCheck: failed,
    evaluationWatch: latest?.digest.evaluationWatch ?? [],
    stillOpen,
  });
  const reviewedIds = reviewEnabled ? rows.filter((r) => r.reviewed_at).map((r) => Number(r.release_id)) : [];
  return { latest, digest, reviewEnabled, reviewedIds };
}

export interface DigestListItem {
  id: number;
  runAt: string;
  trigger: "cron" | "manual";
  status: "success" | "partial" | "failed";
  emailStatus: string | null;
  releases: number;
  needALook: number;
}

/** Past digests, newest first. */
export async function listDigests(limit = 60): Promise<DigestListItem[]> {
  const { data, error } = await supabase().from("digests").select("id, run_at, trigger, status, email_status, stats").order("run_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`load history: ${error.message}`);
  return (data ?? []).map((row) => {
    const stats = (row.stats ?? {}) as { releases?: number; needALook?: number };
    return {
      id: Number(row.id),
      runAt: row.run_at as string,
      trigger: row.trigger as DigestListItem["trigger"],
      status: row.status as DigestListItem["status"],
      emailStatus: (row.email_status as string | null) ?? null,
      releases: stats.releases ?? 0,
      needALook: stats.needALook ?? 0,
    };
  });
}

export async function getDigestById(id: number): Promise<SavedDigest | null> {
  if (!Number.isSafeInteger(id)) return null;
  const { data, error } = await supabase().from("digests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`load digest: ${error.message}`);
  return data ? toSaved(data) : null;
}
