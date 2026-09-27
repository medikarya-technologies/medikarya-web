-- rename_stemi_patient.sql
-- Run once in the Supabase SQL editor.
--
-- The STEMI case's patient had the same name, age, sex and diagnosis as the demo case on a competitor's homepage.
-- This gives him his own identity (Harish Tandon, 61, runs a printing press in Lucknow, brought in by his daughter)
-- and rewords his lines, matching data/cases/simulation/acute-anterior-stemi.json. No clinical content changes:
-- symptoms, timings, vitals, risk factors, drugs, ECG, results, scoring and deterioration are all untouched.
--
-- Each statement changes ONE field, and only if that field still holds the old value, so it cannot overwrite
-- anything that was edited in the database afterwards, and running it twice is harmless. If the case is not in
-- the table at all, nothing happens (the app then uses the bundled JSON, which is already updated).
-- (case_json is treated as jsonb, which is what Supabase creates by default. If the editor says it cannot store
-- jsonb in a json column, put ::json after each jsonb_set(...) and run it again: a failed statement changes nothing.)

-- 1. Is the case in the database, and what does it say now?
select id,
       case_json::jsonb #>> '{patient,name}' as patient_name,
       case_json::jsonb #>> '{patient,age}'  as patient_age
from public.cases
where id = 'acute-anterior-stemi';

begin;

-- displayTitle
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{displayTitle}', '"61-year-old man with severe chest pain and sweating"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{displayTitle}' = '"58-year-old man with severe chest pain and sweating"'::jsonb;

-- objective
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{objective}', '"Manage a 61-year-old man with acute severe chest pain in a real-time emergency: recognise the ECG pattern, protect him from harm, and commit to reperfusion inside the critical window."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{objective}' = '"Manage a 58-year-old man with acute severe chest pain in a real-time emergency: recognise the ECG pattern, protect him from harm, and commit to reperfusion inside the critical window."'::jsonb;

-- patient.name
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient,name}', '"Harish Tandon"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient,name}' = '"Raghav Malhotra"'::jsonb;

-- patient.age
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient,age}', '61'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient,age}' = '58'::jsonb;

-- patient.mrn
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient,mrn}', '"ED-0923-61"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient,mrn}' = '"ED-0417-58"'::jsonb;

-- patient_text_brief
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_text_brief}', '"My name is Harish Tandon. I am 61 and I run a small printing press in Lucknow. About an hour and a half ago I was lifting bundles of paper up to the storeroom on the first floor when a terrible pressing, heavy pain came in the middle of my chest, as if a heavy weight is pressing down on it. It spreads into my left arm and my jaw. I broke into a cold sweat and felt sick, and I have been breathless. It has not eased at all with resting — it is the worst pain of my life, about 9 out of 10. My daughter brought me here in an auto. Over the last two months I have had a few episodes of tightness in my chest when I walk fast, which settled when I rested; I never told anyone. I have had high blood pressure and diabetes for about eight years and high cholesterol. I smoke about 20 cigarettes a day and have done for 30 years. My father died suddenly of a heart attack at 52. I take amlodipine, metformin and atorvastatin, but I often forget the atorvastatin. I have no allergies. I have never had surgery, a stroke, bleeding problems or a head injury, and I do not take blood thinners. I drink a little alcohol at weekends and do not use drugs."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_text_brief}' = '"I am Raghav Malhotra, a 58-year-old man who runs a small hardware shop in Delhi. About an hour and a half ago I was carrying a heavy box of stock up the stairs at my shop when I got a crushing, heavy pain in the middle of my chest, like someone sitting on it. It spreads into my left arm and my jaw. I broke into a cold sweat and felt sick, and I have been breathless. It has not eased at all with resting — it is the worst pain of my life, about 9 out of 10. My son drove me here. Over the last two months I have had a few episodes of tightness in my chest when I walk fast, which settled when I rested; I never told anyone. I have had high blood pressure and diabetes for about eight years and high cholesterol. I smoke about 20 cigarettes a day and have done for 30 years. My father died suddenly of a heart attack at 52. I take amlodipine, metformin and atorvastatin, but I often forget the atorvastatin. I have no allergies. I have never had surgery, a stroke, bleeding problems or a head injury, and I do not take blood thinners. I drink a little alcohol at weekends and do not use drugs."'::jsonb;

-- patient_facts.identity.name
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,identity,name}', '"Harish Tandon"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,identity,name}' = '"Raghav Malhotra"'::jsonb;

-- patient_facts.identity.age_years
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,identity,age_years}', '61'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,identity,age_years}' = '58'::jsonb;

-- patient_facts.identity.occupation
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,identity,occupation}', '"Runs a small printing press"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,identity,occupation}' = '"Owns a hardware shop"'::jsonb;

-- patient_facts.identity.location
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,identity,location}', '"Lucknow"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,identity,location}' = '"Delhi"'::jsonb;

-- patient_facts.pain.onset
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,pain,onset}', '"About 90 minutes ago while lifting bundles of paper up to his first-floor storeroom; it started with effort but did not settle when he stopped"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,pain,onset}' = '"About 90 minutes ago while carrying a heavy box up the stairs at his shop; it started with effort but did not settle when he stopped"'::jsonb;

-- patient_facts.pain.character
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,pain,character}', '"Crushing, heavy — ''like a heavy weight pressing down on my chest''"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,pain,character}' = '"Crushing, heavy — ''like an elephant sitting on my chest''"'::jsonb;

-- patient_facts.timeline.today_about_90_min_ago
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,timeline,today_about_90_min_ago}', '"Sudden severe chest pain while carrying paper bundles upstairs; did not settle."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,timeline,today_about_90_min_ago}' = '"Sudden severe chest pain while carrying stock up the stairs; did not settle."'::jsonb;

-- patient_facts.timeline.arrival
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{patient_facts,timeline,arrival}', '"Brought to the emergency department by his daughter in an auto-rickshaw."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{patient_facts,timeline,arrival}' = '"Brought to the emergency department by his son."'::jsonb;

-- ai_role.first_person_description
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_role,first_person_description}', '"61-year-old man, Harish Tandon, who runs a printing press, in severe chest pain, sweating and breathless, brought to the emergency department by his daughter"'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_role,first_person_description}' = '"58-year-old man, Raghav Malhotra, in severe chest pain, sweating and breathless, brought to the emergency department by his son"'::jsonb;

-- ai_role.key_constraints.1
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_role,key_constraints,1}', '"Do not name a diagnosis or use medical jargon — you run a printing press, you are not a doctor."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_role,key_constraints,1}' = '"Do not name a diagnosis or use medical jargon — you are a shopkeeper, not a doctor."'::jsonb;

-- ai_examples.0.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,0,patient}', '"Doctor sahab, my chest... it is pressing so hard, I cannot bear it. Please do something."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,0,patient}' = '"Doctor, my chest — it''s crushing, I can''t take it. Please help me."'::jsonb;

-- ai_examples.1.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,1,patient}', '"Here, in the centre. Behind the chest bone."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,1,patient}' = '"Right in the middle of my chest, behind the bone."'::jsonb;

-- ai_examples.2.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,2,patient}', '"Into my left arm, and my jaw is also aching."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,2,patient}' = '"Yes, down my left arm and up into my jaw."'::jsonb;

-- ai_examples.3.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,3,patient}', '"Never this bad. For two months or so my chest gets tight when I walk quickly, but it goes if I sit down."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,3,patient}' = '"Not like this. Some tightness when I walk fast, for a couple of months, but it went away when I rested."'::jsonb;

-- ai_examples.4.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,4,patient}', '"Yes, about twenty cigarettes a day. Thirty years now."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,4,patient}' = '"Twenty a day, for thirty years."'::jsonb;

-- ai_examples.5.patient
update public.cases
set case_json = jsonb_set(case_json::jsonb, '{ai_examples,5,patient}', '"No, never. And I do not take any blood thinner."'::jsonb)
where id = 'acute-anterior-stemi'
  and case_json::jsonb #> '{ai_examples,5,patient}' = '"No, nothing like that. No blood thinners either."'::jsonb;

commit;

-- 2. Check: should show Harish Tandon, 61, and old_name_left = false.
select id,
       case_json::jsonb #>> '{patient,name}' as patient_name,
       case_json::jsonb #>> '{patient,age}'  as patient_age,
       case_json::text ilike '%Raghav%'      as old_name_left
from public.cases
where id = 'acute-anterior-stemi';
