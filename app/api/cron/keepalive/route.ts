import { isAuthorizedCron } from "@/lib/cron-auth";
import { supabase } from "@/lib/supabase";

/** Daily no-op read so the free Supabase project is never paused for inactivity. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { count, error } = await supabase().from("repos").select("*", { count: "exact", head: true });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, repos: count, at: new Date().toISOString() });
}
