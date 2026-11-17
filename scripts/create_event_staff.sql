-- create_event_staff.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…, not the Case Studio's).
--
-- Gives a named event team access only to its own operational pages. These are not MediKarya platform admins:
-- they cannot read users, payments, cases, or other events. Add an organiser by their normal sign-in email after
-- they have created a MediKarya account.

create table if not exists public.event_staff (
    event_key text not null,
    email text not null,
    added_by text,
    created_at timestamptz not null default now(),
    primary key (event_key, email)
);
alter table public.event_staff enable row level security;

-- Example, after the organiser has made their account:
-- insert into public.event_staff (event_key, email, added_by)
-- values ('medventure-2026', 'organiser@example.com', 'your-clerk-user-id');

select event_key, email, created_at
from public.event_staff
order by event_key, email;
