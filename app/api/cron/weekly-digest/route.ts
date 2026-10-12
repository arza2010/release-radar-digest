import { isAuthorizedCron } from "@/lib/cron-auth";
import { headerLine } from "@/lib/digest";
import { runAndEmail } from "@/lib/run";

// Hobby plan maximum. A normal run takes about two minutes (a few Gemini calls of 15–30s each).
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const send = new URL(request.url).searchParams.get("send") !== "false";
  try {
    const run = await runAndEmail({ trigger: "cron", send });
    return Response.json({
      ok: true,
      digestId: run.digestId,
      status: run.status,
      summary: headerLine(run.digest.stats),
      geminiCalls: run.analysis.geminiCalls,
      cacheHits: run.analysis.cached,
      aiFailed: run.analysis.failed,
      couldntCheck: run.digest.couldntCheck,
      email: run.email,
      seconds: Math.round(run.durationMs / 100) / 10,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
