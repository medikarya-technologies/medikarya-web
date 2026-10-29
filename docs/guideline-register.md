# Guideline register

Every live case's doses, thresholds and timings must come from a current official guideline, cited in the plan's
`basis`. This register says which guideline each case follows, which edition is current, and what does not match yet.
Guideline PDFs that could be downloaded are kept in `guidelines/` (git-ignored: they are copyrighted).

Status: **current** (the plan cites the latest edition and matches it), **update** (a newer edition exists; the plan
still matches or nearly), **fix** (the plan disagrees with the current guideline), **unread** (the source could not be
opened from here; see "Needs a download" at the end).

Last checked: 2026-10-29. **Fixes applied and saved to the main database on 2026-10-29** for all 8 cases below (the
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

## Needs a download (blocked here by the publisher's bot check)

Nothing outstanding. Received 2026-10-29 from the user and filed: Baveno VIII (from the whole November 2026 Journal of
Hepatology issue; the other 41 items are research papers, not guidelines), AHA 2025 Part 9, ESC 2023 ACS, ESC 2026
HF full text, ESGE 2026.

ATLS 11 is a paid manual: ask a doctor for the needle decompression site in one line instead.

## Still to do

- Live plans with their own blockers: snakebite (anti-snake venom dose), DKA, septic shock, status epilepticus,
  hypoglycaemia (glucagon), anaphylaxis, organophosphate poisoning. Indian sources first: ICMR Standard Treatment
  Workflows, the MoHFW national snakebite protocol, NCVBDC malaria guidelines.
- The STEMI live case (acute anterior STEMI, bundled) against ESC 2023 and the Indian STEMI programme.
- Static cases: about 30, against their own references.
