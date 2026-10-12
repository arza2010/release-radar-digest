/** Decorative radar: rings, crosshair and a slow sweep. Purely visual. */
/** `bold` thickens the strokes so the mark stays legible at icon size. */
export function RadarMark({ className = "", sweep = false, bold = false }: { className?: string; sweep?: boolean; bold?: boolean }) {
  const w = bold ? 5 : 1;
  const o = bold ? 1 : 0.5;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id="sweep-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity={bold ? 0.9 : 0.55} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeOpacity={o} strokeWidth={w} />
      <circle cx="50" cy="50" r="28" stroke="currentColor" strokeOpacity={bold ? 0.7 : 0.4} strokeWidth={w} />
      <circle cx="50" cy="50" r="12" stroke="currentColor" strokeOpacity={bold ? 0.55 : 0.35} strokeWidth={w} />
      {!bold && <path d="M50 4v92M4 50h92" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />}
      <g className={sweep ? "radar-sweep" : undefined}>
        <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" fill="url(#sweep-fade)" />
        <path d="M50 50 L50 4" stroke="currentColor" strokeWidth={bold ? 6 : 1.5} />
      </g>
      <circle cx="50" cy="50" r={bold ? 6 : 2.2} fill="currentColor" />
    </svg>
  );
}
