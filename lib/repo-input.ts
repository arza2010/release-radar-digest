export type ParsedRepo = { ok: true; fullName: string } | { ok: false; error: string };

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts "owner/repo", "github.com/owner/repo" or a full GitHub URL (extra path like /releases is ignored).
 * Returns the lowercase "owner/repo", or a plain-language error.
 */
export function parseRepoInput(raw: string): ParsedRepo {
  let s = raw.trim();
  if (!s) return { ok: false, error: "Enter a repo like owner/name." };
  if (s.length > 300) return { ok: false, error: "That is too long to be a repo name." };

  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (/^github\.com\//i.test(s)) s = s.replace(/^github\.com\//i, "");
  else if (/^[^/\s]+\.[a-z]{2,}\//i.test(s)) return { ok: false, error: "Only github.com repos are supported." };

  const parts = s.split(/[?#]/)[0].split("/").filter(Boolean);
  if (parts.length < 2) return { ok: false, error: "Use the form owner/name, for example stripe/stripe-node." };
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(name) || name === "." || name === ".." || owner === "." || owner === "..") {
    return { ok: false, error: "Repo names can only contain letters, numbers, dots, dashes and underscores." };
  }
  return { ok: true, fullName: `${owner}/${name}`.toLowerCase() };
}
