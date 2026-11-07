// Whether a student's diagnosis counts as correct without the examiner (it decides when it is up, see
// EvaluationEngine.ts; an answer this file accepts is never marked below correct). An answer is correct if it says
// the same as one of the case's accepted wordings, or if it contains every keyword. The keywords are a second way
// in, not a requirement: most accepted wordings ("TIA", "Hypertension") do not contain them. The case checker
// (lib/studio/validate.ts) uses the same rule.
//
// "Says the same" is read word by word, the way a teacher marks a written answer:
// - case, punctuation, spaces, hyphens and British or American spelling do not matter ("Hypertension.",
//   "pre-eclampsia" and "preeclampsia", "haemorrhage" and "hemorrhage", "generalised" and "generalized");
// - the usual abbreviations mean their words ("HTN", "STEMI", "T2DM", "type II"), and a plural is the singular;
// - a slip of the keyboard is forgiven ("fevir", "migrane", "gastroentritis", "apendisitis"), unless the word the
//   student wrote is itself a different clinical word ("afebrile", "nephritic", "arteritis", "hypo-" for "hyper-");
// - extra words are allowed only when they cannot change the diagnosis ("high fever", "probable", "likely",
//   "dengue fever" for "dengue"); any other extra word ("complex", "chronic", "non", "secondary", a second disease)
//   leaves it to the examiner.

import { normaliseObviousClinicalTypos } from "../clinical-typos";

/** The examiner's diagnosis mark (of 15) from which the answer counts as correct: right, even if a little vague. */
export const DIAGNOSIS_CORRECT_FROM = 12;

export function normaliseDiagnosis(text: string): string {
    return normaliseObviousClinicalTypos(text)
        .toLowerCase()
        .replace(/ae|oe/g, "e")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function keywordsMatch(text: string, keywords: readonly string[]): boolean {
    const t = normaliseDiagnosis(text);
    const kws = keywords.map(normaliseDiagnosis).filter(Boolean);
    return kws.length > 0 && kws.every((kw) => t.includes(kw));
}

export function diagnosisMatches(student: string, accepted: readonly string[], keywords: readonly string[]): boolean {
    const s = diagnosisTokens(student);
    if (s.length === 0) return false;
    if (accepted.some((dx) => tokensMatch(s, diagnosisTokens(dx)))) return true;
    return keywordsMatch(student, keywords) && !changesTheDiagnosis(s, accepted);
}

// ── Words

/** Words that carry no diagnosis: an accepted wording may drop them and a student may add them. */
const FUNCTION_WORDS: ReadonlySet<string> = new Set(["a", "an", "the", "of", "with", "in", "on", "at", "and"]);

/** Words a student may add that cannot turn one diagnosis into another ("high fever", "probable appendicitis"). */
const HARMLESS_EXTRAS: ReadonlySet<string> = new Set([
    ...FUNCTION_WORDS,
    "likely", "most", "probable", "probably", "possible", "possibly", "suspected", "suspect", "query", "provisional",
    "presumed", "presumptive", "working", "diagnosis", "dx", "impression", "clinical", "clinically", "case", "is",
    "has", "patient", "high", "grade", "wall", "fever",
]);

/** Abbreviations a student types for a whole diagnosis, read as their words. Only unambiguous ones ("PE" and "MS" are not). */
const ABBREVIATIONS: Readonly<Record<string, string>> = {
    htn: "hypertension",
    dm: "diabetes mellitus",
    t1dm: "type 1 diabetes mellitus",
    t2dm: "type 2 diabetes mellitus",
    mi: "myocardial infarction",
    stemi: "st elevation myocardial infarction",
    nstemi: "non st elevation myocardial infarction",
    awmi: "anterior wall myocardial infarction",
    iwmi: "inferior wall myocardial infarction",
    acs: "acute coronary syndrome",
    ihd: "ischemic heart disease",
    cad: "coronary artery disease",
    rhd: "rheumatic heart disease",
    ccf: "congestive cardiac failure",
    chf: "congestive heart failure",
    lvf: "left ventricular failure",
    af: "atrial fibrillation",
    chb: "complete heart block",
    dvt: "deep vein thrombosis",
    tia: "transient ischemic attack",
    cva: "cerebrovascular accident",
    ich: "intracerebral hemorrhage",
    sah: "subarachnoid hemorrhage",
    uti: "urinary tract infection",
    aki: "acute kidney injury",
    ckd: "chronic kidney disease",
    adpkd: "autosomal dominant polycystic kidney disease",
    bph: "benign prostatic hyperplasia",
    aur: "acute urinary retention",
    copd: "chronic obstructive pulmonary disease",
    ards: "acute respiratory distress syndrome",
    osa: "obstructive sleep apnea",
    cap: "community acquired pneumonia",
    tb: "tuberculosis",
    ptb: "pulmonary tuberculosis",
    dka: "diabetic ketoacidosis",
    hhs: "hyperosmolar hyperglycemic state",
    ida: "iron deficiency anemia",
    pph: "postpartum hemorrhage",
    aom: "acute otitis media",
    csom: "chronic suppurative otitis media",
    gerd: "gastroesophageal reflux disease",
    ugib: "upper gastrointestinal bleed",
    ibs: "irritable bowel syndrome",
    sle: "systemic lupus erythematosus",
    oa: "osteoarthritis",
    sjs: "stevens johnson syndrome",
    dss: "dengue shock syndrome",
    dhf: "dengue hemorrhagic fever",
    mdd: "major depressive disorder",
    gad: "generalized anxiety disorder",
    pid: "pelvic inflammatory disease",
    pcos: "polycystic ovary syndrome",
    nof: "neck of femur",
};

/** Ordinals and the Roman numerals of "type II", "grade III", "category III" are read as digits. */
const NUMBER_WORDS: Readonly<Record<string, string>> = { first: "1", "1st": "1", second: "2", "2nd": "2", third: "3", "3rd": "3", fourth: "4", "4th": "4" };
const ROMAN: Readonly<Record<string, string>> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };
const NUMBERED = new Set(["type", "grade", "stage", "category", "class", "degree", "cn", "nerve"]);

/** A prefix written apart ("pre eclampsia", "post partum", "non toxic") is joined to its word. */
const JOINED_PREFIXES = new Set(["pre", "post", "non", "anti", "sub", "peri", "intra", "extra", "hyper", "hypo", "gastro", "broncho", "osteo", "neuro"]);

/** The diagnosis as canonical words: abbreviations spelled out, numbers as digits, singular, prefixes joined. */
export function diagnosisTokens(text: string): string[] {
    const words = normaliseDiagnosis(text)
        .split(" ")
        .filter(Boolean)
        .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(" "))
        // "type2" and "category3" are "type 2" and "category 3"; an expanded abbreviation has no digits stuck to it
        .flatMap((w) => w.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z]{3,})/g, "$1 $2").split(" "))
        // British and American spellings that the "ae"/"oe" rule above does not cover
        .map((w) => w.replace(/ised$/, "ized").replace(/isation$/, "ization").replace(/our$/, "or").replace(/^sulph/, "sulf"));
    const out: string[] = [];
    for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (NUMBER_WORDS[w]) w = NUMBER_WORDS[w];
        // "ii" to "iv" are numerals wherever they stand; "i" and "v" only after "type", "grade" and the like
        else if (ROMAN[w] && (w.length > 1 || (i > 0 && NUMBERED.has(words[i - 1])))) w = ROMAN[w];
        if (JOINED_PREFIXES.has(w) && i + 1 < words.length && /^[a-z]/.test(words[i + 1])) {
            words[i + 1] = w + words[i + 1];
            continue;
        }
        out.push(singular(w));
    }
    return out;
}

function singular(w: string): string {
    if (w.length > 4 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
}

/** Every word of the accepted wording is in the student's answer (exactly, or with a slip), and nothing else but harmless extras. */
function tokensMatch(student: readonly string[], accepted: readonly string[]): boolean {
    const need = accepted.filter((t) => !FUNCTION_WORDS.has(t));
    if (need.length === 0) return false;
    // one word or two: "breastmilk jaundice" and "breast milk jaundice"
    if (student.filter((t) => !FUNCTION_WORDS.has(t)).join("") === need.join("")) return true;
    const used = student.map(() => false);
    const take = (test: (s: string) => boolean): boolean => {
        const i = student.findIndex((s, k) => !used[k] && test(s));
        if (i < 0) return false;
        used[i] = true;
        return true;
    };
    const slipped: string[] = [];
    for (const t of need) if (!take((s) => s === t)) slipped.push(t);
    for (const t of slipped) if (!take((s) => isSlipOf(s, t))) return false;
    return student.every((s, k) => used[k] || HARMLESS_EXTRAS.has(s));
}

// ── Spelling slips

/**
 * Real clinical words one or two letters from another real one. A student who writes one of these meant it, so it is
 * never read as a slip for its neighbour. engine/evaluation/__tests__/case-calibration.test.ts fails when two words
 * of the library's diagnoses are this close and neither is listed here.
 */
export const DISTINCT_CLINICAL_WORDS: ReadonlySet<string> = new Set(
    [
        "nephritic", "nephrotic", "arthritis", "arteritis", "dysphagia", "dysphasia", "aphagia", "aphasia", "rubella",
        "rubeola", "ileus", "ileum", "ilium", "empyema", "emphysema", "osteoporosis", "osteopetrosis", "cancer", "canker",
        "mastitis", "mastoiditis", "myositis", "myelitis", "laryngitis", "pharyngitis", "uveitis", "uvulitis", "mania",
        "manic", "colic", "colitis", "ureteric", "ureteral", "urethral", "urethritis", "ureteritis", "stable",
        "unstable", "typical", "atypical", "septic", "aseptic", "febrile", "afebrile", "toxic", "basal", "nasal",
        "focal", "faecal", "local", "viral", "vital", "renal", "rectal", "media", "medial", "tonic", "ptosis",
        "proptosis", "ascites", "ascitic", "anuria", "dysuria", "mycosis", "miosis", "psychosis", "cholera", "chorea",
        "ileitis", "iritis", "otitis", "ostitis", "osteitis", "angina", "vagina", "hernia", "hernial", "ankle", "angle",
        "peptic", "night", "right", "stage", "state", "stoke", "stroke", "thrombolysis", "thrombosis", "tropical",
        "topical", "tuberculoid", "hesselbach", "kiesselbach", "nephropathy", "neuropathy", "injection", "infection", "stone", "tuberculosis", "shingles", "single", "amoxicillin",
        "ampicillin", "status", "typhus", "typhi", "venous", "venom",
    ].map((w) => diagnosisTokens(w)[0]),
);

/** Prefixes that turn a word into its opposite or its neighbour: "hyperkalaemia" and "hypokalaemia" are not one slip apart. */
const OPPOSITE_PREFIXES: ReadonlyArray<readonly string[]> = [
    ["hyper", "hypo"], ["macro", "micro"], ["intra", "extra", "inter"], ["endo", "exo"], ["pre", "post", "ante"],
    ["uni", "bi"], ["mono", "poly"], ["brady", "tachy"], ["hemi", "para", "quadri"],
];

/** Endings that name a different kind of disease: "keratitis" and "keratosis" are not one slip apart. */
const SUFFIXES = ["itis", "osis", "oma", "emia", "uria", "algia", "pathy", "plasia", "trophy", "penia", "cytosis", "ectasis", "itic", "otic", "ic", "al"];

function suffixOf(w: string): string | null {
    return SUFFIXES.find((s) => w.length > s.length + 2 && w.endsWith(s)) ?? null;
}

/** Whether the student's word is a slip for the accepted word (not a different word). */
export function isSlipOf(student: string, accepted: string): boolean {
    if (student === accepted) return true;
    if (/\d/.test(student) || /\d/.test(accepted)) return false;
    // short words are too easily another word ("gout", "left"); long ones forgive two slips ("apendisitis")
    const allowed = accepted.length >= 11 ? 2 : accepted.length >= 5 ? 1 : 0;
    if (allowed === 0 || student.length < 4) return false;
    if (DISTINCT_CLINICAL_WORDS.has(student)) return false;
    // opposite prefixes ("hyper"/"hypo", "intra"/"extracapsular"); "a-", "de-", "non-", "un-" in front negate
    for (const pair of OPPOSITE_PREFIXES) {
        const s = pair.find((p) => student.startsWith(p));
        const a = pair.find((p) => accepted.startsWith(p));
        if ((s || a) && s !== a) return false;
    }
    for (const neg of ["a", "an", "de", "non", "un", "in", "dys"]) {
        if (student === neg + accepted || accepted === neg + student) return false;
    }
    const ss = suffixOf(student);
    const as = suffixOf(accepted);
    if (ss && as && ss !== as && !(ss.endsWith(as) || as.endsWith(ss))) return false;
    // a slip that ends in "s" ("otits") lost that "s" as a plural; so did a word such as "diabetes"
    const forms = accepted.length >= 6 ? [[student, accepted], [student + "s", accepted], [student, accepted + "s"]] : [[student, accepted]];
    return forms.some(
        ([a, b]) => editDistance(a, b, allowed) <= allowed,
    );
}

/** Letters added, dropped, changed or swapped with a neighbour (optimal string alignment), stopping past `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2: number[] = [];
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
            row.push(d);
            best = Math.min(best, d);
        }
        if (best > max) return max + 1;
        prev2 = prev;
        prev = row;
    }
    return prev[b.length];
}

// ── Keywords

/**
 * Words that make a different diagnosis of the same disease: the keyword "dengue" is in "severe dengue with shock",
 * "foot ulcer" is in "DKA from an infected foot ulcer". The keyword route refuses an answer with one of these unless
 * an accepted wording of this case uses it too.
 */
const CHANGES_THE_DIAGNOSIS: ReadonlySet<string> = new Set(
    [
        "severe", "shock", "septic", "sepsis", "complicated", "complicating", "complication", "chronic", "recurrent",
        "secondary", "metastatic", "metastasis", "ketoacidosis", "empyema", "abscess", "perforated", "perforation",
        "gangrene", "gangrenous", "malignant", "carcinoma", "cancer", "tumour", "non", "without", "complex", "atypical",
        "refractory", "resistant", "toxic", "failure", "crisis", "coma", "encephalopathy", "haemorrhagic", "neuropathy",
        "infected", "infection", "injury", "leakage", "warning", "status", "obstructed", "obstructive", "strangulated",
        "delirium", "confusional", "secondaries", "obliterans", "congenital", "neonatal", "drug", "induced",
        "catatonic", "postpsychotic", "hebephrenic", "schizoaffective", "schizophreniform", "mastoiditis", "effusion",
        "externa", "ophthalmicus", "disseminated",
    ].map((w) => diagnosisTokens(w)[0]),
);

function changesTheDiagnosis(student: readonly string[], accepted: readonly string[]): boolean {
    const used = new Set(accepted.flatMap(diagnosisTokens));
    return student.some((w) => CHANGES_THE_DIAGNOSIS.has(w) && !used.has(w));
}


// A keyword that on its own also fits other diseases lets a wrong answer score as correct: "kidney" accepts
// "chronic kidney disease" for an acute kidney injury, "thyroid" accepts "hyperthyroidism". The checker refuses a
// case whose only keyword is one of these; it needs the word that tells this disease apart.
export const BROAD_KEYWORDS: ReadonlySet<string> = new Set(
    [
        "kidney", "renal", "liver", "hepatic", "heart", "cardiac", "lung", "chest", "brain", "foot", "thyroid", "alcohol",
        "diabetes", "diabet", "fracture", "hypotension", "hypertension", "hypertens", "retention", "block", "complete",
        "infection", "stroke", "isch", "ischaemia", "ischemia", "inferior", "anterior", "anaemia", "anemia", "cancer",
        "carcinoma", "tumour", "tumor", "failure", "injury", "fever", "pain", "ulcer", "bleed", "bleeding", "shock",
        "sepsis", "postpartum", "acute", "chronic", "primary", "secondary", "syndrome", "disease", "deficiency",
    ].map(normaliseDiagnosis),
);

export function broadKeyword(keywords: readonly string[]): string | null {
    const kws = keywords.map(normaliseDiagnosis).filter(Boolean);
    return kws.length === 1 && BROAD_KEYWORDS.has(kws[0]) ? kws[0] : null;
}
