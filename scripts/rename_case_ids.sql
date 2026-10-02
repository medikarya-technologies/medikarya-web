-- rename_case_ids.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…).
-- Run it AFTER the code that knows the new ids is live (lib/cases/renamed-ids.ts). That code finds a case under
-- either id, so the site works before and after this script; older code only knows the old ids.
--
-- The first ten cases had ids that named their diagnosis ("viral-gastroenteritis"), which showed in the address bar.
-- This renames them to describe the patient instead, everywhere an id is stored: the case itself, students'
-- attempts (so their history and scores stay attached), case starts, reports, private review links and plan rewards.
-- Nothing else about a case changes. It is one transaction: if any step fails, nothing is changed.
-- Running it a second time changes nothing.
--
-- RUN ON 2026-10-02. Supabase's editor asks whether to enable row level security because this makes a (temporary)
-- table; choose "Run without RLS". Choosing to enable it adds a step after the commit that fails with
-- 'relation "case_id_rename" does not exist' (the temporary table is already gone): the rename itself has still
-- been done, and that error can be ignored.

begin;

create temporary table case_id_rename (old_id text primary key, new_id text not null unique) on commit drop;
insert into case_id_rename (old_id, new_id) values
  ('viral-gastroenteritis',                        '2-year-old-boy-with-vomiting-and-watery-diarrhea'),
  ('neonatal-jaundice-breastmilk',                 '4-week-old-infant-with-yellow-eyes-and-face'),
  ('severe-migraine-with-aura',                    '21-year-old-woman-with-visual-disturbances-and-headache'),
  ('iron-deficiency-anemia-in-pregnancy',          '24-year-old-pregnant-woman-with-fatigue-and-breathlessness'),
  ('malaria-returning-traveller-fever',            '24-year-old-man-with-fever-after-travel'),
  ('autosomal-dominant-polycystic-kidney-disease', '49-year-old-woman-with-flank-pain-and-blood-in-urine'),
  ('non-toxic-nodular-goitre-neck-swelling',       '54-year-old-woman-with-a-neck-swelling'),
  ('acute-anterior-stemi',                         '61-year-old-man-with-severe-chest-pain-and-sweating'),
  ('vitamin-b12-deficiency-pernicious-anaemia',    '63-year-old-woman-with-tiredness-and-numb-feet'),
  ('complete-heart-block-syncope',                 '72-year-old-man-with-recurrent-fainting');

-- 1. Before: how many rows carry an old id, table by table.
select 'cases' as table_name, count(*) as rows_with_an_old_id from public.cases where id in (select old_id from case_id_rename)
union all select 'case_attempts', count(*) from public.case_attempts where case_id in (select old_id from case_id_rename)
union all select 'case_starts',   count(*) from public.case_starts   where case_id in (select old_id from case_id_rename)
union all select 'case_reports',  count(*) from public.case_reports  where case_id in (select old_id from case_id_rename)
union all select 'case_reviews',  count(*) from public.case_reviews  where case_id in (select old_id from case_id_rename)
union all select 'plan_grants',   count(*) from public.plan_grants   where case_id in (select old_id from case_id_rename);

-- 2. The cases themselves: the row's id, and the id written inside its JSON.
update public.cases c
set id = m.new_id,
    case_json = c.case_json::jsonb || jsonb_build_object('id', m.new_id),
    updated_at = now()
from case_id_rename m
where c.id = m.old_id;

-- 3. Attempts: the case they belong to, and the copy of it kept inside the saved result.
update public.case_attempts a
set case_id = m.new_id
from case_id_rename m
where a.case_id = m.old_id;

update public.case_attempts a
set feedback_json = a.feedback_json::jsonb || jsonb_build_object('caseId', m.new_id)
from case_id_rename m
where a.feedback_json is not null and a.feedback_json::jsonb ->> 'caseId' = m.old_id;

-- 4. Case starts. A student can have one start per case per day: if they opened a case under its old id and then,
--    after the new code went live, again under its new id on the same day, the old row would become a duplicate,
--    so that one is dropped (it records the same thing).
delete from public.case_starts s
using case_id_rename m
where s.case_id = m.old_id
  and exists (select 1 from public.case_starts n where n.clerk_user_id = s.clerk_user_id and n.day = s.day and n.case_id = m.new_id);

update public.case_starts s
set case_id = m.new_id
from case_id_rename m
where s.case_id = m.old_id;

-- 5. Reports, private review links, plan rewards.
update public.case_reports r set case_id = m.new_id from case_id_rename m where r.case_id = m.old_id;
update public.case_reviews r set case_id = m.new_id from case_id_rename m where r.case_id = m.old_id;
update public.plan_grants  g set case_id = m.new_id from case_id_rename m where g.case_id = m.old_id;

-- 6. After: every count should be 0.
select 'cases' as table_name, count(*) as rows_still_with_an_old_id from public.cases where id in (select old_id from case_id_rename)
union all select 'cases (id inside the JSON)', count(*) from public.cases where case_json::jsonb ->> 'id' in (select old_id from case_id_rename)
union all select 'case_attempts', count(*) from public.case_attempts where case_id in (select old_id from case_id_rename)
union all select 'case_starts',   count(*) from public.case_starts   where case_id in (select old_id from case_id_rename)
union all select 'case_reports',  count(*) from public.case_reports  where case_id in (select old_id from case_id_rename)
union all select 'case_reviews',  count(*) from public.case_reviews  where case_id in (select old_id from case_id_rename)
union all select 'plan_grants',   count(*) from public.plan_grants   where case_id in (select old_id from case_id_rename);

commit;

-- 7. The cases as they are now (nine rows; the tenth, the chest-pain case, ships with the site and has no row).
select id, title from public.cases order by id;
