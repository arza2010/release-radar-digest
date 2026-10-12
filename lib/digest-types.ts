import type { RepoTag, RuleFlag } from "@/lib/types";

export type AiStatus = "ok" | "failed" | "pending";
export type AiCategory = "security" | "breaking" | "routine";
export type Severity = "security" | "breaking";
export type FlaggedBy = "AI" | "Rule" | "AI + Rule";

/** What the AI step stored for a release. */
export interface AiFields {
  status: AiStatus;
  category: AiCategory | null;
  summary: string | null;
  reason: string | null;
  action: string | null;
}

export const NOTE_DISAGREEMENT = "Rule flagged; AI judged routine — check the notes";
export const NOTE_AI_FAILED = "AI summary unavailable";
export const NOTE_NOT_ANALYSED = "Not yet analysed";

/** A release as shown in the digest: stored facts + the merged verdict. */
export interface DigestRelease {
  releaseId: number;
  repo: string;
  tag: RepoTag;
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string;
  prerelease: boolean;
  bodyLineCount: number;
  notesExcerpt: string;
  ruleFlags: RuleFlag[];
  ai: AiFields;
  // merged
  flagged: boolean;
  severity: Severity | null;
  flaggedBy: FlaggedBy | null;
  /** Disagreement / AI-failed / not-analysed message, shown under the badges. */
  note: string | null;
  analysisState: "analysed" | "failed" | "not-analysed";
}

export interface WatchLine {
  repo: string;
  releasesLast90Days: number;
  daysSinceLastRelease: number | null;
  medianDaysBetweenReleases: number | null;
  stars: number;
  forks: number;
  openIssues: number;
  /** Change since the previous snapshot; null when there is no earlier snapshot. */
  starsChange: number | null;
  /** When that earlier snapshot was taken. */
  starsChangeSince: string | null;
}

export interface DigestStats {
  reposChecked: number;
  releases: number;
  noteLines: number;
  needALook: number;
  security: number;
  breaking: number;
  aiFailed: number;
  notAnalysed: number;
}

export interface Digest {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  /** "run" = built by the pipeline from live GitHub; "cache" = built from stored results only. */
  source: "run" | "cache";
  stats: DigestStats;
  needsLook: DigestRelease[];
  /** Flagged releases from before this window that nobody has marked reviewed (only when review tracking is on). */
  stillOpen?: DigestRelease[];
  other: DigestRelease[];
  evaluationWatch: WatchLine[];
  quiet: string[];
  couldntCheck: { repo: string; reason: string }[];
}
