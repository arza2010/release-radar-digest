"use server";

import { getLatestDigest } from "@/lib/digest-store";
import { sendDigestEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { refreshLive, type LiveResult } from "@/lib/live";
import { getRawNotes as load, type RawNotesResult } from "@/lib/raw-notes";
import { setManyReviewed, setReviewed } from "@/lib/reviewed";
import { revalidatePath } from "next/cache";

export async function getRawNotes(repo: string, releaseId: number): Promise<RawNotesResult> {
  return load(String(repo), Number(releaseId));
}

export type EmailNowState = { ok: true; to: string; subjectWeek: string } | { ok: false; error: string };

const EMAIL_COOLDOWN_MS = 60_000;
let lastEmailAt = 0; // best effort per server instance; Resend's own daily limit is the backstop

const mask = (email: string) => email.replace(/^(.).*?(@.*)$/, "$1***$2");

/**
 * "Email me this digest": sends the latest saved digest to DIGEST_RECIPIENT right now.
 * No GitHub or Gemini calls, so it is instant and free. Open to anyone (no login), hence the cooldown.
 */
export async function emailLatestDigestAction(): Promise<EmailNowState> {
  try {
    const wait = lastEmailAt + EMAIL_COOLDOWN_MS - Date.now();
    if (wait > 0) return { ok: false, error: `Just sent one. Try again in ${Math.ceil(wait / 1000)}s.` };
    const latest = await getLatestDigest();
    if (!latest) return { ok: false, error: "There is no saved digest to send yet. Run one from the Repos page first." };
    lastEmailAt = Date.now();
    const outcome = await sendDigestEmail(latest.digest, latest.id);
    if (outcome.status === "failed") {
      lastEmailAt = 0;
      return { ok: false, error: `The email service rejected it: ${outcome.error}` };
    }
    return { ok: true, to: mask(env("DIGEST_RECIPIENT")), subjectWeek: new Date(latest.runAt).toISOString() };
  } catch (e) {
    lastEmailAt = 0;
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't send the email." };
  }
}

/**
 * Record that someone has looked at a flagged release. Open to anyone (no login); a no-op until review tracking is
 * switched on. It deliberately doesn't re-render the page: the card stays put (with an undo) until the next load.
 */
export async function setReviewedAction(releaseId: number, reviewed: boolean): Promise<{ ok: boolean; error?: string }> {
  return setReviewed(Number(releaseId), Boolean(reviewed));
}

/** "Mark all as reviewed" for the Still open backlog. */
export async function setManyReviewedAction(releaseIds: number[]): Promise<{ ok: boolean; count?: number; error?: string }> {
  const res = await setManyReviewed(Array.isArray(releaseIds) ? releaseIds.map(Number) : []);
  if (res.ok) revalidatePath("/");
  return res;
}

/** Called by the dashboard when it opens (and every ~10 minutes while it stays open). Throttled server-side. */
export async function refreshLiveAction(): Promise<LiveResult> {
  return refreshLive();
}
