import type { Cadence } from "@/lib/types";
import { daysBetween } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Release cadence from releases already fetched (no extra API calls).
 * `publishedAt` = ISO dates of every non-draft release we have, any order.
 * The median gap uses all fetched releases (up to the latest ~30).
 */
export function computeCadence(publishedAt: string[], now: Date = new Date()): Cadence {
  const times = publishedAt.map((d) => Date.parse(d)).sort((a, b) => b - a); // newest first
  const cutoff = now.getTime() - 90 * DAY_MS;
  const gaps: number[] = [];
  for (let i = 0; i < times.length - 1; i++) gaps.push((times[i] - times[i + 1]) / DAY_MS);
  const m = median(gaps);
  return {
    releasesLast90Days: times.filter((t) => t >= cutoff).length,
    daysSinceLastRelease: times.length ? daysBetween(now, new Date(times[0])) : null,
    medianDaysBetweenReleases: m === null ? null : Math.round(m * 10) / 10,
  };
}

/** Stars change vs the previous snapshot; null if there is no previous snapshot. */
export function starsChange(previousStars: number | null | undefined, currentStars: number): number | null {
  return previousStars == null ? null : currentStars - previousStars;
}
