import "server-only";
import { fetchReleases, fetchRepoMeta, GithubError } from "@/lib/github";
import { computeCadence } from "@/lib/cadence";
import { inWindow, type Window } from "@/lib/dates";
import { mapLimit } from "@/lib/pool";
import { runRules } from "@/lib/rules";
import type { GithubRelease, RepoResult, RepoTag, ReleaseRecord } from "@/lib/types";

const EXCERPT_CHARS = 600;
const FETCH_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RepoInput {
  full_name: string;
  tag: RepoTag;
}

export function toRecord(r: GithubRelease, repo: string, tag: RepoTag, history: GithubRelease[]): ReleaseRecord {
  const body = r.body ?? "";
  const publishedAt = r.published_at as string;
  const name = r.name?.trim() || r.tag_name;
  return {
    releaseId: r.id,
    repo,
    tag,
    tagName: r.tag_name,
    name,
    htmlUrl: r.html_url,
    publishedAt,
    prerelease: r.prerelease,
    body,
    bodyLineCount: body.trim() ? body.split(/\r?\n/).length : 0,
    notesExcerpt: body.slice(0, EXCERPT_CHARS),
    ruleFlags: runRules({
      tagName: r.tag_name,
      name: r.name,
      body: r.body,
      publishedAt,
      history: history.map((h) => ({ tagName: h.tag_name, publishedAt: h.published_at as string })),
    }),
  };
}

/** Fetch one repo, keep non-draft releases inside the window, run the rules. Never throws: failures become `error`. */
export async function collectRepo(repo: RepoInput, window: Window, now: Date = new Date()): Promise<RepoResult> {
  const base = { repo: repo.full_name, tag: repo.tag };
  try {
    // Evaluating repos need ~90 days of history for cadence, whatever the window.
    const since = repo.tag === "evaluating" ? new Date(Math.min(window.start.getTime(), now.getTime() - 90 * DAY_MS)) : window.start;
    const all = await fetchReleases(repo.full_name, since);
    const releases = all
      .filter((r) => inWindow(r.published_at as string, window))
      .sort((a, b) => Date.parse(b.published_at as string) - Date.parse(a.published_at as string))
      .map((r) => toRecord(r, repo.full_name, repo.tag, all));

    const result: RepoResult = { ...base, ok: true, releases };
    if (repo.tag === "evaluating") {
      result.meta = await fetchRepoMeta(repo.full_name);
      result.cadence = computeCadence(all.map((r) => r.published_at as string), now);
    }
    return result;
  } catch (e) {
    if (!(e instanceof GithubError)) throw e; // config/programming errors must not masquerade as repo failures
    const error = e.reason;
    return { ...base, ok: false, error, releases: [] };
  }
}

export function collectAll(repos: RepoInput[], window: Window, now: Date = new Date()): Promise<RepoResult[]> {
  return mapLimit(repos, FETCH_CONCURRENCY, (r) => collectRepo(r, window, now));
}
