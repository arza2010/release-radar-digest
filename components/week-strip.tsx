import type { DigestRelease } from "@/lib/digest-types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STACK = 10;

const istKey = (d: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(typeof d === "string" ? new Date(d) : d);

const label = (key: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${key}T00:00:00Z`));

/** One column per day (IST). Each release is a dot; flagged ones sit on top and link to their card. */
export function WeekStrip({ releases, windowStart, windowEnd }: { releases: DigestRelease[]; windowStart: string; windowEnd: string }) {
  const keys: string[] = [];
  const end = istKey(windowEnd);
  for (let t = Date.parse(windowStart); ; t += DAY_MS) {
    const k = istKey(new Date(t));
    if (!keys.includes(k)) keys.push(k);
    if (k >= end) break;
  }
  const byDay = new Map<string, DigestRelease[]>(keys.map((k) => [k, []]));
  for (const r of releases) byDay.get(istKey(r.publishedAt))?.push(r);

  const rank = (r: DigestRelease) => (r.severity === "security" ? 2 : r.severity === "breaking" ? 1 : 0);
  const wide = keys.length <= 10;
  const axis = wide ? keys : [keys[0], keys[Math.floor(keys.length / 2)], keys[keys.length - 1]];

  return (
    <figure aria-label="Releases per day" className="mt-6">
      <div className="grid items-end gap-[3px] sm:gap-1" style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }}>
        {keys.map((k) => {
          const items = [...(byDay.get(k) ?? [])].sort((a, b) => rank(a) - rank(b));
          const shown = items.slice(-MAX_STACK);
          const hidden = items.length - shown.length;
          const flagged = items.filter((r) => r.flagged).length;
          return (
            <div
              key={k}
              title={`${label(k)}: ${items.length} release${items.length === 1 ? "" : "s"}${flagged ? `, ${flagged} flagged` : ""}`}
              className="flex h-36 flex-col-reverse items-center gap-[3px] border-b border-line pb-1"
            >
              {shown.map((r) => {
                const cls =
                  r.severity === "security" ? "bg-sec" : r.severity === "breaking" ? "bg-brk" : "bg-muted/40";
                const dot = <span className={`block aspect-square w-full max-w-3 rounded-full ${cls}`} />;
                return r.flagged ? (
                  <a key={r.releaseId} href={`#r-${r.releaseId}`} className="block w-full max-w-3" aria-label={`${r.severity} · ${r.repo} ${r.tagName}`}>
                    {dot}
                  </a>
                ) : (
                  <span key={r.releaseId} className="block w-full max-w-3">{dot}</span>
                );
              })}
              {hidden > 0 && <span className="font-mono text-[10px] leading-none text-muted">+{hidden}</span>}
            </div>
          );
        })}
      </div>
      <div className={`mt-1.5 flex font-mono text-[11px] text-muted ${wide ? "" : "justify-between"}`}>
        {wide
          ? axis.map((k) => (
              <span key={k} className="flex-1 text-center">{label(k)}</span>
            ))
          : axis.map((k) => <span key={k}>{label(k)}</span>)}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-sec" /> Security</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-brk" /> Breaking</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-muted/40" /> Other release</span>
        <span>· flagged dots jump to their card</span>
      </figcaption>
    </figure>
  );
}
