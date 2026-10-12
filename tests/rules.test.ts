import { describe, expect, it } from "vitest";
import { isRuleFlagged, runRules, ruleSeverity } from "@/lib/rules";

const base = { tagName: "v1.2.3", name: "v1.2.3", publishedAt: "2025-06-01T00:00:00Z", history: [] as { tagName: string; publishedAt: string }[] };
const run = (body: string | null, over: Partial<typeof base> = {}) => runRules({ ...base, body, ...over });

describe("security rules", () => {
  it("catches CVE ids", () => {
    const f = run("Fixes CVE-2024-12345 in the parser");
    expect(f).toContainEqual({ type: "security", evidence: "CVE-2024-12345" });
  });
  it("catches GHSA ids", () => {
    const f = run("See GHSA-abcd-1234-wxyz for details");
    expect(f.find((x) => x.evidence.startsWith("GHSA"))).toBeTruthy();
  });
  it("catches the keywords case-insensitively", () => {
    for (const word of ["security", "Vulnerability", "vulnerabilities", "advisory", "XSS", "csrf", "SQL injection"]) {
      expect(ruleSeverity(run(`This release addresses ${word} issues`))).toBe("security");
    }
  });
  it("does not match inside unrelated words", () => {
    expect(run("insecurity of mind; reinjection of hope")).toEqual([]);
  });
  it("looks at the release name too", () => {
    expect(ruleSeverity(run("nothing here", { name: "Security release 1.2.3" }))).toBe("security");
  });
  it("stores each distinct hit once, with evidence", () => {
    const f = run("security security SECURITY");
    expect(f.filter((x) => x.type === "security")).toHaveLength(1);
  });
});

describe("breaking rules", () => {
  it("catches the phrases", () => {
    expect(ruleSeverity(run("## Breaking Changes\n- removed foo"))).toBe("breaking");
    expect(ruleSeverity(run("BREAKING: dropped Node 16"))).toBe("breaking");
    expect(ruleSeverity(run("⚠️ Breaking: new default"))).toBe("breaking");
    expect(ruleSeverity(run("⚠ breaking"))).toBe("breaking");
  });
  it("ignores lower-case 'breaking' in prose", () => {
    expect(run("fix a bug that was breaking the build")).toEqual([]);
  });
  it("adds a major-bump flag with evidence", () => {
    const f = run("Big release", {
      tagName: "v5.0.0",
      history: [{ tagName: "v4.9.0", publishedAt: "2025-05-01T00:00:00Z" }, { tagName: "v5.0.0", publishedAt: "2025-06-01T00:00:00Z" }],
    });
    expect(f).toEqual([{ type: "breaking", evidence: "major version bump: v4.9.0 → v5.0.0" }]);
  });
});

describe("severity and flagging", () => {
  it("security outranks breaking", () => {
    expect(ruleSeverity(run("BREAKING and also CVE-2025-0001"))).toBe("security");
  });
  it("empty / null notes are not flagged", () => {
    expect(isRuleFlagged(run(null))).toBe(false);
    expect(isRuleFlagged(run(""))).toBe(false);
  });
  it("caps flags but keeps the major-bump flag", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `CVE-2024-${1000 + i}`).join(" ");
    const f = run(ids, {
      tagName: "v5.0.0",
      history: [{ tagName: "v4.0.0", publishedAt: "2025-05-01T00:00:00Z" }],
    });
    expect(f.length).toBeLessThanOrEqual(12);
    expect(f.at(-1)?.evidence).toContain("major version bump");
  });
});

import { ruleMatchLinesAfter } from "@/lib/rules";

describe("ruleMatchLinesAfter", () => {
  const body = "CVE-2020-0001 early line\nplain\nlater: fixes CVE-2026-1234 in jwt\nmore plain\nBREAKING: dropped node 16";
  it("returns only matching lines at or after the offset", () => {
    const from = body.indexOf("plain");
    const lines = ruleMatchLinesAfter(body, from);
    expect(lines).toEqual(["later: fixes CVE-2026-1234 in jwt", "BREAKING: dropped node 16"]);
  });
  it("clips very long lines around the match", () => {
    const long = `${"a ".repeat(500)}CVE-2026-5555${" b".repeat(500)}`;
    const [line] = ruleMatchLinesAfter(long, 0);
    expect(line).toContain("CVE-2026-5555");
    expect(line.length).toBeLessThan(300);
  });
  it("respects the max line count", () => {
    const many = Array.from({ length: 50 }, (_, i) => `CVE-2026-${1000 + i}`).join("\n");
    expect(ruleMatchLinesAfter(many, 0, 10)).toHaveLength(10);
  });
});
