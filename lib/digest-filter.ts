import type { Digest, DigestRelease, Severity } from "@/lib/digest-types";

export type ShowFilter = "all" | Severity;

export const SHOW_OPTIONS: { value: ShowFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "security", label: "Security" },
  { value: "breaking", label: "Breaking" },
];

export function parseShow(value: string | string[] | undefined): ShowFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "security" || v === "breaking" ? v : "all";
}

/** Search text from the URL: trimmed, lowercase, capped. */
export function parseQuery(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").trim().toLowerCase().slice(0, 60);
}

/**
 * View-only filtering of a digest: `show` narrows "Needs a look" by severity, `q` matches repo names
 * (or tags) across every section. The stored digest is untouched, and `stats` stay the full totals.
 */
export function filterDigest(d: Digest, opts: { show: ShowFilter; q: string }): Digest {
  const hit = (repo: string) => !opts.q || repo.toLowerCase().includes(opts.q);
  const keep = (r: DigestRelease) => hit(r.repo) || r.tagName.toLowerCase().includes(opts.q);
  const sev = (r: DigestRelease) => opts.show === "all" || r.severity === opts.show;
  return {
    ...d,
    needsLook: d.needsLook.filter((r) => sev(r) && keep(r)),
    stillOpen: d.stillOpen?.filter((r) => sev(r) && keep(r)),
    other: d.other.filter(keep),
    evaluationWatch: d.evaluationWatch.filter((w) => hit(w.repo)),
    quiet: d.quiet.filter(hit),
    couldntCheck: d.couldntCheck.filter((c) => hit(c.repo)),
  };
}

/** Build a link that keeps the current view state, leaving out anything at its default. */
export function viewHref(base: string, p: { days?: number; show?: ShowFilter; q?: string }): string {
  const params = new URLSearchParams();
  if (p.days && p.days !== 7) params.set("days", String(p.days));
  if (p.show && p.show !== "all") params.set("show", p.show);
  if (p.q) params.set("q", p.q);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
