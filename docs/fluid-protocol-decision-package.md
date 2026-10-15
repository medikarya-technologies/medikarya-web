# Fluid management in severe dengue with shock: clinician decision package

MediKarya live-case engine, specification S2 onward. Prepared from live-plan-fluid-engine-spec.md  
Prepared 2026-10-15  
Source: National Guidelines for Clinical Management of Dengue Fever 2023 (NCVBDC, Ministry of Health and Family Welfare, India), 88-page PDF

## 1. What this is

Purpose. The simulation engine needs a fluid protocol it can run: bolus sizes, step-down ladders, what counts as improvement, when to give blood, when to stop. The guideline disagrees with itself in several places, and some things the engine needs are physiology assumptions the guideline does not contain. This package lists every one of those decisions so a clinician can answer them. Until they are answered no fluid logic is written.

What this package is not. It chooses nothing. 'Option A' and 'Option B' are readings of the source, not recommendations. No dose, threshold or timing has been invented. Where a number is printed it is the guideline's own (with the page); where the case sheet supplies a number it is labelled as the case's.

How to answer. Each decision card has a question, why it matters to the simulation, the sources side by side, the engine parameters that depend on the answer, and a sign-off block. Tick an option or write your own, give the reason and the page you relied on, then sign and date. A physiology adviser signs the cards marked P; a responsible clinician signs the cards marked G. Card CQ21 is a teaching decision (T) and may be signed by either together with the case editor.

Three kinds of decision, kept apart. G = how to read the guideline. P = a physiology assumption that no guideline states (the simulation needs one number or curve anyway). T = game-time compression: how the real hour-long and multi-hour treatment is shown in a short encounter.

## 2. How the source was checked

- Source checked: the original PDF, downloaded from the NCVBDC site (ncvbdc.mohfw.gov.in, 'National Guidelines for Clinical Management of Dengue Fever 2023'). Text was extracted page by page and the two flow-chart pages (printed pages 40 and 41) were rendered and read as images, so the figure wording below is what the figure shows, not an extraction guess.
- Page numbers. All page numbers in this package are the page numbers printed on the page. The PDF file's own page index is 22 higher (printed page 40 is PDF page 62). Please check against the printed number.
- Quotation. The guideline is quoted only in very short fragments. Everything else is paraphrased with its numbers kept exactly. Read the cited page for the full wording before you decide.
- Chapter warning. Chapter 5 (printed pages 23 to 29) is dengue in CHILDREN. Chapter 7 (pages 33 to 45) is the management chapter and is where adult fluid care is. Statements from chapter 5 are marked (children).
- Case data used for context only (not from the guideline): male, 29 years, about 65 kg by the case author's estimate (no height recorded); day-2 clinic haematocrit 41%; arrival haematocrit 52%; platelets 18,000 per microlitre; INR 1.3; aPTT 41 s; AST 214 and ALT 146 U/L; minor gum oozing on brushing; BP 100/86, pulse 122, capillary refill 4 s, cold mottled hands, little urine.

## 3. Summary of decisions

| ID | Decision | Type | Engine parameters | Signed |
|---|---|---|---|---|
| C1 | First rapid bolus in hypotensive shock: size, speed and cap | G | PR-BOLUS-H, PR-BOLUS-INT | ☐ |
| C2 | Second and third boluses in hypotensive shock | G | PR-BOLUS-H, PR-BOLUS-INT | ☐ |
| C3 | Compensated shock: first fluid | G | PR-COMP-1, DY-WEIGHT | ☐ |
| C4 | Compensated shock: the second bolus | G | PR-COMP-2, PR-IMPROVE, PR-REFRACT | ☐ |
| C5 | Compensated shock: step-down ladder after improvement | G | PR-LADDER-C, TM-CLOCK | ☐ |
| C6 | Hypotensive shock: step-down after improvement | G | PR-LADDER-H | ☐ |
| C7 | Haematocrit: what is 'high', what is the reference, what is a fall | G | PR-HCT, DY-BLEED | ☐ |
| C8 | Colloid: whether it is offered, when, and what | G | PR-COLLOID | ☐ |
| C9 | Blood: when and how much (adult) | G | PR-BLOOD | ☐ |
| C10 | 'Improvement' and 'persisting shock': what the student must see | G | PR-IMPROVE, DY-BANDS | ☐ |
| C11 | Reducing and stopping fluids; defining overload | G | PR-STOP, DY-OVERLOAD | ☐ |
| C12 | Refractory shock: what the student should do | G | PR-REFRACT | ☐ |
| C13 | Definitions found to differ on verification: narrow pulse pressure and hypotension | G | PR-DEF | ☐ |
| CQ13 | How much infused fluid stays in the circulation | P | DY-RETENTION | ☐ |
| CQ14 | The leak course over clinical time | P | DY-LEAK | ☐ |
| CQ15 | Numeric thresholds for 'improving' | P | DY-BANDS, PR-IMPROVE | ☐ |
| CQ16 | Overload: findings and thresholds | P | DY-OVERLOAD | ☐ |
| CQ17 | Whether and how to include occult bleeding | P | DY-BLEED | ☐ |
| CQ18 | Weight on which doses are calculated | G | DY-WEIGHT, PR-BOLUS-H, PR-COMP-1 | ☐ |
| CQ19 | Platelet transfusion for this patient | G | TX-PLATELET | ☐ |
| CQ20 | Paracetamol dose for this patient | G | TX-PARACETAMOL | ☐ |
| CQ21 | Game-time compression: what an encounter minute stands for | T | TM-CLOCK, PR-BOLUS-INT | ☐ |

Types: G = guideline interpretation; P = physiology assumption; T = game-time compression.

## 4. Decision cards

### C1. First rapid bolus in hypotensive shock: size, speed and cap  (G: guideline interpretation)

**Question.** For an adult with shock and systolic BP under 90, which first-bolus instruction applies: the text's, the Figure 13 box's, or another?

**Why it matters to the simulation.** Sets the first bolus's volume and duration and whether a fixed millilitre cap overrides the per-kg dose. It decides how much circulating volume the first bolus can restore and how many boluses a patient needs, so it also decides what 'three boluses did not work' means.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.40 (Decompensated shock, first bullet) | Crystalloid or colloid (if available) at 20 mL/kg as a bolus given over 15 minutes. |
| Figure 13, p.41 (first box, read on the rendered page) | Rapid bolus 10-20 mL/kg over 15-30 minutes, with '(500 mL maximum)'. Heading: systolic BP under 90 mmHg. |
| Arithmetic only (not from the guideline) | At 65 kg: 10 mL/kg = 650 mL, 20 mL/kg = 1,300 mL. Both are above 500 mL. |

**Options.**

- ☐ A. Follow the text: 20 mL/kg over 15 minutes, no cap.
- ☐ B. Follow Figure 13: 10 to 20 mL/kg over 15 to 30 minutes, capped at 500 mL per bolus.
- ☐ C. Other (state, and say whether the cap applies to adults):

**Engine parameters that depend on it.** PR-BOLUS-H, PR-BOLUS-INT

**Note.** The saved dengue draft currently shows the Figure 13 wording and marks the dose 'under review'.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C2. Second and third boluses in hypotensive shock  (G: guideline interpretation)

**Question.** How many boluses in total, how big, how far apart, and what must be checked before each repeat?

**Why it matters to the simulation.** Decides the repeat-dose rules: how many are allowed, whether a refused extra bolus is 'not indicated' or 'too soon', and what a reassessment must contain before a repeat. These become the allowed and scored actions.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.40 (third bullet) | If shock persists, review the haematocrit. If it has risen or is still high (above 45%), give a second crystalloid bolus of 10-20 mL/kg over 15-30 minutes. Up to three rapid boluses may be given. |
| Figure 13, p.41 | Second rapid bolus 10-20 mL/kg over 15-30 minutes with '(500 mL maximum)'; check the haematocrit and, if there is no improvement, give a third rapid bolus. |
| Not stated anywhere (checked) | The minimum time between boluses. Only each bolus's own duration (15 to 30 minutes) is given. |

**Options.**

- ☐ A. Up to three boluses in total including the first; each 10-20 mL/kg; cap per bolus as decided in C1.
- ☐ B. First plus up to three more.
- ☐ C. Other (state the count, the interval, and the check required before each repeat):

**Engine parameters that depend on it.** PR-BOLUS-H, PR-BOLUS-INT

**Note.** 'Up to three' is ambiguous: three in total, or three after the first? Please state which.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C3. Compensated shock: first fluid  (G: guideline interpretation)

**Question.** Within 10 to 20 mL/kg over one hour, which volume does the simulation use for this patient?

**Why it matters to the simulation.** Sets the first treatment for the compensated phase and the hourly rate that is then reduced. The case author used 10 mL/kg (650 mL at 65 kg).

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 | Start isotonic crystalloid at 10-20 mL/kg per hour over one hour, then reassess vital signs, capillary refill, haematocrit and urine output. |
| Figure 12, p.40 | Start isotonic crystalloid, 10-20 mL/kg for 1 hour. |

**Options.**

- ☐ A. 10 mL/kg over 1 hour.
- ☐ B. 20 mL/kg over 1 hour.
- ☐ C. Other (state, with a reason tied to this patient):

**Engine parameters that depend on it.** PR-COMP-1, DY-WEIGHT

**Note.** The text and the figure agree; the choice within the range is a clinical judgement, not a conflict.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C4. Compensated shock: the second bolus  (G: guideline interpretation)

**Question.** If shock persists with haematocrit still high, is the second bolus 10 mL/kg or 10-20 mL/kg, and what happens if there is no improvement after it?

**Why it matters to the simulation.** Defines the compensated-shock repeat dose and the escalation point that leads into hypotensive-shock care.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 (fourth bullet) | Check the haematocrit after the first bolus. If it has risen or is still above 45%, give a second crystalloid bolus at 10 mL/kg per hour for one hour. After it, if improving, reduce to 7-10 mL/kg/h for 1-2 hours and continue to reduce. |
| Figure 12, p.40 | Second bolus 10-20 mL/kg over 1 hour. If improving: reduce to 7-10 mL/kg/h for 1-2 hours. If not: refractory hypotension, consider inotropes, and 'manage as severe dengue with de-compensated shock (Group C)'. |

**Options.**

- ☐ A. 10 mL/kg over 1 hour.
- ☐ B. 10-20 mL/kg over 1 hour (choose the value).
- ☐ C. Other:

**Engine parameters that depend on it.** PR-COMP-2, PR-IMPROVE, PR-REFRACT

**Note.** Figure 12 sends a non-responder to 'decompensated shock (Group C)' although the patient is already in the severe group. Please say what the simulation should do at this branch.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C5. Compensated shock: step-down ladder after improvement  (G: guideline interpretation)

**Question.** Which sequence of rates and durations should the simulation use, and which end of each duration range?

**Why it matters to the simulation.** This is the ladder a student must follow to avoid overload; the engine will compare their rate changes with it. A different first step or duration changes what is scored as correct reduction.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 (third bullet) | Reduce to 7-10 mL/kg/h for 1-2 h, then 5-7 mL/kg/h for 1-2 h, then 3-5 mL/kg/h for 2-4 h, then 2-3 mL/kg/h for 2-3 h, then according to haemodynamic status, up to 24-48 h. |
| Figure 12, p.40 | Reduce gradually: 5-7 mL/kg/h for 1-2 h, 3-5 mL/kg/h for 2-4 h, 2-3 mL/kg/h for 2-4 h; stop IV fluids at 24-48 hours. The 7-10 mL/kg/h step appears only after a second bolus. |
| Context, a different group (moderate dengue with warning signs), p.36 | Text: 5-7, 3-5 and 2-4 mL/kg/h, each for 2-4 hours. Its own Figure 11 (p.36): 5-7 for 1-2 h, 3-5 for 2-4 h, 2-3 for 2-4 h. So even that group's text and figure differ. |

**Options.**

- ☐ A. Follow the text ladder (starts at 7-10).
- ☐ B. Follow Figure 12 (starts at 5-7; 7-10 only after a second bolus).
- ☐ C. Other (give the ladder and which end of each duration range):

**Engine parameters that depend on it.** PR-LADDER-C, TM-CLOCK

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C6. Hypotensive shock: step-down after improvement  (G: guideline interpretation)

**Question.** After a successful first bolus, is there a 10 mL/kg/h hour before the ladder? After a second or third bolus, is the first step 10 or 7-10 mL/kg/h?

**Why it matters to the simulation.** Same role as C5 for the hypotensive pathway, with two differing first steps.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.40 (second bullet) | If improving after the first bolus: crystalloid or colloid infusion at 10 mL/kg/h for one hour, then reduce to 5-7 mL/kg/h for 1-2 h, 3-5 for 2-4 h, then 2-3 or less, up to 24-48 h. |
| Text, p.40 (third bullet) | After the second bolus, if improving: 7-10 mL/kg/h for 1-2 hours, then gradual reduction as above. |
| Figure 13, p.41 | Improving after the first bolus: reduce gradually 5-7 for 1-2 h, 3-5 for 2-4 h, 2-3 for 2-4 h; stop at 24-48 h (no separate 10 mL/kg/h hour shown). Improving after the 2nd or 3rd bolus: 'reduce IV crystalloids 10 mL/kg/h for 1-2 hours'. |

**Options.**

- ☐ A. Follow the text (10 mL/kg/h for one hour after the first bolus; 7-10 after the second).
- ☐ B. Follow Figure 13 (straight to the ladder after the first; 10 mL/kg/h for 1-2 h after the second or third).
- ☐ C. Other:

**Engine parameters that depend on it.** PR-LADDER-H

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C7. Haematocrit: what is 'high', what is the reference, what is a fall  (G: guideline interpretation)

**Question.** Which cut-off decides 'leakage continues' versus 'suspect bleeding', and is the reference this patient's own earlier value or the guideline's population value?

**Why it matters to the simulation.** This is the branch that sends a student to more crystalloid or to blood. A wrong reference sends a leaking patient to transfusion or a bleeding patient to more fluid. It also decides what the simulation shows as a falling haematocrit.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 and p.40 | Haematocrit risen or still above 45%: repeat the crystalloid bolus. Haematocrit has decreased compared with the initial reference haematocrit, with the reference given as below 40% in children and adult females and below 45% in adult males: suspect bleeding, cross-match and transfuse. |
| Figures 12 and 13, pp.40 and 41 | Hct above 45%: suspect persistent capillary leakage. Hct below 45%: suspect severe overt bleed, check Hb. |
| Case sheet (not the guideline) | His own day-2 value was 41%; on arrival it is 52%. |

**Options.**

- ☐ A. Use the population cut-off: above 45% means leakage, below 45% means bleeding.
- ☐ B. Use his own baseline (41%) as the reference for 'fallen'.
- ☐ C. Other (define 'a fall': from what value, by how much, over how long):

**Engine parameters that depend on it.** PR-HCT, DY-BLEED

**Note.** A fall from 52% to 44% is 'below 45%' but still above his own 41%. Please say which reading governs.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C8. Colloid: whether it is offered, when, and what  (G: guideline interpretation)

**Question.** Is colloid on the tray for this case? If so, when is it indicated and what dose?

**Why it matters to the simulation.** Decides whether a colloid action exists, whether giving it is credit, neutral or harmful, and what the engine models for oncotic effect.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 (critical-period fluid rules) | Hyper-oncotic colloids (such as dextran 40 or starch) may be used in patients with massive plasma leakage and those not responding to the maximum volume of crystalloid. Iso-oncotic colloids (plasma, haemaccel) may be less effective. |
| Text, p.40 (first bullet) | The first hypotensive bolus may be crystalloid or colloid, if available. |
| Figure 13, p.41 | The first box names isotonic crystalloid only. |
| Text, p.44 (fluid overload) | In early overload switch bolus fluid from crystalloid to colloid. Dextran 40: 10 mL/kg bolus, limit 30 mL/kg/day. If in shock with overload: colloid (dextran) 10 mL/kg/h, then furosemide 1 mg/kg/dose once BP is stable. |
| The earlier plan wording (not in this guideline) | 'Colloid after 2 to 3 saline boluses if the haematocrit is rising'. The guideline's rule for a rising haematocrit is another crystalloid bolus. |

**Options.**

- ☐ A. No colloid action in this case.
- ☐ B. Colloid available only for massive leakage or non-response to crystalloid (define when).
- ☐ C. Colloid for fluid overload only.
- ☐ D. Other:

**Engine parameters that depend on it.** PR-COLLOID

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C9. Blood: when and how much (adult)  (G: guideline interpretation)

**Question.** What triggers blood in the simulation, which product, and what dose per kg?

**Why it matters to the simulation.** Defines the bleeding branch's correct action and the harm of giving blood when the haematocrit is high. Also what the debrief tells a student who does not transfuse.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 | Blood transfusion is given for established severe bleeding, or suspected severe bleeding (a fall in haematocrit) with unexplained hypotension. |
| Text and figures, pp.39 to 41 | Whole blood 10 mL/kg or packed red cells 5 mL/kg when the haematocrit has fallen. |
| Text, p.42 (7.4 severe haemorrhage) | If blood loss cannot be quantified: aliquots of 10 mL/kg fresh whole blood or 5 mL/kg freshly packed red cells. |
| Children's chapter, p.28 (5.7) | Blood 20 mL/kg when shock persists despite a declining haematocrit. This is the children's chapter and is not used for an adult unless you say so. |

**Options.**

- ☐ A. Whole blood 10 mL/kg or packed cells 5 mL/kg (adult text and figures).
- ☐ B. Other (state product and dose):

**Engine parameters that depend on it.** PR-BLOOD

**Note.** Please also say whether a fall in haematocrit alone is enough, or whether instability is also required.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C10. 'Improvement' and 'persisting shock': what the student must see  (G: guideline interpretation)

**Question.** Which findings, with what thresholds, define improvement after a bolus, persisting shock, and recovering?

**Why it matters to the simulation.** This replaces the fixed blood-pressure end point and the fixed recovery. Every decision (step down, repeat a bolus, investigate bleeding, escalate) rests on it. It is the largest single input to the engine's decision table.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.36 (moderate dengue, Group B) | Improvement means BP improved, pulse pressure improved, haematocrit decreased, urine output improved, capillary refill improved. Adequate fluid should maintain perfusion and urine output of about 0.5 mL/kg/hour. |
| Text and figures, pp.39 to 41 | Reassess vital signs, capillary refill time, haematocrit and urine output; the figures list BP, pulse pressure, Hct, urine output, capillary refill time and pulse rate. |
| Table 2, p.16 | Compensated shock: narrowed pulse pressure (below 20 mmHg), capillary refill over 2 seconds, cold extremities, weak thready pulses, tachycardia, reduced urine. Decompensated: change of mental state, mottled skin, cold clammy extremities, feeble or absent pulses. |
| Not given anywhere | Numeric thresholds for 'improved' (how much wider, how fast, how many of the six findings). |

**Options.**

- ☐ A. Improved when ALL listed findings have moved in the right direction (state thresholds).
- ☐ B. Improved when the major findings have (state which, and the thresholds).
- ☐ C. Other:

**Engine parameters that depend on it.** PR-IMPROVE, DY-BANDS

**Note.** Guideline interpretation (which findings) is G; the numbers are decided together with the physiology adviser in CQ15.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C11. Reducing and stopping fluids; defining overload  (G: guideline interpretation)

**Question.** Which criteria mean fluids must be reduced or stopped, and which findings define overload for the simulation?

**Why it matters to the simulation.** Defines the harm of continued fluids and the correct stopping point. The engine needs a clear list because overload will be modelled as a consequence, not a flag.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 | IV fluid should not exceed 24-48 hours in those with shock; without shock, not more than 60-72 hours. Always check for signs of fluid overload. |
| Box 7, p.42 | Reduce or stop IV fluids when: normal BP, pulse and peripheral perfusion; haematocrit decrease; apyrexia over 24-48 hours without antipyretics; resolving abdominal symptoms; improving urine output. Continuing beyond 48 hours of the critical phase risks pulmonary oedema and other complications. |
| Text, pp.43 to 44 (7.6.1) | Early overload: puffy eyelids, distended abdomen, mild dyspnoea. Late: moderate to severe respiratory distress, restlessness, confusion. Management includes stopping hypotonic fluids, colloid in early overload, furosemide when vital signs are stable, and reducing IV fluid to as low as 1 mL/kg/h until stopped once the haematocrit is at or below baseline. |
| Text, p.42 (7.5) | In convalescence the haematocrit falls to baseline or below with diuresis; IV fluid is discontinued; diuretics may be needed where there are effusions or ascites. |

**Options.**

- ☐ A. Use Box 7's five criteria; stop when all hold.
- ☐ B. Use Box 7 with a different count (state how many must hold).
- ☐ C. Other:

**Engine parameters that depend on it.** PR-STOP, DY-OVERLOAD

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C12. Refractory shock: what the student should do  (G: guideline interpretation)

**Question.** When fluid does not restore the circulation, which actions are expected and scored, and are any drugs named?

**Why it matters to the simulation.** Defines the end of the fluid pathway: after the allowed boluses fail the simulation currently has no next step. The engine needs the expected actions.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.39 | Restoring the blood pressure is critical for survival; inotropes may be used to support it. |
| Text, pp.40 to 41 (refractory bullets) | Consider inotropes; determine cardiogenic or septic shock; evaluate metabolic cause and organ dysfunction, concomitant conditions, persistent acidosis and the risk of hidden haemorrhage; give additional boluses of crystalloid or colloid over the next 24 hours as the response guides; manage in ICU. |
| Figures 12 and 13, pp.40 and 41 | Refractory hypotension: consider inotropes; manage as decompensated shock. No drug or dose is named in the adult text. |
| Children's chapter, p.28 | Dopamine, epinephrine and dobutamine through a central line, in ICU. Children only. |

**Options.**

- ☐ A. Escalation to ICU and evaluation for other causes is credited; no drug is offered.
- ☐ B. A named inotrope is offered (state which, dose and route, with your source):
- ☐ C. Other:

**Engine parameters that depend on it.** PR-REFRACT

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### C13. Definitions found to differ on verification: narrow pulse pressure and hypotension  (G: guideline interpretation)

**Question.** What are the cut-offs for 'narrow pulse pressure' and 'hypotension', and is the boundary value inside or outside?

**Why it matters to the simulation.** The engine's condition on pulse pressure is already built (S1). It needs the cut-off and whether 20 itself counts. The case plan currently reads 'pulse pressure 20 or less' and 'systolic under 90'.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Table 2, p.16 and p.17 | Narrowing pulse pressure in compensated shock is written 'below 20 mmHg'. |
| Figure 12, p.40 (top box, read on the rendered page) | Reads 'pulse pressure 20 mmHg' with a greater-than-or-equal sign, and 'hypotension (SBP above 90)'. These may be printing errors in the figure. |
| Figure 13, p.41 | Decompensated shock heading: systolic BP below 90 mmHg. |

**Options.**

- ☐ A. Narrow means pulse pressure below 20; hypotension means systolic below 90.
- ☐ B. Narrow means 20 or less (the WHO convention); hypotension means systolic below 90.
- ☐ C. Other:

**Engine parameters that depend on it.** PR-DEF

**Note.** Added during verification; not in the earlier list. It touches code already merged (S1), so the answer may change a boundary in one existing condition.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ13. How much infused fluid stays in the circulation  (P: physiology assumption)

**Question.** During plasma leak, what fraction of an infused crystalloid (and of colloid) remains intravascular, how does that change over time, and how does a rapid bolus differ from a slow infusion?

**Why it matters to the simulation.** Retention decides how far a bolus restores circulating volume and how fast the extravascular load grows. It therefore decides how many boluses a patient needs and when overload begins. The guideline gives no retention figure.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Guideline | No retention figure is given in NCVBDC 2023 (checked). |

**Options.**

- ☐ Please give: fractions with their units and time course, the evidence or the reasoning behind them, and the range of uncertainty.

**Engine parameters that depend on it.** DY-RETENTION

**Note.** No value is proposed here.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ14. The leak course over clinical time  (P: physiology assumption)

**Question.** For a patient who reaches the clinic on day 5 with shock: how quickly does leakage start to matter, when does it peak, when does it end, and when does leaked fluid return to the circulation?

**Why it matters to the simulation.** This is the engine's untreated course and the timing of reabsorption (after which continued fluid causes overload).

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.15 | The critical phase begins after the 3rd or 4th day of fever and lasts about 24 to 48 hours. |
| Text, p.16 | In recovery, extracellular fluid lost by leakage returns to the circulation over 2 to 3 days; excess fluid can then cause pulmonary oedema. |

**Options.**

- ☐ Please give: leak intensity by clinical hour (shape and relative size), the hour it ends, and the reabsorption time course. Say how a compensated presentation differs from a hypotensive one.

**Engine parameters that depend on it.** DY-LEAK

**Note.** No value is proposed here.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ15. Numeric thresholds for 'improving'  (P: physiology assumption)

**Question.** For each finding chosen in C10, what number counts as improved and persisting, and for how long must it hold before the patient counts as recovering?

**Why it matters to the simulation.** The guideline lists the findings but gives few numbers. The engine cannot score 'step down' or 'repeat' without them.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Guideline | Printed numbers only for: narrow pulse pressure below 20 mmHg and capillary refill over 2 seconds (Table 2, p.16); urine output about 0.5 mL/kg/hour (p.36); haematocrit 45% reference (pp.39 to 41). |

**Options.**

- ☐ Please give: threshold per finding, how many must hold, and the persistence time in clinical minutes. Mark each as guideline-based or as your judgement.

**Engine parameters that depend on it.** DY-BANDS, PR-IMPROVE

**Note.** No value is proposed here.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ16. Overload: findings and thresholds  (P: physiology assumption)

**Question.** At what degree of extravascular fluid load does overload show, with which findings, and how fast does continued fluid worsen it?

**Why it matters to the simulation.** Overload is to be modelled as a consequence of running fluids too long or too fast, with effects on saturation, respiratory rate and lung findings, and with a nurse alert. The engine needs bands, not a single flag.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, pp.43 to 44 | Early and late clinical signs are listed (see C11). No quantity of fluid or time is given that produces them. |

**Options.**

- ☐ Please give: bands (none, early, late), the finding and monitor change at each, and any accelerating factor (for example during reabsorption).

**Engine parameters that depend on it.** DY-OVERLOAD

**Note.** No value is proposed here.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ17. Whether and how to include occult bleeding  (P: physiology assumption)

**Question.** Should some attempts present with bleeding on top of leakage? If so, what are the rate and course, how do haematocrit and perfusion behave, how long does the student have, and how often does it occur?

**Why it matters to the simulation.** Needed to teach the falling-haematocrit branch (C7, C9). It requires a case variant chosen by a recorded seed, which is new engine work, so the decision must be clear first.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, pp.39 to 42 | Suspected severe bleeding is a fall in haematocrit with unexplained hypotension; blood doses in C9. No bleeding rates are given. |

**Options.**

- ☐ A. No bleeding variant (teach only the leak pathway).
- ☐ B. Include a bleeding variant (give the details above).
- ☐ C. Make it a separate case.

**Engine parameters that depend on it.** DY-BLEED

**Note.** No value is proposed here.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ18. Weight on which doses are calculated  (G: guideline interpretation)

**Question.** Which weight should fluid doses use for this patient?

**Why it matters to the simulation.** Every mL/kg dose, every step-down rate and the 500 mL cap interact with weight. The case records about 65 kg as the author's own estimate and no height.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.36 | For obese and overweight patients, use ideal body weight for fluid calculations. |
| Table 5, p.37 | Estimated ideal body weight for overweight or obese adults by height (males: 50 kg at 150 cm, 57 at 160, 66 at 170, 75 at 180). Needs a height. |
| Case sheet (not the guideline) | About 65 kg by his own estimate. No height. Not described as overweight. |

**Options.**

- ☐ A. Use 65 kg as written.
- ☐ B. Add a height to the case and state whether ideal body weight applies.
- ☐ C. Other:

**Engine parameters that depend on it.** DY-WEIGHT, PR-BOLUS-H, PR-COMP-1

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ19. Platelet transfusion for this patient  (G: guideline interpretation)

**Question.** Is platelet transfusion harmful (a 15-point deduction), neutral, or acceptable here? Does minor gum oozing count as 'bleeding present'?

**Why it matters to the simulation.** This is a scored action already in the saved plan. The guideline's adult statements and the patient's coagulation results point in different directions, so the scoring needs a decision.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Box 8, p.42 (adult chapter) | Transfuse platelets only if bleeding is present. Prophylactic platelet transfusion may be considered for counts below 10,000 per cumm without bleeding, and for those who may need emergency surgery. |
| Note under Figure 13, p.41 (adult chapter) | Platelet transfusion is not recommended for thrombocytopenia (no prophylaxis). It may be considered in adults with underlying hypertension and thrombocytopenia below 10,000. |
| Text, p.26 (children's chapter 5.5) | In a trial of adults with platelets of 20,000 or less without persistent mild or severe bleeding, prophylactic platelets were not superior to supportive care and had adverse events. |
| Text, p.27 (children's chapter 5.5(b)) | In severe bleeding or haemodynamic instability, platelets and FFP may be given when the count is below 50,000 with deranged PT, APTT, low fibrinogen and raised D-dimer. This is the children's chapter. |
| Case sheet (not the guideline) | Platelets 18,000; minor gum oozing on brushing; INR 1.3; aPTT 41 seconds; in shock. |

**Options.**

- ☐ A. Harmful (keep the deduction): count above 10,000 and the bleeding is minor.
- ☐ B. Neutral (no deduction, no credit).
- ☐ C. Acceptable in this patient (state why).
- ☐ D. Other:

**Engine parameters that depend on it.** TX-PLATELET

**Note.** Correction to earlier work: the saved plan's review note cites 'NCVBDC 5.5' for the 50,000 statement. That section is the children's chapter. The adult statements are Box 8 and the note on p.41. The plan's note needs correcting at its next edit; nothing was changed for this package.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ20. Paracetamol dose for this patient  (G: guideline interpretation)

**Question.** Which paracetamol dose and daily ceiling should the tray show for a shocked patient with raised liver enzymes?

**Why it matters to the simulation.** The tray shows a dose; it must be a dose a clinician accepts for this patient. The earlier plan said 500 mg to 1 g; the guideline gives a per-kg dose.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.34 (instructions for mild dengue, Group A) | Paracetamol 10 mg/kg per dose, not more often than every six hours; maximum for adults 4 g per day; avoid aspirin and NSAIDs. |
| Case sheet (not the guideline) | AST 214 and ALT 146 U/L; about 65 kg (10 mg/kg = 650 mg by arithmetic). |

**Options.**

- ☐ A. 10 mg/kg per dose, at most 6-hourly, ceiling 4 g per day.
- ☐ B. A lower ceiling because of the liver enzymes (state it).
- ☐ C. Other:

**Engine parameters that depend on it.** TX-PARACETAMOL

**Note.** The guideline sentence sits in the outpatient instructions for mild dengue. Please say whether it governs a shocked inpatient.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

### CQ21. Game-time compression: what an encounter minute stands for  (T: game-time compression)

**Question.** How is an hour-long infusion and a multi-hour step-down shown in a short encounter, and what may never be skipped?

**Why it matters to the simulation.** Decides the length of a ward-mode step, which events interrupt a wait, how often a reassessment is required, and which durations are kept real (for example a bolus's 15 to 30 minutes) versus compressed. No fixed game-time number is chosen until this is answered.

**Sources, side by side.**

| Where | What it says (paraphrased; numbers as printed) |
|---|---|
| Text, p.36 (moderate dengue, Group B) | Improvement is evaluated hourly. Urine output is checked 6-hourly and haematocrit 8-hourly. (For another group; context only.) |
| Text, p.40 and p.41 | A bolus lasts 15 to 30 minutes; ladder steps last 1 to 4 hours; fluids run 24 to 48 hours. |

**Options.**

- ☐ Please give: how many clinical minutes one ward step may cover, the longest allowed single wait, events that must always interrupt (alerts, bolus completion, reassessment due), the required reassessment interval, and whether bolus durations are kept real.

**Engine parameters that depend on it.** TM-CLOCK, PR-BOLUS-INT

**Note.** The 2-minute bolus gap, the 8-minute deadline and the fixed per-bolus BP change in the saved dengue draft are estimates chosen by the engineer. They are to be replaced by this decision; they are not clinical values.

**Sign-off.**

| Field | Entry |
|---|---|
| Approved choice | |
| Rationale | |
| Source page relied on | |
| Reviewer name and role | |
| Date | |
| Signature | |

## 5. Engine parameter dictionary

These are data fields in a future approved protocol record, not constants. No values are given.

| ID | What it is | Unit | Depends on | Used by |
|---|---|---|---|---|
| PR-BOLUS-H | Hypotensive-shock rapid bolus: volume per kg, optional cap in mL, duration, maximum count | mL/kg; mL; min; count | C1, C2, CQ18, CQ21 | S2 (infusion/bolus entity), S4 (decision table) |
| PR-BOLUS-INT | Minimum interval between hypotensive boluses and whether a reassessment or haematocrit check is required before each | clinical min; yes/no | C2, C10, CQ21 | S2, S4 |
| PR-COMP-1 | Compensated-shock first fluid: volume per kg and duration | mL/kg; min | C3, CQ18, CQ21 | S2 |
| PR-COMP-2 | Compensated-shock second bolus: volume per kg and duration | mL/kg; min | C4, CQ21 | S2 |
| PR-LADDER-C | Step-down ladder after improvement in compensated shock: levels, order, duration of each | mL/kg/h; clinical h | C5, CQ21 | S2 (ladder), S4 |
| PR-LADDER-H | Step-down ladder after improvement in hypotensive shock, including the level after a first versus a second bolus | mL/kg/h; clinical h | C6, CQ21 | S2, S4 |
| PR-HCT | Haematocrit high threshold, reference value for 'fallen', and the rule for what counts as a fall | %; rule | C7, CQ17 | S3 (observable), S4 (decision table) |
| PR-COLLOID | Whether colloid is on the tray, when it is indicated, the preparation and dose | mL/kg; limits | C8 | S2, S4 |
| PR-BLOOD | Blood: trigger, product, dose per kg | mL/kg | C9, C7, CQ17 | S4 |
| PR-IMPROVE | Operational definition of 'improvement', 'persisting shock' and 'recovering': which findings, thresholds, how many must hold, for how long | per finding; min | C10, CQ15 | S3, S4 (replaces fixed recovery) |
| PR-STOP | When fluids must be reduced or stopped; the overload findings; when a diuretic is acceptable | criteria set | C11, CQ16 | S3 (overload), S4 (scoring) |
| PR-REFRACT | What the student is expected to do when shock is refractory, and what is scored | actions | C12 | S4 |
| PR-DEF | Cut-offs for narrow pulse pressure and hypotension, and whether the boundary value counts | mmHg; < versus <= | C13 | S1 (already built, boundary inclusive or not), S3, S4 |
| DY-RETENTION | Fraction of an infused fluid that stays in the circulation, by fluid and by phase | fraction | CQ13 | S3 (volume and overload variables) |
| DY-LEAK | Leak course over clinical time: onset, peak, end; reabsorption | mL/kg/h by clinical hour | CQ14 | S3 |
| DY-BANDS | Observable thresholds: pulse pressure, capillary refill, urine, haematocrit and the numeric meaning of 'improved' | per finding | CQ15, C10 | S3, S4 |
| DY-OVERLOAD | Extravascular-load bands and their effect on saturation, respiratory rate and lung findings | bands | CQ16, C11 | S3 |
| DY-BLEED | Occult bleeding variant: whether it exists, its rate and course, how often it occurs | mL/kg/h; probability | CQ17, C7, C9 | S3 (variants) |
| DY-WEIGHT | Weight on which doses are calculated (and height if ideal body weight is used) | kg; cm | CQ18 | S2 onward |
| TX-PLATELET | Scoring of platelet transfusion for this patient: harmful, neutral or acceptable | category | CQ19 | plan scoring (already in the saved plan) |
| TX-PARACETAMOL | Paracetamol dose and ceiling for this patient | mg/kg; mg/day | CQ20 | tray detail (saved plan) |
| TM-CLOCK | Game-time compression: what a bedside minute, a ward step and an hour of infusion stand for; what may never be skipped | clinical min per step | CQ21 | S4 (clinical-time handling) |

## 6. Corrections and new findings from verification

- The saved dengue plan's review note about platelets cites 'NCVBDC 5.5' for platelets and FFP below 50,000 with deranged PT and APTT. Chapter 5 is the children's chapter. The adult statements are Box 8 (p.42) and the note on p.41. The plan text should be corrected at its next edit. (Nothing was changed for this package.) See CQ19.
- The earlier specification said the old plan's 'colloid for a rising haematocrit' is not in NCVBDC. More exactly: NCVBDC mentions colloid in three places (p.39 hyper-oncotic colloid for massive leakage or non-response; p.40 first bolus 'crystalloid or colloid if available'; p.44 overload), but its rule for a rising haematocrit is another crystalloid bolus. See C8.
- New conflict found: Figure 12 (p.40) prints 'pulse pressure 20 mmHg' with a greater-than-or-equal sign and 'hypotension (SBP above 90)', while Table 2 (p.16) says narrowing below 20 mmHg and Figure 13 says systolic below 90. See C13. This touches the pulse-pressure condition merged in S1.
- New point: the guideline asks for ideal body weight in obese and overweight patients (p.36, Table 5 p.37). The case has weight only, no height. See CQ18.
- The paracetamol sentence sits in the outpatient instructions for mild dengue (p.34), not in the shock management section. See CQ20.
- The earlier specification's C5 and C6 were right; verification added the Group B text-versus-figure difference (p.36) and the second-bolus first step (7-10 versus 10 mL/kg/h) in C6.
- Case sheet figures (haematocrit 41% and 52%, platelets 18,000, INR, aPTT, AST/ALT, weight) were not verified against any source: they are the case author's data.

## 7. What has not been decided or changed

- No dose, rate, threshold, duration, cap, retention fraction, leak curve or interval has been chosen by this package.
- No fluid-management logic has been written. The engine work (S2 onward) waits for the signed decisions.
- No plan, release blocker, case status or database record was changed in preparing this package.

## 8. Reviewer declaration

I have read the cards I have signed, checked the sources I cite against the original document, and my answers are my own clinical judgement.

| | Responsible clinician | Physiology adviser |
|---|---|---|
| Name | | |
| Designation and institution | | |
| Registration number (optional) | | |
| Cards signed | | |
| Date | | |
| Signature | | |
