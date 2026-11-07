import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { diagnosisMatches, diagnosisTokens, isSlipOf } from "../diagnosisMatch";
import { keywordCovers } from "../historyCoverage";

const CASES_DIR = path.join(process.cwd(), "data", "cases");

function jsonFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return jsonFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
    });
}

/** Adds a doubled letter inside the longest disease word: a realistic one-keystroke slip. */
function oneLetterSlip(phrase: string): string | null {
    const words = [...phrase.matchAll(/[a-z]{7,}/gi)];
    const word = words.sort((a, b) => b[0].length - a[0].length)[0];
    if (!word || word.index === undefined) return null;
    const at = Math.floor(word[0].length / 2);
    const slipped = `${word[0].slice(0, at)}${word[0][at]}${word[0].slice(at)}`;
    return `${phrase.slice(0, word.index)}${slipped}${phrase.slice(word.index + word[0].length)}`;
}

const cases = jsonFiles(CASES_DIR)
    .map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8")) }))
    .filter(({ data }) => Array.isArray(data.evaluation_config?.diagnosis?.accepted_primary));

describe("diagnosis words across the library", () => {
    // Every word any case uses to name a diagnosis (its accepted wordings, the final diagnosis, its tags). If two of
    // them are a slip apart, a student writing one would be marked correct for the other. List one of them in
    // DISTINCT_CLINICAL_WORDS (engine/evaluation/diagnosisMatch.ts) when they are different things.
    const words = new Set<string>();
    for (const { data } of cases) {
        const texts: string[] = [
            ...data.evaluation_config.diagnosis.accepted_primary,
            data.patient?.final_diagnosis ?? "",
            ...(Array.isArray(data.tags) ? data.tags.map(String) : []),
        ];
        for (const t of texts) for (const w of diagnosisTokens(t)) if (w.length >= 5 && !/\d/.test(w)) words.add(w);
    }

    it("has no two different words a slip apart", () => {
        const list = [...words].sort();
        const close: string[] = [];
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const [a, b] = [list[i], list[j]];
                if (a === b || sameWord(a, b)) continue;
                if (isSlipOf(a, b) || isSlipOf(b, a)) close.push(`${a} / ${b}`);
            }
        }
        assert.deepEqual(close, [], `words a slip apart (add the real ones to DISTINCT_CLINICAL_WORDS): ${close.join(", ")}`);
    });
});

/** Spellings of one word that the library uses side by side, so matching them is right. */
function sameWord(a: string, b: string): boolean {
    const pairs = new Set(SAME_WORD_PAIRS.map(([x, y]) => [x, y].sort().join("|")));
    return pairs.has([a, b].sort().join("|"));
}
const SAME_WORD_PAIRS: Array<[string, string]> = [
    ["complicating", "complication"], ["demyelinating", "demyelination"], ["guillain", "guillian"],
    ["hemorrhage", "hemorrhagic"], ["hypertension", "hypertensive"], ["pneumococcal", "pneumococcus"],
    ["scabie", "scabiei"], ["streptococcal", "streptococcus"], ["thoracic", "thoracis"], ["calculi", "calculus"],
];

describe("case-by-case diagnosis calibration", () => {
    for (const { file, data } of cases) {
        it(`${data.id ?? path.basename(file)} accepts every authored diagnosis and a clear one-letter slip`, () => {
            const accepted: string[] = data.evaluation_config.diagnosis.accepted_primary;
            assert.ok(accepted.length > 0, "the case has at least one authored correct diagnosis");

            for (const wording of accepted) {
                assert.equal(diagnosisMatches(wording, accepted, []), true, `authored wording should match: ${wording}`);
                const slipped = oneLetterSlip(wording);
                if (slipped) {
                    assert.equal(diagnosisMatches(slipped, accepted, []), true, `single typo should match: ${slipped}`);
                }
            }
        });

        it(`${data.id ?? path.basename(file)} history matcher accepts each authored requirement and a clear one-letter slip`, () => {
            const required: string[] = data.evaluation_config.history.required_questions ?? [];
            for (const wording of required) {
                assert.equal(keywordCovers(wording, wording), true, `authored history wording should match: ${wording}`);
                const slipped = oneLetterSlip(wording);
                if (slipped) {
                    assert.equal(keywordCovers(wording, slipped), true, `single typo should match: ${slipped}`);
                }
            }
        });
    }
});
