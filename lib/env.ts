import "server-only";

export const ENV_NAMES = [
  "GITHUB_TOKEN",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "DIGEST_RECIPIENT",
  "CRON_SECRET",
  "APP_URL",
] as const;

export type EnvName = (typeof ENV_NAMES)[number];

/**
 * Read a required env var at call time (not import time), so `next build`
 * works without secrets and each feature fails with a clear message.
 */
export function env(name: EnvName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}
