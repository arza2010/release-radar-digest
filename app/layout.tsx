import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Nav } from "@/components/nav";
import { RadarMark } from "@/components/radar-mark";
import { SOURCE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Release Radar",
  description: "A Monday-morning digest of what shipped across the open-source repos we depend on. Security fixes and breaking changes first.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <RadarMark bold className="size-8 text-accent" />
              <span className="font-serif text-xl font-semibold tracking-tight">Release Radar</span>
            </Link>
            <Suspense fallback={<div className="h-8 w-64" aria-hidden />}>
              <Nav />
            </Suspense>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
            <span>Summaries by Gemini Flash, from release text only. Rules flag first; the AI can only add flags, never remove them.</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
              <span>GitHub releases only · no issues, PRs or commits</span>
              <Link href="/about" className="font-semibold text-foreground underline underline-offset-2">How it works</Link>
              <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">Source ↗</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
