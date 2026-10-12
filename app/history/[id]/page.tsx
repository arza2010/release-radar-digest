import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DigestView } from "@/components/digest-view";
import { formatISTDateTime } from "@/lib/dates";
import { parseQuery, parseShow } from "@/lib/digest-filter";
import { getDigestById } from "@/lib/digest-store";
import { getReviewedIds, reviewTrackingEnabled } from "@/lib/reviewed";

export const metadata = { title: "Past digest · Release Radar" };

export default function HistoryDigestPage(props: PageProps<"/history/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-line" aria-busy="true" />}>
        <Digest {...props} />
      </Suspense>
    </main>
  );
}

async function Digest({ params, searchParams }: PageProps<"/history/[id]">) {
  const { id: raw } = await params;
  const id = Number(raw);
  const saved = await getDigestById(id);
  if (!saved) notFound();
  const sp = await searchParams;
  const ids = [...saved.digest.needsLook, ...(saved.digest.stillOpen ?? [])].map((r) => r.releaseId);
  const [reviewEnabled, reviewedIds] = await Promise.all([reviewTrackingEnabled(), getReviewedIds(ids)]);
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Link href="/history" className="font-medium text-foreground underline underline-offset-2">← All digests</Link>
        <span>
          #{saved.id} · {formatISTDateTime(saved.runAt)} IST · {saved.trigger} · {saved.status} · email {saved.emailStatus ?? "–"}
        </span>
      </p>
      <div className="mt-4">
        <DigestView
          digest={saved.digest}
          view={{ base: `/history/${saved.id}`, show: parseShow(sp.show), q: parseQuery(sp.q) }}
          reviewEnabled={reviewEnabled}
          reviewedIds={reviewedIds}
        />
      </div>
    </>
  );
}
