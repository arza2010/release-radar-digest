import "server-only";
import { cacheLife } from "next/cache";
import { fetchRelease } from "@/lib/github";
import { supabase } from "@/lib/supabase";

export type RawNotesResult = { ok: true; body: string; truncated: boolean } | { ok: false; error: string };

const MAX_CHARS = 30000;

/** Fetched from GitHub on demand, then cached by Next so repeat opens cost nothing. */
async function cachedBody(repo: string, releaseId: number): Promise<string> {
  "use cache";
  cacheLife("days");
  const release = await fetchRelease(repo, releaseId);
  return release.body ?? "";
}

/**
 * Raw release notes for the "Show raw notes" toggle.
 * Only releases already in our own table can be requested, so this can't be used to read arbitrary repos.
 */
export async function getRawNotes(repo: string, releaseId: number): Promise<RawNotesResult> {
  if (!Number.isSafeInteger(releaseId)) return { ok: false, error: "Invalid release." };
  const { data, error } = await supabase().from("release_analysis").select("release_id").eq("release_id", releaseId).eq("repo_full_name", repo).maybeSingle();
  if (error || !data) return { ok: false, error: "Release not found." };
  try {
    const body = await cachedBody(repo, releaseId);
    if (!body.trim()) return { ok: true, body: "(This release has no notes.)", truncated: false };
    return { ok: true, body: body.slice(0, MAX_CHARS), truncated: body.length > MAX_CHARS };
  } catch {
    return { ok: false, error: "Couldn't load the notes from GitHub. Try again, or open the release on GitHub." };
  }
}
