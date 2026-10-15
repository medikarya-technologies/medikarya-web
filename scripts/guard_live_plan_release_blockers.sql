-- guard_live_plan_release_blockers.sql
-- Main project (srsqsl…). Optional. Run once in the Supabase SQL editor.
--
-- A live plan's release blockers (case_json.live_plan.release_blockers, lib/simulation/live-plan.ts) keep a case's
-- live version from students until a clinician's question is settled. The app and the scripts keep them on every
-- save, but this makes the database refuse any update that would lose one, whoever writes it:
--
--   * an open blocker (no cleared_at) can only go away by being marked cleared (cleared_at set), never by vanishing;
--   * a plan with an open blocker cannot be switched on (marked approved when it was not). Adding a blocker to a plan
--     that is already switched on is allowed: the app then keeps the case from students until it is settled.
--
-- To clear a blocker, use scripts/release-blocker.ts (it sets cleared_at, cleared_by and resolution).
-- To undo:  drop trigger if exists cases_keep_release_blockers on public.cases;
--           drop function if exists public.cases_keep_release_blockers();

create or replace function public.cases_keep_release_blockers() returns trigger
language plpgsql as $$
declare
  old_blocker jsonb;
  new_blocker jsonb;
begin
  for old_blocker in
    select b from jsonb_array_elements(coalesce(old.case_json::jsonb -> 'live_plan' -> 'release_blockers', '[]'::jsonb)) as b
    where b ->> 'cleared_at' is null
  loop
    select b into new_blocker
    from jsonb_array_elements(coalesce(new.case_json::jsonb -> 'live_plan' -> 'release_blockers', '[]'::jsonb)) as b
    -- by id; a blocker without one (written by hand) has to come back unchanged
    where (old_blocker ->> 'id' is not null and b ->> 'id' = old_blocker ->> 'id') or b = old_blocker;
    if new_blocker is null then
      raise exception 'case %: release blocker "%" is open and cannot be removed; clear it with scripts/release-blocker.ts', new.id, old_blocker ->> 'id';
    end if;
  end loop;

  if (new.case_json::jsonb -> 'live_plan' ->> 'status') = 'approved'
     and coalesce(old.case_json::jsonb -> 'live_plan' ->> 'status', '') <> 'approved'
     and exists (
    select 1 from jsonb_array_elements(coalesce(new.case_json::jsonb -> 'live_plan' -> 'release_blockers', '[]'::jsonb)) as b
    where b ->> 'cleared_at' is null
  ) then
    raise exception 'case %: its live plan has an open release blocker, so it cannot be switched on', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists cases_keep_release_blockers on public.cases;
create trigger cases_keep_release_blockers
  before update on public.cases
  for each row execute function public.cases_keep_release_blockers();
