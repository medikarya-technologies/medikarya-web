-- add_case_reports.sql
-- Run once in the Supabase SQL editor.
--
-- Where "Report a problem with this case" goes. A student picks what kind of problem it is and writes a sentence;
-- the app adds the case and where in it they were (the encounter clock and the tab). Only the server (the service
-- key) writes to this table and reads it: row level security is on and there is no policy, so nobody else can.
--
-- Until this has been run, sending a report fails politely and the dialog offers to send it by email instead.

create table if not exists public.case_reports (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    case_id     text        not null,
    category    text        not null,                  -- clinical | result | patient | scoring | unclear | bug | other
    message     text        not null,
    place       text        not null default 'encounter', -- 'encounter' or 'debrief'
    context     jsonb       not null default '{}'::jsonb, -- { "clockSeconds": 312, "tab": "tests" }
    user_id     text,                                  -- the signed-in student's Clerk id ...
    guest_id    text,                                  -- ... or the guest id of someone trying a case on /try
    status      text        not null default 'new'     -- 'new' | 'seen' | 'fixed' | 'wontfix', for whoever triages
);

create index if not exists case_reports_case_idx  on public.case_reports (case_id, created_at desc);
create index if not exists case_reports_user_idx  on public.case_reports (user_id, created_at desc);
create index if not exists case_reports_guest_idx on public.case_reports (guest_id, created_at desc);

alter table public.case_reports enable row level security;

-- To read what has come in, newest first:
--   select created_at, case_id, category, message, context, place
--   from public.case_reports where status = 'new' order by created_at desc;
