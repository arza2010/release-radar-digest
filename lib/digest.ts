import type { Window } from "@/lib/dates";
import { NOTE_DISAGREEMENT, type Digest, type DigestRelease, type DigestStats, type WatchLine } from "@/lib/digest-types";

const newest = (a: DigestRelease, b: DigestRelease) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

export interface BuildInput {
  generatedAt: Date;
  window: Window;
  windowDays: number;
  source: Digest["source"];
  releases: DigestRelease[];
  reposChecked: number;
  quiet: string[];
  couldntCheck: Digest["couldntCheck"];
  evaluationWatch: WatchLine[];
  stillOpen?: DigestRelease[];
}

/**
 * How much weight a flag carries, lower = look first:
 *  0 flagged by both the rules and the AI
 *  1 flagged by the AI alone
 *  2 flagged by the rules while the AI is unavailable or hasn't run (we can't tell yet)
 *  3 flagged by the rules but the AI judged it routine (kept, shown quietly)
 */
export function confidenceRank(r: DigestRelease): number {
  if (r.flaggedBy === "AI + Rule") return 0;
  if (r.flaggedBy === "AI") return 1;
  return r.note === NOTE_DISAGREEMENT ? 3 : 2;
}

/** Security before breaking, then more-confident flags first, then newest first. */
export function compareFlagged(a: DigestRelease, b: DigestRelease): number {
  if (a.severity !== b.severity) return a.severity === "security" ? -1 : 1;
  return confidenceRank(a) - confidenceRank(b) || newest(a, b);
}

/**
 * Order the digest. The system ranks; it never hides: every release in `releases` ends up in
 * either `needsLook` or `other`.
 *  - Needs a look: security first, then breaking; within each, more-confident flags first, newest first.
 *  - Other: dependencies first, then evaluating repos, newest first within each.
 */
export function buildDigest(input: BuildInput): Digest {
  const flagged = input.releases.filter((r) => r.flagged);
  const rest = input.releases.filter((r) => !r.flagged);

  const needsLook = [...flagged].sort(compareFlagged);
  const other = [...rest].sort((a, b) => (a.tag === b.tag ? newest(a, b) : a.tag === "dependency" ? -1 : 1));

  const stats: DigestStats = {
    reposChecked: input.reposChecked,
    releases: input.releases.length,
    noteLines: input.releases.reduce((n, r) => n + r.bodyLineCount, 0),
    needALook: needsLook.length,
    security: needsLook.filter((r) => r.severity === "security").length,
    breaking: needsLook.filter((r) => r.severity === "breaking").length,
    aiFailed: input.releases.filter((r) => r.analysisState === "failed").length,
    notAnalysed: input.releases.filter((r) => r.analysisState === "not-analysed").length,
  };

  return {
    generatedAt: input.generatedAt.toISOString(),
    windowStart: input.window.start.toISOString(),
    windowEnd: input.window.end.toISOString(),
    windowDays: input.windowDays,
    source: input.source,
    stats,
    needsLook,
    stillOpen: input.stillOpen ? [...input.stillOpen].sort(compareFlagged) : undefined,
    other,
    evaluationWatch: input.evaluationWatch,
    quiet: [...input.quiet].sort(),
    couldntCheck: input.couldntCheck,
  };
}

/** "23 repos checked · 31 releases · 1,840 lines of notes → 4 need a look" */
export function headerLine(s: DigestStats): string {
  const n = (v: number, one: string, many = `${one}s`) => `${v.toLocaleString("en-US")} ${v === 1 ? one : many}`;
  const verdict = s.needALook === 0 ? "nothing needs a look" : `${s.needALook} ${s.needALook === 1 ? "needs" : "need"} a look`;
  return `${n(s.reposChecked, "repo")} checked · ${n(s.releases, "release")} · ${n(s.noteLines, "line")} of notes → ${verdict}`;
}

const PACKAGE_TAG = /^@?[^@\s]+@\d/; // "@hono/vercel@1.0.1", "next-auth@4.24.15"

/**
 * Split one repo's "other" releases so a busy monorepo or a stream of pre-releases doesn't bury the news.
 * Nothing is dropped: `pre` and `sub` are shown collapsed, with a count.
 *  - sub: releases of a sub-package inside a monorepo (tag looks like name@version); collapsed when there are 3+
 *  - pre: pre-releases; collapsed when there are 2+
 */
export function splitReleases(items: DigestRelease[]): { main: DigestRelease[]; pre: DigestRelease[]; sub: DigestRelease[] } {
  const subAll = items.filter((r) => PACKAGE_TAG.test(r.tagName));
  const sub = subAll.length >= 3 ? subAll : [];
  const rest = items.filter((r) => !sub.includes(r));
  const preAll = rest.filter((r) => r.prerelease);
  const pre = preAll.length >= 2 ? preAll : [];
  return { main: rest.filter((r) => !pre.includes(r)), pre, sub };
}
