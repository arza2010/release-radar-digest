import type { RepoInput } from "@/lib/collect";

/** Seed candidates from BUILD_SPEC §9. The final list is chosen after check-repos. */
export const CANDIDATES: RepoInput[] = [
  ...[
    "stripe/stripe-node",
    "stripe/stripe-python",
    "razorpay/razorpay-node",
    "adyen/adyen-node-api-library",
    "braintree/braintree_node",
    "plaid/plaid-node",
    "auth0/node-jsonwebtoken",
    "nextauthjs/next-auth",
    "panva/jose",
    "jaredhanson/passport",
    "keycloak/keycloak",
    "supertokens/supertokens-core",
    "auth0/nextjs-auth0",
    "ory/kratos",
    "axios/axios",
    "expressjs/express",
  ].map((full_name) => ({ full_name, tag: "dependency" as const })),
  ...[
    "better-auth/better-auth",
    "honojs/hono",
    "drizzle-team/drizzle-orm",
    "juspay/hyperswitch",
    "getlago/lago",
    "temporalio/temporal",
  ].map((full_name) => ({ full_name, tag: "evaluating" as const })),
];

/** `--repos a/b,c/d` overrides the candidate list (tag: dependency). */
export function reposFromArgs(argv: string[]): RepoInput[] {
  const i = argv.indexOf("--repos");
  if (i === -1 || !argv[i + 1]) return CANDIDATES;
  return argv[i + 1]
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((full_name) => ({ full_name, tag: "dependency" as const }));
}
