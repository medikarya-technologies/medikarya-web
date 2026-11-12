-- create_try_funnel.sql
-- Run once in the Supabase SQL editor of the MAIN site's project (srsqsl...), not the studio's.
--
-- How far each guest gets through the free case on /try (lib/try-funnel.ts): viewed, started, asked, examined,
-- ordered, submitted, finished, signed_up. One row per guest, play and step; repeats hit the unique key and add
-- nothing. Only the step names, a random guest id, whether the visit began with a Meta ad click, and whether it was
-- our own testing. Never anything typed or chosen in the case.
--
-- Until this table exists, the site still works: recording a step just fails quietly.

create table if not exists public.try_funnel (
    id bigint generated always as identity primary key,
    guest_id uuid not null,
    play_id text not null default '',
    step text not null check (step in ('viewed', 'started', 'asked', 'examined', 'ordered', 'submitted', 'finished', 'signed_up')),
    ad_source text check (ad_source in ('meta')),
    internal boolean not null default false,
    created_at timestamptz not null default now(),
    unique (guest_id, play_id, step)
);

create index if not exists try_funnel_created_idx on public.try_funnel (created_at);

-- Like the other tables: RLS on with no policies, so only the server's secret key (which bypasses RLS) can use it.
alter table public.try_funnel enable row level security;

-- Check: table exists, empty, RLS on.
select count(*) from public.try_funnel;
select relrowsecurity from pg_class where relname = 'try_funnel';
