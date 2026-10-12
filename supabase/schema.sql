-- Open Source Release Radar — database schema
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Access model: the app talks to Postgres only from the server using the
-- service role key. RLS is enabled on every table with NO policies, so the
-- anon / authenticated keys can read and write nothing.

-- ---------------------------------------------------------------- repos
create table if not exists public.repos (
  id          bigint generated always as identity primary key,
  full_name   text not null unique
              constraint repos_full_name_lowercase check (full_name = lower(full_name))
              constraint repos_full_name_format check (full_name ~ '^[a-z0-9._-]+/[a-z0-9._-]+$'),
  tag         text not null default 'dependency'
              constraint repos_tag_check check (tag in ('dependency', 'evaluating')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------ release_analysis
-- The cache: one row per GitHub release id. A release is never re-analysed
-- once it has a row with ai_status = 'ok'.
create table if not exists public.release_analysis (
  release_id       bigint primary key,           -- GitHub release id
  repo_full_name   text not null,
  tag_name         text not null,
  release_name     text,
  html_url         text not null,
  published_at     timestamptz not null,
  prerelease       boolean not null default false,
  body_line_count  integer not null default 0,
  notes_excerpt    text not null default '',     -- first ~600 chars of the notes
  rule_flags       jsonb not null default '[]'::jsonb,  -- [{type, evidence}]
  ai_status        text not null default 'pending'
                   constraint release_analysis_ai_status_check
                   check (ai_status in ('ok', 'failed', 'pending')),
  ai_category      text
                   constraint release_analysis_ai_category_check
                   check (ai_category is null or ai_category in ('security', 'breaking', 'routine')),
  ai_summary       text,
  ai_reason        text,
  ai_action        text,
  model            text,
  analyzed_at      timestamptz
);

-- Optional "mark as reviewed" tracking (also in migrations/002_reviewed.sql for databases created before it).
alter table public.release_analysis add column if not exists reviewed_at timestamptz;

create index if not exists release_analysis_repo_published_idx
  on public.release_analysis (repo_full_name, published_at desc);
create index if not exists release_analysis_published_idx
  on public.release_analysis (published_at desc);

-- -------------------------------------------------------- repo_snapshots
-- Used for week-over-week momentum on "evaluating" repos.
create table if not exists public.repo_snapshots (
  id              bigint generated always as identity primary key,
  repo_full_name  text not null,
  taken_at        timestamptz not null default now(),
  stars           integer not null,
  forks           integer not null,
  open_issues     integer not null
);

create index if not exists repo_snapshots_repo_taken_idx
  on public.repo_snapshots (repo_full_name, taken_at desc);

-- --------------------------------------------------------------- digests
create table if not exists public.digests (
  id            bigint generated always as identity primary key,
  run_at        timestamptz not null default now(),
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  trigger       text not null
                constraint digests_trigger_check check (trigger in ('cron', 'manual')),
  status        text not null
                constraint digests_status_check check (status in ('success', 'partial', 'failed')),
  payload       jsonb not null,                  -- the full built digest
  stats         jsonb not null default '{}'::jsonb,
  email_status  text,                            -- e.g. sent | skipped | failed
  email_error   text
);

create index if not exists digests_run_at_idx on public.digests (run_at desc);

-- ------------------------------------------------------------------- RLS
alter table public.repos             enable row level security;
alter table public.release_analysis  enable row level security;
alter table public.repo_snapshots    enable row level security;
alter table public.digests           enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) has access.
