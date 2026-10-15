-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…, not the case studio's).
--
-- protocol_reviews: private links sent to a professor to answer the clinical decisions in the fluid protocol package
-- (/protocol-review/<token>). The link holds a random token; only its SHA-256 hash is stored here. Answers are saved
-- as they go and can be changed until the link expires. Same shape as case_reviews: RLS on with no policies, so only
-- the server's secret key can read or write it.

create table if not exists public.protocol_reviews (
    id uuid primary key default gen_random_uuid(),
    package text not null,                      -- which decision package, e.g. 'fluid-protocol-2026-10'
    token_hash text not null unique,
    created_by text not null,                   -- who made the link (a label, not a login)
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    reviewer_name text,
    reviewer_designation text,
    reviewer_institution text,
    answers jsonb not null default '{}'::jsonb, -- { "<card id>": { "choice": "A", "other": "...", "note": "..." } }
    updated_at timestamptz,
    submitted_at timestamptz
);
create index if not exists protocol_reviews_package_idx on public.protocol_reviews (package, created_at desc);
alter table public.protocol_reviews enable row level security;

-- Check: the table exists and is empty.
select 'protocol_reviews' as table_name, count(*) from public.protocol_reviews;
