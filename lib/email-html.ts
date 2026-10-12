import { formatIST, formatISTShort } from "@/lib/dates";
import { headerLine, splitReleases } from "@/lib/digest";
import type { Digest, DigestRelease } from "@/lib/digest-types";

/** Email-safe rendering of the digest: table-free where possible, every style inline, plus a plain-text twin. */

const C = {
  bg: "#f3efe6", card: "#fbf9f3", line: "#ddd6c6", ink: "#1b1a17", muted: "#6c675b",
  sec: "#b4281b", secBg: "#f8e4de", secLine: "#e3a496",
  brk: "#85570a", brkBg: "#f6eacb", brkLine: "#dcbb6c",
  accent: "#1b6a55",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, monospace";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const safeUrl = (u: string) => (/^https:\/\/github\.com\//i.test(u) ? u : "#");

export function emailSubject(d: Digest): string {
  const week = formatIST(d.windowEnd).replace(/^[A-Za-z]{3}, /, "");
  const tail = d.stats.releases === 0 ? "Quiet week" : `${d.stats.needALook} need a look`;
  return `Release Radar · Week of ${week} · ${tail}`;
}

function label(r: DigestRelease): string {
  return r.severity === "security" ? "SECURITY" : "BREAKING CHANGE";
}

function featured(r: DigestRelease): string {
  const sec = r.severity === "security";
  const [fg, bg, ln] = sec ? [C.sec, C.secBg, C.secLine] : [C.brk, C.brkBg, C.brkLine];
  const showWhy = r.analysisState === "analysed" && r.ai.reason;
  const rules = r.ruleFlags.slice(0, 4).map((f) => esc(f.evidence)).join(", ");
  return `
<div style="margin:0 0 14px;border:1px solid ${ln};border-radius:10px;background:${C.card};overflow:hidden">
  <div style="background:${bg};color:${fg};padding:7px 14px;font:700 11px ${MONO};letter-spacing:.12em">${label(r)}${r.prerelease ? " · PRE-RELEASE" : ""} <span style="float:right;font-weight:400;letter-spacing:0">Flagged by ${esc(r.flaggedBy ?? "")}</span></div>
  <div style="padding:14px 16px">
    <div style="font:400 16px ${SANS};color:${C.ink}"><span style="color:${C.muted}">${esc(r.repo.split("/")[0])}/</span><b>${esc(r.repo.split("/")[1])}</b>
      <a href="${esc(safeUrl(r.htmlUrl))}" style="font:700 17px ${MONO};color:${C.accent};text-decoration:none;margin-left:6px">${esc(r.tagName)} ↗</a></div>
    <div style="font:12px ${MONO};color:${C.muted};margin-top:2px">${esc(formatIST(r.publishedAt))}</div>
    ${r.note ? `<div style="margin-top:10px;padding:8px 10px;border:1px solid ${C.brkLine};background:${C.brkBg};color:${C.brk};border-radius:6px;font:14px ${SANS}">${esc(r.note)}</div>` : ""}
    ${r.ai.summary ? `<p style="margin:10px 0 0;font:15px/1.55 ${SANS};color:${C.ink}">${esc(r.ai.summary)}</p>` : ""}
    ${showWhy ? `<p style="margin:10px 0 0;font:14px/1.5 ${SANS};color:${C.ink}"><b>Why it's flagged:</b> ${esc(r.ai.reason ?? "")}</p>` : ""}
    ${r.ai.action ? `<p style="margin:6px 0 0;font:14px/1.5 ${SANS};color:${C.ink}"><b>What to check:</b> ${esc(r.ai.action)}</p>` : ""}
    ${r.analysisState !== "analysed" && r.notesExcerpt.trim() ? `<pre style="margin:10px 0 0;white-space:pre-wrap;font:12px/1.5 ${MONO};color:${C.muted};background:${C.bg};padding:8px;border-radius:6px">${esc(r.notesExcerpt.slice(0, 400))}</pre>` : ""}
    ${rules ? `<p style="margin:10px 0 0;font:12px ${MONO};color:${C.muted}">Rules matched: ${rules}${r.ruleFlags.length > 4 ? ` +${r.ruleFlags.length - 4} more` : ""}</p>` : ""}
  </div>
</div>`;
}

function groupByRepo(list: DigestRelease[]) {
  const m = new Map<string, DigestRelease[]>();
  for (const r of list) m.set(r.repo, [...(m.get(r.repo) ?? []), r]);
  return [...m.entries()];
}

function section(title: string, count: number | null, body: string): string {
  return `
<h2 style="margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid ${C.line};font:600 22px ${SERIF};color:${C.ink}">${esc(title)}${count === null ? "" : ` <span style="font:14px ${MONO};color:${C.muted}">${count}</span>`}</h2>${body}`;
}

export function emailHtml(d: Digest, dashboardUrl: string): string {
  const s = d.stats;
  const n = s.needALook;
  const row = (r: DigestRelease) => `
<div style="padding:9px 0;border-top:1px solid ${C.line}">
  <a href="${esc(safeUrl(r.htmlUrl))}" style="font:700 13px ${MONO};color:${C.accent};text-decoration:none">${esc(r.tagName)} ↗</a>
  <span style="font:12px ${MONO};color:${C.muted}"> · ${esc(formatIST(r.publishedAt))}${r.prerelease ? " · pre-release" : ""}</span>
  <div style="font:14px/1.5 ${SANS};color:${C.ink};margin-top:2px">${esc(r.ai.summary ?? "No summary available.")}${r.note ? ` <i style="color:${C.muted}">(${esc(r.note)})</i>` : ""}</div>
</div>`;
  const collapsed = (label: string, items: DigestRelease[]) =>
    `<div style="padding:9px 0;border-top:1px solid ${C.line};font:13px/1.8 ${SANS};color:${C.muted}"><b style="color:${C.ink}">${items.length} ${esc(label)}:</b> ${items.map((r) => `<a href="${esc(safeUrl(r.htmlUrl))}" style="font:12px ${MONO};color:${C.accent};text-decoration:none">${esc(r.tagName)}</a>`).join(" · ")}</div>`;
  const others = groupByRepo(d.other)
    .map(([repo, items]) => {
      const { main, pre, sub } = splitReleases(items);
      const rows = main.map(row).join("") + (pre.length ? collapsed(pre.length === 1 ? "pre-release" : "pre-releases", pre) : "") + (sub.length ? collapsed("sub-package releases", sub) : "");
      return `<div style="margin:0 0 18px"><div style="font:15px ${SANS}"><span style="color:${C.muted}">${esc(repo.split("/")[0])}/</span><b>${esc(repo.split("/")[1])}</b> <span style="font:11px ${MONO};color:${C.muted};text-transform:uppercase;letter-spacing:.1em">${esc(items[0].tag)} · ${items.length}</span></div>${rows}</div>`;
    })
    .join("");

  const watch = d.evaluationWatch
    .map((w) => {
      const delta = w.starsChange === null ? "no earlier snapshot yet" : `${w.starsChange >= 0 ? "+" : ""}${w.starsChange.toLocaleString("en-US")} since ${formatISTShort(w.starsChangeSince as string)}`;
      const cad = w.releasesLast90Days === 0 ? "no releases in 90 days" : `${w.releasesLast90Days} releases in 90 days · last ${w.daysSinceLastRelease}d ago · median gap ${w.medianDaysBetweenReleases ?? "–"}d`;
      return `<div style="padding:7px 0;border-top:1px solid ${C.line};font:14px/1.5 ${SANS}"><b>${esc(w.repo)}</b><br><span style="color:${C.muted}">${esc(cad)} · ★ ${w.stars.toLocaleString("en-US")} (${esc(delta)})</span></div>`;
    })
    .join("");

  const body = [
    section("Needs a look", n, n === 0 ? `<p style="font:14px ${SANS};color:${C.muted}">Nothing flagged in this period.</p>` : d.needsLook.map(featured).join("")),
    d.stillOpen && d.stillOpen.length
      ? section("Still open from earlier weeks", d.stillOpen.length, `<p style="margin:0 0 10px;font:13px ${SANS};color:${C.muted}">Flagged earlier and not yet marked reviewed. Mark them on the dashboard once handled.</p>` + d.stillOpen.map(featured).join(""))
      : "",
    section("Other releases", d.other.length, d.other.length ? others : `<p style="font:14px ${SANS};color:${C.muted}">No other releases.</p>`),
    d.evaluationWatch.length ? section("Evaluation watch", null, watch) : "",
    section("Quiet this week", d.quiet.length, `<p style="font:13px/1.7 ${MONO};color:${C.muted}">${d.quiet.length ? d.quiet.map(esc).join(" · ") : "Every repo had a release."}</p>`),
    d.couldntCheck.length
      ? section("Couldn't check", d.couldntCheck.length, d.couldntCheck.map((c) => `<p style="margin:0 0 6px;padding:8px 12px;border:1px solid ${C.secLine};background:${C.secBg};color:${C.sec};border-radius:6px;font:14px ${SANS}"><b>${esc(c.repo)}</b> — ${esc(c.reason)}</p>`).join(""))
      : "",
  ].join("");

  const headline = s.releases === 0 ? "Quiet week" : n === 0 ? "None need a look" : `${n} ${n === 1 ? "needs" : "need"} a look`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(emailSubject(d))}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(headerLine(s))}</div>
<div style="max-width:660px;margin:0 auto;padding:24px 16px;background:${C.bg};color:${C.ink};font-family:${SANS}">
  <div style="font:600 11px ${MONO};letter-spacing:.18em;color:${C.muted}">RELEASE RADAR · ${esc(formatISTShort(d.windowStart).toUpperCase())} – ${esc(formatISTShort(d.windowEnd).toUpperCase())} · IST</div>
  <p style="margin:14px 0 0;font:13px ${MONO};color:${C.muted}">${esc(headerLine(s).split(" → ")[0])}</p>
  <h1 style="margin:2px 0 0;font:600 38px/1.1 ${SERIF};color:${C.ink}">→ ${esc(headline)}</h1>
  <p style="margin:14px 0 0;font:14px ${SANS}"><a href="${esc(dashboardUrl)}" style="color:${C.accent}">Open the dashboard</a> for raw notes and 30 / 90-day views.</p>
  ${body}
  <p style="margin:34px 0 0;padding-top:14px;border-top:1px solid ${C.line};font:12px/1.6 ${SANS};color:${C.muted}">Summaries are written by Gemini Flash from the release text only. Rules flag first; the AI can add a flag but never remove one. Only GitHub releases are covered, so changes announced elsewhere won't appear. <a href="${esc(dashboardUrl)}" style="color:${C.muted}">Release Radar</a></p>
</div></body></html>`;
}

export function emailText(d: Digest, dashboardUrl: string): string {
  const out: string[] = [`RELEASE RADAR · ${formatISTShort(d.windowStart)} – ${formatISTShort(d.windowEnd)} (IST)`, headerLine(d.stats), `Dashboard: ${dashboardUrl}`, ""];
  out.push(`NEEDS A LOOK (${d.needsLook.length})`);
  if (!d.needsLook.length) out.push("  Nothing flagged in this period.");
  for (const r of d.needsLook) {
    out.push(`  [${label(r)}${r.prerelease ? " · PRE-RELEASE" : ""}] ${r.repo} ${r.tagName} · ${formatIST(r.publishedAt)} · flagged by ${r.flaggedBy}`);
    if (r.note) out.push(`    ! ${r.note}`);
    if (r.ai.summary) out.push(`    ${r.ai.summary}`);
    if (r.analysisState === "analysed" && r.ai.reason) out.push(`    Why: ${r.ai.reason}`);
    if (r.ai.action) out.push(`    Check: ${r.ai.action}`);
    if (r.analysisState !== "analysed" && r.notesExcerpt.trim()) out.push(`    Notes: ${r.notesExcerpt.slice(0, 300).replace(/\s+/g, " ")}`);
    out.push(`    ${r.htmlUrl}`, "");
  }
  if (d.stillOpen && d.stillOpen.length) {
    out.push(`STILL OPEN FROM EARLIER WEEKS (${d.stillOpen.length}) — flagged earlier, not yet marked reviewed`);
    for (const r of d.stillOpen) out.push(`  [${label(r)}] ${r.repo} ${r.tagName} · ${formatIST(r.publishedAt)} · flagged by ${r.flaggedBy}`, `    ${r.ai.reason || r.ai.summary || ""}`, `    ${r.htmlUrl}`);
    out.push("");
  }
  out.push(`OTHER RELEASES (${d.other.length})`);
  for (const [repo, items] of groupByRepo(d.other)) {
    out.push(`  ${repo} [${items[0].tag}]`);
    const { main, pre, sub } = splitReleases(items);
    for (const r of main) out.push(`    ${r.tagName} · ${formatIST(r.publishedAt)}${r.prerelease ? " · pre-release" : ""} — ${r.ai.summary ?? "No summary available."}${r.note ? ` (${r.note})` : ""}`, `      ${r.htmlUrl}`);
    if (pre.length) out.push(`    ${pre.length} pre-release(s): ${pre.map((r) => r.tagName).join(", ")}`);
    if (sub.length) out.push(`    ${sub.length} sub-package release(s): ${sub.map((r) => r.tagName).join(", ")}`);
  }
  if (d.evaluationWatch.length) {
    out.push("", "EVALUATION WATCH");
    for (const w of d.evaluationWatch) out.push(`  ${w.repo}: ${w.releasesLast90Days} releases in 90d · last ${w.daysSinceLastRelease ?? "?"}d ago · median gap ${w.medianDaysBetweenReleases ?? "–"}d · ${w.stars.toLocaleString("en-US")} stars (${w.starsChange === null ? "no earlier snapshot yet" : `${w.starsChange >= 0 ? "+" : ""}${w.starsChange} since ${formatISTShort(w.starsChangeSince as string)}`})`);
  }
  out.push("", `QUIET THIS WEEK (${d.quiet.length})`, `  ${d.quiet.join(", ") || "Every repo had a release."}`);
  if (d.couldntCheck.length) out.push("", `COULDN'T CHECK (${d.couldntCheck.length})`, ...d.couldntCheck.map((c) => `  ${c.repo}: ${c.reason}`));
  out.push("", "Summaries are written by Gemini Flash from the release text only. Rules flag first; the AI can add a flag but never remove one.");
  return out.join("\n");
}
