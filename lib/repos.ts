import "server-only";
import { supabase } from "@/lib/supabase";
import type { RepoInput } from "@/lib/collect";

/** Active tracked repos, dependencies first. */
export async function getActiveRepos(): Promise<RepoInput[]> {
  const { data, error } = await supabase().from("repos").select("full_name, tag").eq("active", true).order("tag").order("full_name");
  if (error) throw new Error(`load repos: ${error.message}`);
  return (data ?? []) as RepoInput[];
}
