/** Read-only: confirms Supabase credentials work and the four tables exist. Usage: npm run check-db */
import { supabase } from "@/lib/supabase";

async function main() {
  for (const table of ["repos", "release_analysis", "repo_snapshots", "digests"]) {
    const { count, error } = await supabase().from(table).select("*", { count: "exact", head: true });
    console.log(`${table.padEnd(18)} ${error ? `ERROR: ${error.message}` : `ok · ${count} rows`}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
