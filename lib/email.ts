import "server-only";
import { Resend } from "resend";
import type { Digest } from "@/lib/digest-types";
import { emailHtml, emailSubject, emailText } from "@/lib/email-html";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export type EmailOutcome = { status: "sent" | "failed"; error: string | null; id?: string };

/** Send the digest to DIGEST_RECIPIENT. Never throws: the outcome is recorded on the digest row. */
export async function sendDigestEmail(digest: Digest, digestId: number): Promise<EmailOutcome> {
  let outcome: EmailOutcome;
  try {
    const url = env("APP_URL").replace(/\/$/, "");
    const { data, error } = await new Resend(env("RESEND_API_KEY")).emails.send({
      from: "Release Radar <onboarding@resend.dev>",
      to: env("DIGEST_RECIPIENT"),
      subject: emailSubject(digest),
      html: emailHtml(digest, url),
      text: emailText(digest, url),
    });
    outcome = error ? { status: "failed", error: `${error.name}: ${error.message}`.slice(0, 500) } : { status: "sent", error: null, id: data?.id };
  } catch (e) {
    outcome = { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) };
  }
  await supabase().from("digests").update({ email_status: outcome.status, email_error: outcome.error }).eq("id", digestId);
  return outcome;
}

export async function markEmailSkipped(digestId: number): Promise<void> {
  await supabase().from("digests").update({ email_status: "skipped", email_error: null }).eq("id", digestId);
}
