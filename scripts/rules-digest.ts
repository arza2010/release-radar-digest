/**
 * Rules-only digest printed to the terminal (no AI, no database).
 * Usage: npm run rules-digest [-- --repos owner/a,owner/b]   (prints the 7- and 30-day windows)
 */
import { collectAll } from "@/lib/collect";
import { formatIST, windowFor } from "@/lib/dates";
import { ruleSeverity } from "@/lib/rules";
import type { RepoResult, ReleaseRecord } from "@/lib/types";
import { reposFromArgs } from "./candidates";

const line = (c = "─") => c.repeat(78);

function releaseLines(r: ReleaseRecord): string[] {
  const sev = ruleSeverity(r.ruleFlags);
  const badges = [sev === "security" ? "SECURITY" : sev === "breaking" ? "BREAKING" : "", r.prerelease ? "pre-release" : ""].filter(Boolean);
  const out = [`  • ${r.repo} ${r.tagName}  (${formatIST(r.publishedAt)})${badges.length ? `  [${badges.join(" · ")}]` : ""}`];
  if (sev) out.push(`      flagged by: Rule   evidence: ${r.ruleFlags.map((f) => `${f.type}: "${f.evidence}"`).slice(0, 4).join("; ")}`);
  out.push(`      ${r.bodyLineCount} lines of notes · ${r.htmlUrl}`);
  return out;
}

function render(days: number, results: RepoResult[]) {
  const ok = results.filter((r) => r.ok);
  const releases = ok.flatMap((r) => r.releases);
  const lines = releases.reduce((n, r) => n + r.bodyLineCount, 0);
  const flagged = releases.filter((r) => ruleSeverity(r.ruleFlags));
  const newest = (a: ReleaseRecord, b: ReleaseRecord) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

  console.log(`\n${line("═")}\nRULES-ONLY DIGEST · last ${days} days\n${line("═")}`);
  console.log(`${results.length} repos checked · ${releases.length} releases · ${lines.toLocaleString()} lines of notes → ${flagged.length} need a look\n`);

  console.log("NEEDS A LOOK");
  const sorted = [...flagged].sort((a, b) => {
    const rank = (r: ReleaseRecord) => (ruleSeverity(r.ruleFlags) === "security" ? 0 : 1);
    return rank(a) - rank(b) || newest(a, b);
  });
  if (sorted.length === 0) console.log("  (nothing flagged by the rules)");
  sorted.forEach((r) => releaseLines(r).forEach((l) => console.log(l)));

  console.log("\nOTHER RELEASES");
  const others = releases.filter((r) => !ruleSeverity(r.ruleFlags)).sort((a, b) => (a.tag === b.tag ? newest(a, b) : a.tag === "dependency" ? -1 : 1));
  if (others.length === 0) console.log("  (none)");
  others.forEach((r) => releaseLines(r).forEach((l) => console.log(l)));

  console.log("\nEVALUATION WATCH");
  const evaluating = ok.filter((r) => r.tag === "evaluating");
  if (evaluating.length === 0) console.log("  (no evaluating repos)");
  for (const r of evaluating) {
    const c = r.cadence;
    const stars = r.meta ? `${r.meta.stargazers_count.toLocaleString()} stars` : "";
    console.log(`  ${r.repo}: ${c?.releasesLast90Days ?? "?"} releases in 90d · last ${c?.daysSinceLastRelease ?? "?"}d ago · median gap ${c?.medianDaysBetweenReleases ?? "?"}d · ${stars} (no previous snapshot yet)`);
  }

  const quiet = ok.filter((r) => r.releases.length === 0).map((r) => r.repo);
  console.log(`\nQUIET THIS PERIOD (${quiet.length})\n  ${quiet.join(", ") || "(none)"}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\nCOULDN'T CHECK (${failed.length})`);
  failed.forEach((r) => console.log(`  ${r.repo}: ${r.error}`));
}

async function main() {
  const repos = reposFromArgs(process.argv.slice(2));
  const now = new Date();
  for (const days of [7, 30]) {
    const results = await collectAll(repos, windowFor(days, now), now);
    render(days, results);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
