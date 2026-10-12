import "server-only";
import { fetchReleases, fetchRepoMeta, GithubError } from "@/lib/github";
import { parseRepoInput } from "@/lib/repo-input";
import { supabase } from "@/lib/supabase";
import type { RepoTag } from "@/lib/types";

/** Keeps a run comfortably inside GitHub's rate limit and Vercel's 300s function limit. */
export const MAX_REPOS = 40;

export type RepoActionResult = { ok: true; message: string; warnings: string[] } | { ok: false; error: string };

export function parseTag(value: unknown): RepoTag | null {
  return value === "dependency" || value === "evaluating" ? value : null;
}

export async function addRepo(rawName: string, tag: RepoTag): Promise<RepoActionResult> {
  const parsed = parseRepoInput(rawName);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const db = supabase();
  const { count, error: countError } = await db.from("repos").select("*", { count: "exact", head: true });
  if (countError) return { ok: false, error: "Couldn't read the repo list. Try again." };
  if ((count ?? 0) >= MAX_REPOS) return { ok: false, error: `The list is limited to ${MAX_REPOS} repos so a weekly run stays fast. Remove one first.` };

  // Validate against live GitHub and use GitHub's canonical name (handles renamed repos).
  let fullName: string;
  const warnings: string[] = [];
  try {
    const meta = await fetchRepoMeta(parsed.fullName);
    fullName = meta.full_name.toLowerCase();
    if (meta.archived) warnings.push("This repo is archived, so it is unlikely to publish new releases.");
    const releases = await fetchReleases(fullName, new Date(Date.now() - 90 * 86_400_000), 1);
    if (releases.length === 0) warnings.push("This repo has no GitHub releases (it may only push tags), so it will always appear under “Quiet”.");
  } catch (e) {
    if (e instanceof GithubError) {
      if (e.reason === "not found (check the name)") return { ok: false, error: `GitHub can't find ${parsed.fullName}. Check the spelling and that the repo is public.` };
      if (e.reason === "rate limited") return { ok: false, error: "GitHub is rate-limiting us right now. Try again in a minute." };
      return { ok: false, error: "GitHub returned an error while checking that repo. Try again." };
    }
    throw e;
  }

  const { error } = await db.from("repos").insert({ full_name: fullName, tag, active: true });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `${fullName} is already being tracked.` };
    return { ok: false, error: "Couldn't save the repo. Try again." };
  }
  return { ok: true, message: `Added ${fullName} as ${tag === "dependency" ? "a dependency" : "an evaluating repo"}. It will be included from the next run.`, warnings };
}

export async function removeRepo(fullName: string): Promise<RepoActionResult> {
  const { error } = await supabase().from("repos").delete().eq("full_name", fullName.toLowerCase());
  if (error) return { ok: false, error: "Couldn't remove the repo. Try again." };
  return { ok: true, message: `Removed ${fullName}.`, warnings: [] };
}

export async function setRepoTag(fullName: string, tag: RepoTag): Promise<RepoActionResult> {
  const { error } = await supabase().from("repos").update({ tag }).eq("full_name", fullName.toLowerCase());
  if (error) return { ok: false, error: "Couldn't change the tag. Try again." };
  return { ok: true, message: `${fullName} is now ${tag}.`, warnings: [] };
}
