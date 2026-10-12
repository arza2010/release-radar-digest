import Link from "next/link";

export const LOOKBACKS = [7, 30, 90] as const;
export type Lookback = (typeof LOOKBACKS)[number];

export function parseLookback(value: string | string[] | undefined): Lookback {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (LOOKBACKS as readonly number[]).includes(n) ? (n as Lookback) : 7;
}

export function LookbackSelector({ days }: { days: Lookback }) {
  return (
    <nav aria-label="Lookback window" className="inline-flex rounded-full border border-line bg-surface p-0.5 font-mono text-xs">
      {LOOKBACKS.map((d) => (
        <Link
          key={d}
          href={d === 7 ? "/" : `/?days=${d}`}
          aria-current={d === days ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${d === days ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
        >
          {d} days
        </Link>
      ))}
    </nav>
  );
}
