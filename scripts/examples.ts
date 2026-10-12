/**
 * Show real analysed releases side by side: notes excerpt · rule flags · AI verdict.
 * Reads the cache only (no GitHub, no Gemini). Usage: npm run examples
 */
import { supabase } from "@/lib/supabase";
import type { RuleFlag } from "@/lib/types";

interface Row {
  release_id: number;
  repo_full_name: string;
  tag_name: string;
  notes_excerpt: string;
  body_line_count: number;
  rule_flags: RuleFlag[];
  ai_status: string;
  ai_category: string | null;
  ai_summary: string | null;
  ai_reason: string | null;
  ai_action: string | null;
  html_url: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function show(label: string, r: Row) {
  const flags = r.rule_flags.length ? r.rule_flags.slice(0, 4).map((f) => `${f.type}: "${f.evidence}"`).join("; ") : "none";
  console.log(`\n┌─ ${label}`);
  console.log(`│ ${r.repo_full_name} ${r.tag_name}  (${r.body_line_count} lines)  ${r.html_url}`);
  console.log(`│ NOTES     ${clip(r.notes_excerpt.replace(/\s+/g, " "), 280)}`);
  console.log(`│ RULES     ${flags}`);
  console.log(`│ AI        ${r.ai_category}  — ${r.ai_summary}`);
  if (r.ai_reason) console.log(`│ REASON    ${r.ai_reason}`);
  if (r.ai_action) console.log(`│ ACTION    ${r.ai_action}`);
}

async function main() {
  const { data, error } = await supabase().from("release_analysis").select("*").eq("ai_status", "ok").not("ai_category", "is", null).order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  const ruleFlagged = (r: Row) => r.rule_flags.length > 0;
  const aiFlagged = (r: Row) => r.ai_category === "security" || r.ai_category === "breaking";
  const aiOnly = rows.filter((r) => aiFlagged(r) && !ruleFlagged(r));
  const ruleOnly = rows.filter((r) => !aiFlagged(r) && ruleFlagged(r));
  const both = rows.filter((r) => aiFlagged(r) && ruleFlagged(r));
  const neither = rows.filter((r) => !aiFlagged(r) && !ruleFlagged(r));

  console.log(`${rows.length} analysed releases in the cache`);
  console.log(`  AI flagged, rules missed:   ${aiOnly.length}`);
  console.log(`  rules flagged, AI routine:  ${ruleOnly.length}`);
  console.log(`  both flagged:               ${both.length}`);
  console.log(`  neither flagged:            ${neither.length}`);
  console.log(`  (flagged overall = ${aiOnly.length + ruleOnly.length + both.length}; the AI never lowers a rule flag)`);

  aiOnly.slice(0, 3).forEach((r, i) => show(`AI CAUGHT WHAT THE RULES MISSED #${i + 1}`, r));
  ruleOnly.slice(0, 1).forEach((r) => show("DISAGREEMENT: rules flagged, AI said routine (stays flagged)", r));
  both.slice(0, 1).forEach((r) => show("BOTH FLAGGED", r));
  neither.slice(0, 1).forEach((r) => show("NEITHER FLAGGED (routine)", r));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
