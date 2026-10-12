import Image from "next/image";
import { RadarMark } from "@/components/radar-mark";

export const metadata = { title: "How it works · Release Radar" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 border-b border-line pb-2 font-serif text-2xl font-semibold tracking-tight">{children}</h2>;
}

const STEPS = [
  ["Load", "Every Monday at about 8 AM IST the scheduler wakes the app, which reads the repo list you maintain on the Repos page. Opening the dashboard does the same pull on demand, so you are never waiting a week to see what shipped."],
  ["Fetch", "For each repo it asks GitHub for releases published in the past 7 days. Drafts are dropped and pre-releases are labelled. A repo that can't be reached is listed under “Couldn't check” with the reason, never skipped silently."],
  ["Check with rules", "Fixed pattern matching runs on every release: CVE and GHSA ids, security words, “breaking change” phrases, and a major version bump compared with the repo's earlier releases. Each hit keeps the exact text that triggered it."],
  ["Read with AI", "Gemini Flash reads the release notes, in batches of up to 8, and writes a short summary, a category (security, breaking or routine), the reason, and what to check. Results are stored by GitHub release id, so a release is analysed once, ever."],
  ["Merge", "A release is flagged if the rules flagged it or the AI did. Flags are never removed, and every release in the window stays in the digest."],
  ["Deliver", "The digest is saved, shown on the dashboard, and emailed, even in a quiet week, so no email means something broke."],
];

const SPLIT = [
  ["AI (Gemini Flash)", "Summary, category (security / breaking / routine), the reason, the suggested check.", "Can add a flag. Cannot remove one."],
  ["Rules (plain code)", "CVE and GHSA ids, security and breaking keywords, major version bumps, ordering and cadence numbers.", "Always runs, always wins a disagreement."],
  ["Human (you)", "Deciding what matters to your product, and what your team does about it.", "The AI says what a release contains. It never judges whether it affects you."],
];

const LIMITS = [
  ["Only GitHub releases are covered.", "Vendors that announce API changes on their own changelog site, and projects that push tags but never publish a release (braintree_node, node-jsonwebtoken and passport are three examples we found), are invisible here."],
  ["Silent security fixes can't be found.", "If a maintainer fixes a vulnerability without saying so in the notes, nothing that reads the notes can detect it."],
  ["Not real-time alerting.", "Data is pulled when someone opens the dashboard and on the Monday run. A security fix published while nobody is looking is first seen at the next visit or in Monday's email. GitHub webhooks would fix that, but they need admin rights on the repos you watch."],
  ["A missed flag lowers a release, it doesn't hide it.", "If the AI fails to flag something and no rule matches, the release still appears, just lower down. Risk is reduced, not removed."],
  ["Very long notes are partly read.", "The AI sees the first 6,000 characters plus any lines further down that mention security or breaking changes. Anything else deep in a huge changelog isn't shown to it."],
  ["The rules are deliberately noisy.", "A single word like “security” raises a flag. That means some false alarms, which is the intended trade: a false alarm is cheap, a missed security fix is not."],
  ["Free-tier limits.", "Gemini's free quota is small, Vercel's cron fires anywhere inside the scheduled hour, and Resend's free plan only delivers to the account owner's own address."],
  ["No login.", "This is a course project. Anyone with the link can edit the repo list or press “Run now”. Manual runs have a cooldown and a daily AI-call cap to protect the quota."],
];

export default function About() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center gap-4">
        <RadarMark bold sweep className="size-14 shrink-0 text-accent" />
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">How it works</h1>
      </div>
      <p className="mt-5 max-w-prose font-serif text-xl italic leading-relaxed text-muted">
        GitHub notifications bury real releases under comments, pull requests and commits. Release Radar looks only at releases, and puts security fixes and breaking changes at the top of a digest you can read in five minutes.
      </p>

      <H2>The pipeline, in plain words</H2>
      <ol className="mt-5 flex flex-col gap-4">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            <p className="leading-relaxed">
              <span className="font-semibold">{title}. </span>
              {body}
            </p>
          </li>
        ))}
      </ol>

      <H2>Which repos does it watch?</H2>
      <div className="mt-5 flex max-w-prose flex-col gap-4 leading-relaxed">
        <p>
          <span className="font-semibold">A fixed list, not a search.</span> The app watches exactly the repos on the Repos page and nothing else. It does not discover repos, and it does not filter by industry, topic, stars or language. The starting list of 22 was picked by hand, leaning on payments (Stripe, Razorpay, Adyen), authentication (next-auth, jose, Keycloak, Auth0) and web basics (Express, axios, Fastify), and each one was checked against live GitHub first.
        </p>
        <p>
          <span className="font-semibold">Two kinds of repo.</span> A <span className="font-mono text-sm">dependency</span> is a library or service we ship against, where a security fix or breaking change matters most. An <span className="font-mono text-sm">evaluating</span> repo is a tool we are considering, and it also gets a cadence and momentum line (how often it releases, how fast its stars are growing).
        </p>
        <p>
          <span className="font-semibold">Anyone can add to it.</span> If a colleague recommends something, or whoever looks after the dashboard wants to keep an eye on another project, they paste <span className="font-mono text-sm">owner/name</span> or a GitHub link on the Repos page. No code changes and no redeploy.
        </p>
        <p>
          <span className="font-semibold">What happens when you add one.</span> The app checks that the repo exists on GitHub and is public, that it is not already tracked, and that the list is under its 40-repo limit. If the repo is archived or has never published a GitHub release, you get a warning but it is still added. From then on it is pulled automatically: the next time the dashboard opens (within minutes) its last 7 days of releases appear, and it is part of Monday&apos;s digest. Older releases show up in the 30 and 90-day views after you press Backfill.
        </p>
        <p className="text-sm text-muted">
          Only public repos can be watched, and only what they publish as GitHub releases. If a new repo releases a lot at once, rule flags appear immediately and AI summaries fill in over the next refreshes, because AI calls are capped to protect the free quota.
        </p>
      </div>

      <H2>Who does what</H2>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="hidden border-b border-line font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:table-header-group">
            <tr>
              <th className="px-4 py-2.5 font-medium">Part</th>
              <th className="px-4 py-2.5 font-medium">Responsible for</th>
              <th className="px-4 py-2.5 font-medium">Power</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SPLIT.map(([who, does, power]) => (
              <tr key={who} className="block px-4 py-3 sm:table-row sm:px-0 sm:py-0">
                <td className="block py-0.5 font-semibold sm:table-cell sm:px-4 sm:py-3">{who}</td>
                <td className="block py-0.5 leading-relaxed sm:table-cell sm:px-4 sm:py-3">{does}</td>
                <td className="block py-0.5 leading-relaxed text-muted sm:table-cell sm:px-4 sm:py-3">{power}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <blockquote className="mt-8 border-l-4 border-accent pl-5 font-serif text-2xl italic leading-snug">
        The AI decides what to raise, never what to bury.
      </blockquote>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
        That is why a rule flag survives an AI that says “routine”: the dashboard shows both opinions (“Rule flagged; AI judged routine — check the notes”) and leaves the decision to you.
      </p>

      <H2>Components map</H2>
      <figure className="mt-5">
        <Image
          src="/components-map.png"
          alt="Components map: Keerthi edits the repo list; the scheduler starts a weekly run; the system reads repos from Supabase, fetches releases from GitHub, applies rules, sends text to Gemini Flash, merges flags and saves the digest; delivery is an email via Resend and a dashboard."
          width={2244}
          height={2387}
          sizes="(min-width: 768px) 768px, 100vw"
          className="w-full rounded-xl border border-line bg-white"
        />
        <figcaption className="mt-2 text-xs text-muted">One difference from the diagram: releases are sent to Gemini in batches of up to 8 per call, not one call per release, to stay inside the free quota.</figcaption>
      </figure>

      <H2>Known limits</H2>
      <ul className="mt-5 flex flex-col gap-4">
        {LIMITS.map(([title, body]) => (
          <li key={title} className="leading-relaxed">
            <span className="font-semibold">{title} </span>
            <span className="text-muted">{body}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
