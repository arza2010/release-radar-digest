import { ruleSeverity } from "@/lib/rules";
import {
  NOTE_AI_FAILED,
  NOTE_DISAGREEMENT,
  NOTE_NOT_ANALYSED,
  type AiFields,
  type DigestRelease,
  type FlaggedBy,
  type Severity,
} from "@/lib/digest-types";
import type { RuleFlag } from "@/lib/types";

export interface MergeResult {
  flagged: boolean;
  severity: Severity | null;
  flaggedBy: FlaggedBy | null;
  note: string | null;
  analysisState: DigestRelease["analysisState"];
}

/**
 * Combine the deterministic rule flags with the AI verdict.
 *
 * The one-way rule: the AI can raise a flag, never lower one.
 *   flagged = ruleFlagged OR AI said security/breaking
 * Nothing here can remove a release; a failed or missing AI result just means we show the notes excerpt.
 */
export function merge(ruleFlags: RuleFlag[], ai: AiFields): MergeResult {
  const ruleSev = ruleSeverity(ruleFlags);
  const aiOk = ai.status === "ok";
  const aiSev: Severity | null = aiOk && (ai.category === "security" || ai.category === "breaking") ? ai.category : null;

  const flagged = ruleSev !== null || aiSev !== null;
  const severity: Severity | null = ruleSev === "security" || aiSev === "security" ? "security" : flagged ? "breaking" : null;
  const flaggedBy: FlaggedBy | null = ruleSev && aiSev ? "AI + Rule" : aiSev ? "AI" : ruleSev ? "Rule" : null;

  let note: string | null = null;
  let analysisState: MergeResult["analysisState"] = "analysed";
  if (ai.status === "failed") {
    note = NOTE_AI_FAILED;
    analysisState = "failed";
  } else if (ai.status === "pending") {
    note = NOTE_NOT_ANALYSED;
    analysisState = "not-analysed";
  } else if (ruleSev && ai.category === "routine") {
    note = NOTE_DISAGREEMENT;
  }
  return { flagged, severity, flaggedBy, note, analysisState };
}
