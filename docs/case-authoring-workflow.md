# Case authoring workflow

Use this workflow for every new MediKarya case. It turns the standards in
`CASE_AUTHORING_GUIDE.md` into a repeatable production path. A passing
structural check is not clinical approval.

## 1. Select and scope

1. Search `data/cases/` by diagnosis, presentation, age group and specialty.
   Do not add a renamed duplicate of an existing learning objective.
2. Start a case only when its learning objective, learner level, care setting and
   primary diagnosis can be stated in one sentence.
3. Choose a **classic consultation case** by default. Use a live-plan simulation
   only when time-critical actions and patient-state changes are themselves the
   objective.
4. Add the work as `status: "draft"`. Do not mark a case published without a
   qualified clinician's documented review.

## 2. Make the authoring packet before writing JSON

Record the following in the case's `review_notes`:

- the primary current guideline (issuer, title, version/date and direct URL);
- the clinical decisions it supports: diagnostic threshold, tests, treatment,
  safety concerns and follow-up;
- the facts supplied by a de-identified source sheet, if any;
- every synthetic teaching value, its `origin: "ai"`, and a short evidence-based
  `basis`;
- known conflicts, uncertainty, or questions for the clinical reviewer.

Never use a guideline to claim a historical patient had a particular result.
For a source-free teaching case, all invented results and vitals must remain
explicitly synthetic.

## 3. Author the case

1. Use a local existing case only for its shape—not its patient facts or wording.
2. Add a non-revealing `displayTitle`, `displayDescription` and `displayTags`.
   Library-facing content must not name the diagnosis, an examination finding or
   a diagnostic test.
3. Make the patient, history, examination, vital signs, tests and walkthrough
   describe the same timeline. Use a parent/caregiver voice when the child cannot
   reliably give the history.
4. Give each test result a parameter, value, unit, relevant age-appropriate
   range, `origin`, `basis`, summary and interpretation. Use a catalog test ID
   when available; otherwise give a hyphenated, case-specific ID.
5. Configure a fair rubric:
   - 8–12 one-concept history requirements plus 8–15 ordinary-language examples;
   - 3–8 equivalent diagnoses and an empty `must_include_keywords` array;
   - core tests only when essential; put defensible alternatives in a core group
     or optional list; leave merely neutral tests unlisted;
   - specific, non-duplicated safety expectations.
6. Add `review_notes` with the unresolved items and an explicit clinician sign-off
   requirement.

## 4. Review in two passes

### Clinical author/reviewer pass

- Check demographics, pregnancy/gestation, timeline, examination, values, units,
  reference ranges, result interpretations, diagnosis and treatment together.
- Check the tests and treatment against the recorded current guideline, including
  local resistance guidance where relevant.
- Try ordinary-language, abbreviated, misspelled, negated and multi-topic history
  questions; try clinically reasonable alternative diagnoses and tests.
- Resolve conflicts rather than hiding them. Keep source and synthetic facts
  visibly distinct.

### Structural and runtime pass

Run the following from the repository root:

```powershell
npm run check:cases
npm run test:sim
npx tsc --noEmit -p .
```

For a draft headed for publication, also run the published-case scoring audit in
the main authoring guide. Review its output; a green structural check cannot
validate medical truth or language-model judgement.

## 5. Publish only after approval

1. Keep the case as `draft` until a qualified clinician has resolved every item
   in `review_notes` and signed off.
2. Publish through Admin Studio so the `cases.case_json` record—not a potentially
   stale local export—is the authoritative revision.
3. Play the published case with a fresh learner account and confirm that the
   title does not reveal the answer, results arrive, scoring accepts plain wording
   and the final database record matches the reviewed draft.

## Current draft queue

| Priority | Draft | Learning objective | Status |
|---:|---|---|---|
| 1 | 6-year-old with fever and painful urination | Recognize a stable first febrile UTI, collect a clean-catch sample before therapy, and arrange appropriate follow-up | Drafted; paediatric review required |
| 2 | Child with barking cough and stridor | Separate croup from airway-danger signs without over-testing | Not started |
| 3 | Child with acute monoarthritis and fever | Recognize septic arthritis and urgent source-control pathway | Not started |
| 4 | Adolescent with acute scrotal pain | Prioritize torsion and avoid delay for non-essential tests | Not started |
| 5 | Child with bruising and petechiae | Distinguish ITP from time-critical infection or malignancy clues | Not started |

The queue is deliberately a planning aid, not clinical approval. Before each
draft, repeat the source and duplicate check above.
