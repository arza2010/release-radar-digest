"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { removeRepoAction, setTagAction } from "@/app/repos/actions";
import type { RepoTag } from "@/lib/types";

function Pending({ children }: { children: (pending: boolean) => React.ReactNode }) {
  const { pending } = useFormStatus();
  return <>{children(pending)}</>;
}

/** Two-way tag switch: each side is its own tiny form. */
export function TagToggle({ repo, tag }: { repo: string; tag: RepoTag }) {
  return (
    <div role="group" aria-label={`Tag for ${repo}`} className="inline-flex rounded-full border border-line bg-background p-0.5 font-mono text-[11px]">
      {(["dependency", "evaluating"] as const).map((t) => (
        <form key={t} action={setTagAction}>
          <input type="hidden" name="repo" value={repo} />
          <input type="hidden" name="tag" value={t} />
          <Pending>
            {(pending) => (
              <button
                type="submit"
                disabled={pending || t === tag}
                aria-pressed={t === tag}
                className={`rounded-full px-2.5 py-1 font-medium uppercase tracking-wider transition-colors ${t === tag ? "bg-foreground text-background" : "text-muted hover:text-foreground"} ${pending ? "opacity-60" : ""}`}
              >
                {t}
              </button>
            )}
          </Pending>
        </form>
      ))}
    </div>
  );
}

/** Remove needs a second click so a stray tap can't delete a repo. */
export function RemoveButton({ repo }: { repo: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="text-xs font-medium text-muted underline-offset-2 hover:text-sec hover:underline">
        Remove
      </button>
    );
  }
  return (
    <form action={removeRepoAction} className="flex items-center gap-2 text-xs">
      <input type="hidden" name="repo" value={repo} />
      <Pending>
        {(pending) => (
          <button type="submit" disabled={pending} className="rounded-md bg-sec px-2 py-1 font-semibold text-background disabled:opacity-60">
            {pending ? "Removing…" : "Confirm remove"}
          </button>
        )}
      </Pending>
      <button type="button" onClick={() => setArmed(false)} className="text-muted hover:text-foreground">
        Cancel
      </button>
    </form>
  );
}
