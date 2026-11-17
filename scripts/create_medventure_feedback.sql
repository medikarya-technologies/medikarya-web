-- create_medventure_feedback.sql
-- Run once in the MAIN SITE Supabase project (srsqsl…), not the Case Studio's.
-- One feedback form per student per event, written only by the MediKarya server (RLS on, no policies).

create table if not exists public.event_feedback (
    event_key text not null,
    clerk_user_id text not null,
    email text not null,
    overall smallint not null check (overall between 1 and 5),
    round_one smallint check (round_one between 1 and 5),
    round_two smallint check (round_two between 1 and 5),
    realism smallint check (realism between 1 and 5),
    recommend smallint check (recommend between 0 and 10),
    study_year text,
    liked text,
    improve text,
    contact_ok boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (event_key, clerk_user_id)
);
alter table public.event_feedback enable row level security;

select count(*) as feedback_rows from public.event_feedback;
