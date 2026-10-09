-- create_pass_codes.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…).
--
-- Join links for workshop passes: medikarya.in/join/<code>, shown in the room as a QR code. Whoever opens it while it
-- is open (and not full) and signs in gets the workshop's pass on their own account, whatever email they use. The pass
-- itself is still a plan_grants row like any other workshop pass (reason 'workshop: <event>'), so top scores and
-- certificates see these students too. Nothing existing changes.

create table if not exists public.pass_codes (
    code text primary key,                       -- the end of the link, e.g. 'mamc-4k7q' (lower case)
    event text not null,                         -- the workshop's name; its passes have reason 'workshop: <event>'
    tier text not null check (tier in ('intern', 'resident')),
    starts_at timestamptz not null,              -- the pass the link gives
    ends_at timestamptz not null,
    opens_at timestamptz not null,               -- when the link itself works
    closes_at timestamptz not null,
    max_joins integer not null check (max_joins > 0),
    active boolean not null default true,        -- the admin can switch it off at any time
    created_by text,                             -- the admin (Clerk user id)
    created_at timestamptz not null default now()
);
alter table public.pass_codes enable row level security;

-- Who joined through which link: one row per account per link, which also stops anyone joining twice.
create table if not exists public.pass_code_joins (
    code text not null references public.pass_codes (code) on delete cascade,
    clerk_user_id text not null,
    email text not null,                         -- lower case; the pass was given to this email
    joined_at timestamptz not null default now(),
    primary key (code, clerk_user_id)
);
alter table public.pass_code_joins enable row level security;

-- Check: both tables exist and are empty.
select 'pass_codes' as table_name, count(*) from public.pass_codes
union all
select 'pass_code_joins', count(*) from public.pass_code_joins;
