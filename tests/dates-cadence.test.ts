import { describe, expect, it } from "vitest";
import { computeCadence, starsChange } from "@/lib/cadence";
import { formatIST, inWindow, windowFor } from "@/lib/dates";

const now = new Date("2025-06-10T12:00:00Z");

describe("window filtering", () => {
  const w = windowFor(7, now);
  it("includes releases inside the window, boundaries included", () => {
    expect(inWindow("2025-06-10T11:00:00Z", w)).toBe(true);
    expect(inWindow("2025-06-03T12:00:00Z", w)).toBe(true);
    expect(inWindow("2025-06-10T12:00:00Z", w)).toBe(true);
  });
  it("excludes releases outside it", () => {
    expect(inWindow("2025-06-03T11:59:59Z", w)).toBe(false);
    expect(inWindow("2025-06-10T12:00:01Z", w)).toBe(false);
  });
  it("30 and 90 day windows widen it", () => {
    expect(inWindow("2025-05-20T00:00:00Z", windowFor(30, now))).toBe(true);
    expect(inWindow("2025-05-20T00:00:00Z", w)).toBe(false);
    expect(inWindow("2025-03-20T00:00:00Z", windowFor(90, now))).toBe(true);
  });
});

describe("formatIST", () => {
  it("uses India time (UTC+5:30), so a late-UTC release lands on the next IST day", () => {
    expect(formatIST("2025-06-09T20:00:00Z")).toContain("10 Jun 2025");
  });
});

describe("cadence", () => {
  it("counts 90-day releases, days since last, and median gap", () => {
    const c = computeCadence(["2025-06-08T00:00:00Z", "2025-06-01T00:00:00Z", "2025-05-18T00:00:00Z", "2024-01-01T00:00:00Z"], now);
    expect(c.releasesLast90Days).toBe(3);
    expect(c.daysSinceLastRelease).toBe(2);
    expect(c.medianDaysBetweenReleases).toBe(14); // gaps: 7, 14, ~503 → median 14
  });
  it("handles zero or one release", () => {
    expect(computeCadence([], now)).toEqual({ releasesLast90Days: 0, daysSinceLastRelease: null, medianDaysBetweenReleases: null });
    expect(computeCadence(["2025-06-01T00:00:00Z"], now).medianDaysBetweenReleases).toBeNull();
  });
  it("stars change needs a previous snapshot", () => {
    expect(starsChange(100, 130)).toBe(30);
    expect(starsChange(null, 130)).toBeNull();
  });
});
