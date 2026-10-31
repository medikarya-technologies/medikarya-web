// =========================
// lib/simulation/live-plan-guide.ts
// =========================
// What the AI drafter (lib/studio/live-draft.ts) is told about a live plan's optional fields: repeat doses, state,
// infusions, prerequisites, reassessment, and how the recovery follows the course (late, after harm). Kept here, beside the plan's own types and pure, so a test can hold it
// to the engine: every field it names exists, and its worked example passes the site's own check.

/** The optional fields, by the name a plan uses. The test checks each is described in the guide. */
export const ADVANCED_FIELDS = [
    "max_doses",
    "min_interval_minutes",
    "effect_per_dose",
    "says_per_dose",
    "doses_required",
    "repeat_within_minutes",
    "repeat_only_while",
    "not_indicated_says",
    "responses",
    "available_when",
    "required_when",
    "infusion",
    "requires",
    "reassess_before_repeat",
    "findings",
    "end_points",
    "stabilised_by_while",
    "or_stabilised_by",
    "reassessment",
    "after_stage",
    "lasting",
] as const;

export const ADVANCED_FIELDS_GUIDE = `OPTIONAL FIELDS. Use one only when this patient's course needs it, and say in basis what each number rests on.
A clinician checks every threshold. Never invent a threshold, a dose or an interval: if no guideline gives one, leave
the field out and say so in basis.

Conditions (used by several fields below) are JSON, in these forms only:
  {"vital": "sbp", "below": 90}       vital is one of hr, sbp, dbp, map, pp, spo2, rr, temp (pp is the
                                      pulse pressure: sbp minus dbp); comparators below (<), above (>),
                                      at_most (<=), at_least (>=)
  {"finding": "<finding id>", "is": true}
  {"stage_reached": "<stage id>"}
  {"given": "<treatment id>", "doses": 2}             doses is optional (at least that many valid doses)
  {"minutes_since_given": "<treatment id>", "dose": 2, "at_least": 5}
  {"stabilised": false}
  {"all": [...]}, {"any": [...]}, {"not": {...}}

Plan fields:
- findings: [{ id, label, present }]: clinical findings tracked explicitly (for example "still fitting", "chest wet"),
  so a decision can rest on them. Stages, responses and recovery can set them: "findings": {"<id>": false}.
- end_points: a condition that must also hold before the patient counts as stabilised on any path (for example
  oxygenation and blood pressure). Needed when an infusion is part of what stabilises the patient.
- stabilised_by_while: a condition; the usual stabilised_by path works only while it holds. Needs or_stabilised_by.
- or_stabilised_by: [{ name, treatments, when? }]: other complete sets of essential treatments that also stop the
  deterioration, such as a rescue path for a patient who has become refractory.
- reassessment: { label, detail, checks: [{ when, says, otherwise? }] }: a bedside reassessment on the tray that
  reports explicit findings (each check's says when its condition holds, else otherwise). Optional report:
  { vitals: [..], consciousness: true, findings: [<finding ids>] } also records those readings each time it is done;
  the engine reads them from the patient, so never write a reading into the plan.
- recovery.after_stage: [{ stage, vitals, after_minutes?, consciousness?, rhythm?, nurse_says? }]: where a patient
  stabilised only after reaching that step of the untreated course settles instead (the furthest step reached
  applies; its vitals override the usual recovery's). Without it the engine derives one from the plan's own steps (part
  of the way back toward the worst step reached, slower), for steps past the time care on time could have stopped it.
  A late patient may settle at unsafe readings: that is a real consequence, and the debrief says so.

Treatment fields:
- max_doses (2 to 10), min_interval_minutes, doses_required (essential only), repeat_within_minutes: a treatment given
  more than once. A dose before the interval is refused and does not count.
- effect_per_dose, says_per_dose: what each dose does and says, in order (the last entry repeats).
- repeat_only_while: a condition; a further dose is given, and required, only while it holds (for example only while
  still fitting, or while an end point is unmet). not_indicated_says: what the student is told when it does not.
- reassess_before_repeat: true when a further dose needs a reassessment since the dose before it (needs reassessment).
- responses: [{ dose?, when?, effect?, says, findings? }]: what it does in a particular state; the first that applies
  replaces the usual effect and says.
- available_when: a condition; the treatment is on the tray only once it has held.
- required_when: a condition; an essential treatment is required only once it has held, and within_minutes counts from
  then. Needs available_when. Never in stabilised_by; put it in an or_stabilised_by path.
- infusion: { over_minutes, while? }: the effect arrives spread over over_minutes, only while the condition holds.
  Its total and duration are fixed: the student cannot stop it, step it down or change its rate, and running it on
  does no harm. Do not use it for fluid that has to be adjusted by response and stopped on reassessment (dengue,
  DKA, septic shock fluids); say in basis that the case needs that and cannot be represented yet.
- requires: [{ when, says }]: what must be true before it can be given, in order, for example IV access for an IV drug
  ({"given": "iv_access"}, says "there is no IV access yet.") or a required sequence of treatments.
- lasting (harmful only): what of its effect is still there after the recovery, as changes on top of it, when it was
  given before then (a sedative's slowed breathing). {} says it wears off (a short-acting drug). Without it half of the
  harm's effect stays.`;

/**
 * A plan that uses every optional field the way the guide describes. It is a format example only (an imaginary
 * patient, numbers chosen to exercise the engine, not clinical advice) and is never given to students.
 */
export const ADVANCED_EXAMPLE = {
    summary: "Format example only: an imaginary patient whose blood pressure falls until the right treatments are given.",
    critical_window_minutes: 5,
    time_limit_minutes: 20,
    findings: [{ id: "cold_peripheries", label: "Cold hands and feet", present: true }],
    stages: [
        { id: "worse", name: "Worse", at_minutes: 6, vitals: { hr: 164, sbp: 80, dbp: 50 }, nurse_says: "Doctor, he is getting worse. Pulse {hr}." },
        { id: "much_worse", name: "Much worse", at_minutes: 12, vitals: { hr: 178, sbp: 62, dbp: 38 }, stability: "critical", nurse_says: "I can barely feel his pulse. BP {bp}." },
    ],
    treatments: [
        { id: "iv_access", role: "essential", within_minutes: 5, says: "A cannula is in." },
        {
            id: "drug_a", label: "Drug A", detail: "Format example dose", group: "medications", role: "essential", within_minutes: 5,
            effect: { sbp: 4, dbp: 2 }, says: "Drug A is given.", requires: [{ when: { given: "iv_access" }, says: "there is no IV access yet." }],
            max_doses: 3, min_interval_minutes: 5, doses_required: 2, repeat_within_minutes: 10,
            effect_per_dose: [{ sbp: 4, dbp: 2 }, { sbp: 6, dbp: 4 }], says_per_dose: ["The first dose of drug A is given.", "A further dose of drug A is given."],
            repeat_only_while: { vital: "sbp", below: 90 }, not_indicated_says: "the blood pressure is already above 90.", reassess_before_repeat: true,
            responses: [{ dose: 2, when: { finding: "cold_peripheries", is: true }, effect: { sbp: 6, dbp: 4 }, says: "A further dose of drug A is given; his hands start to warm.", findings: { cold_peripheries: false } }],
        },
        {
            id: "infusion_b", label: "Infusion B", detail: "Format example infusion", group: "circulation", role: "essential", within_minutes: 4,
            effect: { sbp: 20, dbp: 12, hr: -10 }, says: "Infusion B is running.", infusion: { over_minutes: 6, while: { vital: "sbp", below: 100 } },
            requires: [{ when: { given: "iv_access" }, says: "there is no IV access yet." }],
            available_when: { stage_reached: "much_worse" }, required_when: { stage_reached: "much_worse" },
        },
        { id: "continuous_monitoring", role: "supportive", says: "He is on the monitor." },
        { id: "furosemide_iv", role: "harmful", effect: { sbp: -10, dbp: -6, hr: 8 }, lasting: { sbp: -4, dbp: -2 }, says: "His pressure falls further.", why: "Format example harm." },
    ],
    stabilised_by: ["iv_access", "drug_a"],
    stabilised_by_while: { not: { stage_reached: "much_worse" } },
    or_stabilised_by: [{ name: "Rescue: infusion B", treatments: ["iv_access", "drug_a", "infusion_b"] }],
    end_points: { vital: "sbp", at_least: 85 },
    reassessment: {
        label: "Reassess: circulation",
        detail: "Pulse, BP, capillary refill",
        checks: [
            { when: { vital: "sbp", below: 90 }, says: "BP is still low.", otherwise: "BP is above 90." },
            { when: { finding: "cold_peripheries", is: true }, says: "Hands and feet are cold." },
        ],
        report: { vitals: ["sbp", "dbp", "pp"], findings: ["cold_peripheries"] },
    },
    recovery: {
        after_minutes: 4,
        vitals: { hr: 126, sbp: 94, dbp: 58, spo2: 99, rr: 30 },
        consciousness: "alert",
        nurse_says: "He is settling. Pulse {hr}, BP {bp}.",
        findings: { cold_peripheries: false },
        after_stage: [{ stage: "much_worse", vitals: { hr: 134, sbp: 92, dbp: 56 }, after_minutes: 6, nurse_says: "He is settling, more slowly. Pulse {hr}, BP {bp}." }],
    },
    basis: ["Format example only: not clinical advice."],
};
