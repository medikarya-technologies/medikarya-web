-- create_readonly_role.sql
-- Main project (srsqsl…). Run once in the Supabase SQL editor.
--
-- A login that can read the case tables and nothing else, for checking live cases from a Claude Code cloud session
-- without handing it the secret key. It cannot write, even by mistake: every transaction it opens is read-only, and
-- it has SELECT on four tables only. Students' profiles, plans, payments, certificates and reviewers are left out.
--
--   cases          the case JSON: live plans, their status and release blockers
--   case_attempts  how students did (scores, the debrief), to see how live cases are going
--   case_starts    who opened which case on which day (the live allowance counts these)
--   case_reports   "Report a problem with this case"
--
-- Before running: replace CHOOSE-A-LONG-PASSWORD below with a long random password (letters and digits only, so it
-- needs no escaping in a connection string). Do not save the password anywhere in this repository.
--
-- Then, in the dashboard: Connect > Session pooler, copy the connection string, change the user from
-- postgres.<project ref> to claude_readonly.<project ref>, and put in the password. That string goes into the cloud
-- environment's settings as READONLY_DATABASE_URL.
--
-- To take it away again:
--   drop policy if exists claude_readonly_select on public.cases;
--   drop policy if exists claude_readonly_select on public.case_attempts;
--   drop policy if exists claude_readonly_select on public.case_starts;
--   drop policy if exists claude_readonly_select on public.case_reports;
--   drop owned by claude_readonly;
--   drop role if exists claude_readonly;

create role claude_readonly with login password 'CHOOSE-A-LONG-PASSWORD';

-- Read-only at the session level, and a query that runs away is stopped.
alter role claude_readonly set default_transaction_read_only = on;
alter role claude_readonly set statement_timeout = '30s';

grant usage on schema public to claude_readonly;
grant select on public.cases, public.case_attempts, public.case_starts, public.case_reports to claude_readonly;

-- These tables have row level security on with no policies (only the secret key reads them), so without a policy
-- the role would see no rows. Each policy lets this role, and only this role, read.
create policy claude_readonly_select on public.cases for select to claude_readonly using (true);
create policy claude_readonly_select on public.case_attempts for select to claude_readonly using (true);
create policy claude_readonly_select on public.case_starts for select to claude_readonly using (true);
create policy claude_readonly_select on public.case_reports for select to claude_readonly using (true);

-- Check: four tables, SELECT only.
select table_name, privilege_type from information_schema.role_table_grants where grantee = 'claude_readonly' order by 1;
