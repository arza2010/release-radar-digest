import "server-only";
import { geminiCallsLeftToday } from "@/lib/budget";
import { markEmailSkipped, sendDigestEmail, type EmailOutcome } from "@/lib/email";
import { runDigest, type RunResult } from "@/lib/pipeline";

export interface FullRun extends RunResult {
  email: EmailOutcome | { status: "skipped"; error: null };
}

/**
 * Build the digest, save it, then email it (unless `send` is false: a dry run).
 * Gemini calls are capped by what is left of today's budget; releases beyond it stay "not yet analysed".
 */
export async function runAndEmail(opts: { trigger: "cron" | "manual"; send: boolean }): Promise<FullRun> {
  const { left } = await geminiCallsLeftToday();
  const result = await runDigest({ trigger: opts.trigger, maxGeminiCalls: left });
  if (!opts.send) {
    await markEmailSkipped(result.digestId);
    return { ...result, email: { status: "skipped", error: null } };
  }
  const email = await sendDigestEmail(result.digest, result.digestId);
  return { ...result, email };
}
