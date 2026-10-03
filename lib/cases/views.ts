// What of a case goes to a student's browser, and when.
//
// A case's JSON holds its own answers: the diagnosis (its title), the scoring, the expert walkthrough, the quiz bank.
// Anything sent to the browser can be read there, so a student who has not finished the case gets the PLAY view (what
// the encounter needs to run, nothing that states the answer), and the DEBRIEF part arrives with their result once
// they have submitted. Someone who has completed the case before, and admins, get the whole thing.
//
// What the play view still contains, because the encounter runs in the browser: the examination findings, every
// test's result, and (in a live simulation) the rules that drive the patient. Those describe the patient, as ordering
// every test would; hiding them too means running the encounter on the server.

type Json = Record<string, any>;

/** Kept from the patient block: who they are and how they arrive. Not the diagnosis, plan or the script of their history. */
const PATIENT_AT_THE_BEDSIDE = ["name", "age", "gender", "mrn", "admissionDate", "chiefComplaint", "vitalSigns", "allergies", "currentMedications"] as const;

/** Top-level fields that state the answer, the scoring, or the AI patient's script. None is read by the encounter in the browser. */
const WITHHELD = [
  "tags",
  "description",
  "evaluation_config",
  "scoring_rubric",
  "questions",
  "discussion",
  "walkthrough",
  "reinforcement",
  "learning_objectives",
  "ai_examples",
  "patient_text_brief",
  "patient_facts",
  "source",
  // which treatments are essential, which harm, and why: the encounter runs on the rules made from it, not on it
  "live_plan",
] as const;

/** The case as the encounter needs it while it is being played. */
export function playView(caseData: Json): Json {
  const view: Json = { ...caseData };
  for (const key of WITHHELD) delete view[key];
  view.title = caseData.displayTitle ?? "Patient case"; // the real title is the diagnosis
  if (caseData.patient && typeof caseData.patient === "object") {
    view.patient = Object.fromEntries(PATIENT_AT_THE_BEDSIDE.filter((k) => k in caseData.patient).map((k) => [k, caseData.patient[k]]));
  }
  // who speaks for the patient is all the screen needs of the AI's role
  if (caseData.ai_role) view.ai_role = { speaker: caseData.ai_role.speaker, can_speak_for_self: caseData.ai_role.can_speak_for_self };
  view.playView = true;
  return view;
}

/** What the debrief shows that the play view withheld. Returned with a student's result (app/actions/evaluate.ts). */
export function debriefOf(caseData: Json): Json {
  return {
    title: caseData.title,
    discussion: caseData.discussion,
    walkthrough: caseData.walkthrough,
    reinforcement: caseData.reinforcement,
  };
}
