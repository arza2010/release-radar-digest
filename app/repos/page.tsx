import { Suspense } from "react";
import { ActionsPanel } from "@/components/repos/actions-panel";
import { AddRepoForm } from "@/components/repos/add-repo-form";
import { RemoveButton, TagToggle } from "@/components/repos/row-controls";
import { MAX_REPOS } from "@/lib/repo-admin";
import { daysSince } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import type { RepoTag } from "@/lib/types";

export const metadata = { title: "Repos · Release Radar" };

// "Run digest now" and "Backfill" run from this page as server actions, so they inherit this limit.
export const maxDuration = 300;

export default function ReposPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <Repos />
      </Suspense>
    </main>
  );
}

async function Repos() {
  const db = supabase();
  const [{ data: repos, error }, { data: releases }] = await Promise.all([
    db.from("repos").select("full_name, tag").order("full_name"),
    db.from("release_analysis").select("repo_full_name, tag_name, published_at").order("published_at", { ascending: false }).limit(3000),
  ]);
  if (error) throw new Error(error.message);

  const latest = new Map<string, { tag: string; at: string }>();
  for (const r of releases ?? []) if (!latest.has(r.repo_full_name)) latest.set(r.repo_full_name, { tag: r.tag_name, at: r.published_at });

  const groups: { tag: RepoTag; title: string; blurb: string }[] = [
    { tag: "dependency", title: "Dependencies", blurb: "Libraries and services we ship against. Security and breaking changes matter most here." },
    { tag: "evaluating", title: "Evaluating", blurb: "Tools we're considering. These also get a cadence and momentum line each week." },
  ];

  return (
    <>
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Tracked repos</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          <span className="font-mono">{repos?.length ?? 0}</span> of {MAX_REPOS} repos. Edit the list here, no code needed. Changes apply from the next run. There is no login, so anyone with this link can edit.
        </p>
      </div>

      <div className="mt-6">
        <AddRepoForm />
      </div>

      {groups.map((g) => {
        const rows = (repos ?? []).filter((r) => r.tag === g.tag);
        return (
          <section key={g.tag} className="mt-10">
            <div className="flex items-baseline gap-3 border-b border-line pb-2">
              <h2 className="font-serif text-2xl font-semibold tracking-tight">{g.title}</h2>
              <span className="font-mono text-sm text-muted">{rows.length}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{g.blurb}</p>
            {rows.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No repos here yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
                {rows.map((r) => {
                  const last = latest.get(r.full_name);
                  const [owner, name] = r.full_name.split("/");
                  return (
                    <li key={r.full_name} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <a href={`https://github.com/${r.full_name}`} target="_blank" rel="noopener noreferrer" className="break-all text-sm hover:underline">
                          <span className="text-muted">{owner}/</span>
                          <span className="font-semibold">{name}</span>
                        </a>
                        <p className="font-mono text-xs text-muted">
                          {last ? `last stored release ${last.tag} · ${Math.floor(daysSince(last.at))}d ago` : "no releases stored yet"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <TagToggle repo={r.full_name} tag={r.tag as RepoTag} />
                        <RemoveButton repo={r.full_name} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <div className="mt-12">
        <ActionsPanel />
      </div>
    </>
  );
}
