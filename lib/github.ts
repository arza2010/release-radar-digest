import "server-only";
import { env } from "@/lib/env";
import type { GithubRelease, RepoMeta } from "@/lib/types";

/**
 * GitHub REST client. By design it can only reach two things:
 *   GET /repos/{owner}/{repo}/releases        (and /releases/{id})
 *   GET /repos/{owner}/{repo}                 (metadata: stars, forks, existence)
 * No issues, pull requests, comments or commits are ever requested.
 */
const API = "https://api.github.com";
const PER_PAGE = 30;

export type GithubErrorReason = "not found (check the name)" | "rate limited" | "GitHub error";

export class GithubError extends Error {
  constructor(
    public reason: GithubErrorReason,
    public status: number,
    detail?: string,
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
  }
}

/** Updated after every response; handy for scripts that report quota. */
export const rateLimit = { remaining: null as number | null, limit: null as number | null, resetAt: null as Date | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ghGet<T>(path: string): Promise<T> {
  const url = `${API}${path}`;
  const token = env("GITHUB_TOKEN"); // a missing token is a setup error: throw, don't report it as a repo failure
  let lastError: GithubError | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "release-radar",
        },
        cache: "no-store",
      });
    } catch (e) {
      lastError = new GithubError("GitHub error", 0, e instanceof Error ? e.message : "network error");
      await sleep(800);
      continue;
    }

    const remaining = res.headers.get("x-ratelimit-remaining");
    const limit = res.headers.get("x-ratelimit-limit");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining !== null) rateLimit.remaining = Number(remaining);
    if (limit !== null) rateLimit.limit = Number(limit);
    if (reset !== null) rateLimit.resetAt = new Date(Number(reset) * 1000);

    if (res.ok) return (await res.json()) as T;

    if (res.status === 404) throw new GithubError("not found (check the name)", 404);
    if (res.status === 429 || (res.status === 403 && (remaining === "0" || res.headers.has("retry-after")))) {
      throw new GithubError("rate limited", res.status);
    }
    lastError = new GithubError("GitHub error", res.status, `HTTP ${res.status}`);
    if (res.status >= 500) {
      await sleep(800);
      continue; // one retry on 5xx
    }
    throw lastError;
  }
  throw lastError ?? new GithubError("GitHub error", 0);
}

export function fetchRepoMeta(fullName: string): Promise<RepoMeta> {
  return ghGet<RepoMeta>(`/repos/${fullName}`);
}

/**
 * Fetch releases, newest-first pages of 30, until a page reaches back past `since` (or maxPages).
 * Drafts are dropped. Going back past `since` also gives the earlier releases the major-bump check needs.
 */
export async function fetchReleases(fullName: string, since: Date, maxPages = 4): Promise<GithubRelease[]> {
  const all: GithubRelease[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await ghGet<GithubRelease[]>(`/repos/${fullName}/releases?per_page=${PER_PAGE}&page=${page}`);
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
    const oldest = Math.min(...batch.map((r) => (r.published_at ? Date.parse(r.published_at) : Infinity)));
    if (oldest < since.getTime()) break;
  }
  return all.filter((r) => !r.draft && r.published_at);
}

/** One release by id (for the dashboard's "Show raw notes" toggle). */
export function fetchRelease(fullName: string, releaseId: number): Promise<GithubRelease> {
  return ghGet<GithubRelease>(`/repos/${fullName}/releases/${releaseId}`);
}
