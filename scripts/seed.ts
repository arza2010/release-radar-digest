/** Applies the repo list from supabase/seed.sql through the API (same effect as running it in the SQL editor). Usage: npm run seed */
import { readFileSync } from "node:fs";
import { supabase } from "@/lib/supabase";

async function main() {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const rows = [...sql.matchAll(/\('([^']+)',\s*'(dependency|evaluating)'\)/g)].map((m) => ({ full_name: m[1], tag: m[2] }));
  const { error } = await supabase().from("repos").upsert(rows, { onConflict: "full_name", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  const { count } = await supabase().from("repos").select("*", { count: "exact", head: true });
  console.log(`seed ok: ${rows.length} in seed.sql, ${count} repos in the table`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
