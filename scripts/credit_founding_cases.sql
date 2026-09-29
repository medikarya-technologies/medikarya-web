-- credit_founding_cases.sql
-- Run once in the Supabase SQL editor of the MAIN SITE's project (URL starts srsqsl…).
--
-- MediKarya's first four cases were written by Shani Dangwal (Doon University) and clinically reviewed by
-- Dr. Apoorva Nagar (Clinical Advisor & Case Validator, Santosh University), as the Early Contributors page says.
-- This puts the same credit on the cases themselves, so each case's briefing shows "Case written by ..." and
-- "Clinically reviewed by ...". Only case_json.credit and case_json.review are added; nothing else changes, and
-- running it again changes nothing further.

-- 1. The four cases.
select id, title, status, case_json->'credit' as credit_now, case_json->'review' as review_now
from public.cases
where id in ('viral-gastroenteritis', 'severe-migraine-with-aura', 'neonatal-jaundice-breastmilk', 'iron-deficiency-anemia-in-pregnancy');

-- 2. Credit them.
update public.cases
set case_json = case_json::jsonb || jsonb_build_object(
      'credit', jsonb_build_object('author', 'Shani Dangwal', 'institution', 'Doon University', 'source', 'Early contributor'),
      'review', jsonb_build_object(
        'decision', 'approved',
        'show_name', true,
        'reviewer_name', 'Dr. Apoorva Nagar',
        'reviewer_designation', 'Clinical Advisor & Case Validator',
        'reviewer_institution', 'Santosh University'
      )
    ),
    updated_at = now()
where id in ('viral-gastroenteritis', 'severe-migraine-with-aura', 'neonatal-jaundice-breastmilk', 'iron-deficiency-anemia-in-pregnancy');

-- 3. Check: four rows, each with the author and the reviewer.
select id, case_json->'credit'->>'author' as author, case_json->'review'->>'reviewer_name' as reviewer
from public.cases
where id in ('viral-gastroenteritis', 'severe-migraine-with-aura', 'neonatal-jaundice-breastmilk', 'iron-deficiency-anemia-in-pregnancy');
