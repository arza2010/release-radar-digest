import "server-only";
import { starsChange } from "@/lib/cadence";
import type { WatchLine } from "@/lib/digest-types";
import { supabase } from "@/lib/supabase";
import type { RepoResult } from "@/lib/types";

const MIN_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Evaluation-watch lines for evaluating repos, with stars change vs the previous snapshot.
 * A new snapshot is stored only if the newest one is at least 12h old, and "previous" means a snapshot at least
 * 12h old, so re-running the digest a few times in one day doesn't wipe out the week-over-week momentum.
 */
export async function buildWatch(results: RepoResult[], now: Date): Promise<WatchLine[]> {
  const db = supabase();
  const cutoff = new Date(now.getTime() - MIN_AGE_MS).toISOString();
  const lines: WatchLine[] = [];

  for (const r of results.filter((x) => x.ok && x.tag === "evaluating" && x.meta && x.cadence)) {
    const meta = r.meta!;
    const cadence = r.cadence!;
    const { data: prev, error } = await db
      .from("repo_snapshots")
      .select("stars, taken_at")
      .eq("repo_full_name", r.repo)
      .lte("taken_at", cutoff)
      .order("taken_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`read snapshots: ${error.message}`);

    const { data: latest } = await db.from("repo_snapshots").select("taken_at").eq("repo_full_name", r.repo).order("taken_at", { ascending: false }).limit(1);
    if (!latest?.length || latest[0].taken_at <= cutoff) {
      const { error: insErr } = await db.from("repo_snapshots").insert({
        repo_full_name: r.repo,
        taken_at: now.toISOString(),
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        open_issues: meta.open_issues_count,
      });
      if (insErr) throw new Error(`save snapshot: ${insErr.message}`);
    }

    lines.push({
      repo: r.repo,
      releasesLast90Days: cadence.releasesLast90Days,
      daysSinceLastRelease: cadence.daysSinceLastRelease,
      medianDaysBetweenReleases: cadence.medianDaysBetweenReleases,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      openIssues: meta.open_issues_count,
      starsChange: starsChange(prev?.[0]?.stars, meta.stargazers_count),
      starsChangeSince: prev?.[0]?.taken_at ?? null,
    });
  }
  return lines;
}
