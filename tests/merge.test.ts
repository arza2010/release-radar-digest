import { describe, expect, it } from "vitest";
import { buildDigest, headerLine } from "@/lib/digest";
import { NOTE_AI_FAILED, NOTE_DISAGREEMENT, NOTE_NOT_ANALYSED, type AiFields, type DigestRelease } from "@/lib/digest-types";
import { merge } from "@/lib/merge";
import { windowFor } from "@/lib/dates";
import type { RuleFlag } from "@/lib/types";

const sec: RuleFlag[] = [{ type: "security", evidence: "CVE-2025-0001" }];
const brk: RuleFlag[] = [{ type: "breaking", evidence: "BREAKING" }];
const ai = (category: AiFields["category"], status: AiFields["status"] = "ok"): AiFields => ({ status, category, summary: "s", reason: "", action: "" });

describe("merge: the AI can raise a flag, never lower one", () => {
  it("rule-flagged stays flagged when the AI says routine, and shows the disagreement", () => {
    for (const flags of [sec, brk]) {
      const m = merge(flags, ai("routine"));
      expect(m.flagged).toBe(true);
      expect(m.flaggedBy).toBe("Rule");
      expect(m.note).toBe(NOTE_DISAGREEMENT);
    }
    expect(merge(sec, ai("routine")).severity).toBe("security");
    expect(merge(brk, ai("routine")).severity).toBe("breaking");
  });
  it("AI alone can flag", () => {
    expect(merge([], ai("security"))).toMatchObject({ flagged: true, severity: "security", flaggedBy: "AI", note: null });
    expect(merge([], ai("breaking"))).toMatchObject({ flagged: true, severity: "breaking", flaggedBy: "AI" });
  });
  it("both flag → 'AI + Rule'", () => {
    expect(merge(sec, ai("security")).flaggedBy).toBe("AI + Rule");
    expect(merge(brk, ai("security")).flaggedBy).toBe("AI + Rule");
  });
  it("severity: security beats breaking, whichever source raised it", () => {
    expect(merge(brk, ai("security")).severity).toBe("security");
    expect(merge(sec, ai("breaking")).severity).toBe("security");
    expect(merge(brk, ai("breaking")).severity).toBe("breaking");
  });
  it("neither flags → not flagged, no note", () => {
    expect(merge([], ai("routine"))).toMatchObject({ flagged: false, severity: null, flaggedBy: null, note: null });
  });
  it("a release with empty notes (AI ok, no category) is not flagged by the AI", () => {
    expect(merge([], ai(null))).toMatchObject({ flagged: false, note: null });
    expect(merge(sec, ai(null)).flagged).toBe(true);
  });
});

describe("merge: a failed or missing AI result keeps the release", () => {
  it("failed AI: rule flag survives, 'AI summary unavailable'", () => {
    const m = merge(sec, ai(null, "failed"));
    expect(m).toMatchObject({ flagged: true, flaggedBy: "Rule", note: NOTE_AI_FAILED, analysisState: "failed" });
  });
  it("failed AI with no rule flag: not flagged but still present", () => {
    expect(merge([], ai(null, "failed"))).toMatchObject({ flagged: false, note: NOTE_AI_FAILED });
  });
  it("a stale category on a failed row is ignored", () => {
    expect(merge([], ai("security", "failed")).flagged).toBe(false);
  });
  it("not yet analysed: rules-only flags + note", () => {
    expect(merge(brk, ai(null, "pending"))).toMatchObject({ flagged: true, note: NOTE_NOT_ANALYSED, analysisState: "not-analysed" });
  });
});

function rel(id: number, over: Partial<DigestRelease> & { rules?: RuleFlag[]; aiv?: AiFields }): DigestRelease {
  const ruleFlags = over.rules ?? [];
  const a = over.aiv ?? ai("routine");
  return {
    releaseId: id, repo: `o/r${id}`, tag: "dependency", tagName: "v1", name: "v1", htmlUrl: "u",
    publishedAt: `2025-06-0${id}T00:00:00Z`, prerelease: false, bodyLineCount: 10, notesExcerpt: "", ruleFlags, ai: a,
    ...merge(ruleFlags, a), ...over,
  };
}

describe("buildDigest", () => {
  const window = windowFor(7, new Date("2025-06-10T00:00:00Z"));
  const base = { generatedAt: new Date("2025-06-10T00:00:00Z"), window, windowDays: 7, source: "run" as const, reposChecked: 5, quiet: ["z/z", "a/a"], couldntCheck: [], evaluationWatch: [] };

  it("never drops a release: needsLook + other = input", () => {
    const releases = [rel(1, {}), rel(2, { rules: sec }), rel(3, { aiv: ai("breaking") }), rel(4, { aiv: ai(null, "failed") }), rel(5, { tag: "evaluating" })];
    const d = buildDigest({ ...base, releases });
    expect(d.needsLook.length + d.other.length).toBe(releases.length);
    expect(d.stats.releases).toBe(5);
    expect(d.stats.aiFailed).toBe(1);
  });
  it("orders needs-a-look security first then breaking, newest first within each", () => {
    const releases = [
      rel(1, { aiv: ai("breaking") }),
      rel(2, { rules: sec }),
      rel(3, { aiv: ai("breaking") }),
      rel(4, { aiv: ai("security") }),
    ];
    const d = buildDigest({ ...base, releases });
    expect(d.needsLook.map((r) => r.releaseId)).toEqual([4, 2, 3, 1]);
  });
  it("orders other: dependencies before evaluating, newest first", () => {
    const releases = [rel(1, { tag: "evaluating" }), rel(2, {}), rel(3, { tag: "evaluating" }), rel(4, {})];
    const d = buildDigest({ ...base, releases });
    expect(d.other.map((r) => r.releaseId)).toEqual([4, 2, 3, 1]);
  });
  it("sorts the quiet list", () => {
    expect(buildDigest({ ...base, releases: [] }).quiet).toEqual(["a/a", "z/z"]);
  });
});

describe("headerLine", () => {
  it("matches the spec's format", () => {
    const s = { reposChecked: 23, releases: 31, noteLines: 1840, needALook: 4, security: 1, breaking: 3, aiFailed: 0, notAnalysed: 0 };
    expect(headerLine(s)).toBe("23 repos checked · 31 releases · 1,840 lines of notes → 4 need a look");
  });
  it("handles singular and zero", () => {
    expect(headerLine({ reposChecked: 1, releases: 1, noteLines: 1, needALook: 1, security: 0, breaking: 1, aiFailed: 0, notAnalysed: 0 })).toBe("1 repo checked · 1 release · 1 line of notes → 1 needs a look");
    expect(headerLine({ reposChecked: 3, releases: 0, noteLines: 0, needALook: 0, security: 0, breaking: 0, aiFailed: 0, notAnalysed: 0 })).toContain("nothing needs a look");
  });
});

import { compareFlagged, confidenceRank, splitReleases } from "@/lib/digest";
import { filterDigest, parseQuery, parseShow } from "@/lib/digest-filter";

describe("ordering by confidence", () => {
  it("ranks both > AI only > rules (AI unavailable) > rules (AI judged routine)", () => {
    const both = rel(1, { rules: sec, aiv: ai("security") });
    const aiOnly = rel(2, { aiv: ai("security") });
    const ruleUnknown = rel(3, { rules: sec, aiv: ai(null, "failed") });
    const ruleRoutine = rel(4, { rules: sec, aiv: ai("routine") });
    expect([both, aiOnly, ruleUnknown, ruleRoutine].map(confidenceRank)).toEqual([0, 1, 2, 3]);
    expect([ruleRoutine, ruleUnknown, aiOnly, both].sort(compareFlagged).map((r) => r.releaseId)).toEqual([1, 2, 3, 4]);
  });
  it("severity still wins: a rule-only security flag stays above an AI-confirmed breaking change", () => {
    const ruleOnlySecurity = rel(1, { rules: sec, aiv: ai("routine") });
    const aiBreaking = rel(2, { rules: brk, aiv: ai("breaking") });
    expect([aiBreaking, ruleOnlySecurity].sort(compareFlagged).map((r) => r.releaseId)).toEqual([1, 2]);
  });
  it("within the same severity and confidence, newest first", () => {
    const older = rel(1, { aiv: ai("breaking") });
    const newer = rel(5, { aiv: ai("breaking") });
    expect([older, newer].sort(compareFlagged).map((r) => r.releaseId)).toEqual([5, 1]);
  });
});

describe("splitReleases", () => {
  const r = (tagName: string, prerelease = false) => ({ ...rel(1, {}), tagName, prerelease });
  it("collapses 3+ monorepo sub-package releases but keeps repo releases", () => {
    const items = [r("v4.13.0"), r("@hono/vercel@1.0.1"), r("@hono/deno@1.0.3"), r("@hono/bun@1.0.1")];
    const s = splitReleases(items);
    expect(s.sub).toHaveLength(3);
    expect(s.main.map((x) => x.tagName)).toEqual(["v4.13.0"]);
  });
  it("does not collapse fewer than 3 sub-package releases", () => {
    const s = splitReleases([r("@hono/vercel@1.0.1"), r("@hono/deno@1.0.3")]);
    expect(s.sub).toHaveLength(0);
    expect(s.main).toHaveLength(2);
  });
  it("collapses 2+ pre-releases", () => {
    const s = splitReleases([r("v23.0.0"), r("v23.1.0-alpha.1", true), r("v23.1.0-alpha.2", true)]);
    expect(s.pre).toHaveLength(2);
    expect(s.main.map((x) => x.tagName)).toEqual(["v23.0.0"]);
  });
  it("never drops a release", () => {
    const items = [r("v1"), r("v2-rc.1", true), r("v2-rc.2", true), r("a@1"), r("b@1"), r("c@1")];
    const s = splitReleases(items);
    expect(s.main.length + s.pre.length + s.sub.length).toBe(items.length);
  });
});

describe("filterDigest", () => {
  const digest = () =>
    buildDigest({
      generatedAt: new Date("2025-06-10T00:00:00Z"), window: windowFor(7, new Date("2025-06-10T00:00:00Z")), windowDays: 7, source: "run", reposChecked: 3,
      releases: [
        { ...rel(1, { rules: sec, aiv: ai("security") }), repo: "stripe/stripe-node" },
        { ...rel(2, { aiv: ai("breaking") }), repo: "axios/axios" },
        { ...rel(3, {}), repo: "stripe/stripe-python" },
      ],
      quiet: ["stripe/stripe-go", "jose/jose"], couldntCheck: [], evaluationWatch: [],
    });
  it("show=security keeps only security flags, other sections untouched", () => {
    const f = filterDigest(digest(), { show: "security", q: "" });
    expect(f.needsLook.map((r) => r.releaseId)).toEqual([1]);
    expect(f.other).toHaveLength(1);
  });
  it("q matches repo names across sections, case-insensitively", () => {
    const f = filterDigest(digest(), { show: "all", q: "stripe" });
    expect(f.needsLook.map((r) => r.repo)).toEqual(["stripe/stripe-node"]);
    expect(f.other.map((r) => r.repo)).toEqual(["stripe/stripe-python"]);
    expect(f.quiet).toEqual(["stripe/stripe-go"]);
  });
  it("stats keep the full totals", () => {
    expect(filterDigest(digest(), { show: "all", q: "zzz" }).stats.releases).toBe(3);
  });
  it("parses URL params defensively", () => {
    expect(parseShow("security")).toBe("security");
    expect(parseShow("nonsense")).toBe("all");
    expect(parseShow(undefined)).toBe("all");
    expect(parseQuery("  Stripe  ")).toBe("stripe");
    expect(parseQuery("x".repeat(200))).toHaveLength(60);
  });
});
