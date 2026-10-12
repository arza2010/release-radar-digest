/**
 * Collect releases for the tracked repos, then analyse any that are not cached yet.
 * Usage: npm run analyze [-- --days 7] [-- --max-calls 10] [-- --redo-truncated]
 * --redo-truncated re-analyses releases whose notes exceed the 6,000-char limit (used after improving how long notes are shown to the AI).
 * Re-running is cheap: cached releases are never sent to Gemini again.
 */
import { analyzeReleases } from "@/lib/analyze";
import { collectAll } from "@/lib/collect";
import { windowFor } from "@/lib/dates";
import { BODY_CHAR_LIMIT } from "@/lib/gemini";
import { getActiveRepos } from "@/lib/repos";
import { supabase } from "@/lib/supabase";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const v = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

async function main() {
  const days = arg("days", 7);
  const maxCalls = arg("max-calls", Infinity);
  const now = new Date();
  const repos = await getActiveRepos();
  console.log(`Collecting ${repos.length} repos, last ${days} days…`);
  const results = await collectAll(repos, windowFor(days, now), now);
  const releases = results.flatMap((r) => r.releases);
  const failedRepos = results.filter((r) => !r.ok);
  console.log(`${releases.length} releases found${failedRepos.length ? `, ${failedRepos.length} repos failed: ${failedRepos.map((r) => `${r.repo} (${r.error})`).join(", ")}` : ""}`);

  if (process.argv.includes("--redo-truncated")) {
    const long = releases.filter((r) => r.body.length > BODY_CHAR_LIMIT).map((r) => r.releaseId);
    console.log(`Resetting ${long.length} releases with notes longer than ${BODY_CHAR_LIMIT} chars to re-analyse them`);
    if (long.length) {
      const { error } = await supabase().from("release_analysis").update({ ai_status: "pending" }).in("release_id", long);
      if (error) throw new Error(error.message);
    }
  }

  const t0 = Date.now();
  const s = await analyzeReleases(releases, { maxCalls });
  console.log(`\nAnalysis (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`  releases:            ${s.total}`);
  console.log(`  cache hits:          ${s.cached}  (not sent to Gemini)`);
  console.log(`  empty notes:         ${s.emptyNotes}  (no AI call)`);
  console.log(`  analysed now:        ${s.analysedNow}`);
  console.log(`  failed:              ${s.failed}`);
  console.log(`  deferred (budget):   ${s.deferred}`);
  console.log(`  GEMINI CALLS:        ${s.geminiCalls}  (${s.batches} batches of up to 8)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
