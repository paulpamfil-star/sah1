-- Chess: The Origins — playtest console
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- One row per live match. The whole match is one jsonb blob: board, log, cards,
-- terrain, seats. The app writes the blob whole on every move, so there is
-- nothing to migrate when the match shape changes.

create table if not exists public.matches (
  code        text primary key,
  state       jsonb       not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists matches_updated_at_idx on public.matches (updated_at desc);

alter table public.matches enable row level security;

-- WHO CAN DO WHAT.
--
-- These policies let anyone holding the site's publishable key read and write
-- any match row. That is deliberate for a playtest: there are no accounts, and
-- a four-letter code is the only thing standing between a player and a match.
-- It is NOT good enough for a shipped game — before you sell this, put real
-- auth on it and scope these policies to the players seated in the match.

drop policy if exists "read any match" on public.matches;
create policy "read any match"
  on public.matches for select
  using (true);

drop policy if exists "create a match" on public.matches;
create policy "create a match"
  on public.matches for insert
  with check (true);

drop policy if exists "update a match" on public.matches;
create policy "update a match"
  on public.matches for update
  using (true) with check (true);

-- Realtime: both phones subscribe to their own match row.
alter publication supabase_realtime add table public.matches;

-- Housekeeping. A free project has 500 MB; a match blob is a few tens of KB, so
-- this is about tidiness, not space. Run it whenever, or wire it to a cron.
--
--   delete from public.matches where updated_at < now() - interval '30 days';
