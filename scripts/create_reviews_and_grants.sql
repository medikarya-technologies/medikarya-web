-- create_reviews_and_grants.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…, not the case studio's).
--
-- 1. case_reviews: the private review links sent to a professor for a draft case, and what they decided. The link
--    holds a random token; only its SHA-256 hash is stored here, so the table alone cannot be used to review.
-- 2. plan_grants: free plan time given outside Razorpay, e.g. 1 month of Resident to a student whose case is
--    published. Keyed by email, so it applies when that student signs in to MediKarya, account or not yet.
-- Both follow the other tables: RLS on with no policies, so only the server's secret key can read or write them.

create table if not exists public.case_reviews (
    id uuid primary key default gen_random_uuid(),
    case_id text not null,
    token_hash text not null unique,
    created_by text not null,                 -- the admin (Clerk user id) who sent the link
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    reviewer_name text,
    reviewer_designation text,
    reviewer_department text,
    reviewer_institution text,
    show_name boolean not null default false,  -- the reviewer agreed to be named on the case
    decision text check (decision in ('approved', 'changes_requested')),
    comments text,
    decided_at timestamptz
);
create index if not exists case_reviews_case_idx on public.case_reviews (case_id, created_at desc);
alter table public.case_reviews enable row level security;

create table if not exists public.plan_grants (
    id uuid primary key default gen_random_uuid(),
    email text not null,                       -- lower-case
    tier text not null check (tier in ('intern', 'resident')),
    months integer not null check (months > 0),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    reason text not null,                      -- e.g. 'case_published'
    case_id text,
    granted_by text,                           -- the admin (Clerk user id)
    created_at timestamptz not null default now()
);
create index if not exists plan_grants_email_idx on public.plan_grants (email, ends_at desc);
alter table public.plan_grants enable row level security;

-- Check: both tables exist and are empty.
select 'case_reviews' as table_name, count(*) from public.case_reviews
union all
select 'plan_grants', count(*) from public.plan_grants;
