import type { AiFields, DigestRelease } from "@/lib/digest-types";
import { merge } from "@/lib/merge";
import type { RepoTag, RuleFlag } from "@/lib/types";

/** A `release_analysis` row as returned by Supabase. */
export interface AnalysisRow {
  release_id: number | string;
  repo_full_name: string;
  tag_name: string;
  release_name: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  body_line_count: number;
  notes_excerpt: string;
  rule_flags: RuleFlag[] | null;
  ai_status: "ok" | "failed" | "pending";
  ai_category: AiFields["category"];
  ai_summary: string | null;
  ai_reason: string | null;
  ai_action: string | null;
  /** Present only once the optional review-tracking column exists. */
  reviewed_at?: string | null;
}

export function rowToRelease(row: AnalysisRow, tag: RepoTag): DigestRelease {
  const ruleFlags = row.rule_flags ?? [];
  const ai: AiFields = {
    status: row.ai_status,
    category: row.ai_category,
    summary: row.ai_summary,
    reason: row.ai_reason,
    action: row.ai_action,
  };
  return {
    releaseId: Number(row.release_id),
    repo: row.repo_full_name,
    tag,
    tagName: row.tag_name,
    name: row.release_name || row.tag_name,
    htmlUrl: row.html_url,
    publishedAt: row.published_at,
    prerelease: row.prerelease,
    bodyLineCount: row.body_line_count,
    notesExcerpt: row.notes_excerpt,
    ruleFlags,
    ai,
    ...merge(ruleFlags, ai),
  };
}
