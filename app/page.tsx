import Link from "next/link";
import { Suspense } from "react";
import { DigestView } from "@/components/digest-view";
import { EmailDigestButton } from "@/components/email-digest-button";
import { LiveRefresh } from "@/components/live-refresh";
import { UnderTheHood } from "@/components/under-the-hood";
import { LookbackSelector, parseLookback } from "@/components/lookback";
import { formatISTDateTime } from "@/lib/dates";
import { parseQuery, parseShow } from "@/lib/digest-filter";
import { loadDashboard } from "@/lib/digest-store";

// The live refresh runs as a server action from this page (GitHub fetch + a couple of Gemini calls).
export const maxDuration = 120;

export default function Home(props: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<Loading />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-4">
      <div className="h-5 w-1/2 rounded bg-line" />
      <div className="h-72 rounded-2xl bg-line" />
      <div className="h-40 rounded-xl bg-line" />
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const days = parseLookback(sp.days);
  const show = parseShow(sp.show);
  const q = parseQuery(sp.q);
  // Every view is built from stored results, which the live refresh below keeps current. The digest exactly as
  // emailed stays one click away under History.
  const { latest, digest, reviewEnabled, reviewedIds } = await loadDashboard(days);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <LiveRefresh />
          <p className="text-xs text-muted">
            Last weekly digest{" "}
            <span className="font-medium text-foreground">{latest ? `${formatISTDateTime(latest.runAt)} IST` : "– none yet"}</span>
            <span className="mx-2" aria-hidden>·</span>
            Next scheduled <span className="font-medium text-foreground">Monday 8–9 AM IST</span>
            {latest && (
              <>
                <span className="mx-2" aria-hidden>·</span>
                <Link href={`/history/${latest.id}`} className="font-medium text-foreground underline underline-offset-2 hover:text-accent">
                  View it as emailed →
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <LookbackSelector days={days} />
          <EmailDigestButton />
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-line bg-note-bg px-4 py-2.5 text-sm text-note">
        {days === 7
          ? "Live view: releases are pulled from GitHub when you open this page, new ones get an AI summary, and everything is flagged the moment it appears. "
          : `Last ${days} days, built from stored results (no live fetch for this range). Releases no refresh or run has stored yet are not shown; use Backfill on the Repos page to fill it in. `}
        Releases not yet analysed show rules-only flags.{" "}
        <Link href="/about" className="whitespace-nowrap font-semibold underline underline-offset-2 hover:text-foreground">
          How it works →
        </Link>
      </p>

      <div className="mt-5">
        <DigestView digest={digest} view={{ base: "/", days, show, q }} reviewEnabled={reviewEnabled} reviewedIds={reviewedIds} />
      </div>

      <UnderTheHood />
    </>
  );
}
