-- create_medventure_challenge.sql
-- Run once in the MAIN SITE Supabase project (srsqsl…), after create_event_staff.sql.
-- The tables have RLS enabled with no policies: only the MediKarya server secret may operate the event.

create table if not exists public.event_rooms (
    event_key text primary key,
    status text not null default 'draft' check (status in ('draft', 'live', 'closed', 'finalized')),
    round_two_case_id text,
    started_at timestamptz,
    closed_at timestamptz,
    finalized_at timestamptz,
    updated_at timestamptz not null default now()
);
alter table public.event_rooms enable row level security;

-- A pathway is an editable decision tree. Each node and answer has a stable text id;
-- answers are { id, text, points, nextNodeId }, with null nextNodeId ending that pathway.
create table if not exists public.event_pathways (
    event_key text not null references public.event_rooms(event_key) on delete cascade,
    id text not null,
    title text not null,
    position integer not null,
    start_node_id text not null,
    nodes jsonb not null default '[]'::jsonb,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (event_key, id),
    unique (event_key, position)
);
alter table public.event_pathways enable row level security;

create table if not exists public.event_round1_attempts (
    event_key text not null references public.event_rooms(event_key) on delete cascade,
    clerk_user_id text not null,
    email text not null,
    state jsonb not null default '{}'::jsonb,
    score integer not null default 0,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    primary key (event_key, clerk_user_id)
);
alter table public.event_round1_attempts enable row level security;

create table if not exists public.event_round2_starts (
    event_key text not null references public.event_rooms(event_key) on delete cascade,
    clerk_user_id text not null,
    case_id text not null,
    started_at timestamptz not null default now(),
    primary key (event_key, clerk_user_id)
);
alter table public.event_round2_starts enable row level security;

create table if not exists public.event_prizes (
    event_key text not null references public.event_rooms(event_key) on delete cascade,
    place integer not null check (place between 1 and 3),
    clerk_user_id text not null,
    email text not null,
    tier text not null check (tier in ('intern', 'resident')),
    granted_at timestamptz not null default now(),
    primary key (event_key, place),
    unique (event_key, clerk_user_id)
);
alter table public.event_prizes enable row level security;

insert into public.event_rooms (event_key)
values ('medventure-2026')
on conflict (event_key) do nothing;

select event_key, status, round_two_case_id, started_at, closed_at, finalized_at
from public.event_rooms
where event_key = 'medventure-2026';
