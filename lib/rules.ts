import type { RuleFlag } from "@/lib/types";
import { majorBumpEvidence, type TagWithDate } from "@/lib/semver";

/** Deterministic checks. These can only add flags; nothing downstream may remove them. */
const SECURITY_PATTERNS: RegExp[] = [
  /CVE-\d{4}-\d{4,}/gi,
  /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/gi,
  /\bsecurity\b/gi,
  /\bvulnerab\w*/gi,
  /\badvisor(?:y|ies)\b/gi,
  /\bXSS\b/gi,
  /\bCSRF\b/gi,
  /\binjection\b/gi,
];

const BREAKING_PATTERNS: RegExp[] = [
  /breaking[ -]change/gi,
  /\bBREAKING\b/g, // upper-case only; lower-case "breaking" is too common in prose
  /⚠️?\s*breaking/gi,
];

const MAX_FLAGS = 12;

function collect(text: string, patterns: RegExp[], type: RuleFlag["type"], out: RuleFlag[], seen: Set<string>) {
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const evidence = match[0];
      const key = `${type}:${evidence.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type, evidence });
    }
  }
}

export interface RuleInput {
  tagName: string;
  name: string | null;
  body: string | null;
  publishedAt: string;
  /** The repo's other releases (any date), for the major-bump check. */
  history: TagWithDate[];
}

export function runRules(input: RuleInput): RuleFlag[] {
  const text = `${input.name ?? ""}\n${input.body ?? ""}`;
  const flags: RuleFlag[] = [];
  const seen = new Set<string>();

  collect(text, SECURITY_PATTERNS, "security", flags, seen);
  collect(text, BREAKING_PATTERNS, "breaking", flags, seen);

  const bump = majorBumpEvidence(input.tagName, input.publishedAt, input.history);
  if (bump) flags.push({ type: "breaking", evidence: bump });

  // Keep the major-bump flag even if text matches hit the cap.
  if (flags.length <= MAX_FLAGS) return flags;
  const bumpFlag = bump ? flags[flags.length - 1] : null;
  const trimmed = flags.slice(0, MAX_FLAGS - (bumpFlag ? 1 : 0));
  return bumpFlag ? [...trimmed, bumpFlag] : trimmed;
}

export function isRuleFlagged(flags: RuleFlag[]): boolean {
  return flags.length > 0;
}

export function ruleSeverity(flags: RuleFlag[]): "security" | "breaking" | null {
  if (flags.some((f) => f.type === "security")) return "security";
  if (flags.some((f) => f.type === "breaking")) return "breaking";
  return null;
}

const LINE_CONTEXT_BEFORE = 100;
const LINE_CONTEXT_AFTER = 140;

/**
 * Lines of `body` at or after `fromChar` that contain a security/breaking keyword, each clipped to a window
 * around the first match. Used to show the AI the parts of a very long release note that truncation cut off.
 * It only returns text that is really in the release notes.
 */
export function ruleMatchLinesAfter(body: string, fromChar: number, maxLines = 30): string[] {
  const patterns = [...SECURITY_PATTERNS, ...BREAKING_PATTERNS].map((p) => new RegExp(p.source, p.flags.replace("g", "")));
  const out: string[] = [];
  let offset = 0;
  for (const line of body.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (lineStart + line.length < fromChar) continue;
    let first = -1;
    for (const re of patterns) {
      const m = re.exec(line);
      if (m && (first === -1 || m.index < first)) first = m.index;
    }
    if (first === -1) continue;
    const from = Math.max(0, first - LINE_CONTEXT_BEFORE);
    const text = line.slice(from, first + LINE_CONTEXT_AFTER).replace(/\s+/g, " ").trim();
    if (text) out.push((from > 0 ? "…" : "") + text + (first + LINE_CONTEXT_AFTER < line.length ? "…" : ""));
    if (out.length >= maxLines) break;
  }
  return out;
}
