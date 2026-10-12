import { describe, expect, it } from "vitest";
import { parseRepoInput } from "@/lib/repo-input";
import { emailHtml, emailSubject, emailText, esc } from "@/lib/email-html";
import { buildDigest } from "@/lib/digest";
import { merge } from "@/lib/merge";
import { windowFor } from "@/lib/dates";
import type { AiFields, DigestRelease } from "@/lib/digest-types";
import type { RuleFlag } from "@/lib/types";

describe("parseRepoInput", () => {
  it("normalises to lowercase owner/repo", () => {
    expect(parseRepoInput("Stripe/Stripe-Node")).toEqual({ ok: true, fullName: "stripe/stripe-node" });
  });
  it("accepts URLs, .git and extra path", () => {
    for (const s of ["https://github.com/axios/axios", "github.com/axios/axios/", "https://www.github.com/axios/axios/releases/tag/v1", "axios/axios.git", "  axios/axios  "]) {
      expect(parseRepoInput(s)).toEqual({ ok: true, fullName: "axios/axios" });
    }
  });
  it("rejects bad input with a message", () => {
    for (const s of ["", "axios", "https://gitlab.com/a/b", "a b/c", "../etc", "a/b c", "x".repeat(400)]) {
      const r = parseRepoInput(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });
});

const ai = (category: AiFields["category"]): AiFields => ({ status: "ok", category, summary: "Fixes <script>alert(1)</script> things.", reason: "Because & reasons", action: "Upgrade" });
function rel(id: number, rules: RuleFlag[], a: AiFields): DigestRelease {
  return { releaseId: id, repo: "o/r", tag: "dependency", tagName: "v1.0.0", name: "v1", htmlUrl: "https://github.com/o/r/releases/tag/v1.0.0", publishedAt: "2025-06-09T00:00:00Z", prerelease: false, bodyLineCount: 3, notesExcerpt: "", ruleFlags: rules, ai: a, ...merge(rules, a) };
}
const make = (releases: DigestRelease[]) =>
  buildDigest({ generatedAt: new Date("2025-06-10T00:00:00Z"), window: windowFor(7, new Date("2025-06-10T00:00:00Z")), windowDays: 7, source: "run", releases, reposChecked: 4, quiet: ["a/a"], couldntCheck: [{ repo: "x/y", reason: "not found (check the name)" }], evaluationWatch: [] });

describe("email", () => {
  it("subject names the week and the count", () => {
    const d = make([rel(1, [{ type: "security", evidence: "CVE-2025-1" }], ai("security")), rel(2, [], ai("routine"))]);
    expect(emailSubject(d)).toBe("Release Radar · Week of 10 Jun 2025 · 1 need a look");
  });
  it("subject says Quiet week when nothing shipped", () => {
    expect(emailSubject(make([]))).toBe("Release Radar · Week of 10 Jun 2025 · Quiet week");
  });
  it("escapes HTML coming from release text", () => {
    const html = emailHtml(make([rel(1, [], ai("security"))]), "https://app.example");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(esc(`"'<&>`)).toBe("&quot;&#39;&lt;&amp;&gt;");
  });
  it("includes every section, the flag source and the dashboard link in html and text", () => {
    const d = make([rel(1, [{ type: "security", evidence: "CVE-2025-1" }], ai("routine")), rel(2, [], ai("routine"))]);
    const html = emailHtml(d, "https://app.example");
    for (const t of ["Needs a look", "Other releases", "Quiet this week", "Couldn&#39;t check", "Flagged by Rule", "https://app.example"]) expect(html).toContain(t);
    const text = emailText(d, "https://app.example");
    for (const t of ["NEEDS A LOOK (1)", "OTHER RELEASES (1)", "QUIET THIS WEEK (1)", "COULDN'T CHECK (1)", "flagged by Rule", "Rule flagged; AI judged routine", "https://app.example"]) expect(text).toContain(t);
  });
  it("a quiet week still produces a full email", () => {
    const d = make([]);
    expect(emailHtml(d, "https://app.example")).toContain("Quiet week");
    expect(emailText(d, "https://app.example")).toContain("Nothing flagged in this period.");
  });
  it("never links to a non-GitHub url", () => {
    const r = rel(1, [], ai("security"));
    r.htmlUrl = "javascript:alert(1)";
    expect(emailHtml(make([r]), "https://app.example")).not.toContain("javascript:");
  });
});

describe("email: collapsing and still-open", () => {
  const sub = (id: number, tag: string): DigestRelease => ({ ...rel(id, [], ai("routine")), repo: "honojs/hono", tagName: tag, htmlUrl: `https://github.com/honojs/hono/releases/tag/${id}` });
  it("collapses sub-package streams into one line but still links every release", () => {
    const d = make([sub(1, "@hono/a@1.0.0"), sub(2, "@hono/b@1.0.0"), sub(3, "@hono/c@1.0.0")]);
    const html = emailHtml(d, "https://app.example");
    expect(html).toContain("3 sub-package releases:");
    for (const t of ["@hono/a@1.0.0", "@hono/b@1.0.0", "@hono/c@1.0.0"]) expect(html).toContain(t);
    expect(emailText(d, "https://app.example")).toContain("3 sub-package release(s)");
  });
  it("renders a still-open section only when there are carried-over flags", () => {
    const base = make([rel(1, [], ai("routine"))]);
    expect(emailHtml(base, "https://app.example")).not.toContain("Still open");
    const withOpen = { ...base, stillOpen: [rel(9, [{ type: "security", evidence: "CVE-2025-9" }], ai("security"))] };
    expect(emailHtml(withOpen, "https://app.example")).toContain("Still open from earlier weeks");
    expect(emailText(withOpen, "https://app.example")).toContain("STILL OPEN FROM EARLIER WEEKS (1)");
  });
});
