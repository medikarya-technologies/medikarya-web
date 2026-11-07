# Guideline register

Every live case's doses, thresholds and timings must come from a current official guideline, cited in the plan's
`basis`. This register says which guideline each case follows, which edition is current, and what does not match yet.
Guideline PDFs that could be downloaded are kept in `guidelines/` (git-ignored: they are copyrighted).

Status: **current** (the plan cites the latest edition and matches it), **update** (a newer edition exists; the plan
still matches or nearly), **fix** (the plan disagrees with the current guideline), **unread** (the source could not be
opened from here; see "Needs a download" at the end).

Last checked: 2026-11-04 (built-in STEMI case and the static cases, sections below). Live plans: 2026-10-29. **Fixes applied and saved to the main database on 2026-10-29** for all 8 cases below (the
plans stay proposed with `clinical_review` open; nothing was switched on). What was done is listed under "Applied".

## Live cases

### Dengue shock (29-year-old man with belly pain as his fever settles) · live

| Source | Edition | Status | Local copy |
|---|---|---|---|
| NCVBDC National Guidelines for Clinical Management of Dengue Fever | 2023 | current | `guidelines/National Guidelines for Clinical Management of Dengue Fever 2023.pdf` |
| WHO Dengue guidelines | 2009 | current (used for the first-bolus hour) | none |

Checked against the PDF on 2026-10-29: compensated and hypotensive fluid pathways (pp. 39-41 printed), taper ladders,
blood dose, platelets (p. 41: none prophylactically; may be considered below 10,000 only with underlying
hypertension), narrow pulse pressure below 20 mmHg. All match after the 2026-10-29 fixes.

### Massive PE (48-year-old man who suddenly could not breathe and fainted)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| AHA/ACC/multisociety Guideline for Acute Pulmonary Embolism in Adults (Creager et al, Circulation 2026;153:e977-e1051, doi 10.1161/CIR.0000000000001415) | Feb 2026 | **fix** | `guidelines/aha-2026-pe/pe.pdf` |
| ESC Guidelines for acute PE | 2019 | still the latest ESC edition | none |

Findings:
1. **Anticoagulant.** AHA/ACC 2026, anticoagulation rec 2 (Class 1, B-R, p. e1002): in Categories C1 to E1, LMWH is
   recommended over UFH. He is Category E1 (persistent hypotension with shock; definitions p. e991). ESC 2019 prefers
   UFH in high-risk PE. The plan scores only the UFH bolus. Fix: let the anticoagulation item accept LMWH or UFH, and
   teach that the two guidelines differ.
2. **Thrombolysis.** AHA/ACC 2026, systemic thrombolysis rec 1 (Class 2a, C-LD, p. e1012): reasonable in Categories
   E1-2 with acceptable bleeding risk; standard alteplase 100 mg over 2 hours. Matches the plan (ESC 2019 gives
   Class I). Streptokinase: AHA says first-generation agents are "not used in contemporary practice"; keep it only as
   the alternative where alteplase is unavailable, as in India.
3. **Fluids and noradrenaline.** AHA/ACC 2026 (p. e1007): small boluses of 500 mL or less only in selected
   normotensive patients; noradrenaline is the vasopressor of choice, with a second agent added above about
   15 micrograms/min. The plan's 250 mL supportive bolus and supportive noradrenaline fit.
4. **Bedside echo.** AHA/ACC 2026 (p. e995): point-of-care ultrasound may be used when formal echo is unavailable.
   Matches the "no CT while unstable" teaching.
5. **Furosemide is marked harmful.** AHA/ACC 2026 lists diuresis as a support option when there is volume overload.
   Hypotensive and without overload, he should not get it; reword the reason to "while he is hypotensive", not
   "never".
6. The plan's references already name the 2026 AHA/ACC guideline; its basis should cite the recommendation numbers
   above.

### Inferior STEMI with RV infarction and bradycardia (56-year-old man with chest pain and a slow pulse)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| ESC Guidelines for acute coronary syndromes (Byrne et al, Eur Heart J 2023;44:3720-3826, doi 10.1093/eurheartj/ehad191) | 2023 | **fix** (current edition; no 2026 ACS guideline, ESC 2026 issued HF, CKD, rehabilitation and the 5th Universal Definition of MI) | `guidelines/esc-2023-acs/esc-2023-acs.pdf` |
| AHA Guidelines for CPR and ECC, Part 9 Adult ALS (Wigginton et al, Circulation 2025;152(suppl 2):S538-S577) | 2025 (plan cites 2020) | **update** | `guidelines/aha-2025-als/aha-2025-part9-als.pdf` |

Findings:
1. **P2Y12 item.** The tray says "Ticagrelor 180 mg orally (clopidogrel 300 mg if lysis)". This patient is being
   lysed. ESC 2023 Recommendation Table 7 (PDF p. 43): with fibrinolysis, "aspirin and clopidogrel are recommended"
   (I, A); dose table (PDF p. 32): clopidogrel 300 mg at the time of fibrinolysis, 75 mg above 75 years. Fix: lead
   with clopidogrel in this plan's own detail text.
2. **Anticoagulant.** Same table: with fibrinolysis, enoxaparin IV then SC is the preferred anticoagulant (I, A);
   UFH (weight-adjusted IV bolus, then infusion) only when enoxaparin is not available (I, B). The plan scores only
   the UFH bolus. Fix: the item should be enoxaparin, with UFH accepted. The 30 mg IV enoxaparin bolus is in the
   guideline's online supplementary Table S10, not in the main PDF; it is the standard pharmaco-invasive dose.
3. **Tenecteplase half dose** is "above 75 years" (IIa, B), not "75 or older". Wording only; he is 56.
4. **Atropine** confirmed by AHA 2025 Figure 8 (p. S575): 1 mg IV bolus, repeat every 3 to 5 minutes, maximum 3 mg;
   atropine is reasonable in bradycardia with haemodynamic compromise (2a, B-NR); if it fails, transcutaneous pacing
   or dopamine 5-20 micrograms/kg/min or adrenaline 2-10 micrograms/min (2b). ESC 2023 (PDF p. 59): chronotropes
   then temporary pacing if atropine fails (I, C). Update the citation from AHA 2020 to 2025.
5. **Nitrates** are contraindicated with hypotension, marked bradycardia or RV infarction (ESC 2023, PDF p. 25).
   Matches the harmful GTN item.
6. The 250 mL fluid bolus for RV infarction is a teaching choice, not a guideline figure; say so in the basis.

### Tension pneumothorax after a bike accident (24-year-old man struggling to breathe)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| ATLS Student Course Manual | **11th edition, 2025** (plan cites the 10th) | **update**, unread (paid manual) | none |
| BTS guideline for pleural disease and clinical statement on pleural procedures | 2023 (plan cites older BTS pleural procedures guidance) | **update** | none |
| WJES 2025 meta-analysis on needle site and length | 2025 | current | none |

Findings:
1. ATLS 11 (launched 2025) changes the primary survey to xABCDE, with catastrophic haemorrhage first, and stresses
   resuscitating shock before intubation. No source here confirms whether the adult needle decompression site
   changed. The plan's 5th intercostal space, just anterior to the midaxillary line, is the 10th-edition site; the
   meta-analysis quotes "4th or 5th". Fix: accept the 4th or 5th space, and have a doctor confirm the ATLS 11 wording
   (a one-line question).
2. Update the BTS citation to the 2023 documents.

### Severe hyperkalaemia after missed dialysis (46-year-old man whose legs are too weak to stand)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| UK Kidney Association, Clinical Practice Guideline: Management of Hyperkalaemia in Adults | **July 2026** (plan cites Oct 2023) | **update** | `guidelines/ukka-2026-hyperkalaemia/ukka-hyperkalaemia-jul2026.pdf` |

Findings (UKKA July 2026, PDF pp. 14-15):
1. Calcium: 30 mL 10% calcium gluconate over 10 minutes, or 10 mL 10% calcium chloride over 5 minutes (16.2a, 2C);
   chloride preferred only in cardiac arrest or peri-arrest, gluconate for everyone else (16.2b, 1C). Matches.
2. Insulin 10 units with 25 g glucose (16.3.1, 1B); 10% glucose 50 mL/hour for 5 hours if the pre-treatment glucose
   is below 7.0 mmol/L (16.3.3, 2B). Matches.
3. **Salbutamol** 10 to 20 mg nebulised is now *recommended* (1B) as an add-on in severe hyperkalaemia (16.4.1); the
   plan's basis says "suggests (2C)". Update the wording; it can stay supportive, since it is an add-on.
4. **New:** sodium zirconium cyclosilicate is recommended in the emergency management of severe hyperkalaemia (16.6.1a,
   1B); patiromer is an option (16.6.2). Consider a supportive tray item, if the drug is available in India.
5. Sodium bicarbonate not routine (16.5, 2C); calcium resonium no longer routine in acute hyperkalaemia (2B). The
   harmful items match.

### Variceal bleed (52-year-old man vomiting blood at 2 am)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| **Baveno VIII consensus** (J Hepatol 2026;85:993-1018, doi 10.1016/j.jhep.2026.07.030) | Nov 2026 issue (plan cites Baveno VII, 2022) | **fix** | `guidelines/baveno-viii-2026/baveno-viii.pdf` |
| BSG UK guidelines on variceal haemorrhage (Tripathi et al, Gut 2015) | 2015 | current (source of the terlipressin dose) | none |
| NICE CG141 | 2012 | current | none |

Findings (Baveno VIII, Panel 5, pp. 1001-1002 and Fig. 3):
1. Matches the plan: restrictive transfusion to Hb 7-8 g/dL (5.4); vasoactive drug as soon as possible, for 2-5 days
   (5.7); preventive antibiotics at presentation, third-generation cephalosporin preferred (5.10, 5.11); endoscopy
   within 12 hours after resuscitation, sooner if unstable (5.18); PPI stopped once the bleed is variceal (5.14);
   no tranexamic acid (5.25). Baveno gives no terlipressin dose; the plan's dose stays cited to BSG 2015.
2. **FFP and platelets.** Baveno VIII: FFP "not routinely recommended" (5.23, strong); platelets not routinely, but
   may be considered if bleeding cannot be controlled (5.24, weak). NICE CG141 (2012) still supports them, so leaving
   them unscored is defensible, but the teaching should follow Baveno VIII.
3. **Contradiction inside the case.** The written management says "Correct the coagulopathy with fresh frozen plasma
   and the low platelets with platelet transfusion". Fix it to match point 2.
4. **New in Baveno VIII, not on the tray:** intubation before endoscopy with altered consciousness or active
   haematemesis (5.5, strong), which matters because he becomes drowsy untreated; lactulose to prevent hepatic
   encephalopathy (5.22, strong); erythromycin 250 mg IV 30-90 minutes before endoscopy (5.20, weak, new).
   Consider lactulose and erythromycin as supportive items and airway protection in the teaching.
5. The case lists **no references**. Add Baveno VIII, BSG 2015 and NICE CG141.

### Bleeding duodenal ulcer (54-year-old man with black stools who vomited blood)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| **ESGE peptic ulcer bleeding guideline, Update 2026** (Gralnek et al, Endoscopy 2026;58:899-924, doi 10.1055/a-2863-8314) | May 2026 (plan cites ESGE 2021) | **fix** (wording) | `guidelines/esge-2026-ulcer-bleeding/esge-2026-ulcer-bleeding.pdf` |
| ACG 2021, NICE CG141 | 2021, 2012 | current | none |

Findings (ESGE 2026 summary table, PDF pp. 4-9):
1. Matches the plan: crystalloid first if haemodynamically unstable (strong); no tranexamic acid (strong, high
   quality); high-dose PPI after endoscopic haemostasis, e.g. 80 mg then 8 mg/hour for 72 hours (strong, high);
   pre-endoscopy high-dose IV PPI "be considered" without delaying endoscopy (new, rec 3), so the supportive PPI item
   fits; Glasgow-Blatchford score for risk; endoscopy within 24 hours after resuscitation, and not within 6 or 12
   hours unless the patient stays unstable despite resuscitation (new, rec 4). He is unstable, so the "call for
   endoscopy" item fits; add this wording to the teaching.
2. **Transfusion wording.** ESGE's restrictive threshold (transfuse below 7 g/dL, aim for 7-9; at or below 8 and aim
   for 10 or more with cardiovascular disease) is for **haemodynamically stable** patients (PDF p. 4, unchanged). The
   plan's reason says "transfuse at 7 g/dL or below" for a man whose Hb is 7.2. He needs blood because he is in shock
   and still bleeding, not because of the threshold. Fix the reason to say so, and teach the threshold for after he
   is stable.
3. Update the citation from ESGE 2021 to 2026.

### Hypertensive pulmonary oedema (58-year-old woman who woke up gasping for breath)

| Source | Edition | Status | Local copy |
|---|---|---|---|
| **ESC Guidelines for the management of heart failure** (Køber et al, Eur Heart J 2026, doi 10.1093/eurheartj/ehag100) | Aug 2026 (plan cites 2021 and the 2023 update) | **update** | `guidelines/esc-2026-hf/esc-2026-hf-full.pdf`, `esc-2026-hf-slides.pdf` |

Findings (ESC 2026 slide set, recommendation tables for decompensated HF, slides 67-68):
1. Oxygen if SpO2 below 90% or PaO2 below 60 mmHg (I, C); NIV in respiratory distress, RR above 25 and SpO2 below 90%,
   as soon as possible (IIa, B2); IV loop diuretics for everyone admitted with fluid overload (I, A); IV vasodilators
   when systolic BP is above 110 mmHg (IIb, C); routine opiates not recommended (III, C). **All match the plan.**
2. ESC 2026 calls it "decompensated" heart failure, with acute pulmonary oedema as one of four presentations. Update
   the wording and the citation.
3. Furosemide: ESC 2026 section 7.5.3 and Figure 15 (PDF pp. 48-49): 40 mg IV in diuretic-naive patients, twice the
   usual oral dose for those already on a loop diuretic. The plan's 40 mg matches; cite 2026 instead of 2021's
   "20 to 40 mg".
4. ESC 2026 section 7.3.3 (PDF p. 44): acute pulmonary oedema is mainly fluid redistribution, so these patients
   "usually do not need high doses of diuretics, but they may need vasodilators". Supports the nitrate being
   essential here; add it to the teaching.

### Acute severe asthma (26-year-old woman who cannot catch her breath) · draft

| Source | Edition | Status | Local copy |
|---|---|---|---|
| **GINA Global Strategy for Asthma Management and Prevention** | 2026 | current (primary report now checked) | `guidelines/gina-2026/gina-2026-strategy-report.pdf` |
| BTS/SIGN 158 (acute asthma section) | 2019 | current for UK acute asthma | none |

Findings (GINA 2026):
1. Oxygen only below 92%, titrated to 92-95%, no higher than 96% in adults (PDF pp. 21, 181). Matches the plan's 92-95%.
   The plan's basis says GINA "was checked only through secondary summaries"; it is now checked against the report.
2. Magnesium sulphate: a single 2 g IV infusion over 20 minutes for those not responding with persistent hypoxaemia
   (PDF p. 189). Matches.
3. Aminophylline "should not be used"; sedatives "must be avoided" (PDF p. 190). Both are harmful items. Matches.
4. **SABA doses are "more conservative than in the past"**, with a warning on SABA toxicity (lactic acidosis that
   looks like worsening asthma) (PDF p. 21). The plan's salbutamol 5 mg nebulised, repeated back-to-back, is the BTS/SIGN
   dose. Keep it, cited to BTS, and add GINA's toxicity warning to the teaching.

## Applied (2026-10-29)

- **PE:** the anticoagulant item is the plan's own (`anticoagulation_pe`): enoxaparin 1 mg/kg SC or UFH 80 units/kg
  then 18 units/kg/hour, both accepted; basis cites AHA/ACC 2026 recommendation numbers; furosemide harmful "while he
  is hypotensive"; teaching and references updated.
- **STEMI:** own items `clopidogrel_with_lysis` (300 mg, 75 mg above 75) and `anticoagulant_with_lysis` (enoxaparin
  30 mg IV then 1 mg/kg SC; UFH if unavailable); atropine cited to AHA 2025; tenecteplase half dose "above 75".
- **Tension pneumothorax:** 4th or 5th intercostal space accepted; ATLS 11 and BTS 2023 noted (ATLS 11 site still a
  one-line doctor check).
- **Hyperkalaemia:** UKKA July 2026 grades; new supportive item sodium zirconium cyclosilicate 10 g three times daily.
- **Variceal bleed:** Baveno VIII throughout; FFP and platelets text follows it; new supportive items erythromycin
  250 mg IV and intubation before endoscopy; lactulose and airway in the written management; references added.
- **Ulcer bleed:** transfusion reason fixed (in shock and bleeding; the 7 g/dL threshold is for stable patients);
  ESGE 2026 citations.
- **Pulmonary oedema:** ESC 2026 citations and dose wording (40 mg IV, or twice the oral dose).
- **Asthma (draft):** basis now cites the full GINA 2026 report; SABA toxicity warning in the teaching.
- **All live plans:** basis lines kept within 400 characters and tray details within 140, which the plan checker
  enforces by cutting text silently. Also fixed details that were already cut mid-word (chest drain, calcium, red
  cells) and the dengue escalation detail.

## Built-in trial case (acute anterior STEMI, `data/cases/simulation/acute-anterior-stemi.json`) · live

| Source | Edition | Status | Local copy |
|---|---|---|---|
| ICMR Standard Treatment Workflow: STEMI (in the cardiology compilation) | May 2026 | current | `guidelines/icmr-2026-11/1793170714_cardiologyall.pdf` |
| ESC Guidelines for acute coronary syndromes | 2023 | current | none on this machine |
| ACC/AHA ACS guideline | 2025 | current (already cited) | none |

Checked 2026-11-04. ECG within 10 minutes, primary PCI where available, lysis when PCI cannot be delivered within
120 minutes, aspirin and P2Y12 loading (ticagrelor 180 mg; clopidogrel 300 mg with lysis), weight-adjusted heparin and
tenecteplase, atorvastatin 80 mg, no nitrates or IV beta-blocker in a low-output state: all match ICMR and ESC.
**Fixed:** oxygen was treated as reasonable below 94%; ICMR, ESC 2023 and ACC/AHA 2025 give it only below 90%. The
thresholds and notes now use 90% (commit c7ad67c), and the scenario test checks it.

## Static cases (checked 2026-11-04)

The 21 static cases that had no guideline check. Each case now lists its sources in `discussion.references`; fixes
were saved to the main database on 2026-11-04 (snapshots of the earlier versions kept locally). Listed by diagnosis
only, so this public file does not pair case titles with their answers. PDFs in `guidelines/icmr-2026-11/`.

| Diagnosis | Checked against | Result |
|---|---|---|
| Stevens-Johnson syndrome | ICMR STW cADR Part B (2022); BAD 2016 | **fix:** skin biopsy no longer a core test (ICMR: not usually needed); SCORTEN on ICMR thresholds, repeated day 3; early prednisolone 1-2 mg/kg 3-7 days or cyclosporine 3-5 mg/kg 10-14 days |
| Spinal metastasis from breast cancer | NICE NG234 (2023); ICMR STW Breast Cancer (2020), Low Back Pain (2024) | **fix:** triple assessment, imaging before core biopsy (ICMR); mammogram or breast ultrasound now a core group |
| Bile duct stones with cholangitis | ICMR STW CBD Stone, Gall Stone Disease (2022); Tokyo 2018; BSG 2017 | current (grade I cholangitis, ERCP, early cholecystectomy) |
| Multiple sclerosis | NICE NG220 (2022); McDonald 2017 | current |
| Primary spontaneous pneumothorax | BTS pleural guideline 2023; BTS air travel 2022 | current |
| Delirium from a urinary infection | NICE CG103, NG111, NG51; ICMR STW UTI (2026) | current |
| Pancreatic head cancer | NICE NG85; ESMO 2023; ICMR STW Jaundice (2020) | current |
| Obstructive sleep apnoea | NICE NG202 (2021); INOSA 2014; NICE NG246 (2025) | current |
| Empyema | BTS pleural guideline 2023; MIST2 | current |
| Recurrent TIAs with atrial fibrillation | NICE NG128; ESC AF 2024; ICMR STW Stroke (2019) | current |
| Guillain-Barre syndrome | EAN/PNS 2023; ICMR STW Acute Paralysis (2019) | current; ICMR referral criteria added |
| Postural hypotension and falls | ESC syncope 2018; ICMR STW Hypertension (2026), Bradyarrhythmia (2025) | current; ICMR orthostatic BP from 65 added |
| COPD with cor pulmonale | GOLD 2026; NICE NG115; ICMR STW COPD (2019) | current |
| Type 2 diabetes found through neuropathy | ICMR STW T2DM, Diabetic Foot (2022); NICE NG19, CG173 | current |
| Hypertension with LVH | ICMR STW Hypertension in Adults (May 2026); NICE NG136; ESH 2023; NICE NG238 | **fix:** at 160/100 or more one visit diagnoses (ICMR); start a two-drug single pill (RAAS blocker with CCB or thiazide-like); ABPM optional; both questions rewritten; never two RAAS blockers |
| Infective endocarditis | ESC 2023 endocarditis; POET | current |
| Non-toxic nodular goitre | ATA 2015 nodules; ATA 2014 goitre surgery | **fix:** management and teaching rewritten (TSH first, ultrasound, FNAC by Bethesda, laryngoscopy, surgery for compression; no TSH suppression) |
| Complete heart block | ICMR STW Bradyarrhythmia (Jan 2025); ESC pacing 2021 | **fix:** reversible-cause tests (K, renal, glucose, TSH), dopamine or isoprenaline bridge to temporary pacing, echo before pacemaker, VVI acceptable |
| Vitamin B12 deficiency (pernicious anaemia) | NICE NG239 (2024); BSH 2014 | current |
| Malaria in a returning traveller | NVBDCP guidelines 2014; WHO malaria 2025 | **fix:** bivalent RDT accepted alongside the film (core group) |
| ADPKD | KDIGO ADPKD 2025; Pei 2009 | **fix:** BP targets by KDIGO age and CKD bands; water at least 2-3 L/day while eGFR is 30 or more; tolvaptan at eGFR 25 or more with rapid progression |

Scoring fix in three founding cases (heart block, malaria, ADPKD): red flags that are examination or laboratory
findings (pulse of 36, low platelets, haemolysis, enlarged kidneys) were marked critical history questions, so a
student lost marks for not asking about them. They are now non-critical. The seven cases whose scoring changed were
played through again with the AI patient and the evaluator: 96 to 99, correct diagnosis.

## New cases (written from guidelines, 2026-11-06)

Written by the team from the sources below, every dose and threshold checked in the PDF text, and played through
with the AI patient and the evaluator before publishing (scores 99 to 100, correct diagnosis).

| Diagnosis | Written from | Notes |
|---|---|---|
| Acute primary angle-closure glaucoma | ICMR STW Glaucoma (July 2020); Royal Victorian Eye and Ear Hospital APAC guideline (2021) | ICMR gives the drugs (acetazolamide, IV mannitol, pilocarpine 2%, iridotomy for all angle closure) but no acute doses; acetazolamide 500 mg and its sulfonamide contraindication from RVEEH. No mannitol dose stated (neither source gives one). First ophthalmology case. |
| Russell's viper envenomation with coagulopathy | MoHFW STG Management of Snake Bite (August 2017); WHO SEARO 2016 | 20WBCT, no test dose, 10 vials then low-dose 2 vials 6-hourly, repeat 20WBCT at 6 h, prophylactic adrenaline 0.25 mg SC, no NSAIDs or IM injections. |
| Category III dog bite (rabies PEP) | NCDC National Guidelines for Rabies Prophylaxis 2019 (scanned PDF, read from page images); WHO position paper 2018 | Categories, 15-minute wash, ERIG 40 / HRIG 20 IU/kg infiltrated (not beyond day 7), ID 2-2-2-0-2 or IM Essen 0-3-7-14-28, 10-day observation rule. |
| Iron deficiency anaemia from heavy menstrual bleeding (copper IUCD) | ICMR STW Heavy Menstrual Bleeding (December 2025); Anemia Mukt Bharat Abhiyaan Operational Guidelines (2026) | AMB 2026 cut-offs (non-pregnant: moderate 8.0-10.9) and treatment (1 IFA Red daily for 3 months, retest at 2 months); tranexamic acid, LNG-IUS, transfusion only below 7 g/dL. |
| First simple febrile seizure | AAP 2011 (neurodiagnostic evaluation) and AAP 2008 (long-term management); ICMR STW Epilepsy and Fever in Children | No Indian guideline covers febrile seizures; ICMR used for paracetamol 15 mg/kg and the 5-minute rescue (buccal/intranasal midazolam 0.3-0.5 mg/kg). |

## New cases (written from guidelines, batch 2, 2026-11-06)

Same method; played through before publishing (scores 97 to 100, correct diagnosis).

| Diagnosis | Written from | Notes |
|---|---|---|
| Mild acute bronchiolitis in an infant (home care, no oxygen) | NICE NG9 (2015, updated 2021); AAP 2014; WHO Pocket Book of Hospital Care for Children 2013 (4.5); ICMR STW Severe Pneumonia in Children 2019 (when to suspect bronchiolitis) | Follows the 90% SpO2 line (NICE 2021 = AAP). WHO and IMNCI allow a bronchodilator trial when the cause of a wheeze is unclear, so only regular salbutamol for home is marked as harmful. No Indian source gives detailed management (IAP STG 2022 has no official free copy). |
| Severe acute otitis media in a toddler (immediate antibiotics) | ICMR Antimicrobial Treatment Guidelines 2019 (4.1.6.2, Table 4.1); ICMR STW Otorrhoea 2019; NCDC National Treatment Guidelines v2.0 (Nov 2025, 7.4); AAP 2013; WHO Pocket Book 2013; NICE NG91 | NCDC 2025 classifies fever ≥39 °C, severe otalgia, otalgia >48 hours, bulging drum or complication as severe and lists amoxicillin-clavulanate 90/6.4 mg/kg/day divided BID for 5–7 days. This is the regimen used in the case. ICMR/AAP differ on first line and duration; keep that distinction explicit. |
| Uncomplicated thoracic herpes zoster, over 50, with diabetes | ICMR/DHR STW Varicella and Herpes Zoster (July 2022); EDF/EADV S2k guideline Parts 1 and 2 (2017); CDC shingles overview (2024) and recombinant vaccine guidance (2024) | Acyclovir 800 mg five times a day or valacyclovir 1 g three times a day for 7 days within 72 h; pain ladder as ICMR; vaccine not during the acute episode; contact precautions for a pregnant non-immune contact. Neither source names an NSAID dose, so none is given. |
| Primary osteoarthritis of both knees | ICMR STW Osteoarthritis of Knee Joint (July 2024); NICE NG226 (2022) | Follows ICMR on standing X-rays and NICE on paracetamol (not routine). Topical NSAID first, oral NSAID with a PPI; no hyaluronan or arthroscopic lavage. Kidney function is core because she takes a daily over-the-counter NSAID (NICE 1.4.4 renal risk). No doses in either source, so none is given. |
| Schizophrenia, first episode, no substance use | IPS Clinical Practice Guidelines for schizophrenia 2026 (Indian J Psychiatry 68 Suppl 1); ICMR STW Psychosis (Oct 2019); IPS CPG 2017; ICD-11 6A20 | Baseline CBC, LFT, RFT, fasting glucose, lipids; risperidone 2 mg at night for a week then 3-4 mg (ICMR); IPS 2026 monitoring table; treat 1-2 years after remission. Follows IPS over ICMR on routine trihexyphenidyl (not penalised either way). CT/MRI only with organic features (IPS 2026). |

## New cases (written from guidelines, 2026-11-07)

The three cases below were checked against their current sources, passed the case validator, and completed a full AI-patient conversation and production evaluator run before publication. Synthetic scenario-only test values are marked `origin: "ai"`; unnecessary tests have no fabricated result. All three opened in the bedside encounter, received a correct final diagnosis, and had no safety penalty or missed red flags.

| Diagnosis | Written from | Notes |
|---|---|---|
| Mild acute biliary pancreatitis | ACG Clinical Guideline: Management of Acute Pancreatitis (2024); NCDC/ICMR National Treatment Guidelines v2.0 (Nov 2025, §4.9) | Diagnosis, imaging, fluids, feeding, ERCP, antibiotics, and same-admission cholecystectomy checked against ACG; national antimicrobial guidance confirms no antibiotics without infection. Full evaluator: **99/100**, correct. |
| Mild non-purulent cellulitis of the lower leg | NCDC/ICMR National Treatment Guidelines v2.0 (Nov 2025, §§9.3–9.4); ICMR STW Bacterial Skin Infections (2022) | Cephalexin 250–500 mg QID for 5–7 days per NCDC; assessment excludes abscess and necrotizing infection. No routine culture or imaging. Full evaluator: **99/100**, correct. |
| Major partial-thickness thermal burn | DGHS/MoHFW Standard Treatment Guidelines for Management of Burns (2025); NCDC/ICMR National Treatment Guidelines v2.0 (Nov 2025, §15) | Adult 21% TBSA: resuscitation above 15%, meets admission criterion above 20%; fluids are titrated to physiology and hourly urine output. Added DGHS first-day fluid timing, prompt rehabilitation, aseptic cleaning, non-adherent paraffin gauze and burn-service-directed topical antimicrobial. No prophylactic systemic antibiotics without proven infection. Full evaluator: **100/100**, correct. |

All three cases are published. Combined production playthrough: 99–100/100; zero safety penalties and no missed red flags.

## New cases (written from guidelines, batch 10, 2026-11-07)

Four additional cases fill gaps in infectious disease and ophthalmology. Each passed the case validator and completed the full AI-patient playthrough and exact production evaluator before publication. Test values and examination measurements are explicitly synthetic; optional or unindicated investigations have no fabricated result.

| Diagnosis | Written from | Notes |
|---|---|---|
| Acute uncomplicated varicella in an adolescent over 12 | ICMR/DHR STW Varicella and Herpes Zoster (July 2022); CDC varicella infection-control guidance (isolation endpoint) | ICMR-supported clinical diagnosis and age-based acyclovir with treatment within 24 hours; avoid aspirin, screen for systemic complications, isolate until lesions crust. CDC supplies the crusting endpoint because ICMR does not specify it. No routine tests. Full evaluator: **99/100**, correct. |
| Proliferative diabetic retinopathy with pre-retinal haemorrhage | ICMR STW Diabetic Retinopathy (July 2020), still listed in the current ICMR STW catalogue | Visual acuity, pupils, IOP and dilated retinal examination lead to urgent retina referral; treatment choice is left to the specialist. Synthetic examination findings. Full evaluator: **99/100**, correct. |
| Acute hepatitis E without acute liver failure | MoHFW National Guidelines for Diagnosis and Management of Viral Hepatitis (2018), still listed by NVHCP; 2026 Indian expert consensus used only for vaccine-prevention context | IgM anti-HEV diagnosis, assess INR and encephalopathy, supportive outpatient care for stable non-pregnant patient, and escalation for acute liver failure. The newer ministry copy found is explicitly a draft, so it was not used as final guidance; the acute HEV section gives no fixed retest interval. Safe-water advice follows the described fecal-oral transmission route. Synthetic labs. Full evaluator: **99/100**, correct. |
| Visually significant bilateral age-related cataracts | ICMR STW Cataract (July 2020), still listed in the current ICMR STW catalogue | ICMR surgery offer threshold is BCVA below 6/12 in the better eye, with symptoms and patient needs considered. Case includes refraction, full eye examination, pre-op BP/glucose and biometry. SICS/phaco choice depends on expertise, feasibility, availability and informed preference. Postoperative drop adherence, follow-up, and refraction are included. Synthetic measurements. Full evaluator: **99/100**, correct. |

All four cases are published. Combined batch-10 playthrough: 99/100; zero safety penalties and no missed red flags.

## New cases (written from Indian guidelines, batch 11, 2026-11-07)

Three further gaps were filled after checking current Indian primary guidance. Synthetic test measurements are explicitly labelled; tests without patient results are not given invented values. Each case passed the bedside validator and completed the AI-patient history, examination and investigation sequence plus the production evaluator. All three scored **99/100**, with correct diagnoses, no safety penalty and no missed red flags. Database verified after publication: **87 published + 6 drafts = 93 cases**.

| Diagnosis | Written from | Notes |
|---|---|---|
| Ward-treated community-acquired pneumonia with hypoxaemia | NCDC/ICMR National Treatment Guidelines v2.0 (November 2025, §12.5); ICMR/DHR Standard Treatment Workflows of India (2019, adult CAP severity and referral pathway) | CRB-65 is 1 for age; room-air SpO2 89% independently meets the ICMR referral threshold for a patient over 50 and supports oxygen and inpatient ward care. Ward regimen follows the current 2025 national guidance: ceftriaxone 2 g IV once daily plus azithromycin 500 mg daily (or doxycycline), 5–7 days; stop by day 5 only when stability criteria are met. Full evaluator: **99/100**. |
| Acute chikungunya in an adult | NCVBDC National Guidelines for Clinical Management of Chikungunya Fever (2023; current government recommendation) | Day-5 RT-PCR confirms infection within the guideline's acute testing window; dengue remains a safety differential, so avoid NSAIDs until excluded. Supportive care, adult paracetamol ceiling, acute-phase steroid/antibiotic avoidance, escalation signs and mosquito-bite prevention are covered. Full evaluator: **99/100**. |
| Gestational diabetes detected at 26 weeks | NHM Technical and Operational Guidelines for Gestational Diabetes Mellitus (2018); FOGSI/ICOG GCPR Hyperglycemia in Pregnancy (August 2024) | Synthetic non-fasting 75 g DIPSI two-hour value 164 mg/dL meets the ≥140 mg/dL threshold. Includes MNT/exercise, SMBG targets and review, escalation after lifestyle trial, individualized insulin or informed metformin discussion, fetal growth surveillance from 28 weeks at 3–4 week intervals, later birth planning and postpartum testing. HbA1c is not treated as a useful stand-alone pregnancy measure. Full evaluator: **99/100**. |

The complete production playthrough asked every case's 8–10 reference questions, performed each available examination section, ordered the configured core and relevant optional tests, submitted diagnosis and management, and used `scoreClassicAttempt` (the same evaluator path used by the app). All three results were non-provisional.

## New cases (written from Indian guidelines, batch 12, 2026-11-07)

Three more cases were written from Indian primary guidance, passed the bedside validator, and completed a full AI-patient history, examination, investigation and production-evaluator playthrough. All were published with scenario-only test measurements labelled synthetic (`origin: "ai"` and a case-specific basis); no result is invented for an unperformed investigation. Scores were 99–100, diagnoses correct, and all final runs had zero safety penalties, missed red flags or missed core tests.

| Diagnosis | Written from | Notes |
|---|---|---|
| Severe leptospirosis with acute kidney injury, jaundice and pulmonary involvement | [NCDC National Leptospirosis Guidelines (2015)](https://ncdc.mohfw.gov.in/uploads/pdf/lep4.pdf); [NCDC Manual of Zoonotic Diseases (2025), ch. 20](https://ncdc.mohfw.gov.in/uploads/resource/1769335263_ZDPHI_Manual_2025_V2_06.11.2025.pdf); [NCDC monsoon advisory (June 2026)](https://ncdc.mohfw.gov.in/uploads/pdf/lep55.pdf) | NCDC states that the national leptospirosis guideline revision is in progress. The case keeps the listed 2015 referral criteria and regimen, incorporates the 2025 severity framework, and makes urgent escalation explicit for oliguria, bilirubin above 3 mg/dL and pulmonary involvement. Full evaluator: **99/100**. |
| Japanese encephalitis presenting as acute encephalitis syndrome | [NCDC Manual of Zoonotic Diseases (2025)](https://ncdc.mohfw.gov.in/uploads/resource/1769335263_ZDPHI_Manual_2025_V2_06.11.2025.pdf); [MoHFW AES/JE Standard Treatment Guideline](https://www.clinicalestablishments.mohfw.gov.in/sites/default/files/standard-treatment-guidelines/5041.pdf); [IAP Acute Febrile Encephalopathy in Children (2026)](https://iapindia.org/pdf/action-plan-2026/Neurology/012-Approach-to-Acute-Febrile-Encephalopathy-in-Children.pdf) | Updated after publication to meet the AES time definition and IAP’s basic CSF/blood screening panel (including malaria, dengue, JE and scrub typhus) and empiric ceftriaxone pathway while bacterial infection is unexcluded. CSF JE IgM remains confirmatory; no specific antiviral for JE. Final evaluator: **100/100**. |
| Eclampsia at 36 weeks | [FOGSI-GESTOSIS-ICOG GCPR: Hypertensive Disorders in Pregnancy, 3rd ed. (2026)](https://www.fogsi.org/wp-content/uploads/2026/01/Hypertensive-Disorders-in-Pregnancy-Final-pdf.pdf) | Stabilization precedes delivery; magnesium sulfate is dosed and monitored per the Indian protocol, severe-range BP is treated promptly, and delivery route follows the obstetric situation rather than an automatic caesarean. Full evaluator: **99/100**. |

## New cases (written from Indian guidelines, batch 13, 2026-11-07)

Ten additional gaps were filled. Each case passed the bedside validator and a full, non-provisional production evaluator playthrough using `scoreClassicAttempt`. The playthrough included all reference history questions, every authored examination section, core and relevant optional tests with results interpreted, diagnosis, and a complete management plan. All diagnoses were correct, all core tests were covered, and final runs had zero safety penalties and missed red flags. Test results are synthetic and labeled in the case data. The evaluator verifies the case rubric and encounter workflow; it is not independent clinical certification. After the 2026-11-08 update, re-evaluated scores ranged from **97 to 100**.

| Diagnosis | Written from | Notes |
|---|---|---|
| Severe falciparum malaria with cerebral involvement and hypoglycaemia | [NCVBDC Guidelines for Diagnosis and Treatment of Malaria](https://ncvbdc.mohfw.gov.in/WriteReadData/l892s/20627628441542176662.pdf); [current NCVBDC malaria programme resources](https://ncvbdc.mohfw.gov.in/index1.php?lang=1&level=1&lid=3686&sublinkid=5899) | The severe-malaria treatment document remains the published national regimen, while the programme site lists newer 2025 programme materials. The case treats severe disease as an emergency, gives IV/IM artesunate at the national schedule, checks and corrects hypoglycaemia, and includes a direct shock/perfusion check added after the first evaluator run. Final evaluator: **100/100**. |
| Visceral leishmaniasis with pancytopenia and splenomegaly | [NCVBDC Operational Guidelines for Kala-Azar Elimination (2015)](https://ncvbdc.mohfw.gov.in/WriteReadData/l892s/opertional-guideline-KA-2015.pdf); [NCVBDC current programme resources](https://ncvbdc.mohfw.gov.in/index1.php?Background=Light&font=Increase&level=1&lid=3686&sublinkid=5899&theme=Cream) | Uses the listed Indian liposomal amphotericin B regimen and its infusion monitoring; does not treat different amphotericin formulations as interchangeable. The older treatment guideline remains listed alongside current programme updates. Full evaluator: **100/100**. |
| Exertional heatstroke with acute encephalopathy | [NCDC/NPCCHH Emergency Cooling for Severe Heat-Related Illnesses (March 2024)](https://www.ncdc.mohfw.gov.in/wp-content/uploads/2024/03/Emergency-Cooling-for-Severe-Heat-Related-Illnesses_March2024_NPCCHH.pdf) | Rectal core temperature guides cooling; initiate rapid cooling immediately, aim below 39 °C, and do not delay cooling for transport. Antipyretics and dantrolene are not used as heatstroke treatment. Full evaluator: **99/100**. |
| Hyperemesis gravidarum with dehydration and electrolyte disturbance | [FOGSI-ICOG GCPR: Nausea/Vomiting in Pregnancy and Hyperemesis Gravidarum (2024)](https://www.fogsi.org/wp-content/uploads/2024/08/Binder_Nausea-Vomiting.pdf) | IV saline/Hartmann's and electrolyte monitoring; give thiamine before dextrose and avoid rapid sodium correction. Full evaluator: **99/100**. |
| Early-onset neonatal sepsis in a term newborn | [IAP Approach to Neonatal Sepsis (2026)](https://iapindia.org/pdf/action-plan-2026/Neonatal-Emergencies/006-Approach-to-Neonatal-Sepsis.pdf); [IAP-NNF Neonatal Shock (2026)](https://iapindia.org/pdf/action-plan-2026/QRG-030-Neonatal%20Shock.pdf); [NCDC/ICMR National Treatment Guidelines, v2.0 (Nov 2025)](https://ncdc.mohfw.gov.in/uploads/pdf/amr17.pdf) | Post-publication audit specifies the infant is 60 hours old (inside the EOS ≤72-hour window), uses the IAP NICU term dose for PMA 39 weeks/PNA 0–7 days (ampicillin 50 mg/kg q12h plus gentamicin 4 mg/kg q24h), and requires local antibiogram review. Added neonatal compensated-shock bolus/reassessment and glucose correction, LP after stabilization for CNS signs, blood-culture observation ≥72 hours, and culture-negative clinical-sepsis duration guidance. Final evaluator: **99/100**. |
| Acute pneumococcal bacterial meningitis in a child | [IAP Standard Treatment Guideline 56: Acute Bacterial Meningitis (2022)](https://iapindia.org/pdf/Ch-056-stg-acute-bacterial-meningitis.pdf); [IAP Infections of the Central Nervous System (2026)](https://iapindia.org/pdf/action-plan-2026/Neurology/010-Infections-of-the-Central-Nervous-System.pdf); [NCDC/ICMR National Treatment Guidelines, v2.0 (Nov 2025)](https://ncdc.mohfw.gov.in/uploads/pdf/amr17.pdf) | Rechecked empiric ceftriaxone 100 mg/kg/day plus vancomycin 60 mg/kg/day divided per IAP 2026; Hib-specific dexamethasone is time-sensitive and not used for this culture-confirmed pneumococcal case. LP contraindications and no-delay antibiotic rule remain explicit. Final evaluator: **99/100**. |
| Respiratory diphtheria with extensive pharyngeal disease | [NCDC/ICMR National Treatment Guidelines, v2.0 (Nov 2025), §13.2](https://ncdc.mohfw.gov.in/uploads/pdf/amr17.pdf) | Diphtheria antitoxin is urgent on clinical suspicion and must not wait for laboratory confirmation; dose follows disease extent and duration. Antibiotics, airway readiness, isolation and public-health action are covered. Full evaluator: **99/100**. |
| First-episode bipolar I mania with psychotic features | [Indian Psychiatric Society CPG: Bipolar Disorder, 2025 update (Indian Journal of Psychiatry, 2026)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12900052/) | Includes immediate risk and substance assessment, medical and pregnancy baseline checks, and a mood stabilizer/antipsychotic plan; antidepressant monotherapy is not recommended for acute mania. Updated full evaluator: **97/100**. |
| Poststreptococcal acute nephritic syndrome with hypertension | [IAP Approach to Acute Nephritic Syndrome and RPGN (2026)](https://iapindia.org/pdf/action-plan-2026/Nephrology/007-Approach-to-Acute-Nephritic-Syndrome.pdf); [IAP Standard Treatment Guideline 139 (2022)](https://iapindia.org/pdf/Ch-139-Acute-Glomerulonephritis.pdf) | Updated with C3/C4 assessment, oral furosemide 2–4 mg/kg/day for 1–2 days when fluid overload warrants, amlodipine preferred for stage 2 hypertension, and C3 recovery by 12 weeks. Final evaluator: **99/100**. |
| Acute pain crisis in sickle cell disease | [IAP Standard Treatment Guideline 46: Practicing Pearls for Sickle Cell Disease Management (2022)](https://iapindia.org/pdf/Ch-046-sickle-cell-disease-management.pdf) | Prompt analgesia with opioids when indicated, monitoring, and screening for acute chest syndrome, stroke and infection; uncomplicated pain alone is not an indication for transfusion, and overhydration is avoided. Removed unindicated chest radiograph and blood culture for an afebrile child; kept a prior electrophoresis result clearly as chart review and added overdue LFT monitoring for hydroxyurea follow-up. Final evaluator: **99/100**. |

### Post-publication current-guideline audit (2026-11-08)

The 13 cases from batches 12 and 13 were rechecked against current Indian primary guidance and re-run through the production evaluator with the authored history, examination, core/relevant optional investigations, diagnosis and management. Updates were made to Japanese encephalitis/AES, neonatal sepsis, pediatric meningitis, acute nephritic syndrome and sickle-cell pain. All 13 templates passed the bedside validator; the evaluator runs were non-provisional, diagnoses matched, core tests were covered, and there were no safety penalties or missed red flags. Scores were **97–100/100**. This is evidence that the cases match their authored rubric and cited guidance; it is not a guarantee of error-free clinical care.

Database verified after publication of batches 12 and 13: **100 published + 6 drafts = 106 database cases; 101 visible including built-in STEMI**.

## Needs a download (blocked here by the publisher's bot check)

Nothing outstanding. Received 2026-10-29 from the user and filed: Baveno VIII (from the whole November 2026 Journal of
Hepatology issue; the other 41 items are research papers, not guidelines), AHA 2025 Part 9, ESC 2023 ACS, ESC 2026
HF full text, ESGE 2026.

ATLS 11 is a paid manual: ask a doctor for the needle decompression site in one line instead.

## Still to do

- Done 2026-11-04: the six blocked live plans (snakebite, DKA, septic shock, status epilepticus, hypoglycaemia,
  organophosphate) were settled from published guidelines and switched on; the built-in STEMI case and the 21
  unchecked static cases are above. The team-written cases from 2026-10-31 onwards were checked when written.
- Anaphylaxis live plan: two questions for a doctor (SpO2 end point; airway support on the tray near arrest).
