import Link from "next/link";
import { formatISTShort } from "@/lib/dates";
import { confidenceRank, splitReleases } from "@/lib/digest";
import { filterDigest, SHOW_OPTIONS, viewHref, type ShowFilter } from "@/lib/digest-filter";
import type { Digest, DigestRelease, WatchLine } from "@/lib/digest-types";
import { ReviewAll } from "@/components/review-all";
import { CompactFlagCard, FeaturedCard, ReleaseRow, type ReviewProps } from "@/components/release-card";
import { RadarMark } from "@/components/radar-mark";
import { WeekStrip } from "@/components/week-strip";

export interface ViewState {
  /** Path the filters link back to, e.g. "/" or "/history/3". */
  base: string;
  /** Lookback days, only for the main dashboard (keeps the selector when filtering). */
  days?: number;
  show: ShowFilter;
  q: string;
}

const DAY_MS = 86_400_000;

function Section({ id, title, count, hint, aside, children }: { id?: string; title: string; count?: string | number; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-2">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
          {count !== undefined && <span className="font-mono text-sm text-muted">{count}</span>}
        </div>
        {aside}
      </div>
      {hint && <p className="mt-2 max-w-prose text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function groupByRepo(releases: DigestRelease[]) {
  const groups = new Map<string, { repo: string; tag: DigestRelease["tag"]; items: DigestRelease[] }>();
  for (const r of releases) {
    const g = groups.get(r.repo) ?? { repo: r.repo, tag: r.tag, items: [] };
    g.items.push(r);
    groups.set(r.repo, g);
  }
  return [...groups.values()];
}

function Hero({ digest }: { digest: Digest }) {
  const { stats } = digest;
  const n = stats.needALook;
  const open = digest.stillOpen?.length ?? 0;
  const num = (v: number) => v.toLocaleString("en-US");
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-5 py-7 sm:px-8 sm:py-9">
      <RadarMark sweep className="pointer-events-none absolute -right-16 -top-16 size-72 text-accent opacity-[0.16] sm:-right-10 sm:-top-14 sm:size-96" />
      <div className="relative">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          {formatISTShort(digest.windowStart)} – {formatISTShort(digest.windowEnd)} · IST · last {digest.windowDays} days
        </p>
        <p className="mt-3 font-mono text-sm text-muted">
          {num(stats.reposChecked)} {stats.reposChecked === 1 ? "repo" : "repos"} checked · {num(stats.releases)} {stats.releases === 1 ? "release" : "releases"} · {num(stats.noteLines)}{" "}
          {stats.noteLines === 1 ? "line" : "lines"} of notes
        </p>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-x-4 font-serif leading-none tracking-tight">
          <span aria-hidden className="text-3xl text-muted sm:text-4xl">→</span>
          <span className={`text-7xl font-semibold sm:text-8xl ${n > 0 ? "text-foreground" : "text-accent"}`}>{n === 0 ? "None" : n}</span>
          <span className="text-3xl italic sm:text-4xl">{n === 1 ? "needs a look" : "need a look"}</span>
        </h1>
        {(n > 0 || open > 0) && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {stats.security > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sec-line bg-sec-bg px-3 py-1 font-medium text-sec">
                <i className="size-2 rounded-full bg-sec" /> {stats.security} security
              </span>
            )}
            {stats.breaking > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brk-line bg-brk-bg px-3 py-1 font-medium text-brk">
                <i className="size-2 rounded-full bg-brk" /> {stats.breaking} breaking
              </span>
            )}
            {open > 0 && (
              <a href="#still-open" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1 font-medium underline-offset-2 hover:underline">
                + {open} still open from earlier weeks
              </a>
            )}
            {stats.aiFailed > 0 && <span className="text-muted">AI summary unavailable for {stats.aiFailed}</span>}
            {stats.notAnalysed > 0 && <span className="text-muted">{stats.notAnalysed} not yet analysed (rules-only flags)</span>}
          </p>
        )}
        <WeekStrip releases={[...digest.needsLook, ...digest.other]} windowStart={digest.windowStart} windowEnd={digest.windowEnd} />
      </div>
    </div>
  );
}

function Toolbar({ view }: { view: ViewState }) {
  return (
    <form action={view.base} method="get" role="search" className="mt-5 flex flex-wrap items-center gap-2">
      {view.days && view.days !== 7 && <input type="hidden" name="days" value={view.days} />}
      {view.show !== "all" && <input type="hidden" name="show" value={view.show} />}
      <label htmlFor="repo-search" className="sr-only">Filter by repo</label>
      <input
        id="repo-search"
        name="q"
        defaultValue={view.q}
        maxLength={60}
        placeholder="Filter by repo, e.g. stripe"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent sm:max-w-sm sm:flex-none sm:basis-80"
      />
      <button type="submit" className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-accent">
        Filter
      </button>
      {view.q && (
        <Link href={viewHref(view.base, { days: view.days, show: view.show })} className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
          Clear “{view.q}”
        </Link>
      )}
    </form>
  );
}

function ShowChips({ view }: { view: ViewState }) {
  return (
    <nav aria-label="Filter flagged releases" className="inline-flex rounded-full border border-line bg-surface p-0.5 font-mono text-xs">
      {SHOW_OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={viewHref(view.base, { days: view.days, show: o.value, q: view.q })}
          aria-current={o.value === view.show ? "page" : undefined}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${o.value === view.show ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

function FlagList({ items, review, windowEnd, showAge }: { items: DigestRelease[]; review: (id: number) => ReviewProps; windowEnd?: string; showAge?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((r) =>
        confidenceRank(r) === 3 ? (
          <CompactFlagCard key={r.releaseId} r={r} review={review(r.releaseId)} />
        ) : (
          <FeaturedCard key={r.releaseId} r={r} review={review(r.releaseId)} ageDays={showAge && windowEnd ? Math.floor((Date.parse(windowEnd) - Date.parse(r.publishedAt)) / DAY_MS) : undefined} />
        ),
      )}
    </div>
  );
}

function Collapsed({ label, items }: { label: string; items: DigestRelease[] }) {
  const sample = items.slice(0, 3).map((r) => r.tagName).join(", ");
  return (
    <details className="group border-t border-line py-2.5">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 text-sm text-muted marker:hidden hover:text-foreground">
        <span aria-hidden className="inline-block w-3 transition-transform group-open:rotate-90">▸</span>
        <span className="font-medium text-foreground">
          {items.length} {label}
        </span>
        <span className="font-mono text-xs">
          {sample}
          {items.length > 3 ? ", …" : ""}
        </span>
      </summary>
      <div className="mt-1 divide-y divide-line border-t border-line">
        {items.map((r) => (
          <ReleaseRow key={r.releaseId} r={r} />
        ))}
      </div>
    </details>
  );
}

function WatchTable({ lines }: { lines: WatchLine[] }) {
  const maxReleases = Math.max(1, ...lines.map((l) => l.releasesLast90Days));
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:table-header-group">
          <tr>
            <th className="px-4 py-2.5 font-medium">Repo</th>
            <th className="px-4 py-2.5 font-medium">Releases · 90 days</th>
            <th className="px-4 py-2.5 font-medium">Last</th>
            <th className="px-4 py-2.5 font-medium">Median gap</th>
            <th className="px-4 py-2.5 text-right font-medium">Stars</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((w) => {
            const delta = w.starsChange === null ? "no earlier snapshot yet" : `${w.starsChange >= 0 ? "+" : ""}${w.starsChange.toLocaleString("en-US")} since ${formatISTShort(w.starsChangeSince as string)}`;
            return (
              <tr key={w.repo} className="block px-4 py-3 sm:table-row sm:px-0 sm:py-0">
                <td className="block py-0.5 font-medium sm:table-cell sm:px-4 sm:py-3">{w.repo}</td>
                <td className="block py-0.5 sm:table-cell sm:px-4 sm:py-3">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(w.releasesLast90Days / maxReleases) * 100}%` }} />
                    </span>
                    <span className="font-mono text-xs">{w.releasesLast90Days}</span>
                  </span>
                </td>
                <td className="block py-0.5 font-mono text-xs text-muted sm:table-cell sm:px-4 sm:py-3">{w.daysSinceLastRelease === null ? "never" : `${w.daysSinceLastRelease}d ago`}</td>
                <td className="block py-0.5 font-mono text-xs text-muted sm:table-cell sm:px-4 sm:py-3">{w.medianDaysBetweenReleases === null ? "–" : `${w.medianDaysBetweenReleases}d`}</td>
                <td className="block py-0.5 sm:table-cell sm:px-4 sm:py-3 sm:text-right">
                  <span className="font-mono text-xs">★ {w.stars.toLocaleString("en-US")}</span>
                  <span className="block text-[11px] text-muted">{delta}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DigestView({ digest, view, reviewEnabled = false, reviewedIds = [] }: { digest: Digest; view: ViewState; reviewEnabled?: boolean; reviewedIds?: number[] }) {
  const f = filterDigest(digest, view);
  const reviewed = new Set(reviewedIds);
  const review = (id: number): ReviewProps => ({ enabled: reviewEnabled, reviewed: reviewed.has(id) });
  const filtering = view.show !== "all" || view.q !== "";
  const fullFlagged = digest.needsLook.length;

  return (
    <div>
      <Hero digest={digest} />
      <Toolbar view={view} />

      <Section
        title="Needs a look"
        count={filtering ? `${f.needsLook.length} of ${fullFlagged}` : fullFlagged}
        hint="Security first, then breaking changes. Within each, flags both the rules and the AI agree on come first, and flags only the rules raised (AI judged routine) are shown quietly at the end. Nothing is hidden: the AI can add a flag but never remove one."
        aside={<ShowChips view={view} />}
      >
        {f.needsLook.length === 0 ? <Empty>{filtering ? "No flagged releases match this filter." : "Nothing flagged in this period."}</Empty> : <FlagList items={f.needsLook} review={review} />}
      </Section>

      {f.stillOpen && f.stillOpen.length > 0 && (
        <Section
          id="still-open"
          title="Still open from earlier weeks"
          count={f.stillOpen.length}
          hint="Flagged in an earlier digest and not yet marked as reviewed, so an unread security fix can't quietly age out. Marked ones leave this list the next time the page loads."
          aside={reviewEnabled ? <ReviewAll releaseIds={f.stillOpen.filter((r) => !reviewed.has(r.releaseId)).map((r) => r.releaseId)} /> : undefined}
        >
          <FlagList items={f.stillOpen} review={review} windowEnd={digest.windowEnd} showAge />
        </Section>
      )}

      <Section title="Other releases" count={filtering && view.q ? `${f.other.length} of ${digest.other.length}` : digest.other.length} hint="Dependencies first, then the tools we're evaluating. Sub-package and pre-release streams are tucked into collapsed lines, never removed.">
        {f.other.length === 0 ? (
          <Empty>{view.q ? "No other releases match this filter." : "No other releases."}</Empty>
        ) : (
          <div className="flex flex-col gap-8">
            {groupByRepo(f.other).map((g) => {
              const { main, pre, sub } = splitReleases(g.items);
              return (
                <div key={g.repo}>
                  <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                    <span className="break-all">
                      <span className="text-muted">{g.repo.split("/")[0]}/</span>
                      <span className="font-semibold">{g.repo.split("/")[1]}</span>
                    </span>
                    <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{g.tag}</span>
                    <span className="font-mono text-xs text-muted">{g.items.length}</span>
                  </h3>
                  <div className="mt-1 divide-y divide-line border-t border-line">
                    {main.map((r) => (
                      <ReleaseRow key={r.releaseId} r={r} />
                    ))}
                  </div>
                  {pre.length > 0 && <Collapsed label={pre.length === 1 ? "pre-release" : "pre-releases"} items={pre} />}
                  {sub.length > 0 && <Collapsed label="sub-package releases" items={sub} />}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Evaluation watch" hint="Release cadence and momentum for the tools we're evaluating, as of the last run.">
        {f.evaluationWatch.length === 0 ? <Empty>{view.q ? "No evaluating repos match." : "No evaluating repos."}</Empty> : <WatchTable lines={f.evaluationWatch} />}
      </Section>

      <Section title="Quiet in this period" count={f.quiet.length} hint="Tracked repos with no release in the window.">
        {f.quiet.length === 0 ? (
          <Empty>{view.q ? "No quiet repos match." : "Every repo had a release."}</Empty>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {f.quiet.map((q) => (
              <li key={q} className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-muted">
                {q}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Couldn't check" count={f.couldntCheck.length}>
        {f.couldntCheck.length === 0 ? (
          <Empty>All repos were checked.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {f.couldntCheck.map((c) => (
              <li key={c.repo} className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-sec-line bg-sec-bg px-4 py-2.5 text-sm">
                <span className="font-semibold text-sec">{c.repo}</span>
                <span className="text-sec/90">{c.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
