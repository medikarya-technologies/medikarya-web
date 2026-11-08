-- create_subscription_checkout_attempts.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project.
--
-- Stores which signed-in student opened a subscription checkout and whether it was paid, failed, or closed.
-- Razorpay remains the source of truth for subscription/payment state; this table records only the local checkout
-- outcome and a short failure reason, never payment credentials.

create table if not exists public.subscription_checkout_attempts (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text not null,
    razorpay_subscription_id text not null unique,
    tier text not null check (tier in ('intern', 'resident')),
    billing_period text not null check (billing_period in ('monthly', 'yearly')),
    coupon_code text,
    outcome text not null default 'started' check (outcome in ('started', 'failed', 'abandoned', 'paid')),
    failure_code text,
    failure_description text check (failure_description is null or length(failure_description) <= 300),
    payment_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists subscription_checkout_attempts_user_created_idx
    on public.subscription_checkout_attempts (clerk_user_id, created_at desc);
create index if not exists subscription_checkout_attempts_outcome_created_idx
    on public.subscription_checkout_attempts (outcome, created_at desc);

alter table public.subscription_checkout_attempts enable row level security;

-- No policies: default-deny to client keys; the server-side service-role client reads and writes this table.
-- Check: count should work in the SQL editor and relrowsecurity should be true.
select count(*) from public.subscription_checkout_attempts;
select relrowsecurity from pg_class where relname = 'subscription_checkout_attempts';
