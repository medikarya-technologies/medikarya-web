# Live plans: rate-controlled fluids and a dynamic patient (engine specification)

Status: **proposal, nothing implemented.** Written 2026-10-15 after the dengue review.
Scope: the engine (`lib/simulation/`) changes that dengue, DKA and septic shock need. Not in scope: converting any other case, switching anything on, clearing any release blocker.

Rule for this document: **the engine is generic; every clinical number is data that a clinician approves.** Where the guideline disagrees with itself, this document records the disagreement and stops. No executable treatment logic is written until the clinical questions in sections 3 and 14 are answered.

---

## 1. What the engine does today (verified in the code)

| Area | Today | Consequence for dengue |
|---|---|---|
| Patient state | `PatientState` is a fold over the event log. Vitals are integers (HR, SBP, DBP, SpO2, RR, temp). Everything else is a boolean flag with a set-at time. | No numeric quantity (urine, haematocrit, volume) can exist. |
| Time | Discrete-event rules. A rule fires at the instant its condition becomes true (`time_elapsed_gte_minutes`, `minutes_since_flag`). `time_scale` and `untimed` (180 min cap) exist. The plan encounter is 25 min. | An hour-long infusion and multi-hour step-downs do not fit. |
| Untreated course | Each stage moves vitals by the **difference** from the previous stage (verified in `compileLivePlan`), so a treatment's effect persists. | Good: no change needed. |
| Treatment effect | A treatment is a fixed vital delta, once, or spread over N minutes as an `infusion` (fixed total, fixed duration, stoppable only via `infusion.while` plus a tray action). | No rate, no step-down, no remaining volume, no harm from running on. |
| Recovery | Fixed `after_minutes` after a flag, then vitals are *set* to fixed values. | Recovery is a script, not a result. |
| Stabilisation | Treatment-set flags plus an optional `end_points` condition on vitals/findings/stage. No pulse pressure, no cross-vital arithmetic. | A blood-pressure end point is already met on arrival in compensated shock. |
| Reassessment | A tray action printing fixed sentences from findings. Findings change only at stages, recovery or a treatment response. | Findings are not measurements; they cannot drive a decision. |
| Scoring | `scoreBedside` is a pure function of the event log: essential items (on time 1, late 0.5, missed 0), 15 off per harmful item. Browser and server agree because the server replays the student's events (`replayStudentEvents`) and re-derives everything else. | Any new scoring must stay a pure function of the log. |
| Waiting | `TIME_SKIPPED` (1 or 5 min), stops early at a nurse alert, replayed by the server. | The right shape to extend to "review in an hour". |

Facts established by testing the dengue draft (see `live-plan-dengue.test.ts`): stopping an infusion works as a student action; stage drops do not erase treatment effects; an infusion cannot be stepped down; continuing fluids after recovery does nothing; profound shock fails after three boluses with no next step.

---

## 2. Engine decisions versus clinical decisions

Nothing in column B may be coded as a constant. It is read from an **approved protocol record** (section 8). A plan whose protocol record has any parameter not marked approved cannot be served to students, using the existing release-blocker mechanism.

| A. Engine decisions (this document) | B. Clinical decisions (clinician must approve; sections 3 and 14) |
|---|---|
| Which quantities the patient has, units, integer rounding, update order | The actual numbers: rates, volumes, thresholds, retention, leak course |
| How an infusion starts, changes rate, stops, finishes | Which rates are allowed, in what order, for how long (the step-down ladder) |
| How reassessment produces findings and how the log records them | What counts as "improving", "persistent shock", "suspected bleeding", "overload" |
| How decisions are scored (credit, miss, harm) | Which action is right for which findings, and how long the student has |
| How clinical hours fit the encounter clock | How many clinical minutes a game minute stands for; what is skipped |

Removed by this design (they are estimates I chose to make the draft run, not clinical facts): the 2-minute bolus interval, the 8-minute deadline, the fixed +8/+2 mmHg per bolus, and the fixed recovery vitals. They are replaced by protocol timing in clinical time, by an approved volume-to-vitals mapping, and by recovery that follows from the patient's state.

---

## 3. The guideline conflicts (NCVBDC 2023)

Source: *National Guidelines for Clinical Management of Dengue Fever 2023* (text extracted from the PDF; pages are as printed in that text and must be re-checked against the PDF by the clinician). Each row is a **decision for the responsible clinician**, not for engineering.

| # | Topic | Text says | Figure / elsewhere says | Why it matters |
|---|---|---|---|---|
| C1 | Hypotensive-shock first bolus | 20 mL/kg as a bolus over 15 minutes | Fig 13: rapid bolus 10 to 20 mL/kg over 15 to 30 min, **500 mL maximum** | At 65 kg: 1,300 mL versus a 500 mL cap. Sets bolus size and duration. |
| C2 | Hypotensive second and third bolus | 10 to 20 mL/kg over 15 to 30 min, "up to three rapid boluses" | Fig 13: 2nd rapid bolus 10 to 20 mL/kg (500 mL max), then a 3rd | Whether the cap applies to every bolus. |
| C3 | Compensated shock, first fluid | 10 to 20 mL/kg/hour over one hour | Fig 12: 10 to 20 mL/kg for 1 hour | Consistent; lower end (10) is what the plan uses. |
| C4 | Compensated shock, second bolus | "10 ml/kg/hr for one hour" | Fig 12: second bolus 10 to 20 mL/kg over 1 hour | 10 versus 10 to 20. |
| C5 | Step-down ladder after improvement (compensated) | 7 to 10 mL/kg/h for 1 to 2 h, then 5 to 7 for 1 to 2 h, then 3 to 5 for 2 to 4 h, then 2 to 3 for 2 to 3 h, up to 24 to 48 h | Fig 12: 5 to 7 (1 to 2 h), 3 to 5 (2 to 4 h), 2 to 3 (2 to 4 h); the 7 to 10 step appears only after a second bolus | Different first step and different durations. |
| C6 | Step-down ladder after improvement (hypotensive) | 10 mL/kg/h for one hour, then 5 to 7 (1 to 2 h), 3 to 5 (2 to 4 h), 2 to 3 or less up to 24 to 48 h; after a second bolus 7 to 10 for 1 to 2 h | Fig 13: 5 to 7, 3 to 5, 2 to 3; "reduce 10 mL/kg/h for 1 to 2 h" after the 2nd bolus | Two different first steps. |
| C7 | Haematocrit decision | Rising or still above 45%: another crystalloid bolus. Lower than the reference (below 45% in adult males, 40% in children and adult females): suspect bleeding, transfuse | Fig 12 and 13: Hct above 45% leakage; below 45% bleed | "Reference" is ambiguous: the population value (45%) or **this patient's own baseline** (41% on day 2)? A fall from 52 to 44 is "below 45%" yet still above his own baseline. |
| C8 | Colloid | First hypotensive bolus "crystalloid or colloid (if available)"; dextran 40 for early fluid overload | The plan's earlier wording (colloid for a rising haematocrit after 2 to 3 boluses) is **not** in NCVBDC | The old plan text is wrong or from another guideline (ISCCM/WHO). |
| C9 | Blood | Whole blood 10 mL/kg or packed cells 5 mL/kg (adult) | A separate paediatric statement gives 20 mL/kg | Adult dose only; confirm. |
| C10 | "Improvement" | Reassess vital signs, capillary refill, haematocrit, urine output; "BP improved, pulse pressure improved, Hct decreased, urine output improved, capillary refilling improved" | No thresholds given except "urine output about 0.5 mL/kg/h", shock table (pulse pressure 20 or less; capillary refill over 2 s) | The engine needs numbers; the guideline gives few. |
| C11 | Stop fluids | Stop at 24 to 48 h; stop when leakage resolves (stable BP, pulse volume, perfusion; haematocrit falling with good pulse volume; afebrile over 24 to 48 h; improving urine) | Overload: furosemide only if stable and out of the critical phase; avoid diuretics during leakage; colloid (dextran 10 mL/kg/h) if in shock with overload | Defines overload, stopping and the harm model. |
| C12 | Refractory shock | Consider inotropes; look for cardiogenic or septic shock, acidosis, hidden bleeding; ICU | No doses | A branch to represent, with no dose to invent. |

Approval gate: the chosen reading of C1 to C12 is recorded in the protocol record (section 8) with the reviewer, date and PDF page. Until then the engine work stops at the data-model level.

---

## 4. State model

### 4.1 Principles
- State stays a deterministic fold over the event log. Nothing is stored that cannot be recomputed from the log.
- All quantities are **integers** (tenths where needed) so the browser and the server cannot disagree through floating-point rounding.
- Hidden variables drive observable ones. Per-treatment vital deltas are not used for fluid cases.
- New behaviour exists only when a plan declares `dynamics`. Without it the existing code path runs unchanged (section 11).

### 4.2 Hidden variables (units per kg, weight from the case, 65 kg for this one pending C-confirmation)
| Variable | Meaning | Changes by |
|---|---|---|
| `V` effective circulating volume deficit (mL/kg x10) | How short of plasma he is | Rises with leak `L` and bleed `B`; falls with retained infusion; **falls as leaked fluid is reabsorbed into the circulation** (the deficit shrinks) |
| `L` leak rate (mL/kg/h x10) | Ongoing plasma leakage | Follows a clinician-authored course over clinical time: onset, peak, resolution (a table, not a formula) |
| `B` occult bleed rate (mL/kg/h x10) | Hidden haemorrhage; zero unless the scenario variant has it | Authored table; stops only if the cause is treated (blood does not stop it) |
| `E` extravascular fluid load (mL/kg x10) | Fluid sitting in pleura, abdomen, lungs | Rises with the non-retained part of infusions and with leak; **falls by exactly the amount that returns to the circulation on reabsorption** (the same mL leave `E` and reduce `V`, so the two stay consistent) |
| `Hb_conc` haematocrit (% x10) | Observable, derived | From `V`, `B`, `E` and the baseline (see 4.4) |

### 4.3 Observable variables and how each changes
Every observable is a **monotonic piecewise-linear function of the hidden variables**, authored as a small table in the plan and approved by a clinician. They are evaluated at each simulated minute and rounded to integers. The existing monitor vitals stay the display.

| Observable | Driven by | Over time | After interventions |
|---|---|---|---|
| SBP, DBP | `V`, `E` (overload lowers via cardiac load only if clinician specifies) | Falls as `V` rises; narrows first (pulse pressure) then falls | Follows `V` as fluid is retained; no fixed per-bolus mmHg |
| **Pulse pressure** `pp = sbp - dbp` | derived | Narrows early (20 or less is the guideline's shock criterion) | Widens as `V` improves |
| HR | `V` | Rises with `V` | Eases as `V` falls |
| Capillary refill (s, tenths) | `V` | Lengthens (over 2 s abnormal) | Shortens with `V` |
| Urine output (mL/kg/h, tenths) | `V` | Falls below about 0.5 mL/kg/h in shock | Returns as `V` improves; reading appears only after catheterisation |
| Haematocrit | `V`, `B`, baseline | Rises with leak (baseline 41, arrival 52); falls with bleeding or after dilution | Falls as leak ends; **falls and keeps falling with bleeding** |
| SpO2, RR, lung findings | `E` | Fall/rise when `E` crosses clinician thresholds (overload) | Worse if fluid continues; better after reabsorption is managed |
| Consciousness, stability | `V` | As existing stages, but from `V` bands | Improve with `V` |

The existing stage table (`stages`) remains available: a dengue plan may express its untreated course as the leak course `L(t)` instead, and the stage names become labels for `V` bands.

### 4.4 Haematocrit rule (needs C7)
`Hct = baseline x f(V, B)`, with the baseline the patient's own (41% on day 2) and a reference for the decision rule chosen by the clinician (C7). The engine exposes both `hct` and `hct_vs_baseline` so either reading can be selected in the protocol record.

### 4.5 Time stepping
- One integration step per simulated minute, plus a step at every event timestamp (so a bolus given at 14:30 starts at 14:30).
- Order inside a step: leak/bleed course, then infusion inflow, then retention split, then observables, then alarms.
- Integration is a pure function `integrate(state, from, to, activeInfusions)` called inside `PatientState.apply` before an event is applied, and by `due()` when it looks for the next instant an alarm threshold is crossed (scanned minute by minute; a superset of instants is harmless, as today).
- Integration steps are **not** logged as events. Only meaningful instants are: alerts, phase changes, student actions, completions. This keeps the log small for 24 to 48 clinical hours.

---

## 5. Infusion lifecycle

### 5.1 Entity
`Infusion { id, treatment_id, kind (crystalloid | colloid | blood), rate_ml_per_h, planned_volume_ml?, started_at, stopped_at?, state: running | paused | stopped | completed }` plus its rate-change history. It exists only through events.

### 5.2 Student actions (new tray controls) and events
| Action | Event | Rules |
|---|---|---|
| Start a rate-controlled infusion | `INFUSION_STARTED { treatment_id, rate_ml_per_h }` | Needs IV access (existing `requires`). A second crystalloid infusion cannot start while one is running (must change rate). |
| Give a bolus | `BOLUS_GIVEN { volume_ml, over_minutes }` | A bolus is a short infusion at the protocol's rate; it ends itself. Cap per bolus read from the protocol record (C1, C2). |
| Change the rate | `INFUSION_RATE_CHANGED { infusion_id, to_level }` | Levels come from the protocol ladder; the tray offers the ladder's levels, not a free number. Allowed in any direction; direction and timing are scored (section 7). |
| Stop | `INFUSION_STOPPED { infusion_id }` | Always allowed. Stopping too early or too late is scored, not refused. |
| Finish | `INFUSION_COMPLETED` | **Derived** by the engine when the planned volume is delivered; never accepted from the client (the replay discards it, like `STATE_TRANSITION`). |

### 5.3 Remaining volume and what the student sees
`remaining_ml = planned_volume - integral of rate over running time`, computed from the events. The tray shows the rate level, the volume given and the volume remaining, per infusion, from the same fold on browser and server.

### 5.4 Inappropriate continued fluids
Harm is not a flag. It emerges: the non-retained fraction of every running mL raises `E`; when `E` crosses a clinician-set band, SpO2 and RR change through the mapping, a nurse alert fires ("breathing faster, saturation falling"), and a `SafetyEvent` is recorded. After the leak ends the same infusion keeps adding to `E` and produces overload faster (reabsorption plus infusion). A "free-flowing 2 L" harmful item becomes just a very high rate for a short time, scored by its effect.

### 5.5 Interaction with hard limits
The patient cannot be harmed beyond the mapping bounds (existing clamps in `applyChanges` stay). Overload never silently resets; it reverses only through stopping or the clinician-approved reabsorption and diuretic rules.

---

## 6. Reassessment-driven decisions

### 6.1 The student requests a reassessment; the engine produces the findings
The student submits only a **request** (today the tray action `reassess_patient`, an `INTERVENTION_GIVEN`). The request carries no findings. The engine derives the findings from the canonical patient state at that timestamp and writes them into a `REASSESSED` event, so the log alone explains what the student saw: vitals, pulse pressure, consciousness and the plan's tracked findings (S1); later capillary refill, urine, haematocrit with its trend, lung and abdominal findings (S3).

Trust rule: **client-supplied vitals, laboratory values or findings are never used.** The server replay drops every `REASSESSED` event in an untrusted log (as it drops `STATE_TRANSITION`) and regenerates each one deterministically from the student's reassessment request and the replayed patient. A forged or altered `REASSESSED` therefore changes nothing. In the browser the same engine method produces the event, so both sides agree.

Ordering: the findings are read after everything due strictly before the request's timestamp has happened, and before the request's own effects and anything else due at that same instant (the rule `giveIntervention` already follows for its consequence text). A reassessment at the exact second of a deterioration therefore shows the patient as they were just before it; one second later shows the deterioration.

Urine and haematocrit (S3 onward) appear only if the student has ordered them (catheter, repeat haematocrit): ordering is itself an action with a turnaround in clinical time, reusing the existing test-result machinery.

### 6.2 The decision table (clinician-authored, in the protocol record)
Rows map findings to the **set of acceptable actions** and the clinical-time window in which one must be taken. Shape only (no numbers invented here):

| Findings at reassessment | Acceptable actions | Notes |
|---|---|---|
| Improving on the approved criteria | Step down to the next ladder level | C5, C6, C10 |
| Not improving, haematocrit rising or high | Repeat a bolus (up to three) | C2, C7 |
| Not improving, haematocrit falling or below reference | Investigate bleeding, cross-match, blood | C7, C9 |
| Not improving after the allowed boluses | Escalate: ICU, look for other shock, inotropes (no doses) | C12 |
| Leak resolved, stable | Stop fluids | C11 |
| Overload signs | Reduce or stop; colloid if in shock; diuretic only if stable and out of the critical phase | C11 |

A fixed blood-pressure end point **never** substitutes for this table. `end_points` stays available for other cases but is not used by the dengue plan.

### 6.3 Recovery
There is no `after_minutes` recovery. The patient is "recovering" when the approved improvement criteria have held for a clinician-set number of clinical minutes. The nurse says so at that moment. If the criteria stop holding, the state returns to deteriorating (a patient can relapse if fluids are stopped too early).

---

## 7. Scoring rules (still a pure function of the event log)

New item kinds; the bedside score keeps its shape (credit / count, minus 15 per harmful item, 0 to 100; final score 60% consultation + 40% bedside).

| Item | Credit |
|---|---|
| Decision point (one per reassessment the student does) | Expected action from the table taken inside its window: 1; taken late: 0.5; a different action: 0; a harmful action: harmful item |
| Missed decision point | If the student never reassessed within the protocol's required interval: the missed item is "reassessment", not each possible action |
| Over-treatment | Fluids still running at a level above what the approved criteria call for, for longer than the clinician-set grace: item lost, with the overload shown in the debrief |
| Under-resuscitation | Shock persists, a bolus is allowed and not given within its window: missed |
| Bleeding branch | Transfusing when the haematocrit is rising or high: harmful. Not investigating or transfusing when it falls and he stays unstable: missed |
| Refractory branch | Escalation (ICU/other causes/inotropes consideration) after the allowed boluses fail: credit; continuing boluses beyond the allowed number: refused and not counted |

Parity: scoring reads only student events and derived state from the fold; the server replay regenerates every derived event (completions, alerts, transitions) exactly as today. A test replays each scenario on both sides and compares the full score object and `PatientState.snapshot()`.

---

## 8. Plan data (all optional; absent means today's behaviour)

```
plan.dynamics   { weight_kg, baseline, leak_course[], bleed_course[], retention, mappings[], bands{}, alarms[] }
plan.protocol   { source, conflicts_resolved[{id, chosen, reviewer, date, page}], ladder[], bolus{}, decision_table[], improvement_criteria, recovery_hold_minutes, grace_minutes, approved: boolean }
plan.variants   [{ id, overrides }]   (e.g. "leak only", "leak with occult bleed"; chosen by a recorded seed)
treatment.fluid { kind, levels[], per_bolus_max_ml, bag_ml? }
```

- `protocol.approved` is false until a clinician signs; a plan with `dynamics` and an unapproved protocol is held back by an automatic release blocker (`protocol_unapproved`), in addition to existing blockers.
- Variants are chosen deterministically from the attempt id at the start and recorded as `VARIANT_SELECTED` so the server replays the same patient. (This is new; it is what makes "suspected bleeding" playable without a second case.)
- Everything is compiled by the same checker (`checkLivePlan`); new rules: every mapping monotonic, ladder levels ordered, every decision-table branch reachable, every action in the table exists on the tray.

---

## 9. Clinical time

Three clocks, kept separate:

| Clock | Meaning |
|---|---|
| Encounter clock (seconds) | The student's session, as today (25 min plan limit). |
| Clinical clock (minutes/hours) | What happens to the patient. Integration runs on this. |
| `time_scale` | Ratio while the student is live at the bedside (existing). |

Design: the encounter has two modes, both on the same event log.
1. **Bedside mode** (as today, minute-level, real time with `time_scale`): resuscitation, first boluses, first reassessment.
2. **Ward mode** (new): the student advances clinical time in steps ("review in 30 minutes", "review in 1 hour", "go to next scheduled reassessment") using an extension of `TIME_SKIPPED` that carries **clinical** minutes. The engine integrates the whole step, applies protocol timing (a 60-minute infusion finishes inside one step), and **stops at the first nurse alert**, exactly as `skipTime` does today. The server replays `TIME_SKIPPED` with the same minutes.

So an hour-long infusion is one step in ward mode, and a multi-hour ladder is a handful of steps. The real-time `time_limit_minutes` stays the budget for bedside play; the clinical horizon (for example 24 to 48 hours of patient time) is a separate plan field and the encounter ends when the student submits or the horizon is reached.

Event ordering at the same timestamp (fixed, tested): (1) integration up to t, (2) due rules (leak phase, alarms), (3) the student's event, (4) rules due because of it, (5) alarms that this made true. Ties between rules keep authored order (as today). `INFUSION_COMPLETED` is stamped at the exact minute the volume is delivered, before a student event at the same minute.

Nurse alerts: alarms come from thresholds on the **derived** variables (for example pulse pressure, urine, saturation). One alert per crossing; an alert ends a wait; a wait that began after a crossing does not alert again for the same crossing.

Replay and performance: the server keeps only student events plus `TIME_SKIPPED` and `VARIANT_SELECTED`; it regenerates the rest. Integration is incremental with periodic checkpoints so a 48-hour encounter does not re-integrate from zero on each snapshot. Budget (to be measured): a full replay of a 48 h scenario well under the time of the existing score call.

---

## 10. Dengue as the first implementation and validation case

Nothing here is coded until sections 3 and 14 are answered.

Scenario matrix (each is a deterministic test on the real plan, with browser/server parity and a play-test in the browser pane):

| # | Scenario | What it proves |
|---|---|---|
| D1 | Compensated shock, correct first fluid, reassess, step down along the approved ladder, stop at leak resolution | Rate-controlled infusion, remaining volume, ladder compliance, criteria-based recovery |
| D2 | Untreated: compensated to hypotensive to profound shock | Leak course and observables from `V` |
| D3 | Late: first fluid after hypotension; bolus rather than the slow rate | Bolus path, cap per bolus, reassessment gating |
| D4 | Rescue: boluses with reassessment between, up to the allowed number | Repeat doses with the protocol timing; criteria-based recovery |
| D5 | Persistent leakage: haematocrit still high after the first fluid, second bolus | Findings-driven action; no fixed BP end point |
| D6 | Suspected bleeding variant: haematocrit falls while unstable; blood, not more crystalloid | Variants; bleeding branch both ways (blood when rising is harmful) |
| D7 | Refractory shock: non-response to the allowed boluses; escalation | Refractory branch; boluses beyond the limit refused |
| D8 | Correct reduction versus continued fluids after the leak resolves: overload, alert, harm, scoring | Harm from running on; stopping; clinical-time steps |
| D9 | Free-flowing 2 L, platelets, NSAID, steroid (existing harmful set) | Existing harmful scoring still works |

Also asserted in every scenario: an untouched plan (no `dynamics`) compiles and plays exactly as before.

---

## 11. Backward compatibility and safety

- **Absent fields mean no change.** `PatientState`, `compileLivePlan`, `scoreBedside`, `replayStudentEvents` take the existing path when `dynamics` is absent. The new event types are added to `sanitizeEvents` as an allowlist; an old server that sees one drops it (the existing behaviour for unknown events), so deploy the server before any client that can send them.
- **Golden files** (`lib/simulation/__tests__/golden/`) must be byte-identical after every stage. The compiled engine hash for every existing plan must not change. These are stage gates, not afterthoughts.
- **No plan changes status.** Every case plan stays `proposed`; every release blocker is preserved at every stage and in deployment. The dengue blockers (`clinical_review`, `infusion_model_limitation`, `dengue_ncvbdc_figures`) are cleared only by the named clinician review, never by code. A new automatic blocker (`protocol_unapproved`) holds any plan whose protocol record is not approved.
- **Dev/test mode writes the real database** (CLAUDE.md): each browser test snapshots first, runs `test-users.mjs clean` afterwards, and verifies attempt counts return to the baseline.
- **No schema change** is needed for the engine itself (plans live inside `case_json`). If a protocol approval record needs its own table later, that is a SQL script the user runs, with the project named.

---

## 12. Migration in stages (each stage ends green, golden unchanged, nothing switched on)

| Stage | Content | Risk | Independent value |
|---|---|---|---|
| S0 | This specification and the clinical decisions (sections 3 and 14) | none | Unblocks everything |
| S1 | Derived `pulse_pressure` condition parameter; `REASSESSED` event with structured findings; tests | low | Fixes the "BP end point already met" problem for every case |
| S2 | Rate-controlled infusion entity, events, remaining volume, tray UI, replay; effect still from a clinician-approved per-level table (no hidden model yet) | medium | DKA and septic shock fluids can show rate and stop |
| S3 | Hidden variables, mappings, overload and bleeding, variants | high | The full dengue patient |
| S4 | Decision table, scoring, ward mode (clinical-time `TIME_SKIPPED`), criteria-based recovery | high | Reassessment-driven teaching |
| S5 | Dengue port and validation (section 10), then browser play-tests, then a review of DKA and septic shock against the same engine | medium | The point of the work |

Each stage is its own branch and pull request. No stage starts before the previous one is merged and the suite is green.

---

## 13. Test plan

1. **Unit:** integrator exactness and integer rounding; determinism (same log twice gives the same snapshot); same-timestamp ordering invariance; remaining volume; ladder legality; bolus cap; derived events cannot come from a client.
2. **Property tests:** random action sequences produce identical `PatientState.snapshot()` and identical scores in the browser path and the server replay.
3. **Compatibility:** all existing plans: compiled hash unchanged, golden playthroughs unchanged, whole suite unchanged.
4. **Dengue matrix** D1 to D9 as above, on the real plan.
5. **Checker rules:** monotonic mappings, reachable branches, tray actions exist, unapproved protocol blocks serving.
6. **Time:** wait stops at an alert; a 60-minute infusion inside one ward step; replay of `TIME_SKIPPED` with clinical minutes; 48-hour replay time budget.
7. **Browser (Edge via DevTools protocol, pane is hidden):** premature and correct actions, refusal display, reassessment findings display, rate change, stop, overload alert, debrief; database counts before and after; clean-up.

---

## 14. Unresolved clinical questions (owner: the responsible clinician)

CQ1 to CQ12 are C1 to C12 in section 3. In addition:

- CQ13. Retention: what fraction of an infused crystalloid stays intravascular in dengue plasma leak, and how does it change as the leak ends? (physiology adviser)
- CQ14. The leak course: onset, peak and end in clinical hours, and how it differs between a compensated and a hypotensive presentation.
- CQ15. The improvement criteria: which parameters, which thresholds, how many must hold, for how long (C10).
- CQ16. Overload: which findings and at what extravascular load; what the diuretic rules are in this patient.
- CQ17. The bleeding variant: bleed rate, how the haematocrit and perfusion behave, how long the student has.
- CQ18. Weight: 65 kg is the case author's number; confirm.
- CQ19. Platelet transfusion: is it harmful here (platelets 18,000, minor gum bleeding, INR 1.3, aPTT 41, shock)? The guideline's own statement allows platelets and FFP below 50,000 with deranged PT/APTT in severe bleeding or instability.
- CQ20. Paracetamol: 10 mg/kg per dose (650 mg) at most 6-hourly, adult maximum 4 g/day, versus the plan's earlier 500 mg to 1 g.
- CQ21. Clinical-time compression: how many clinical minutes or hours each ward step may skip, and which events may never be skipped.

Until CQ1 to CQ12 and CQ13 to CQ17 are approved, the protocol record stays unapproved and no executable fluid logic is written.

---

## 15. Explicitly not part of this proposal

- No change to any saved plan, blocker or status.
- No new case conversion (PE, ulcer bleed or others) until the engine decision is made.
- No new SQL.
- No claim that dengue is ready for publication, now or after the engine work: a clinician still reviews the plan, the protocol and play-tests it.
