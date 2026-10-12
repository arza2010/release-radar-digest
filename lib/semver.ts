export interface ParsedTag {
  /** Non-numeric text before the version, lowercased, trailing "v" removed (monorepo package name, usually ""). */
  prefix: string;
  major: number;
  minor: number;
  patch: number;
  /** Pre-release identifier such as "rc.1", or null for a stable version. */
  pre: string | null;
}

const TAG_RE = /^([^\d]*?)(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parse a release tag like "v4.2.1", "4.0.0-rc.1" or "jose-v5.0.0". Returns null if it isn't semver-like. */
export function parseTag(tag: string): ParsedTag | null {
  const m = TAG_RE.exec(tag.trim());
  if (!m) return null;
  const prefix = m[1].toLowerCase().replace(/v$/, "");
  return {
    prefix,
    major: Number(m[2]),
    minor: Number(m[3]),
    patch: m[4] === undefined ? 0 : Number(m[4]),
    pre: m[5] ?? null,
  };
}

/** Compare by major.minor.patch only (pre-release ignored). */
export function compareCore(a: ParsedTag, b: ParsedTag): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Is `current` a major bump over `previous`?
 * 0.x counts: a minor bump while the major is 0 is treated as major.
 */
export function isMajorBump(current: ParsedTag, previous: ParsedTag): boolean {
  if (current.major > previous.major) return true;
  return current.major === 0 && previous.major === 0 && current.minor > previous.minor;
}

export interface TagWithDate {
  tagName: string;
  publishedAt: string;
}

/**
 * Decide whether `tagName` published at `publishedAt` is a major bump versus the repo's earlier releases.
 *
 * The baseline is the highest earlier version (not merely the previous release by date), so a backport
 * like 4.18.2 shipped after 5.0.0 isn't misread, and 5.0.1 after a 4.x backport isn't a "bump".
 * Only tags with the same prefix are compared (monorepos publish several packages).
 * Stable versions are the baseline when any exist, so every 5.0.0-rc.N stays flagged against 4.x.
 * Returns the evidence string, or null when not a bump or not comparable.
 */
export function majorBumpEvidence(
  tagName: string,
  publishedAt: string,
  history: TagWithDate[],
): string | null {
  const current = parseTag(tagName);
  if (!current) return null;
  const at = Date.parse(publishedAt);
  const earlier = history
    .filter((h) => h.tagName !== tagName && Date.parse(h.publishedAt) <= at)
    .map((h) => ({ tagName: h.tagName, parsed: parseTag(h.tagName) }))
    .filter((h): h is { tagName: string; parsed: ParsedTag } => h.parsed !== null && h.parsed.prefix === current.prefix);
  if (earlier.length === 0) return null;
  const stable = earlier.filter((h) => h.parsed.pre === null);
  const pool = stable.length > 0 ? stable : earlier;
  const base = pool.reduce((best, h) => (compareCore(h.parsed, best.parsed) > 0 ? h : best));
  return isMajorBump(current, base.parsed)
    ? `major version bump: ${base.tagName} → ${tagName}`
    : null;
}
