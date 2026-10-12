const DAY_MS = 24 * 60 * 60 * 1000;

export interface Window {
  start: Date;
  end: Date;
}

/** The window is [now − days, now]. */
export function windowFor(days: number, now: Date = new Date()): Window {
  return { start: new Date(now.getTime() - days * DAY_MS), end: now };
}

export function inWindow(iso: string, w: Window): boolean {
  const t = Date.parse(iso);
  return t >= w.start.getTime() && t <= w.end.getTime();
}

/** e.g. "Mon, 06 Oct 2025" in India time. */
export function formatIST(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

/** e.g. "11 Oct 2026, 08:41 pm" in India time. */
export function formatISTDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** e.g. "6 Oct" in India time. */
export function formatISTShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(d);
}

/** Whole-and-fractional days between an ISO timestamp and now. */
export function daysSince(iso: string): number {
  return (Date.now() - Date.parse(iso)) / DAY_MS;
}
