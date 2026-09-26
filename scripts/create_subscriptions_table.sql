-- create_subscriptions_table.sql
-- Run once in the Supabase SQL editor.
--
-- Tracks Razorpay subscriptions (Intern/Resident recurring plans), separate from `user_profiles`
-- because a user's subscription history is its own thing over time — upgrades, lapses, resubscribes —
-- not a single current-state column. Razorpay's own webhook events (subscription.activated/.charged/
-- .cancelled/etc., see app/api/payments/webhook/route.ts) upsert rows here by razorpay_subscription_id;
-- `status` uses Razorpay's own status strings as-is (created/authenticated/active/paused/halted/
-- cancelled/completed/expired) rather than inventing a parallel enum that could drift from theirs.

create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text not null,
    razorpay_subscription_id text not null unique,
    razorpay_plan_id text not null,
    tier text not null,
    status text not null,
    current_start timestamptz,
    current_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists subscriptions_clerk_user_id_idx on public.subscriptions (clerk_user_id);

-- RLS on, no policies: default-deny for any key but the server-side secret key this app actually uses
-- (lib/supabase/server.ts — the only Supabase client anywhere in the codebase, service-role, always
-- bypasses RLS regardless). Changes nothing about how the app works today; closes the table by default
-- if a client-side Supabase key is ever added later, rather than leaving it open by accident.
alter table public.subscriptions enable row level security;

-- Check: table exists, empty, RLS on.
select count(*) from public.subscriptions;
select relrowsecurity from pg_class where relname = 'subscriptions';
