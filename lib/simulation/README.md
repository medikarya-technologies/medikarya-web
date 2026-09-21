# Clinical simulation engine

A generic runtime where **cases are programmable clinical environments**. The
engine knows nothing about STEMI; the case JSON knows what every flag, action
and threshold means.

```
Case JSON ─▶ PatientState ◀─ EncounterEvent[]  (single source of truth)
                 │                 ▲
                 ▼                 │ dispatch
   vitals rail · telemetry · nurse alert · intervene tray · exam · orders
                 │
                 ▼
   DualScorer ─▶ Clinical score + Independent score ─▶ debrief ─▶ reinforcement
```

Run the tests (type-checks with the project's TypeScript, then `node:test`):

```bash
npm run test:sim
```

## Files

| File | Job |
|---|---|
| `encounter-events.ts` | The 12 event types. `timestamp` is **seconds on the simulation clock**. |
| `case-schema.ts` | TypeScript shape of the simulation block of a case JSON. |
| `patient-state.ts` | `PatientState`: a *fold* over the log. `apply(event)` is the only mutation; `evaluate()`/`due()` decide what fires, without mutating. |
| `encounter-engine.ts` | Framework-free `ClinicalEventManager` core: dispatch, fire due rules, assists. |
| `conditions.ts` | The condition grammar (below). |
| `assist-policy.ts` | The semantic assist ladder (`allowed[]` / `disabled[]`, costs). |
| `case-resolvers.ts` | Results, exam findings and hints — pure functions of *config + log*, nothing stored. |
| `validate-config.ts` | Catches typo'd flags, unreachable rules, bad rubrics. Run it on every case. |
| `replay.ts` | Server-side integrity: keep only what the student did, rebuild the rest. |
| `legacy-adapter.ts` | Runs a **classic** case at the bedside, from the case's own data (below). |
| `classic-inputs.ts` | Reads the classic evaluator's inputs (diagnosis, plan, tests, chat) back out of the log. |
| `test-catalog.ts` | The order menu as one case sees it: its own `custom_tests`, then (optionally) the master catalog. |
| `vitals-assess.ts` | Age-banded vital limits, the abnormality badges (an assist) and their explanations. |
| `live-vitals.ts` | The monitor's natural wander (HR, SpO₂, RR) and cuff readings (BP): display-only, bounded, never crossing a badge or alarm threshold. |
| `appearance.ts` | How the patient LOOKS (pallor, jaundice, sweat, expression), resolved against their state, and worded ("Face is very pale and yellow."). |
| `portrait-palette.ts` | The portrait's colours: what pallor, jaundice and cyanosis do to skin, lips and the whites of the eyes, on every skin tone. |
| `persona.ts` | WHO the patient is as a picture: body by age, how old they look (grey, lines, glasses), Indian clothes in curated colours, hair, chosen from age, gender and the case id; a case can override it. |
| `upgrade-report.ts` | "If I add this case, what will the student get?" (printed by `migrate-cases.ts --dry-run`). |
| `arrival.ts` | The patient as first seen, before an encounter exists (figure, look, one-line observation, breathing rate): the same resolution the bedside rail makes for its first frame, for the briefing screen. |
| `ecg-synth.ts` | Rhythm → beats → per-lead waveform (telemetry and 12-lead share it). |
| `../clinical-catalog.ts` | 183 tests with universal ranges + turnarounds. |
| `../../engine/evaluation/DualScorer.ts` | Rubric evaluator → two scores from one log. |

## Invariants worth protecting

1. **The log is the only truth.** Nothing derives clinical state from UI state.
2. **State is a pure function of the log.** Same log + same rules ⇒ same patient.
   That is what lets the server replay an encounter instead of trusting the client.
3. **A rule fires at the instant it becomes true**, not when the UI next ticks.
4. **Actions win ties.** An intervention at 15:00.0 beats a rule that turns true at 15:00.0.
5. **Physiology ≠ recognition.** "The patient has a STEMI" (rules key off
   `ongoing_ischemia`) is not "the student recognised it" (`stemi_recognized_by_student`,
   scorer-only). A student who never notices must still deteriorate.

## Authoring a case

A simulation case is a normal case JSON plus these top-level keys
(see `data/cases/simulation/acute-anterior-stemi.json`, the worked example):

`clinical_constraints` · `assist_config` · `initial_state` (declare **every** flag here) ·
`action_consequences` · `event_rules` · `state_thresholds` · `recognition_rules` ·
`examination` · `investigation_results` · `socratic_hints` · `scoring_rubric` · `reinforcement`

### Action keys — what `action_consequences[].action` can be

| Key | Comes from |
|---|---|
| `aspirin_300mg`, `activate_cath_lab`, … | an intervention id from `intervention-catalog.ts` |
| `<testId>_ordered` (e.g. `ecg_12_lead_ordered`) | ordering that test |
| `<manoeuvre>_performed` | an exam manoeuvre from `examination` |
| a `recognition_rules[].action` | the student's interpretation / differential / diagnosis matched (negation-aware) |
| an `investigation_results[].state_consequence` | the student interpreting that result |
| an `event_rules[].emits` | a rule firing (a *system* action) |

A consequence may carry `when` (a guard, evaluated against the state **before** any consequence
of that action applies), `sets`, `physiological_changes`, `trajectory_note`, `safety_penalty`.

### Conditions

One grammar for rules, guards, exam variants, hints and scoring:

```jsonc
{ "time_elapsed_gte_minutes": 15 }                          // 1. time
{ "flag": "reperfusion_strategy_initiated", "is": false }   // 2. action / state flag
{ "parameter": "spo2", "lt": 85 }                           // 3. physiology
{ "state": "worsening_ischemia" }  { "alarm": "shock_state" }
{ "minutes_since_flag": { "flag": "pci_started", "gte": 6 } }
{ "all": [ … ] }  { "any": [ … ] }  { "not": { … } }
```

Scoring adds encounter predicates: `ordered`, `gave`, `performed`, `asked_about`,
`interpretation_mentions`, `differential_slot`, `plan_mentions`, `rule_fired`, …

### Narratives and findings

`{hr}` `{bp}` `{sbp}` `{dbp}` `{map}` `{spo2}` `{rr}` `{rhythm}` `{temp}` are filled from the
live vitals, so authored prose can never disagree with the monitor.

## Classic cases at the bedside

Every classic case (patient + vitals + tests + `evaluation_config`) runs in the same bedside
encounter. `getCaseById` passes it through `upgradeLegacyCase` (`legacy-adapter.ts`), which
derives the simulation block **from the case's own data and adds nothing clinical**:

| From the classic case | Becomes |
|---|---|
| `patient.vitalSigns` (+ the ECG test's `ecg_parameters`) | `initial_state`, the monitor rhythm, age-banded alarm limits. A vital never measured is shown as "—" (`initial_state.unmeasured`). |
| `patient_facts.*_examination` sections | `examination` manoeuvres, in the case's own words. No sections ⇒ no Examine tab. |
| `tests[]` and their results | `custom_tests` + `investigation_results` with `order_menu: "case_only"`. Numbers and findings are on view when the result arrives; the expert's wording sits behind the paid reveal (and is not offered when there is none). Results return after seconds, not an ED hour. |
| `evaluation_config` | `scoring_mode: "classic"`: scored by the classic evaluator; the Independent score is that minus the assist costs. |

What it deliberately does **not** do: the patient stays as presented (no `event_rules`), there is
no treatment tray (`available_interventions: []`), no hints (no authored `socratic_hints`), no
critical-window bar or order budget (`clinical_constraints` are optional; `untimed: true`).
Physiology and treatment effects have to be authored, and clinician-reviewed, per case: see the
STEMI case.

**Adding a case.** Put its JSON in `data/cases/` and run `scripts/migrate-cases.ts`; `getCaseById` upgrades it when a student opens it, no other step. It needs a **heart rate** in `patient.vitalSigns` and **at least one test with an `id`** in `tests[]`; without either it silently opens in the old three-step flow. To see what a case will get before uploading it (this writes nothing and needs no Supabase keys):

```bash
npm run check:cases
```

It prints, per case, whether it runs at the bedside, the monitor rhythm, how many tests have results, whether there is an Examine tab, the first-look line and the portrait (`upgrade-report.ts`).

Keep `displayTitle` and `displayTags` at the level of what the patient would tell you, plus the specialty: never the diagnosis, an examination finding or a test name. The library shows the title before a student starts and its search reads the tags, so a tag like "malaria" or "bradycardia" gives the case away (`scripts/fix_display_tags.sql` corrects the seven that did).

Switches: `CLASSIC_CASE_FLOW=true` in the server environment turns the upgrade off everywhere;
`"experience": "classic"` in a case's JSON opts that one case out. Try any case without logging
in at `/sim-preview?case=<id>` (dev builds only).

## The encounter screen

Four surfaces, darkest to lightest, so every zone reads as its own thing without a decorative
colour (tokens `--color-enc-*` in `app/globals.css`; primitives in `components/cases/encounter-ui.tsx`):

| Surface | What lives on it |
|---|---|
| **scope** (dark) | the patient monitor: the only dark surface and the only place with channel colours (ECG green, SpO₂ cyan, RR amber, NIBP white) |
| **console** | the chrome: top bar and the patient rail (portrait, monitor, clock, support) |
| **desk** | the working surface behind the tabs: the transcript, the worklists |
| **sheet** (white) | content: orders, findings, the assessment, the composer dock |

One accent (the brand blue) marks what the student does (Order, Send, Submit, Give). Green / amber /
red mean clinical status and nothing else. Tabs are an underlined strip attached to the sheet they
control. The suggested questions live in the composer dock, labelled, so they never read as part of
the conversation.

**How the patient looks** is `appearance` in the case JSON (`pallor`, `jaundice`, `cyanosis`,
`flushed`, `sweating`, `sunken_eyes`, `expression`, `swelling`, `skin_tone`, an optional `note`, and
`variants` that follow the patient's state with the same condition grammar). The portrait and the
one-line observation are both drawn from it, so they can never disagree. A classic case needs none:
`deriveAppearance` reads it from the case's examination findings and structured facts, and says
nothing where the case says nothing. `data/cases/simulation/appearance.ts` holds drafts (for
clinical review) for the classic cases that document nothing.

**Who the patient is** (`persona.ts`) is separate from how they look right now, and follows the real age, gender and case id, so it needs no authoring:

| | |
|---|---|
| **Body** | infant (<1 y), toddler (1–4), child (5–12), then adult man or woman. Toddlers are drawn small in the frame with a round head, big low-set eyes and narrow shoulders. |
| **Age** | continuous, not a switch at 65: grey hair from the late 30s, lines from the late 20s, hollow cheeks from the late 50s, glasses more likely with age, a moustache on many men. A 58-year-old and a 72-year-old are different drawings. |
| **Clothes** | ordinary Indian clothes for the age and sex, in curated fabric colours picked by the case id: saree (with the pallu over the head for some older women), salwar kameez with a dupatta, kurta, kurta with a Nehru jacket, shirt, tee; a frock for a little girl, a swaddle and cap for an infant. Two cases differ; one case never changes. |
| **Never a default** | a bindi, a nose stud: they depend on the patient's community and are not guessed from a name. |

A case overrides any of it in its `appearance` block: `attire` (`saree`, `salwar`, `kurta`, `kurta_jacket`, `shirt`, `tee`, `frock`, `swaddle`, `gown`), `accessories` (exactly this list: `glasses`, `earrings`, `moustache`, `bindi`, `nose_stud`; `[]` is none) and `skin_tone`. The faces still share one drawing per body; what differs between people is age, hair, clothes, glasses, moustache and skin tone. Dev gallery: `/sim-preview/portraits?set=cases|ladder|extras`.

**The briefing before the bedside** (`components/cases/patient-card.tsx`, shown on `/dashboard/cases/[id]` and `/try` before Start) is drawn from the same surfaces: the portrait and the "First look" line come from `appearanceAtArrival`, so the student meets the same person before and after pressing Start; the vitals on arrival sit on the dark monitor surface; the record (complaint, allergies, medicines) is on the white sheet. It shows only what the case has: no admission time, MRN or setting is invented, and a vital the case never measured is "—" with the case's own note ("Afebrile to touch"). The earlier attempts strip under it is `attempt-history.tsx`. In dev, `/sim-preview?screen=briefing&case=<id>` (add `&attempts=3`) shows it for any case without a login.

**Picking a case back up.** The encounter already keeps itself in the browser (`medikarya-sim-<id>`: the event log and the clock; `medikarya-sim-ui-<id>`: the chat and, once scored, the result), and opening the case again resumes it. `lib/simulation/resume.ts` reads those two keys to say a case is *in progress* (the student has done something and has not been scored), which is what the library's "In progress" rows, the home page's "Continue" card and the briefing's "Resume case / Start over" show. It is per browser, not per account.

**The tour** (`components/cases/encounter-tour.tsx`, drawn by `components/tour/guided-tour.tsx`) walks a student through the screen: where to type, examine, order tests, intervene and diagnose. Steps point at controls by `data-tour="..."` (top bar, tabs, rail, composer), so a step whose control is not there (no Examine tab, no Intervene button, no left rail on a phone) is left out. It starts by itself once, for a student with no attempts on any case who has not seen it on this device (`lib/tour/tour-storage.ts`), the encounter clock is frozen while it is open, and the ? in the top bar replays it. To try it in dev: `/sim-preview?case=<id>&tour=1`.

**Dark.** The app (dashboard, encounter, `/try`) has a dark theme, chosen by the student (Light, Dark, System; light by default) and never applied to the marketing pages (`lib/theme.ts`). `.dark` in `app/globals.css` re-points the `--color-enc-*` tokens, so anything drawn from them follows. Where a token is used as a *fill under white text* (a badge, an active chip) use `bg-enc-fill`, and `bg-enc-scrim` for the backdrop behind a drawer or spinner, not `bg-enc-ink`, which is near-white in dark. The older screens (quiz, classic feedback) still use raw Tailwind colours; a block at the end of `globals.css` remaps those for dark, so new work should use the tokens instead.

**Monitor sound** (`components/cases/monitor-sound.tsx`, numbers in `monitor-sound.ts`) is off until the student turns it on (the speaker on the monitor; remembered per device). A beep per heartbeat, pitched by SpO₂ like a pulse oximeter, and a three-tone alarm every 4 s while an alarm shows. The beep comes from the ECG trace when it draws a beat (so it lands on the QRS you see); when nothing is drawing (a phone with the monitor closed) a timer at the patient's rate stands in. Nothing plays in a hidden tab, or in ventricular fibrillation.

**Report a problem** (`report-problem.tsx`, rules in `lib/reports/case-report.ts`, stored by `app/actions/case-reports.ts`) is in the encounter's top bar and on the feedback screens. It stores one kind of problem, a sentence, and where the student was (clock, tab) in `public.case_reports`: **run `scripts/add_case_reports.sql` once in Supabase**. Until then sending fails politely and the dialog offers the same report as an email. The clock is frozen while the dialog is open.

**Milestones and "where you lose marks"** (the Progress page) are worked out from the attempts, never stored: `lib/library/milestones.ts` (first case, 3 and 7-day streaks in UTC days like the streak the dashboard keeps, a 90+, a specialty complete, every case tried) and `lib/library/skills.ts`. An attempt stores its marks in two shapes: classic scoring keeps `historyScore`, `testingScore`, `reasoningScore`, `diagnosisScore`, `managementScore` and `missedRedFlags` at the top of `feedback_json`; rubric scoring keeps `simulation.domains` and `simulation.knowledgeGaps`. Both become the same six skills; `app/actions/skills.ts` reads only those paths, not the event log. Saving an attempt (`persistAttempt` in `app/actions/evaluate.ts`) returns the milestones it just earned, and the debrief says so once. Because they are derived from the current library, "every case tried" waits for a case added later.

**The Progress page** (`/dashboard/progress`, `components/dashboard/student-progress.tsx`) holds the student's record in three tabs that each fit about one screen: *Overview* (the training section, the same component as the dashboard home), *Skills* (`SkillsCard` "where you lose marks", `SpecialtyCard`, `MissedCard`, in `progress-cards.tsx`) and *Activity* (recent attempts and the milestones, each unfinished one with a bar from `Milestone.fraction`). The open tab is in the address (`?tab=skills`): `lib/library/progress-tabs.ts` reads it forgivingly and the page writes it with `replaceState`, so Back still leaves the page; all three panels stay mounted and the two not open are `hidden`. A student with no attempts sees one "Nothing to chart yet" panel instead of three empty tabs. Specialty rows, and the "not started" links under them, open the library on that specialty (`specialtyHref` in `library-url.ts`). Profile (`/dashboard/profile`) is deliberately short: identity from Clerk, Appearance, and one "Your record" card that links to Progress; it used to hold all of this in one column four screens tall. Careful with wording on the Skills tab: "your weakest part" is the lowest *average*, not "where most marks are lost", because the parts are worth different marks (classic scoring: history 25, tests 20, reasoning 30, diagnosis 15, management 10); the old sentence said the latter and was not true.

**The library** keeps its filters in the address (`lib/library/library-url.ts`, replaced not pushed, other parameters kept), can save a case for later (`lib/library/saved.ts`, per signed-in user, in the browser) and marks a case "New" for two weeks after it was added if it is not yet tried. Every dashboard tab has its own title, and the dashboard has its own error and not-found pages (`app/dashboard/error.tsx`, `not-found.tsx`; `app/error.tsx` and `global-error.tsx` for the rest). A server component must take the button classes from `components/dashboard/button-styles.ts`, not from `dashboard-ui.tsx`: a constant imported from a `"use client"` file arrives as a client reference, not as its text.

**The monitor is alive.** HR, SpO₂ and RR wander by a beat or a point, BP is a cuff reading every
three minutes (and straight away when the patient changes), and a true change glides to its new value
over a few seconds. This is display only, and bounded so it can never show a reading on the other side
of a badge or alarm threshold from the patient's true state (`live-vitals.test.ts` checks this over a
grid of ages and values).

## Adding the case to the app

Bundled cases live in `data/cases/simulation/` and are registered in its `index.ts`.
`getCaseById` / `getCases` read Supabase first, so a row with the same id overrides the bundled one.
`npm run test:sim` validates every bundled case with zero errors **and** zero warnings.
