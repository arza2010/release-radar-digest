export type RepoTag = "dependency" | "evaluating";
export type FlagType = "security" | "breaking";

export interface RuleFlag {
  type: FlagType;
  /** The text that triggered the rule (or a description of the version bump). */
  evidence: string;
}

/** A GitHub release as returned by the releases endpoint (fields we use). */
export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
}

export interface RepoMeta {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
}

/** A release inside the digest window, with its deterministic rule flags. */
export interface ReleaseRecord {
  releaseId: number;
  repo: string;
  tag: RepoTag;
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string; // ISO
  prerelease: boolean;
  body: string; // full text, kept in memory for the AI step; only an excerpt is stored
  bodyLineCount: number;
  notesExcerpt: string;
  ruleFlags: RuleFlag[];
}

export interface Cadence {
  releasesLast90Days: number;
  daysSinceLastRelease: number | null;
  medianDaysBetweenReleases: number | null;
}

export interface RepoResult {
  repo: string;
  tag: RepoTag;
  ok: boolean;
  /** Plain-language failure reason, set when ok is false. */
  error?: string;
  releases: ReleaseRecord[];
  /** Only for evaluating repos. */
  cadence?: Cadence;
  meta?: RepoMeta;
}
