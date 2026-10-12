import "server-only";
import { compareFlagged } from "@/lib/digest";
import type { DigestRelease } from "@/lib/digest-types";
import { rowToRelease, type AnalysisRow } from "@/lib/digest-rows";
import { supabase } from "@/lib/supabase";
import type { RepoTag } from "@/lib/types";

/**
 * Optional "mark as reviewed" tracking. It needs one extra column, which you add with one SQL line
 * (see supabase/migrations/002_reviewed.sql). Until then this module reports the feature as off and the
 * app behaves exactly as before: no buttons, no "Still open" section.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const STILL_OPEN_LOOKBACK_DAYS = 90;
const STILL_OPEN_CAP = 20;

let cached: { value: boolean; at: number } | null = null;

export async function reviewTrackingEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const { error } = await supabase().from("release_analysis").select("reviewed_at").limit(1);
  const value = !error;
  cached = { value, at: Date.now() };
  return value;
}

/** Which of these releases have been marked reviewed. Empty when tracking is off. */
export async function getReviewedIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0 || !(await reviewTrackingEnabled())) return [];
  const out: number[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase().from("release_analysis").select("release_id").in("release_id", ids.slice(i, i + 200)).not("reviewed_at", "is", null);
    for (const row of data ?? []) out.push(Number(row.release_id));
  }
  return out;
}

export async function setReviewed(releaseId: number, reviewed: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isSafeInteger(releaseId)) return { ok: false, error: "Invalid release." };
  if (!(await reviewTrackingEnabled())) return { ok: false, error: "Review tracking isn't switched on yet." };
  const { error } = await supabase().from("release_analysis").update({ reviewed_at: reviewed ? new Date().toISOString() : null }).eq("release_id", releaseId);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/**
 * Flagged releases from before `windowStart` (up to 90 days back) that nobody has reviewed:
 * the "11 days unread" case. Only releases of repos we still track.
 */
export async function getStillOpen(windowStart: Date, tags: Map<string, RepoTag>): Promise<DigestRelease[]> {
  if (!(await reviewTrackingEnabled())) return [];
  const since = new Date(Date.now() - STILL_OPEN_LOOKBACK_DAYS * DAY_MS);
  const { data, error } = await supabase()
    .from("release_analysis")
    .select("*")
    .is("reviewed_at", null)
    .gte("published_at", since.toISOString())
    .lt("published_at", windowStart.toISOString())
    .in("repo_full_name", [...tags.keys()]);
  if (error) return [];
  return ((data ?? []) as AnalysisRow[])
    .map((row) => rowToRelease(row, tags.get(row.repo_full_name) ?? "dependency"))
    .filter((r) => r.flagged)
    .sort(compareFlagged)
    .slice(0, STILL_OPEN_CAP);
}

/** Mark several releases reviewed at once (e.g. the first-day backlog). Capped so one click can't touch everything. */
export async function setManyReviewed(releaseIds: number[]): Promise<{ ok: boolean; count?: number; error?: string }> {
  const ids = [...new Set(releaseIds.filter((n) => Number.isSafeInteger(n)))].slice(0, 50);
  if (ids.length === 0) return { ok: false, error: "Nothing to mark." };
  if (!(await reviewTrackingEnabled())) return { ok: false, error: "Review tracking isn't switched on yet." };
  const { error } = await supabase().from("release_analysis").update({ reviewed_at: new Date().toISOString() }).in("release_id", ids).is("reviewed_at", null);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true, count: ids.length };
}
