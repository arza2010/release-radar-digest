/** Writes the latest saved digest as email HTML/text to ./tmp-email/ for eyeballing. Usage: npm run preview-email */
import { mkdirSync, writeFileSync } from "node:fs";
import { getLatestDigest } from "@/lib/digest-store";
import { emailHtml, emailSubject, emailText } from "@/lib/email-html";

async function main() {
  const latest = await getLatestDigest();
  if (!latest) throw new Error("No digest saved yet. Run: npm run build-digest");
  mkdirSync("tmp-email", { recursive: true });
  const url = process.env.APP_URL ?? "http://localhost:3000";
  writeFileSync("tmp-email/digest.html", emailHtml(latest.digest, url));
  writeFileSync("tmp-email/digest.txt", emailText(latest.digest, url));
  console.log(`subject: ${emailSubject(latest.digest)}\nwrote tmp-email/digest.html and digest.txt`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
