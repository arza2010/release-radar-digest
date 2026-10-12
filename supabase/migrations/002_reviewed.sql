-- Optional: switches on "Mark as reviewed" and the "Still open from earlier weeks" section.
-- Run once in the Supabase SQL editor. Safe to re-run; it does not touch existing data.
alter table public.release_analysis add column if not exists reviewed_at timestamptz;
