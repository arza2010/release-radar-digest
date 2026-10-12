import Link from "next/link";
import { SOURCE_URL } from "@/lib/site";

const LINKS = [
  { href: "/about", title: "How it works", body: "The pipeline, step by step: pull, rules, AI, merge, deliver." },
  { href: "/about#which-repos", title: "Which repos it watches", body: "A hand-picked list you control. How to add your own." },
  { href: "/about#who-does-what", title: "AI, rules or human?", body: "What each part decides, and what it never does." },
  { href: "/about#known-limits", title: "Known limits", body: "What this can't see, stated honestly." },
];

/** A small pointer at the end of the digest for anyone who wants to understand how it was built. */
export function UnderTheHood() {
  return (
    <aside aria-labelledby="under-the-hood" className="mt-16 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="under-the-hood" className="font-serif text-xl font-semibold tracking-tight">
          Curious how this was built?
        </h2>
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted underline underline-offset-2 hover:text-foreground">
          Source code on GitHub ↗
        </a>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group block rounded-lg border border-line bg-background p-3 transition-colors hover:border-accent">
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {l.title}
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent">→</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{l.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
