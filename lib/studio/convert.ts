import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { CLINICAL_CATALOG, CATALOG_TEST_IDS } from "@/lib/clinical-catalog";
import type { StudioCase } from "./source";
import { checkDraft, type CheckResult } from "./validate";
import example from "./example-case.json";

// Turns a studio case sheet (history, examination, diagnosis, investigations: what a student presents on the ward)
// into a playable MediKarya case: the AI patient's script, results for the tests, the scoring, a spoiler-free
// library title and the teaching. The facts come from the case sheet; whatever the sheet does not have (usually
// the actual test values) the model proposes and must list in review_notes, so the game check knows what to
// verify. The draft is checked (lib/studio/validate.ts) and, if the check finds problems, sent back once to be
// fixed. Nothing here publishes: the result is saved as a draft (app/admin/studio/actions.ts).

const MODEL = "gemini-3.8-flash";

export interface Conversion {
  caseJson: Record<string, any>;
  reviewNotes: string[];
  check: CheckResult;
}

const CATALOG_LIST = CLINICAL_CATALOG.map((t) => `${t.id} = ${t.name}`).join("\n");

const RULES = `You convert a medical student's clinical case sheet (written in an Indian teaching hospital) into a
MediKarya simulation case: a patient a student interviews through an AI, examines, orders tests for, and diagnoses,
and is then scored. Output ONLY a JSON object {"case": {...}, "review_notes": [...]} shaped exactly like the example.

Facts
- History, examination findings, diagnosis and management come from the case sheet. Never contradict it and never
  add symptoms, signs or history it does not contain; if a fact is missing, the patient says they don't know.
- Where the case needs something the sheet does not give (test result values, SpO2, a missing vital), work out a
  value from what the sheet does document (pulse, BP, pallor, icterus, the examination, the diagnosis) so the case
  stays consistent, and add one line per proposal to review_notes ("CBC values proposed: not in the case sheet.").
  Every invented clinical detail must be in review_notes.

Where each value came from (a clinical reviewer reads this instead of playing the case)
- Every test result has "origin": "case_sheet" if its values are written in the sheet, "ai" if you proposed them.
  An "ai" result also has "basis": one short line naming the documented findings it follows from ("Hb 9.2 g/dL: the
  sheet documents conjunctival pallor and a pulse of 104/min").
- Every vital sign in patient.vitalSigns has "origin" the same way (a vital the sheet records is "case_sheet").

Identity and privacy
- The sheet's patient name and address have been replaced with "the patient" and "[place]". Invent a new, ordinary
  Indian name that fits the age, sex and region, and never use a real village, street or hospital: a state is fine.
- No hospital names, doctor names or dates.

Tests
- Give a full result (summary, values with parameter/value/unit/referenceRange, interpretation, criticalFindings) for
  every test the sheet mentions and every core test.
- Use an id from the CATALOG below whenever one fits (e.g. "tsh", "cbc", "usg_neck_thyroid", "fnac"). Only when
  nothing in the catalog fits (e.g. a specific biopsy), use a hyphenated custom id like "trucut-biopsy-breast".
- category is "Laboratory", "Imaging" or "Special". "origin" and, for "ai", "basis" go inside result.

Scoring (evaluation_config)
- history.required_questions: 8–12 short phrases a good student must ask; red_flag_questions: the dangerous misses.
- testing: core_tests = what confirms the diagnosis (each must be in tests[]); optional_tests = reasonable extras;
  distractor_tests = 5–10 catalog ids that are low-value here; dangerous_tests = 1–4 catalog ids that are invasive or
  unsafe without indication. Every id must be in tests[] or the catalog.
- diagnosis.accepted_primary: 3–5 wordings of the diagnosis; must_include_keywords: 1–3 words.
- management.core_steps (3–6) and dangerous_steps (1–4), fitting Indian practice.
- red_flags: {intent, keywords[], present_in_case, critical}.

What the library shows
- displayTitle: "<age>-year-old <man|woman|boy|girl> with <presenting complaint in plain words>". displayDescription:
  one or two sentences of presentation. displayTags: [specialty slug, symptom slug]. NONE of these may name or hint
  at the diagnosis, the organ disease or the investigation findings.
- title: the diagnosis (only admins see it). category: the specialty given. difficulty: Beginner, Intermediate or
  Advanced as given unless clearly wrong (then say why in review_notes). estimatedTime: 15–25.

Examination and appearance
- patient_facts must hold the examination as separate sections, one per system the sheet examined, each named
  "<system>_examination": general_physical_examination, local_examination (inspection, palpation, percussion,
  auscultation, special tests), respiratory_examination, cardiovascular_examination, abdominal_examination,
  neurological_examination (and others the sheet has). The student examines each one separately, so keep every
  finding the sheet gives, positive and negative.
- appearance: how the patient looks on arrival, from the general examination: pallor, jaundice, cyanosis,
  sweating, sunken_eyes (each 0 none, 1 slight, 2 obvious, 3 marked), expression (one of calm, tired, anxious,
  pain, distress, breathless, drowsy, irritable, photophobic), swelling only for a visible neck swelling
  (neck_right, neck_left or neck_front), and note: one plain sentence of what you see.

The AI patient
- patient_text_brief: first person, plain words. patient_facts: structured facts from the sheet. ai_role: speaker
  "patient" (or a parent/relative for a young child, with can_speak_for_self false), simple English with the odd
  Hindi word, a tone that fits, key_constraints (answer only what is asked, no jargon, no diagnosis names).
  ai_examples: 4–6 exchanges in that voice.

Teaching
- discussion.keyPoints: 6–8 points; walkthrough: markdown "### Expert Walkthrough: ..." covering history,
  examination, investigations, diagnosis and management; questions: 1–2 single-best-answer MCQs like the example.

CATALOG (id = name):
${CATALOG_LIST}`;

function sheetFor(sc: StudioCase): string {
  return JSON.stringify(
    {
      title_given_by_student: sc.title,
      specialty: sc.specialty,
      difficulty: sc.difficulty,
      patient: { age: sc.patient.age, sex: sc.patient.sex, occupation: sc.patient.occupation, religion: sc.patient.religion },
      ...sc.sections,
    },
    null,
    1
  );
}

function parseJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

async function generate(prompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL,
    systemInstruction: RULES,
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", maxOutputTokens: 32768 },
  });
  const result = await model.generateContent(prompt);
  return parseJson(result.response.text());
}

const catalogIds = new Set(CATALOG_TEST_IDS);

/**
 * revise: rebuild an existing draft with a clinical reviewer's comments, changing only what they asked for (so what
 * they did not question stays as they read it), instead of converting from scratch.
 */
export async function convertStudioCase(
  sc: StudioCase,
  revise?: { previous: { case: unknown; review_notes: string[] }; comments: string }
): Promise<Conversion> {
  const ctx = { catalogIds, identifiers: sc.identifiers };

  let out = await generate(
    revise
      ? `A clinical reviewer read this case and asked for changes. Make exactly the changes they ask for, keep everything ` +
          `else as it is, and keep "origin", "basis" and review_notes true for anything you change (a value the reviewer ` +
          `gave you has origin "reviewer").\n\nREVIEWER'S COMMENTS:\n${revise.comments}\n\n` +
          `CASE SHEET:\n${sheetFor(sc)}\n\nCURRENT CASE:\n${JSON.stringify(revise.previous)}`
      : `EXAMPLE (a different case, converted well):\n${JSON.stringify(example)}\n\nCASE SHEET TO CONVERT:\n${sheetFor(sc)}`
  );
  let check = checkDraft(out?.case, ctx);

  // One chance to fix what the check found.
  if (check.errors.length > 0) {
    out = await generate(
      `This conversion has problems. Return the corrected {"case", "review_notes"} JSON, changing only what is needed.\n\n` +
        `PROBLEMS:\n- ${check.errors.join("\n- ")}\n\nCASE SHEET:\n${sheetFor(sc)}\n\nCONVERSION:\n${JSON.stringify(out)}`
    );
    check = checkDraft(out?.case, ctx);
  }

  const reviewNotes = Array.isArray(out?.review_notes) ? out.review_notes.filter((n: unknown) => typeof n === "string") : [];
  return { caseJson: out?.case ?? {}, reviewNotes, check };
}

/** A URL id from the library title (which names the patient, not the disease), unique against `taken`. */
export function caseIdFor(displayTitle: string, taken: ReadonlySet<string>): string {
  const base =
    displayTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "studio-case";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}
