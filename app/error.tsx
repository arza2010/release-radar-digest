"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Couldn&apos;t load the digest</h1>
      <p className="mt-2 text-sm text-muted">The database or a setting may be unavailable. Try again in a moment.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-background">
        Try again
      </button>
    </main>
  );
}
