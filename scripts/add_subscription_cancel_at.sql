-- add_subscription_cancel_at.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (the one whose URL starts srsqsl…, not the
-- case studio's).
--
-- When a student cancels, Razorpay keeps the subscription active to the end of the period they paid for and
-- only then marks it cancelled. cancel_at is that date, so the Plan & billing page can say "Cancels on …" and
-- access stops then even if Razorpay's webhook is missed. Nothing breaks before this runs; cancelling just
-- cannot be recorded until it has.

alter table public.subscriptions add column if not exists cancel_at timestamptz;

-- Check: should list cancel_at.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'cancel_at';
