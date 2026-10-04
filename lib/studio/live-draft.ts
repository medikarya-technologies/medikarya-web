import "server-only";

import { caseModelJson } from "@/lib/ai/case-model";
import { INTERVENTIONS } from "@/lib/simulation/intervention-catalog";
import { checkLivePlan, normaliseLivePlan, type LivePlan, type LivePlanCheck, type LiveVitals } from "@/lib/simulation/live-plan";

// Drafts a LIVE PLAN for an ordinary case (lib/simulation/live-plan.ts): what happens to this patient, minute by
// minute, if nothing is done; what is on the tray and what each thing does; what stops the deterioration; where the
// patient settles. The model writes the plan in a clinician's terms and nothing else: the engine's rules are made
// from it by code (compileLivePlan), and the plan is checked here (checkLivePlan) and sent back once if the check
// finds problems. A drafted plan is a PROPOSAL: students do not meet it until a senior clinician has signed it off
// and an admin has switched it on (app/admin/live).
//
// Not every case can honestly be a live one. A patient with a goitre does not crash in twenty minutes, and the model
// is told to say so instead of inventing an emergency.

export type LiveDraft =
  | { ok: true; plan: LivePlan; check: LivePlanCheck }
  | { ok: false; reason: "not_suitable"; why: string }
  | { ok: false; reason: "invalid"; problems: string[] };

const TRAY_LIST = INTERVENTIONS.map((i) => `${i.id} = ${i.label} (${i.detail})`).join("\n");

const RULES = `You are helping a medical education team in India turn a clinical case into a LIVE simulation: the
student meets the patient at the bedside, a clock runs, and the patient gets worse until the right things are done.
You write the LIVE PLAN for the case you are given. A senior clinician will check every number before any student
sees it, so be conservative, standard and explicit about what your numbers rest on.

First decide whether this case can honestly be a live one. It can if, in the setting where this patient presents,
the condition has an acute course that plays out over minutes to an hour or two and is changed by bedside treatment
(shock, sepsis, severe dehydration, acute severe asthma, anaphylaxis, DKA, status epilepticus, an arrhythmia with
compromise, an acute coronary syndrome, eclampsia, severe malaria with complications, hypoglycaemia...). It cannot if
the condition is chronic or stable and nothing a student does in twenty minutes changes it (a goitre, iron or B12
deficiency worked up in outpatients, a chronic kidney condition, a headache syndrome). If it cannot, output ONLY
{"not_suitable": "<one or two sentences saying why>"} and nothing else. Never invent a complication the case does
not support in order to make it dramatic.

If it can, output ONLY a JSON object {"plan": {...}} with exactly these fields:

summary: one or two sentences: what happens to THIS patient if nothing is done.
setting: where the encounter happens, e.g. "Emergency department, resuscitation bay".
critical_window_minutes: by when the decisive treatment should have been given (the student sees this as the window).
time_limit_minutes: when the encounter ends (15 to 30).
arrival: { consciousness, stability, vitals }. consciousness is one of alert, anxious, drowsy, altered, unresponsive.
  stability is one of stable, unstable, critical. vitals: give ONLY the vitals listed under "NOT RECORDED ON ARRIVAL"
  in the case; the rest are taken from the case and must not be repeated.
stages: 3 to 5 steps of the UNTREATED course, in order. Each: { id, name, at_minutes, vitals, rhythm?, consciousness?,
  stability?, nurse_says }. vitals are the values ON THE MONITOR at that point if nothing has been done: any of hr,
  sbp, dbp, spo2, rr, temp (give sbp and dbp together). Leave out a vital that has not changed. at_minutes must
  increase, the first not before 3, the last before time_limit_minutes. The last step should be the dangerous end of
  the untreated course for this condition (stability "critical", or "arrest" only if that is truly where it leads in
  this time). rhythm (only if it changes) is one of sinus_normal, sinus_tachycardia, sinus_bradycardia, afib, flutter,
  complete_heart_block, pvc_occasional, pvc_frequent, pvc_bigeminy, vt_sustained, vf. nurse_says: one or two plain
  sentences the nurse says to the student when it happens; you may use {hr} {bp} {spo2} {rr} for the monitor's numbers.
treatments: 6 to 10 things the student can give or do, each { id, label, detail, group, role, within_minutes?, effect?,
  consciousness?, rhythm?, says, why }.
  - id: use an id from the SHARED TRAY below whenever one fits exactly (then label, detail and group are ignored and
    taken from the tray). Otherwise make your own id in lower_snake_case and give label, detail (the dose, route and
    rate, as given in standard Indian practice; weight-based for a child, with the weight you assumed) and group (one
    of airway, circulation, medications, cardiac_procedures, other).
  - role: "essential" (must be given; give within_minutes), "supportive" (reasonable, not required), or "harmful"
    (makes THIS patient worse). Include at least two that are not essential, and at least one harmful treatment that a
    student might plausibly reach for, so the tray does not give the answer away.
  - effect: what it does to the monitor as CHANGES, e.g. { "sbp": 10, "dbp": 6, "hr": -12 }. A change, never a target.
    Leave it out if the monitor does not move. A harmful treatment has an effect in the harmful direction.
  - says: one or two sentences the student sees when they give it (what happens, not a lecture).
  - why: one sentence for the debrief: why it is essential, or why it harms this patient.
stabilised_by: the ids of the essential treatments that, once ALL have been given, stop the deterioration.
recovery: { after_minutes, vitals, consciousness, rhythm?, nurse_says }: where the patient settles after_minutes (2 to
  8) after the last of those treatments. vitals must give hr, sbp, dbp, spo2 and rr.
basis: 4 to 8 short lines saying what the plan rests on: the usual course of this condition untreated, the guideline
  or standard textbook teaching behind each essential treatment and its timing, the weight you assumed for a child,
  and anything you were unsure of. This is what the clinician checks first.

Rules
- Everything must fit THIS patient: their age, weight, sex, vitals on arrival, examination and diagnosis. Vitals must
  be plausible for the age (a toddler's heart rate and blood pressure are not an adult's).
- Do not contradict the case: its diagnosis, findings and management are given. Its management.core_steps are where
  the essential treatments come from; its dangerous_steps are where the harmful ones come from.
- Use treatments and doses that are standard in India. If you are not sure of a dose, say so in basis.
- No drug or procedure that needs a setting the case does not have.

SHARED TRAY (id = label (detail)):
${TRAY_LIST}`;

// Gemini by default, Claude with CASE_AI=claude (lib/ai/case-model.ts). The plan is checked by code afterwards.
const generate = (prompt: string): Promise<any> => caseModelJson(RULES, prompt, { maxTokens: 16384, temperature: 0.2 });

/** What the model needs of the case: who the patient is, what they have, and how it is managed. Not the AI patient's script. */
function caseFor(caseJson: Record<string, any>, measured: LiveVitals): string {
  const notRecorded = (["hr", "sbp", "dbp", "spo2", "rr", "temp"] as const).filter((k) => measured[k] === undefined);
  return JSON.stringify(
    {
      diagnosis: caseJson.title,
      specialty: caseJson.category,
      difficulty: caseJson.difficulty,
      patient: {
        age: caseJson.patient?.age,
        sex: caseJson.patient?.gender,
        presenting_complaint: caseJson.patient?.chiefComplaint,
        medications: caseJson.patient?.currentMedications,
        allergies: caseJson.patient?.allergies,
      },
      VITALS_ON_ARRIVAL: measured,
      NOT_RECORDED_ON_ARRIVAL: notRecorded,
      history_and_examination: caseJson.patient_facts,
      investigations: (Array.isArray(caseJson.tests) ? caseJson.tests : []).map((t: any) => ({ name: t.name, summary: t.result?.summary, interpretation: t.result?.interpretation })),
      accepted_diagnoses: caseJson.evaluation_config?.diagnosis?.accepted_primary,
      management: caseJson.evaluation_config?.management,
      teaching_points: caseJson.discussion?.keyPoints,
    },
    null,
    1
  );
}

/**
 * Drafts a plan for this case, or (with `revise`) changes an existing plan as a clinician or the admin asked,
 * leaving the rest as it was. `measured` is what the case records on arrival (measuredOnArrival).
 */
export async function draftLivePlan(
  caseJson: Record<string, any>,
  measured: LiveVitals,
  revise?: { previous: LivePlan; comments: string }
): Promise<LiveDraft> {
  const theCase = caseFor(caseJson, measured);
  const { sign_off: _s, status: _st, origin: _o, drafted_at: _d, version: _v, ...previous } = revise?.previous ?? ({} as LivePlan);

  let out = await generate(
    revise
      ? `A senior clinician read this live plan and asked for changes. Make exactly the changes asked for and keep everything ` +
          `else as it is. Add a line to basis for each change ("Changed on the reviewer's advice: ...").\n\n` +
          `CHANGES ASKED FOR:\n${revise.comments}\n\nCASE:\n${theCase}\n\nCURRENT PLAN:\n${JSON.stringify(previous)}`
      : `CASE:\n${theCase}`
  );

  if (typeof out?.not_suitable === "string" && out.not_suitable.trim() && !revise) {
    return { ok: false, reason: "not_suitable", why: out.not_suitable.trim().slice(0, 600) };
  }

  let plan = normaliseLivePlan(out?.plan, "ai");
  let check = checkLivePlan(plan, measured);

  // One chance to fix what the check found.
  if (check.errors.length > 0) {
    out = await generate(
      `This live plan has problems. Return the corrected {"plan": {...}}, changing only what is needed.\n\n` +
        `PROBLEMS:\n- ${check.errors.join("\n- ")}\n\nCASE:\n${theCase}\n\nPLAN:\n${JSON.stringify(out?.plan ?? {})}`
    );
    plan = normaliseLivePlan(out?.plan, "ai");
    check = checkLivePlan(plan, measured);
  }
  if (check.errors.length > 0) return { ok: false, reason: "invalid", problems: check.errors };

  return { ok: true, plan: { ...plan, drafted_at: new Date().toISOString() }, check };
}
