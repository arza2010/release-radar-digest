import Link from "next/link";
import { Suspense } from "react";
import { formatISTDateTime } from "@/lib/dates";
import { listDigests } from "@/lib/digest-store";

export const metadata = { title: "History · Release Radar" };

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Past digests</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">Every saved run, newest first. Open one to see it exactly as it was built, including dry runs that weren&apos;t emailed. <Link href="/about" className="whitespace-nowrap font-medium text-foreground underline underline-offset-2">How a digest is built →</Link></p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />}>
        <List />
      </Suspense>
    </main>
  );
}

const tone = {
  success: "border-accent/40 bg-accent-bg text-accent",
  partial: "border-brk-line bg-brk-bg text-brk",
  failed: "border-sec-line bg-sec-bg text-sec",
} as const;

async function List() {
  const items = await listDigests();
  if (items.length === 0) {
    return <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">No digests yet. Run one from the Repos page.</p>;
  }
  return (
    <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/history/${d.id}`} className="flex flex-col gap-1.5 px-4 py-3.5 hover:bg-background sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-muted">#{d.id}</span>
              <span className="font-medium">{formatISTDateTime(d.runAt)} IST</span>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{d.trigger}</span>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tone[d.status]}`}>{d.status}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                <b className="font-semibold text-foreground">{d.needALook}</b> need a look · {d.releases} releases
              </span>
              <span>email: {d.emailStatus ?? "–"}</span>
              <span aria-hidden>→</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
