-- widen_testing_rubric_viral_gastroenteritis.sql
-- Run once in the Supabase SQL editor.
--
-- The order menu just opened up: a student can now order any of the 183 tests in the master catalog
-- (lib/clinical-catalog.ts), not just this case's own 10 — the same as the STEMI case already allows.
-- But the classic evaluator's test-ordering score (engine/evaluation/DeterministicScorer.ts) only docks
-- marks for an id it was TOLD is a distractor or dangerous; it never scores the other direction, so a
-- catalog test ordered outside this list costs nothing. This adds a real, clinically-reasoned list of
-- catalog ids to the case's existing evaluation_config.testing (which only named 4 of its own 10 tests),
-- so over-ordering from the wider catalog has the same real consequence STEMI already has.
--
-- Values are REPLACED at this path (jsonb_set does not merge arrays), so both lists below keep the case's
-- original entries and add to them. Old values are in the comments so this can be undone. Nothing else in
-- the row changes; core_tests, optional_tests and testing_required are untouched.

update public.cases
set case_json = jsonb_set(
    case_json::jsonb,
    '{evaluation_config,testing,distractor_tests}',
    '["usg-abdomen","xray-abdomen","iem","troponin_i","bnp","tsh","ft4","cortisol_am","psa","afp","cea","ca_125","ana","rheumatoid_factor","hiv_test","vdrl_rpr","mri_brain","mammography","dexa_scan","pet_ct","cardiac_mri","ct_coronary_angiography","spirometry","audiometry"]'::jsonb
)
where id = 'viral-gastroenteritis';
-- was ["usg-abdomen","xray-abdomen","iem"]
-- added: cardiac markers, endocrine, tumour markers, autoimmune/serology and advanced imaging that have
-- no bearing on a toddler with straightforward viral gastroenteritis — low-value, not unsafe (-4 each,
-- same points as the case's existing distractor entries; see DeterministicScorer.scoreTesting).

update public.cases
set case_json = jsonb_set(
    case_json::jsonb,
    '{evaluation_config,testing,dangerous_tests}',
    '["ct-abdomen","lumbar_puncture_csf","bone_marrow_biopsy","upper_gi_endoscopy","colonoscopy","bronchoscopy"]'::jsonb
)
where id = 'viral-gastroenteritis';
-- was ["ct-abdomen"]
-- added: invasive procedures (bleeding/perforation/sedation risk in a 2-year-old) with no indication here
-- (-10 each + a safety flag, same as the case's existing "ct-abdomen" entry).

-- Check: both lists should now be the longer ones above.
select id,
       case_json->'evaluation_config'->'testing'->'distractor_tests' as distractor_tests,
       case_json->'evaluation_config'->'testing'->'dangerous_tests'  as dangerous_tests
from public.cases
where id = 'viral-gastroenteritis';
