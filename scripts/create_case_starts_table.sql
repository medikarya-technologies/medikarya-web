-- create_case_starts_table.sql
-- Run once in the Supabase SQL editor.
--
-- One row per student, per case, per day (India time) that they open it. This is what the plan limits count
-- (lib/plans/limits.ts): 2 / 15 / unlimited normal cases a day, 0 / 5 / 10 live cases a day, and the free plan's
-- one live case ever. Opening, resuming or retrying the same case again that day hits the unique key and adds
-- nothing, so it is not counted twice.
--
-- Until this table exists, starting a case while signed in fails with "could not check your plan", so run this
-- before (or together with) deploying the code that uses it.

create table if not exists public.case_starts (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text not null,
    case_id text not null,
    live boolean not null default false,
    day date not null,
    created_at timestamptz not null default now(),
    unique (clerk_user_id, case_id, day)
);

create index if not exists case_starts_user_day_idx on public.case_starts (clerk_user_id, day);

-- Same as subscriptions: RLS on with no policies, so only the server's secret key (which bypasses RLS) can read it.
alter table public.case_starts enable row level security;

-- Check: table exists, empty, RLS on.
select count(*) from public.case_starts;
select relrowsecurity from pg_class where relname = 'case_starts';
