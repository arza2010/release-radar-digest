import "server-only";
import { classifyBatch, BATCH_SIZE, type BatchOutcome } from "@/lib/gemini";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { ReleaseRecord } from "@/lib/types";

export const NO_NOTES_SUMMARY = "No release notes provided.";

export interface AnalyzeStats {
  /** Releases handed in. */
  total: number;
  /** Already analysed earlier (cache hits): never sent to Gemini again. */
  cached: number;
  /** Empty notes: no AI call, fixed summary. */
  emptyNotes: number;
  analysedNow: number;
  failed: number;
  /** Not attempted because the call budget ran out; left pending for the next run. */
  deferred: number;
  geminiCalls: number;
  batches: number;
}

function baseRow(r: ReleaseRecord) {
  return {
    release_id: r.releaseId,
    repo_full_name: r.repo,
    tag_name: r.tagName,
    release_name: r.name,
    html_url: r.htmlUrl,
    published_at: r.publishedAt,
    prerelease: r.prerelease,
    body_line_count: r.bodyLineCount,
    notes_excerpt: r.notesExcerpt,
    rule_flags: r.ruleFlags,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>, what: string): Promise<T> {
  const res = await p;
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

/**
 * Make sure every release has a row in release_analysis and an AI result.
 *  - Rows with ai_status = 'ok' are cache hits and are never re-analysed.
 *  - Rows that are 'pending' or 'failed' are (re)tried, in batches of up to 8 per Gemini call.
 *  - `maxCalls` caps Gemini calls and `deadline` (epoch ms) stops new batches starting; the rest stay 'pending' so a later run can resume.
 * Each batch is written to Supabase as soon as it returns, so progress survives a timeout.
 */
export async function analyzeReleases(releases: ReleaseRecord[], opts: { maxCalls?: number; deadline?: number } = {}): Promise<AnalyzeStats> {
  const db = supabase();
  const stats: AnalyzeStats = { total: releases.length, cached: 0, emptyNotes: 0, analysedNow: 0, failed: 0, deferred: 0, geminiCalls: 0, batches: 0 };
  if (releases.length === 0) return stats;

  // 1. Ensure a row exists and keep rule flags fresh. Only base columns are sent, so AI columns on existing rows are untouched.
  for (const part of chunk(releases, 200)) {
    await must(db.from("release_analysis").upsert(part.map(baseRow), { onConflict: "release_id" }), "save releases");
  }

  // 2. What is already analysed?
  const done = new Set<number>();
  for (const part of chunk(releases.map((r) => r.releaseId), 200)) {
    const { data } = await must(db.from("release_analysis").select("release_id").in("release_id", part).eq("ai_status", "ok"), "read cache");
    for (const row of data ?? []) done.add(Number(row.release_id));
  }
  const todo = releases.filter((r) => !done.has(r.releaseId));
  stats.cached = releases.length - todo.length;

  // 3. Empty notes: no AI call.
  const empty = todo.filter((r) => !r.body.trim());
  const toAnalyse = todo.filter((r) => r.body.trim());
  for (const r of empty) {
    await must(
      db.from("release_analysis").update({ ai_status: "ok", ai_category: null, ai_summary: NO_NOTES_SUMMARY, ai_reason: "", ai_action: "", model: null, analyzed_at: new Date().toISOString() }).eq("release_id", r.releaseId),
      "save empty-notes row",
    );
  }
  stats.emptyNotes = empty.length;

  // 4. Gemini, batched.
  const model = env("GEMINI_MODEL");
  const maxCalls = opts.maxCalls ?? Infinity;
  for (const batch of chunk(toAnalyse, BATCH_SIZE)) {
    if (stats.geminiCalls >= maxCalls || Date.now() > (opts.deadline ?? Infinity)) {
      stats.deferred += batch.length;
      continue;
    }
    const report = await classifyBatch(batch);
    stats.geminiCalls += report.calls;
    stats.batches++;
    const now = new Date().toISOString();
    for (const r of batch) {
      const outcome: BatchOutcome = report.outcomes.get(r.releaseId) ?? { ok: false, error: "missing from AI response" };
      if (outcome.ok) {
        stats.analysedNow++;
        await must(
          db.from("release_analysis").update({ ai_status: "ok", ai_category: outcome.result.category, ai_summary: outcome.result.summary, ai_reason: outcome.result.reason, ai_action: outcome.result.action, model, analyzed_at: now }).eq("release_id", r.releaseId),
          "save analysis",
        );
      } else {
        stats.failed++;
        await must(
          db.from("release_analysis").update({ ai_status: "failed", ai_category: null, ai_summary: null, ai_reason: outcome.error, ai_action: null, model, analyzed_at: now }).eq("release_id", r.releaseId),
          "save failure",
        );
      }
    }
  }
  return stats;
}
