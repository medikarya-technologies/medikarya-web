import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { diagnosisMatches } from "../diagnosisMatch";
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
