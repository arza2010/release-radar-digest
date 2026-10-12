import "server-only";
import { BATCH_SIZE } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";

/**
 * With no login, anyone can press "Run now" or "Backfill". These limits keep the Gemini free tier safe.
 * Gemini usage is estimated from release_analysis rows analysed since 00:00 UTC (each call handles up to
 * BATCH_SIZE rows), so no extra table is needed. The estimate is a lower bound.
 */
export const DAILY_CALL_CAP = 20;
export const MANUAL_COOLDOWN_MS = 10 * 60 * 1000;
export const BACKFILL_COOLDOWN_MS = 60 * 1000;

export async function geminiCallsLeftToday(): Promise<{ used: number; left: number }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase()
    .from("release_analysis")
    .select("*", { count: "exact", head: true })
    .not("model", "is", null)
    .gte("analyzed_at", startOfDay.toISOString());
  if (error) throw new Error(`read usage: ${error.message}`);
  const used = Math.ceil((count ?? 0) / BATCH_SIZE);
  return { used, left: Math.max(0, DAILY_CALL_CAP - used) };
}

/** Milliseconds until the next manual run is allowed (0 = allowed now). */
export async function manualRunWaitMs(): Promise<number> {
  const { data, error } = await supabase().from("digests").select("run_at").eq("trigger", "manual").order("run_at", { ascending: false }).limit(1);
  if (error) throw new Error(`read cooldown: ${error.message}`);
  if (!data?.length) return 0;
  return Math.max(0, Date.parse(data[0].run_at) + MANUAL_COOLDOWN_MS - Date.now());
}

// Best-effort guard against double clicks on one server instance (the cooldown above covers the rest).
let busy = false;
export async function exclusive<T>(fn: () => Promise<T>): Promise<T | "busy"> {
  if (busy) return "busy";
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}
