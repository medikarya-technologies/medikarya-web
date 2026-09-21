-- fix_display_tags.sql
-- Run once in the Supabase SQL editor.
--
-- The library searches each case's displayTags. They should say what the patient would tell you and which
-- specialty it is: not the diagnosis, not an examination finding, not a test. Seven cases gave more away than
-- that ("malaria", "ADPKD", "vitamin-b12-deficiency", "bradycardia", "ECG", "thyroid", "dehydration",
-- "prolonged jaundice"), so typing one of those words into the search found the case by its answer.
--
-- Only case_json.displayTags changes; nothing else in the row is touched. The old values are in the comments
-- so this can be undone. The library reads the case list through a one-minute cache, so it shows within a minute.
-- (case_json is treated as jsonb, which is what Supabase creates by default. If the editor says it cannot store
-- jsonb in a json column, put ::json after each jsonb_set(...) and run it again: a failed statement changes nothing.)

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["nephrology","haematuria","flank-pain"]'::jsonb)
where id = 'autosomal-dominant-polycystic-kidney-disease';
-- was ["nephrology","haematuria","flank-pain","ADPKD"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["cardiology","syncope","dizziness"]'::jsonb)
where id = 'complete-heart-block-syncope';
-- was ["cardiology","syncope","bradycardia","ECG"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["infectious-disease","fever","chills","returning-traveller"]'::jsonb)
where id = 'malaria-returning-traveller-fever';
-- was ["infectious-disease","malaria","fever","returning-traveller"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["pediatrics","neonatology","jaundice","yellow-eyes"]'::jsonb)
where id = 'neonatal-jaundice-breastmilk';
-- was ["pediatrics","neonatology","jaundice","prolonged jaundice"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["internal-medicine","neck-swelling"]'::jsonb)
where id = 'non-toxic-nodular-goitre-neck-swelling';
-- was ["internal-medicine","thyroid","neck-swelling"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["pediatrics","vomiting","diarrhea"]'::jsonb)
where id = 'viral-gastroenteritis';
-- was ["pediatrics","vomiting","diarrhea","dehydration"]

update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTags}', '["haematology","fatigue","breathlessness","numb-feet"]'::jsonb)
where id = 'vitamin-b12-deficiency-pernicious-anaemia';
-- was ["haematology","vitamin-b12-deficiency","macrocytic-anaemia","neuropathy"]

-- Check: every row should now list symptom-level tags only.
select id, case_json->'displayTags' as display_tags
from public.cases
order by id;
