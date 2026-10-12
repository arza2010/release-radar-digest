-- Seed the tracked repos. Verified against live GitHub with `npm run check-repos`.
-- Safe to re-run: existing rows are left untouched.
insert into public.repos (full_name, tag) values
  -- dependencies we ship against
  ('stripe/stripe-node',                'dependency'),
  ('stripe/stripe-python',              'dependency'),
  ('stripe/stripe-go',                  'dependency'),
  ('razorpay/razorpay-node',            'dependency'),
  ('adyen/adyen-node-api-library',      'dependency'),
  ('adyen/adyen-python-api-library',    'dependency'),
  ('nextauthjs/next-auth',              'dependency'),
  ('panva/jose',                        'dependency'),
  ('keycloak/keycloak',                 'dependency'),
  ('supertokens/supertokens-core',      'dependency'),
  ('auth0/nextjs-auth0',                'dependency'),
  ('auth0/node-auth0',                  'dependency'),
  ('axios/axios',                       'dependency'),
  ('expressjs/express',                 'dependency'),
  ('fastify/fastify',                   'dependency'),
  ('panva/node-oidc-provider',          'dependency'),
  -- tools we are evaluating
  ('better-auth/better-auth',           'evaluating'),
  ('honojs/hono',                       'evaluating'),
  ('drizzle-team/drizzle-orm',          'evaluating'),
  ('juspay/hyperswitch',                'evaluating'),
  ('getlago/lago',                      'evaluating'),
  ('temporalio/temporal',               'evaluating')
on conflict (full_name) do nothing;
