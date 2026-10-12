import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this header automatically). */
export function isAuthorizedCron(header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
