import { formatIST } from "@/lib/dates";
import { NOTE_DISAGREEMENT, type DigestRelease } from "@/lib/digest-types";
import { RawNotes } from "@/components/raw-notes";
import { ReviewToggle } from "@/components/review-toggle";

export interface ReviewProps {
  /** Review tracking is switched on (the extra column exists). */
  enabled: boolean;
  reviewed: boolean;
}

function RepoName({ repo }: { repo: string }) {
  const [owner, name] = repo.split("/");
  return (
    <span className="break-all">
      <span className="text-muted">{owner}/</span>
      <span className="font-semibold">{name}</span>
    </span>
  );
}

function VersionLink({ r, className = "" }: { r: DigestRelease; className?: string }) {
  return (
    <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className={`break-all font-mono font-semibold text-accent underline-offset-4 hover:underline ${className}`}>
      {r.tagName}
      <span aria-hidden> ↗</span>
      <span className="sr-only"> (opens the GitHub release)</span>
    </a>
  );
}

function Note({ r }: { r: DigestRelease }) {
  if (!r.note) return null;
  const warn = r.note === NOTE_DISAGREEMENT;
  return (
    <p className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${warn ? "border-brk-line bg-brk-bg text-brk" : "border-line bg-note-bg text-note"}`}>
      <span aria-hidden className="mt-px font-mono">{warn ? "⚠" : "ℹ"}</span>
      <span>{r.note}</span>
    </p>
  );
}

function Excerpt({ r }: { r: DigestRelease }) {
  if (r.analysisState === "analysed" || !r.notesExcerpt.trim()) return null;
  return <p className="mt-3 line-clamp-4 whitespace-pre-line break-words rounded-md border border-line bg-background p-3 font-mono text-xs leading-relaxed text-muted">{r.notesExcerpt}</p>;
}

function RuleChips({ r }: { r: DigestRelease }) {
  if (r.ruleFlags.length === 0) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span className="font-mono uppercase tracking-wider">Rules matched</span>
      {r.ruleFlags.slice(0, 4).map((f) => (
        <code key={`${f.type}:${f.evidence}`} className="rounded border border-line bg-background px-1.5 py-0.5 font-mono text-foreground/80">
          {f.evidence}
        </code>
      ))}
      {r.ruleFlags.length > 4 && <span>+{r.ruleFlags.length - 4} more</span>}
    </p>
  );
}

function Footer({ r, review }: { r: DigestRelease; review?: ReviewProps }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <RawNotes repo={r.repo} releaseId={r.releaseId} />
      {review?.enabled && <ReviewToggle releaseId={r.releaseId} reviewed={review.reviewed} />}
    </div>
  );
}

/** A "Needs a look" card: severity header bar, summary, then Why / Check side by side. */
export function FeaturedCard({ r, review, ageDays }: { r: DigestRelease; review?: ReviewProps; ageDays?: number }) {
  const sec = r.severity === "security";
  const bar = sec ? "bg-sec-bg text-sec border-sec-line" : "bg-brk-bg text-brk border-brk-line";
  const ring = sec ? "border-sec-line" : "border-brk-line";
  const showWhy = r.analysisState === "analysed" && r.ai.reason;
  return (
    <article id={`r-${r.releaseId}`} className={`overflow-hidden rounded-xl border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.03)] ${ring} ${review?.reviewed ? "opacity-75" : ""}`}>
      <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${bar}`}>
        <span className="flex items-center gap-2">
          <span aria-hidden className={`inline-block size-2 rounded-full ${sec ? "bg-sec" : "bg-brk"}`} />
          {sec ? "Security" : "Breaking change"}
          {r.prerelease && <span className="rounded border border-current/40 px-1.5 py-px font-medium tracking-wider opacity-80">Pre-release</span>}
          {review?.reviewed && <span className="rounded border border-current/40 px-1.5 py-px font-medium tracking-wider">Reviewed ✓</span>}
        </span>
        <span className="font-medium normal-case tracking-normal opacity-90">Flagged by {r.flaggedBy}</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-lg leading-tight">
            <RepoName repo={r.repo} />
            <VersionLink r={r} className="text-xl" />
          </h3>
          <time dateTime={r.publishedAt} className="font-mono text-xs text-muted">
            {formatIST(r.publishedAt)}
            {ageDays !== undefined && ` · ${ageDays}d ago`}
          </time>
        </div>

        <Note r={r} />
        {r.ai.summary && <p className="mt-3 max-w-prose text-[15px] leading-relaxed">{r.ai.summary}</p>}

        {(showWhy || r.ai.action) && (
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            {showWhy && (
              <div className="rounded-lg border border-line bg-background p-3">
                <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Why it&apos;s flagged</dt>
                <dd className="mt-1 text-sm leading-relaxed">{r.ai.reason}</dd>
              </div>
            )}
            {r.ai.action && (
              <div className="rounded-lg border border-line bg-background p-3">
                <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">What to check</dt>
                <dd className="mt-1 text-sm leading-relaxed">{r.ai.action}</dd>
              </div>
            )}
          </dl>
        )}

        <Excerpt r={r} />
        <RuleChips r={r} />
        <Footer r={r} review={review} />
      </div>
    </article>
  );
}

/**
 * A quieter card for a release the rules flagged but the AI judged routine. It is still in "Needs a look"
 * (the AI can never remove a flag), just ranked last and visually lighter.
 */
export function CompactFlagCard({ r, review }: { r: DigestRelease; review?: ReviewProps }) {
  const sec = r.severity === "security";
  return (
    <article id={`r-${r.releaseId}`} className={`rounded-lg border bg-surface px-4 py-3 ${sec ? "border-sec-line/70" : "border-brk-line/70"} ${review?.reviewed ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[15px]">
          <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${sec ? "text-sec" : "text-brk"}`}>
            <span aria-hidden className={`inline-block size-2 rounded-full ${sec ? "bg-sec" : "bg-brk"}`} />
            {sec ? "Security" : "Breaking"} · rules only
          </span>
          <RepoName repo={r.repo} />
          <VersionLink r={r} className="text-sm" />
          {r.prerelease && <span className="rounded border border-line px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">Pre</span>}
          {review?.reviewed && <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">Reviewed ✓</span>}
        </h3>
        <time dateTime={r.publishedAt} className="font-mono text-xs text-muted">{formatIST(r.publishedAt)}</time>
      </div>
      <Note r={r} />
      {r.ai.summary && <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{r.ai.summary}</p>}
      <RuleChips r={r} />
      <Footer r={r} review={review} />
    </article>
  );
}

/** A compact row for the "Other releases" list. */
export function ReleaseRow({ r }: { r: DigestRelease }) {
  return (
    <article id={`r-${r.releaseId}`} className="py-3.5">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[11rem_1fr]">
        <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
          <VersionLink r={r} className="text-sm" />
          <div className="flex items-center gap-2 font-mono text-xs text-muted">
            <time dateTime={r.publishedAt}>{formatIST(r.publishedAt)}</time>
            {r.prerelease && <span className="rounded border border-line px-1.5 py-px uppercase tracking-wider">Pre</span>}
          </div>
        </div>
        <div>
          {r.ai.summary ? <p className="text-sm leading-relaxed">{r.ai.summary}</p> : <p className="text-sm text-muted">No summary available.</p>}
          <Note r={r} />
          <Excerpt r={r} />
          <div className="mt-3">
            <RawNotes repo={r.repo} releaseId={r.releaseId} />
          </div>
        </div>
      </div>
    </article>
  );
}
