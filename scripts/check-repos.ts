/**
 * Verify seed candidates against live GitHub: exists? publishes releases? how recent?
 * Usage: npm run check-repos [-- --repos owner/a,owner/b]
 */
import { fetchReleases, fetchRepoMeta, GithubError, rateLimit } from "@/lib/github";
import { formatIST, inWindow, windowFor } from "@/lib/dates";
import { mapLimit } from "@/lib/pool";
import { runRules } from "@/lib/rules";
import { reposFromArgs } from "./candidates";

interface Row {
  repo: string;
  tag: string;
  status: string; // "ok" or the failure reason
  renamedTo?: string;
  archived?: boolean;
  total: number;
  d7: number;
  d30: number;
  d90: number;
  last?: string;
  securityHits: string[];
}

async function check(repo: { full_name: string; tag: string }, now: Date): Promise<Row> {
  const row: Row = { repo: repo.full_name, tag: repo.tag, status: "ok", total: 0, d7: 0, d30: 0, d90: 0, securityHits: [] };
  try {
    const meta = await fetchRepoMeta(repo.full_name);
    if (meta.full_name.toLowerCase() !== repo.full_name) row.renamedTo = meta.full_name.toLowerCase();
    row.archived = meta.archived;
    const w90 = windowFor(90, now);
    const releases = await fetchReleases(repo.full_name, w90.start);
    row.total = releases.length;
    const dates = releases.map((r) => r.published_at as string).sort().reverse();
    row.last = dates[0];
    for (const [days, key] of [[7, "d7"], [30, "d30"], [90, "d90"]] as const) {
      const w = windowFor(days, now);
      row[key] = dates.filter((d) => inWindow(d, w)).length;
    }
    const history = releases.map((r) => ({ tagName: r.tag_name, publishedAt: r.published_at as string }));
    for (const r of releases.filter((r) => inWindow(r.published_at as string, w90))) {
      const hits = runRules({ tagName: r.tag_name, name: r.name, body: r.body, publishedAt: r.published_at as string, history })
        .filter((f) => f.type === "security");
      if (hits.length) row.securityHits.push(`${r.tag_name}: ${hits.slice(0, 3).map((h) => h.evidence).join(", ")}`);
    }
  } catch (e) {
    if (!(e instanceof GithubError)) throw e;
    row.status = e.reason;
  }
  return row;
}

async function main() {
  const now = new Date();
  const repos = reposFromArgs(process.argv.slice(2));
  console.log(`Checking ${repos.length} repos against live GitHub (${now.toISOString()})\n`);
  const rows = await mapLimit(repos, 5, (r) => check(r, now));

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`${pad("repo", 34)}${pad("tag", 12)}${pad("7d", 4)}${pad("30d", 5)}${pad("90d", 5)}${pad("last release", 18)}security/CVE mentions (last 90d)`);
  console.log("-".repeat(120));
  for (const r of rows) {
    if (r.status !== "ok") {
      console.log(`${pad(r.repo, 34)}${pad(r.tag, 12)}!! ${r.status}`);
      continue;
    }
    const note = [r.renamedTo ? `renamed → ${r.renamedTo}` : "", r.archived ? "ARCHIVED" : "", r.total === 0 ? "NO GITHUB RELEASES" : ""].filter(Boolean).join(" · ");
    const sec = r.securityHits.length ? `${r.securityHits.length} release(s): ${r.securityHits.slice(0, 2).join(" | ")}` : "—";
    console.log(`${pad(r.repo, 34)}${pad(r.tag, 12)}${pad(r.d7, 4)}${pad(r.d30, 5)}${pad(r.d90, 5)}${pad(r.last ? formatIST(r.last) : "never", 18)}${sec}${note ? `   [${note}]` : ""}`);
  }

  const ok = rows.filter((r) => r.status === "ok");
  console.log("\nSummary");
  console.log(`  exist & reachable:        ${ok.length}/${rows.length}`);
  console.log(`  published GitHub releases: ${ok.filter((r) => r.total > 0).length}`);
  console.log(`  release in last 30 days:   ${ok.filter((r) => r.d30 > 0).length}`);
  console.log(`  release in last 7 days:    ${ok.filter((r) => r.d7 > 0).length}`);
  const bad = rows.filter((r) => r.status !== "ok");
  if (bad.length) console.log(`  problems: ${bad.map((r) => `${r.repo} (${r.status})`).join(", ")}`);
  console.log(`  GitHub quota left: ${rateLimit.remaining ?? "?"}/${rateLimit.limit ?? "?"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
