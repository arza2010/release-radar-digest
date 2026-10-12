"use server";

import { revalidatePath } from "next/cache";
import { backfill90, type BackfillResult } from "@/lib/backfill";
import { BACKFILL_COOLDOWN_MS, exclusive, geminiCallsLeftToday, manualRunWaitMs } from "@/lib/budget";
import { headerLine } from "@/lib/digest";
import { addRepo, parseTag, removeRepo, setRepoTag } from "@/lib/repo-admin";
import { runAndEmail } from "@/lib/run";

/** `input` echoes what was typed so a failed attempt keeps its text; `nonce` forces the field to remount. */
export type FormState = { ok: boolean; message?: string; warnings?: string[]; input?: string; nonce: number } | null;

export async function addRepoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const nonce = Date.now();
  const input = String(formData.get("name") ?? "");
  const tag = parseTag(formData.get("tag"));
  if (!tag) return { ok: false, message: "Pick a tag: dependency or evaluating.", input, nonce };
  const res = await addRepo(input, tag);
  revalidatePath("/repos");
  revalidatePath("/");
  return res.ok ? { ok: true, message: res.message, warnings: res.warnings, nonce } : { ok: false, message: res.error, input, nonce };
}

export async function removeRepoAction(formData: FormData): Promise<void> {
  await removeRepo(String(formData.get("repo") ?? ""));
  revalidatePath("/repos");
  revalidatePath("/");
}

export async function setTagAction(formData: FormData): Promise<void> {
  const tag = parseTag(formData.get("tag"));
  if (tag) await setRepoTag(String(formData.get("repo") ?? ""), tag);
  revalidatePath("/repos");
  revalidatePath("/");
}

export type RunNowState =
  | { ok: false; error: string }
  | { ok: true; digestId: number; status: string; summary: string; geminiCalls: number; cacheHits: number; aiFailed: number; email: string; seconds: number };

/** "Run digest now". Open to anyone (no login), so it is rate-limited by a cooldown and the daily Gemini budget. */
export async function runNowAction(send: boolean): Promise<RunNowState> {
  try {
    const wait = await manualRunWaitMs();
    if (wait > 0) return { ok: false, error: `A manual run finished recently. Try again in ${Math.ceil(wait / 60000)} min. This limit protects the free AI quota.` };
    const out = await exclusive(() => runAndEmail({ trigger: "manual", send }));
    if (out === "busy") return { ok: false, error: "A run is already in progress. Give it a couple of minutes." };
    revalidatePath("/");
    return {
      ok: true,
      digestId: out.digestId,
      status: out.status,
      summary: headerLine(out.digest.stats),
      geminiCalls: out.analysis.geminiCalls,
      cacheHits: out.analysis.cached,
      aiFailed: out.analysis.failed,
      email: out.email.status === "sent" ? "sent" : out.email.status === "skipped" ? "skipped (dry run)" : `failed: ${out.email.error}`,
      seconds: Math.round(out.durationMs / 100) / 10,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The run failed." };
  }
}

let lastBackfillAt = 0;

export type BackfillState = { ok: false; error: string } | ({ ok: true } & BackfillResult);

/** "Backfill 90 days": analyses uncached releases in resumable chunks. */
export async function backfillAction(): Promise<BackfillState> {
  try {
    const wait = lastBackfillAt + BACKFILL_COOLDOWN_MS - Date.now();
    if (wait > 0) return { ok: false, error: `Just ran. Try again in ${Math.ceil(wait / 1000)}s.` };
    const { left } = await geminiCallsLeftToday();
    if (left === 0) return { ok: false, error: "Today's AI budget is used up (a safety cap for the free Gemini quota). Try again tomorrow; progress is saved." };
    const out = await exclusive(backfill90);
    if (out === "busy") return { ok: false, error: "A run is already in progress. Give it a couple of minutes." };
    lastBackfillAt = Date.now();
    revalidatePath("/");
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The backfill failed." };
  }
}
