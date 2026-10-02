// Checks a case the converter drafted (lib/studio/convert.ts) before it is saved: the shape the app needs, every
// test the scoring names actually existing, nothing in the library-facing text naming the diagnosis, and no
// identifier from the student's case sheet surviving. Pure, so it is tested (lib/studio/__tests__). Problems are
// "errors" (the draft would break or spoil something; the converter asks the model to fix them) or "warnings"
// (worth a human look during the game check).

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

export interface CheckContext {
  /** Test ids the app can order besides the case's own (the master catalog). */
  catalogIds: ReadonlySet<string>;
  /** From the case sheet: the patient's name and case number must not appear anywhere (an error); their address
   *  should not (a warning, since a town name can turn up innocently). */
  identifiers: { names: readonly string[]; places: readonly string[] };
}

type Json = Record<string, any>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const EXPRESSIONS = ["calm", "tired", "anxious", "pain", "distress", "breathless", "drowsy", "irritable", "photophobic"];

// Words that say what the disease is, taken from the accepted diagnoses (not generic words like "acute").
const GENERIC = new Set([
  "acute", "chronic", "left", "right", "sided", "with", "without", "and", "the", "of", "in", "non", "primary",
  "secondary", "syndrome", "disease", "disorder", "uncomplicated", "complicated", "bilateral", "unilateral",
  "severe", "mild", "moderate", "stage", "type", "grade",
]);

export function diagnosisWords(accepted: readonly string[]): string[] {
  const words = new Set<string>();
  for (const dx of accepted) {
    for (const w of dx.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 5 && !GENERIC.has(w)) words.add(w);
    }
  }
  return [...words];
}

function mentions(text: string, words: readonly string[]): string[] {
  const t = text.toLowerCase();
  return words.filter((w) => new RegExp(`\\b${w}`).test(t));
}

export function checkDraft(c: unknown, ctx: CheckContext): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(c)) return { errors: ["The draft is not a JSON object."], warnings };

  // ── Library-facing fields
  for (const k of ["title", "category", "displayTitle", "displayDescription", "patient_text_brief", "walkthrough"]) {
    if (!isStr(c[k])) errors.push(`${k} is missing.`);
  }
  if (!DIFFICULTIES.includes(c.difficulty)) errors.push(`difficulty must be one of ${DIFFICULTIES.join(", ")}.`);
  if (typeof c.estimatedTime !== "number" || c.estimatedTime < 5 || c.estimatedTime > 60) errors.push("estimatedTime must be a number of minutes (5–60).");
  if (!strArr(c.tags)) errors.push("tags must be a list of strings.");
  if (!strArr(c.displayTags)) errors.push("displayTags must be a list of strings.");

  // ── Patient
  const p = c.patient;
  if (!isObj(p)) errors.push("patient is missing.");
  else {
    if (!isStr(p.name)) errors.push("patient.name is missing.");
    if (typeof p.age !== "number") errors.push("patient.age must be a number.");
    if (!["Male", "Female"].includes(p.gender)) errors.push('patient.gender must be "Male" or "Female".');
    if (!isStr(p.chiefComplaint)) errors.push("patient.chiefComplaint is missing.");
    if (typeof p.vitalSigns?.heartRate?.value !== "number") errors.push("patient.vitalSigns.heartRate.value must be a number (the bedside monitor needs it).");
    if (!Array.isArray(p.allergies)) errors.push("patient.allergies must be a list.");
    if (!Array.isArray(p.currentMedications)) errors.push("patient.currentMedications must be a list.");
  }

  // ── The AI patient
  if (!isObj(c.patient_facts) || Object.keys(c.patient_facts).length < 3) errors.push("patient_facts is missing or nearly empty.");
  else {
    // The bedside's Examine tab offers one manoeuvre per "<system>_examination" section (legacy-adapter.ts).
    const exams = Object.keys(c.patient_facts).filter((k) => /_examination$/.test(k));
    if (exams.length === 0) errors.push('patient_facts has no "<system>_examination" sections: the student would have nothing to examine.');
    else if (exams.length < 3) warnings.push(`Only ${exams.length} examination section${exams.length === 1 ? "" : "s"} (${exams.join(", ")}): check the case sheet's systemic examination made it in.`);
  }
  if (c.appearance !== undefined) {
    const a = c.appearance;
    const level = (x: unknown) => x === undefined || [0, 1, 2, 3].includes(x as number);
    if (!isObj(a) || !["pallor", "jaundice", "cyanosis", "sweating", "sunken_eyes"].every((k) => level(a[k]))) errors.push("appearance levels must be 0, 1, 2 or 3.");
    else if (a.expression !== undefined && !EXPRESSIONS.includes(a.expression)) errors.push(`appearance.expression must be one of ${EXPRESSIONS.join(", ")}.`);
    else if (a.swelling !== undefined && !["neck_right", "neck_left", "neck_front"].includes(a.swelling)) errors.push("appearance.swelling must be neck_right, neck_left or neck_front.");
  }
  const role = c.ai_role;
  if (!isObj(role) || !isStr(role.first_person_description) || typeof role.can_speak_for_self !== "boolean" || !strArr(role.key_constraints)) {
    errors.push("ai_role needs first_person_description, can_speak_for_self (true/false) and key_constraints.");
  }
  if (!Array.isArray(c.ai_examples) || c.ai_examples.length < 3 || !c.ai_examples.every((e: unknown) => isObj(e) && isStr(e.doctor) && isStr(e.patient))) {
    errors.push("ai_examples needs at least 3 { doctor, patient } exchanges.");
  }

  // ── Tests
  const testIds = new Set<string>();
  if (!Array.isArray(c.tests) || c.tests.length === 0) errors.push("tests[] is empty: there is nothing with a result to order.");
  else {
    for (const [i, t] of c.tests.entries()) {
      if (!isObj(t) || !isStr(t.id) || !isStr(t.name)) {
        errors.push(`tests[${i}] needs an id and a name.`);
        continue;
      }
      if (testIds.has(t.id)) errors.push(`tests has "${t.id}" twice.`);
      testIds.add(t.id);
      if (!isObj(t.result) || !isStr(t.result.summary) || !Array.isArray(t.result.values) || !isStr(t.result.interpretation)) {
        errors.push(`tests "${t.id}" needs result.summary, result.values[] and result.interpretation.`);
      }
      if (isObj(t.result) && !["case_sheet", "ai", "reviewer"].includes(t.result.origin)) {
        warnings.push(`tests "${t.id}" does not say where its values came from (result.origin "case_sheet" or "ai").`);
      } else if (isObj(t.result) && t.result.origin === "ai" && !isStr(t.result.basis)) {
        warnings.push(`tests "${t.id}" was added by the AI but gives no basis for its values.`);
      }
      if (!ctx.catalogIds.has(t.id) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t.id)) {
        warnings.push(`tests "${t.id}" is neither a catalog id nor a hyphenated custom id.`);
      }
    }
  }

  // ── Scoring
  const ev = c.evaluation_config;
  let accepted: string[] = [];
  if (!isObj(ev)) errors.push("evaluation_config is missing.");
  else {
    const h = ev.history;
    if (!isObj(h) || !strArr(h.required_questions) || h.required_questions.length < 4 || !strArr(h.red_flag_questions)) {
      errors.push("evaluation_config.history needs required_questions (at least 4) and red_flag_questions.");
    }
    const t = ev.testing;
    if (!isObj(t)) errors.push("evaluation_config.testing is missing.");
    else {
      for (const k of ["core_tests", "optional_tests", "distractor_tests", "dangerous_tests"]) {
        if (!strArr(t[k])) {
          errors.push(`evaluation_config.testing.${k} must be a list of test ids.`);
          continue;
        }
        for (const id of t[k] as string[]) {
          if (!testIds.has(id) && !ctx.catalogIds.has(id)) errors.push(`evaluation_config.testing.${k} names "${id}", which is neither in tests[] nor in the catalog.`);
        }
      }
      if (strArr(t.core_tests)) {
        if (t.core_tests.length === 0) warnings.push("No core tests: ordering nothing would not cost marks.");
        for (const id of t.core_tests) if (!testIds.has(id)) errors.push(`Core test "${id}" has no result in tests[].`);
      }
      if (strArr(t.distractor_tests) && t.distractor_tests.length < 3) warnings.push("Fewer than 3 distractor tests: over-ordering will barely cost anything.");
    }
    const d = ev.diagnosis;
    if (!isObj(d) || !strArr(d.accepted_primary) || d.accepted_primary.length === 0) errors.push("evaluation_config.diagnosis.accepted_primary is empty.");
    else accepted = d.accepted_primary;
    const m = ev.management;
    if (!isObj(m) || !strArr(m.core_steps) || m.core_steps.length === 0 || !strArr(m.dangerous_steps)) {
      errors.push("evaluation_config.management needs core_steps (at least one) and dangerous_steps.");
    }
    if (!Array.isArray(ev.red_flags) || !ev.red_flags.every((r: unknown) => isObj(r) && isStr(r.intent) && strArr(r.keywords) && typeof r.critical === "boolean")) {
      errors.push("evaluation_config.red_flags must be a list of { intent, keywords[], present_in_case, critical }.");
    }
  }

  // ── Teaching
  if (!isObj(c.discussion) || !strArr(c.discussion.keyPoints) || c.discussion.keyPoints.length < 3) errors.push("discussion.keyPoints needs at least 3 points.");

  // ── Nothing in what the library shows gives the diagnosis away
  const giveaway = diagnosisWords(accepted);
  for (const k of ["displayTitle", "displayDescription"]) {
    if (isStr(c[k])) {
      const hit = mentions(c[k], giveaway);
      if (hit.length) errors.push(`${k} gives the diagnosis away (${hit.join(", ")}): describe the patient, not the disease.`);
    }
  }
  if (strArr(c.displayTags)) {
    const hit = mentions(c.displayTags.join(" "), giveaway);
    if (hit.length) errors.push(`displayTags give the diagnosis away (${hit.join(", ")}).`);
  }

  // ── No identifier from the student's case sheet anywhere
  const all = JSON.stringify(c).toLowerCase();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = (needle: string) => new RegExp(`\\b${escape(needle)}\\b`).test(all);
  for (const id of ctx.identifiers.names) {
    const needle = id.trim().toLowerCase();
    if (needle.length >= 3 && found(needle)) errors.push(`The draft contains "${id}" from the case sheet (the patient's name or case number): invent a new name.`);
  }
  for (const place of ctx.identifiers.places) {
    for (const word of place.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5)) {
      if (found(word)) warnings.push(`The draft mentions "${word}", part of the address on the case sheet: check it is not the patient's real village or street.`);
    }
  }

  return { errors, warnings };
}

/**
 * Two personal details, settled the same way every time instead of trusting the model. Religion: one the sheet did
 * not give is removed (it is not needed to play the case, and should not be made up). State: the sheet's own state
 * is used when it gives one; otherwise the state is the model's choice (the sheet's place is withheld for privacy)
 * and is always listed for the reviewer, because where a patient lives can matter to the diagnosis.
 * Changes `c` in place; returns the notes to add.
 */
export function settleIdentity(
  c: unknown,
  sheet: { religion?: string | null; state?: string | null },
  reviewNotes: readonly string[]
): string[] {
  const identity = isObj(c) && isObj(c.patient_facts) && isObj(c.patient_facts.identity) ? c.patient_facts.identity : null;
  if (!identity) return [];
  if (!sheet.religion?.trim()) delete identity.religion;

  const sheetState = sheet.state?.trim();
  if (sheetState) {
    identity.location = sheetState;
    return [];
  }

  const location = typeof identity.location === "string" ? identity.location.trim() : "";
  if (!location) return [];
  const listed = reviewNotes.some((n) => n.toLowerCase().includes(location.toLowerCase()));
  return listed ? [] : [`State '${location}' chosen by the AI: the case sheet's place is withheld for privacy. Check it is a region where this condition is seen.`];
}
