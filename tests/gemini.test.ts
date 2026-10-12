import { describe, expect, it } from "vitest";
import { BODY_CHAR_LIMIT, buildUserContent, validateResponse } from "@/lib/gemini";
import type { ReleaseRecord } from "@/lib/types";

const rel = (id: number, body: string): ReleaseRecord => ({
  releaseId: id, repo: "o/r", tag: "dependency", tagName: "v1.0.0", name: "v1.0.0", htmlUrl: "https://x",
  publishedAt: "2025-01-01T00:00:00Z", prerelease: false, body, bodyLineCount: 1, notesExcerpt: body.slice(0, 600), ruleFlags: [],
});

describe("validateResponse", () => {
  const ok = (id: string, over: Record<string, unknown> = {}) => ({ id, summary: "Did a thing.", category: "routine", reason: "", action: "", ...over });

  it("accepts a valid response for every id", () => {
    const m = validateResponse([ok("1"), ok("2", { category: "security", reason: "Fixes CVE", action: "Upgrade" })], [1, 2]);
    expect(m.get(1)).toMatchObject({ ok: true });
    expect(m.get(2)).toMatchObject({ ok: true, result: { category: "security", reason: "Fixes CVE", action: "Upgrade" } });
  });
  it("marks a release missing from the response as failed, without failing the others", () => {
    const m = validateResponse([ok("1")], [1, 2]);
    expect(m.get(1)?.ok).toBe(true);
    expect(m.get(2)).toEqual({ ok: false, error: "missing from AI response" });
  });
  it("rejects an invalid category", () => {
    const m = validateResponse([ok("1", { category: "critical" })], [1]);
    expect(m.get(1)).toMatchObject({ ok: false });
  });
  it("rejects an empty summary", () => {
    expect(validateResponse([ok("1", { summary: "  " })], [1]).get(1)).toMatchObject({ ok: false });
  });
  it("fails everything when the response is not an array", () => {
    for (const bad of [null, {}, "nope", 42]) {
      const m = validateResponse(bad, [1, 2]);
      expect([...m.values()].every((o) => !o.ok)).toBe(true);
      expect(m.size).toBe(2);
    }
  });
  it("ignores ids that were not requested", () => {
    const m = validateResponse([ok("1"), ok("99")], [1]);
    expect([...m.keys()]).toEqual([1]);
  });
  it("blanks reason/action for routine releases", () => {
    const m = validateResponse([ok("1", { reason: "stray", action: "stray" })], [1]);
    expect(m.get(1)).toMatchObject({ ok: true, result: { reason: "", action: "" } });
  });
});

describe("buildUserContent", () => {
  it("includes every release id", () => {
    const text = buildUserContent([rel(11, "a"), rel(22, "b")]);
    expect(text).toContain("id=11");
    expect(text).toContain("id=22");
  });
  it("truncates long bodies and says so in the prompt", () => {
    const text = buildUserContent([rel(1, "x".repeat(BODY_CHAR_LIMIT + 500))]);
    expect(text).toContain("TRUNCATED");
    expect(text).toContain(`first ${BODY_CHAR_LIMIT} of ${BODY_CHAR_LIMIT + 500}`);
    expect(text).not.toContain("x".repeat(BODY_CHAR_LIMIT + 1));
  });
  it("passes security lines from the cut-off tail so a late CVE section is not invisible", () => {
    const body = "intro line\n".repeat(700) + "<td>CVE-2026-9999 fixed in the token endpoint</td>\nunrelated tail line";
    const text = buildUserContent([rel(1, body)]);
    expect(text).toContain("TRUNCATED");
    expect(text).toContain("CVE-2026-9999 fixed in the token endpoint");
    expect(text).not.toContain("unrelated tail line");
  });
  it("does not mention truncation for short bodies", () => {
    expect(buildUserContent([rel(1, "short")])).not.toContain("TRUNCATED");
  });
});
