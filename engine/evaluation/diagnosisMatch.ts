// Whether a student's diagnosis counts as correct. An answer is correct if it matches one of the case's accepted
// wordings, or if it contains every keyword. The keywords are a second way in, not a requirement: most accepted
// wordings ("TIA", "Hypertension") do not contain them. The case checker (lib/studio/validate.ts) uses the same rule.
//
// Wordings are compared without case, punctuation or extra spaces, and with British and American spellings made
// the same ("haemorrhage" and "hemorrhage", "oedema" and "edema"), because students type "Hypertension." or
// "pre-eclampsia" as often as the case writer's exact form.

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
    const s = normaliseDiagnosis(student);
    if (!s) return false;
    if (accepted.some((dx) => acceptedWordingMatches(s, normaliseDiagnosis(dx)))) return true;
    return keywordsMatch(student, keywords);
}

/** Exact authored wording, or one obvious single-character typo in one long word. */
function acceptedWordingMatches(student: string, accepted: string): boolean {
    if (student === accepted) return true;
    const studentWords = student.split(" ");
    const acceptedWords = accepted.split(" ");
    if (studentWords.length !== acceptedWords.length) return false;

    let typoCount = 0;
    for (let i = 0; i < studentWords.length; i++) {
        if (studentWords[i] === acceptedWords[i]) continue;
        if (++typoCount > 1 || !oneCharacterTypo(studentWords[i], acceptedWords[i])) return false;
    }
    return typoCount === 1;
}

function oneCharacterTypo(a: string, b: string): boolean {
    // Keep fuzzy matching conservative: short words can become a different valid word (cancer/canker).
    if (Math.min(a.length, b.length) < 7 || Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
        const differences = [...a].flatMap((char, index) => char === b[index] ? [] : [index]);
        if (
            differences.length === 2 &&
            differences[1] === differences[0] + 1 &&
            a[differences[0]] === b[differences[1]] &&
            a[differences[1]] === b[differences[0]]
        ) return true;
    }
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) === 1;
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
