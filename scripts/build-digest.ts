/**
 * Run the pipeline end to end (no email yet) and save a digest. Usage: npm run build-digest
 * Re-running is cheap: cached releases cost no Gemini calls.
 */
import { headerLine } from "@/lib/digest";
import { runDigest } from "@/lib/pipeline";

async function main() {
  const r = await runDigest({ trigger: "manual" });
  console.log(`digest #${r.digestId} saved · status ${r.status} · ${(r.durationMs / 1000).toFixed(1)}s`);
  console.log(headerLine(r.digest.stats));
  console.log(`Gemini calls this run: ${r.analysis.geminiCalls} · cache hits ${r.analysis.cached} · AI failures ${r.analysis.failed}`);
  if (r.digest.couldntCheck.length) console.log("Couldn't check:", r.digest.couldntCheck.map((c) => `${c.repo} (${c.reason})`).join(", "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
