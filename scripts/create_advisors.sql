-- create_advisors.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…, not the case studio's).
-- It makes two new tables, so the editor will ask about row level security: either answer is fine, the script
-- turns it on itself. Running it a second time changes nothing.
--
-- 1. advisor_invites: private links an admin sends to a professor or senior doctor (Admin → Advisors). The link opens
--    the chosen cases without an account: they give their name, designation and institution, play the cases, and can
--    leave feedback. The link holds a random token; only its SHA-256 hash is stored here, so this table alone cannot
--    be used to open a case. A link works for 14 days.
-- 2. advisors: the Clinical Advisory Board as it is shown on medikarya.in/contributors. A member is added by an admin,
--    from an invite or by hand; their certificate is issued in the case studio and its credential id is kept here.
-- Both follow the other tables: RLS on with no policies, so only the server's secret key can read or write them.

create table if not exists public.advisor_invites (
    id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    note text,                                 -- who the admin made it for, in their own words
    case_ids text[] not null,                  -- the cases this link opens
    created_by text not null,                  -- the admin (Clerk user id)
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    name text,                                 -- what the person told us when they opened the link
    designation text,
    department text,
    institution text,
    list_name boolean not null default false,  -- they agreed to be named on the contributors page
    details_at timestamptz,
    feedback text,
    feedback_at timestamptz
);
create index if not exists advisor_invites_created_idx on public.advisor_invites (created_at desc);
alter table public.advisor_invites enable row level security;

create table if not exists public.advisors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    designation text,
    department text,
    institution text,
    listed boolean not null default true,      -- shown on medikarya.in/contributors
    invite_id uuid references public.advisor_invites(id) on delete set null,
    credential_id text,                        -- their Clinical Advisory Board certificate (issued in the case studio)
    created_by text not null,
    created_at timestamptz not null default now()
);
create index if not exists advisors_created_idx on public.advisors (created_at);
alter table public.advisors enable row level security;

-- Check: both tables exist and are empty.
select 'advisor_invites' as table_name, count(*) from public.advisor_invites
union all
select 'advisors', count(*) from public.advisors;
