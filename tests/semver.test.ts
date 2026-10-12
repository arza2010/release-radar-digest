import { describe, expect, it } from "vitest";
import { isMajorBump, majorBumpEvidence, parseTag } from "@/lib/semver";

const h = (tagName: string, publishedAt: string) => ({ tagName, publishedAt });

describe("parseTag", () => {
  it("ignores a leading v", () => {
    expect(parseTag("v4.2.1")).toMatchObject({ major: 4, minor: 2, patch: 1, pre: null });
    expect(parseTag("4.2.1")).toMatchObject({ major: 4, minor: 2, patch: 1 });
  });
  it("reads pre-release tags", () => {
    expect(parseTag("v5.0.0-rc.1")).toMatchObject({ major: 5, pre: "rc.1" });
  });
  it("accepts two-part versions", () => {
    expect(parseTag("v1.25")).toMatchObject({ major: 1, minor: 25, patch: 0 });
  });
  it("keeps a package prefix for monorepo tags", () => {
    expect(parseTag("jose-v5.1.0")).toMatchObject({ prefix: "jose-", major: 5 });
  });
  it("returns null for non-semver tags", () => {
    expect(parseTag("latest")).toBeNull();
    expect(parseTag("nightly")).toBeNull();
  });
});

describe("isMajorBump", () => {
  const p = (t: string) => parseTag(t)!;
  it("flags a higher major", () => expect(isMajorBump(p("v5.0.0"), p("v4.9.9"))).toBe(true));
  it("does not flag minor or patch", () => {
    expect(isMajorBump(p("v4.10.0"), p("v4.9.9"))).toBe(false);
    expect(isMajorBump(p("v4.9.10"), p("v4.9.9"))).toBe(false);
  });
  it("counts 0.x minor bumps as major", () => {
    expect(isMajorBump(p("v0.4.0"), p("v0.3.9"))).toBe(true);
    expect(isMajorBump(p("v0.3.10"), p("v0.3.9"))).toBe(false);
  });
  it("does not flag 0.x → 1.0 differently from a normal major", () => {
    expect(isMajorBump(p("v1.0.0"), p("v0.9.0"))).toBe(true);
  });
});

describe("majorBumpEvidence", () => {
  const history = [
    h("v4.18.0", "2025-01-01T00:00:00Z"),
    h("v4.18.1", "2025-02-01T00:00:00Z"),
    h("v5.0.0", "2025-03-01T00:00:00Z"),
  ];
  it("flags the first release of a new major, with evidence", () => {
    expect(majorBumpEvidence("v5.0.0", "2025-03-01T00:00:00Z", history)).toBe("major version bump: v4.18.1 → v5.0.0");
  });
  it("does not flag a backport shipped after the new major", () => {
    const hist = [...history, h("v4.18.2", "2025-04-01T00:00:00Z")];
    expect(majorBumpEvidence("v4.18.2", "2025-04-01T00:00:00Z", hist)).toBeNull();
  });
  it("does not flag 5.0.1 just because a 4.x backport came between", () => {
    const hist = [...history, h("v4.18.2", "2025-04-01T00:00:00Z"), h("v5.0.1", "2025-05-01T00:00:00Z")];
    expect(majorBumpEvidence("v5.0.1", "2025-05-01T00:00:00Z", hist)).toBeNull();
  });
  it("keeps every release candidate of a new major flagged, and the final too", () => {
    const hist = [
      h("v4.9.0", "2025-01-01T00:00:00Z"),
      h("v5.0.0-rc.1", "2025-02-01T00:00:00Z"),
      h("v5.0.0-rc.2", "2025-02-10T00:00:00Z"),
      h("v5.0.0", "2025-03-01T00:00:00Z"),
    ];
    expect(majorBumpEvidence("v5.0.0-rc.1", "2025-02-01T00:00:00Z", hist)).not.toBeNull();
    expect(majorBumpEvidence("v5.0.0-rc.2", "2025-02-10T00:00:00Z", hist)).not.toBeNull();
    expect(majorBumpEvidence("v5.0.0", "2025-03-01T00:00:00Z", hist)).not.toBeNull();
  });
  it("falls back to pre-releases when a repo never shipped a stable version", () => {
    const hist = [h("v1.0.0-beta.1", "2025-01-01T00:00:00Z"), h("v1.0.0-beta.2", "2025-02-01T00:00:00Z")];
    expect(majorBumpEvidence("v1.0.0-beta.2", "2025-02-01T00:00:00Z", hist)).toBeNull();
  });
  it("is null with no earlier release or unparsable tags", () => {
    expect(majorBumpEvidence("v1.0.0", "2025-01-01T00:00:00Z", [h("v1.0.0", "2025-01-01T00:00:00Z")])).toBeNull();
    expect(majorBumpEvidence("nightly", "2025-01-01T00:00:00Z", history)).toBeNull();
  });
  it("only compares tags with the same package prefix", () => {
    const hist = [h("core-v1.2.0", "2025-01-01T00:00:00Z"), h("v9.0.0", "2025-01-02T00:00:00Z"), h("core-v1.3.0", "2025-02-01T00:00:00Z")];
    expect(majorBumpEvidence("core-v1.3.0", "2025-02-01T00:00:00Z", hist)).toBeNull();
  });
  it("0.x minor bump is flagged", () => {
    const hist = [h("v0.3.4", "2025-01-01T00:00:00Z"), h("v0.4.0", "2025-02-01T00:00:00Z")];
    expect(majorBumpEvidence("v0.4.0", "2025-02-01T00:00:00Z", hist)).toBe("major version bump: v0.3.4 → v0.4.0");
  });
});
