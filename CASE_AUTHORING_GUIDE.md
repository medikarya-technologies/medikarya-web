# MediKarya case authoring guide

**Use this guide when creating or revising a case with any AI.** It describes how to make a case clinically coherent, fair to students, and compatible with the current MediKarya case pipeline. It is a working standard, not a promise that an AI draft is clinically approved. A qualified clinician must review the case before publication.

The application and scoring code are the final authority when implementation details change. This guide was checked against the code and all published case structures on 2026-11-09. For the internal engine overview, see [EVALUATION_ENGINE.md](EVALUATION_ENGINE.md); older material there is marked historical where it differs from the current code.

## 1. How cases move through MediKarya

1. A case sheet is converted into a draft through `lib/studio/convert.ts`.
2. The draft is structurally checked by `lib/studio/validate.ts`. Passing this check means its shape and configured IDs are valid; it does **not** mean its clinical content is correct.
3. An educator or clinician reviews and edits the draft in Studio.
4. Publication stores the case in the `cases` table as `case_json`. That published database record is what students receive. A local case export may be stale.
5. The runtime adapts older classic cases through `lib/simulation/legacy-adapter.ts`. New event-based simulation cases use `lib/simulation/case-schema.ts`, encounter events, and their rubric/live-plan configuration.
6. `lib/cases/views.ts` prepares the student view and removes internal result provenance (`basis`). Students see results when available; they must not see the answer key or scoring configuration before submitting.

The review note is part of the draft/reviewer workflow. It is not a substitute for resolving a contradiction before publication.

## 2. What the current classic scorer rewards

Published classic cases use a 100-point rubric:

| Area | Maximum | How it is marked |
|---|---:|---|
| Clinical reasoning | 30 | Examiner evaluates the student's reasoning from the consultation. |
| History | 25 | Version 2 gives 17.5 for required-topic coverage and up to 7.5 for relevance, depth, and focus. |
| Diagnosis | 15 | Examiner judges clinical meaning; the accepted diagnosis list is a safety net. 12/15 or more is considered correct. |
| Test ordering | 20 | Exact test IDs and author-configured categories are scored. |
| Management | 10 | Examiner compares the plan with the case's core and dangerous steps. |

Safety deductions can apply after these marks: dangerous tests also reduce the test score and add a safety penalty; missed red flags can incur up to 10 points total. Final marks are bounded from 0 to 100.

**History is not supposed to require the case's exact words.** The primary history judgment is semantic: a student can ask several relevant things in one question, and clear lay wording counts. If the semantic coverage response is unusable or unavailable, the scorer has a keyword-based fallback. That fallback is a known limitation: write each required item as a simple clinical concept, test it with ordinary synonyms and paraphrases, and never add a rare phrase or exact wording as a requirement. Keyword fallback must not be treated as the ideal grading standard.

`diagnosis.must_include_keywords` is a legacy field and does not grade current classic diagnoses. Keep it empty. Diagnosis marks come from the examiner and the accepted-primary safety net; the engine does not require those configured keywords.

Classic test ordering is intentionally deterministic and exact by ID:

- Core test ordered: **+8**; each missed core test: **−5**.
- A member of a configured core-test group earns that group's credit once; missing the group incurs one missed-core deduction.
- Optional test ordered: **+3**.
- Distractor ordered: **−4**.
- Dangerous test ordered: **−10**, plus a safety deduction.
- Unlisted tests are neutral. The testing score is clamped to 0–20.

This design makes authoring choices consequential. An excessive core list, a mislabeled optional test, an unrecognized equivalent test ID, or an unjustified dangerous/distractor label can lower a student's mark even when their reasoning was defensible. Use core groups for equivalent alternatives and keep conditional tests optional unless the case clearly makes them necessary. Do not fill category lists to hit a quota.

The newer event-based simulation rubric is separate: it scores recorded actions, interpretations, diagnosis, management and safety from structured case configuration. Do not assume classic test-ordering points or history fields automatically describe a live-plan case. Check the actual case's `scoring_mode` and rubric in `lib/simulation/case-schema.ts` and `engine/evaluation/DualScorer.ts`.

## 3. Source facts, proposed values, and provenance

Every test result must say where it came from:

- `case_sheet`: the source case explicitly supplies the measurement.
- `ai`: a new teaching value was proposed because the source did not supply it. Include a short `basis` that ties it to documented facts, and list the proposal in `review_notes`.
- `reviewer`: a qualified reviewer supplied or approved the value; the basis should identify the review when the workflow supports it.
- `legacy_unknown`: only for an already-published case whose original source sheet is unavailable and whose historical value cannot be verified. Include a basis explaining what was checked, which guideline informs plausibility, and that the guideline does not prove the individual historical value. Never use this for a new case.

Do not turn an internet reference range or a typical textbook value into a claim about what an individual historical patient measured. Online sources can support plausibility, age-appropriate ranges, test selection and treatment guidance. They cannot recover a missing source sheet.

If the source sheet contains no result, the AI may propose a clearly marked synthetic result only when the case-writing workflow permits it. Keep the distinction visible in the draft and review notes. Do not quietly relabel an invented result as a source fact.

## 4. Clinical consistency checklist

Before asking for review, compare every part of the case with every other part:

- **Patient:** age, sex, pregnancy, gestational age, weight, setting and relevant background agree throughout the case.
- **Timeline:** symptom onset, duration, test timing, treatment and response fit together.
- **Examination:** the written examination, structured findings, appearance, AI patient answers and images describe the same patient. Do not add a finding merely because it is common in the diagnosis.
- **Investigations:** each value has a parameter, unit and suitable reference interval where relevant. Check decimal placement, conversions, derived values, totals and fractions. Summary and interpretation must match the actual numbers.
- **Conclusions:** do not state more than the evidence supports. A normal CBC alone does not establish a viral cause. Do not say “no eosinophilia” if an eosinophil result is absent. Do not call a result normal using an adult interval when the patient is a child.
- **Conflicts:** if sheet, exam and result disagree, name the exact conflict in `review_notes`; do not silently select whichever side makes a cleaner story. A clinician-author must resolve historical facts. A deliberately synthetic rewrite can change them only when the new value is marked `ai`, its basis is disclosed, and the rewrite is explicit.
- **Teaching:** the differential, red flags, diagnosis, tests, walkthrough, management and scoring rubric should follow the same version of the case and the same current guideline.

### Extra checks for paediatric and newborn cases

- Use age-specific paediatric ranges and an appropriate source. Newborn results can depend on age in hours or days, gestational age, risk factors and the method used; adult reference intervals are not acceptable substitutes.
- Make the speaker appropriate to the child's age. A parent or caregiver should answer for an infant or young child when the child cannot reliably provide the history. Use age-appropriate language and do not imply a toddler can report complex symptoms unaided.
- Check the examination against the result. A visible clinical description and a numerical lab result must not conflict without explanation and an explicit author decision.
- For prolonged neonatal jaundice, NHM's 2024 CEmONC curriculum calls for total/direct bilirubin, haemoglobin/haematocrit and mother/infant blood groups; additional tests depend on the presentation. The guideline's rough visual estimate is not a replacement for measured bilirubin or age/risk treatment thresholds.
- For acute childhood diarrhoea, ICMR's STW makes investigations dependent on severity and signs. Do not make routine stool tests or imaging mandatory without a case-specific reason. Reflect dehydration and electrolyte abnormalities accurately.
- Before publication, ask a paediatric clinician to review reference ranges, interpretation, urgency, treatment and the age-appropriate patient role.

## 5. Build a fair marking configuration

### History

- Write 8–12 required items as one concept each, such as “blood in the stool” or “how long the fever has lasted.”
- Include only topics that materially distinguish diagnoses, assess severity, identify risk, or affect safe care. Avoid broad bundles that require several answers for one mark.
- Add 8–15 realistic reference questions for reviewer calibration. Include a mix of direct, lay, concise, and multi-topic questions. These examples are not phrases the student must copy.
- Put genuinely dangerous omissions in the red-flag list. Do not duplicate a normal history item as a safety penalty.
- Read each required item as if the student used a synonym, common abbreviation, or simple Hindi-English phrasing. If that would fail the keyword fallback despite being clinically clear, simplify the item and add examples for calibration.

### Diagnosis

- List 3–8 clinically equivalent wordings in `accepted_primary`, including common abbreviations and usual synonyms.
- Do not accept a diagnosis that changes acuity, cause, complication or subtype unless that is also correct for this case.
- Leave `must_include_keywords` empty. Do not encode exact-match requirements in diagnosis fields.
- Check broad-but-correct answers, spelling variants, abbreviations, extra qualifiers and dangerous near-miss diagnoses with the actual diagnosis matcher and examiner prompt.

### Tests

- Mark only essential, diagnosis-confirming tests as core; use core groups when accepted alternatives are clinically equivalent.
- Mark reasonable, conditional or context-dependent tests optional. An investigation that is appropriate only after a risk screen, red flag, or failed first-line test should not be a punitive distractor by default.
- Mark a test as a distractor only if it is low-value for this specific patient and presentation. Mark it dangerous only when the actual case makes it unsafe, invasive without indication, or clearly inappropriate.
- Ensure every scored test ID corresponds to the correct catalog item or a validated case item. A medically equivalent test under an unlisted ID may be neutral to the scorer.
- Keep `tests[]` results, the scoring categories, and the teaching discussion aligned. A test described as necessary in the walkthrough must not be penalized as a distractor.

### Management and safety

- Core steps should be observable, clinically meaningful actions, not an exhaustive protocol checklist.
- Dangerous steps should describe a real risk in this presentation. Avoid double-penalizing the same omission as a missed red flag, dangerous management step, and reasoning failure unless each measures a distinct harm.
- Use current Indian national guidance and relevant specialty guidance for local practice. Include dose, route, timing and monitoring when they are clinically material and supported by the source.

## 6. Use current sources responsibly

For Indian context, search current primary/official material first: MoHFW/NHM, ICMR, NCVBDC, and the relevant Indian specialty society. Use international society guidance when it is directly relevant or when local guidance is unavailable. Record the source title, issuing body, version/date, exact URL and the part that supports the case decision. Confirm that the source is current on the date of review.

Examples referenced while checking current MediKarya cases (verify the latest edition when authoring a new case):

- [NHM CEmONC Curriculum, 2024, Part 2 (newborn care)](https://nhm.gov.in/pdf/2024/Revised_CEmONC_Curriculum-2024-Part-2.pdf)
- [ICMR Standard Treatment Workflow: Acute Diarrhoea](https://www.icmr.gov.in/icmrobject/uploads/STWs/1725952338_paediatrics_diarrhea.pdf)
- [2025 ESC Guidelines for cardiovascular disease and pregnancy](https://www.escardio.org/static-file/Escardio/Guidelines/Products/Slide%20sets/2025/2025%20official%20slides_Pregnancy.pdf)
- [KDIGO 2025 ADPKD Guideline](https://kdigo.org/wp-content/uploads/2025/01/KDIGO-2025-ADPKD-Guideline.pdf)
- [Indian Thyroid Society thyroid nodule consensus, 2024](https://www.indianthyroidsociety.in/assets/img/publications/the_diagnosis_and_management_of_thyroid_nodules_.1.pdf)
- [ICMR Standard Treatment Workflow: Bradyarrhythmia](https://www.icmr.gov.in/icmrobject/uploads/STWs/1771492063_bradyarrthymia13_2_2.pdf)

## 7. Before publication: reviewer checklist

- [ ] Source facts and synthetic proposals are distinguishable; every result has valid provenance.
- [ ] Any conflict is either resolved by the case author or clearly marked as an explicit synthetic rewrite.
- [ ] Patient details, narrative, exam, investigations, interpretations, diagnosis and management agree.
- [ ] Age-specific values, units, reference intervals and calculations have been checked.
- [ ] Every required history topic accepts semantically equivalent plain-language questions; no student needs a magic word.
- [ ] Diagnosis variants and sensible test alternatives are accepted; test categories do not punish defensible care.
- [ ] Safety deductions are specific, justified and not duplicated without reason.
- [ ] The walkthrough and scoring reflect current guidance and the exact case version.
- [ ] A clinician reviewed the clinical content; a paediatric case received paediatric review.
- [ ] The case has been tried with varied student phrasings, lay terminology, abbreviations, negation, multi-topic questions and appropriate alternative tests.
- [ ] The reviewer checked the final published database record, not only a local draft.

The structural audit and automated tests can catch malformed data and known regressions. They cannot certify clinical truth, guarantee a fair score for every wording, or replace clinical review and calibration.

## 8. Verification commands

Run these from the repository before accepting engine or case-structure changes:

```powershell
npm run test:sim
npx tsc --noEmit -p .
npx ts-node --project scripts/tsconfig.migrate.json scripts/audit-published-case-scoring.ts
```

The published-case audit reads all published records and checks schema/configuration. It is read-only and does not evaluate whether the medical facts are true. To check a new case semantically, review the student's plausible alternative wordings and score each against the intended rubric with a clinician.

## 9. Instructions to give another AI

Copy this into the AI that is helping draft a case:

> Follow `CASE_AUTHORING_GUIDE.md` and the current MediKarya case schema. First identify which facts come from the case sheet and which are absent. Do not invent a historical patient's measurements. If the workflow allows a synthetic teaching value, mark its origin as `ai`, provide a short evidence-based `basis`, and list it in `review_notes`. Check age/gestation-specific ranges, units, arithmetic, result summaries and the examination together. If source facts conflict, preserve the source and flag the exact contradiction for a clinician; do not silently resolve it. Use current Indian official guidance where available and give title, issuing body, date/version and direct links. Write history criteria as clinical concepts that accept plain-language synonyms; do not use exact keywords as required answers. Keep accepted diagnosis variants broad enough for equivalent wording but precise enough to reject a different severity or complication. Put only essential tests in core, conditional reasonable tests in optional, and use distractor/danger labels sparingly with a case-specific reason. Return the case JSON plus a reviewer checklist, list every unresolved issue, and state clearly that the draft needs qualified clinical review before publication.

## 10. Known limits

- No automated check can guarantee zero future case errors or fully grade every language variation.
- History scoring has a keyword fallback when its semantic coverage judgement cannot be used; keep concepts simple and test paraphrases.
- Test ordering is exact-ID based, so authoring and catalog mapping must be checked.
- Guidelines can change. Recheck current sources for each new case.
- The authoring AI is not the final clinical reviewer. A clean structural audit is not a clinical sign-off.
