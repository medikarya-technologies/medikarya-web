import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    HISTORY_COVERAGE_MAX,
    HISTORY_MAX,
    HISTORY_QUALITY_MAX,
    contentTokens,
    historyReview,
    historyScoringMode,
    isCatchAll,
    keywordCovers,
    readAiCoverage,
    scoreHistory,
    topicIntents,
} from "../historyCoverage";

// The rule (EVALUATION_ENGINE.md, "History"): history = how much of what the case needs was asked (17.5) + how well
// (7.5). These tests pin the rule's invariants, so a change that breaks one fails here, not on students.

// ── Calibration set ─────────────────────────────────────────────────────────
// Three made-up cases (not library cases: the repo is public), each with a strong, a partial and a poor history
// written the way students really type (short questions, lay words, typos, several things in one message).

const CASES = {
    cough: {
        required: [
            "how long he has had the cough",
            "sputum and its colour",
            "blood in the sputum",
            "fever",
            "night sweats",
            "weight loss",
            "previous TB treatment",
            "contact with someone with TB",
            "HIV test",
            "diabetes",
            "smoking and alcohol",
            "who lives at home",
        ],
        strong: [
            "since when is the cough?",
            "any phlegm? what colour",
            "any blood when you cough?",
            "do you get fever, at what time",
            "do you sweat at night",
            "have you lost weight",
            "ever taken TB treatment before?",
            "anyone around you had TB?",
            "have you had an HIV test",
            "are you diabetic?",
            "do you smoke or drink alcohol",
            "who lives with you at home",
        ],
        partial: ["since when is the cough?", "any phlegm? what colour", "any blood when you cough?", "do you get fever", "have you lost weight", "do you smoke"],
        poor: ["what happened?", "since when is the cough?", "ok", "anything else?"],
    },
    diarrhoea: {
        required: [
            "how many days of loose stools",
            "how often he passes stool",
            "blood in the stool",
            "vomiting",
            "is the child drinking",
            "urine output",
            "fever",
            "food the child has eaten",
            "others at home with the same illness",
            "vaccination",
        ],
        strong: [
            "how many days has he had loose motions?",
            "how many times a day does he pass stool",
            "any blood in the stool",
            "is he vomitting?",
            "is he able to drink water",
            "is he passing urine normally",
            "any fever",
            "did he eat outside food",
            "anyone else at home sick like this",
            "are his vaccines up to date",
        ],
        partial: ["how many days has he had loose motions?", "any blood in the stool", "is he vomitting?", "any fever", "ok"],
        poor: ["what is the problem", "since when"],
    },
    headache: {
        required: [
            "when the headache started",
            "location of the headache",
            "visual disturbance",
            "nausea or vomiting",
            "weakness or numbness",
            "neck stiffness",
            "fever",
            "medicines taken",
            "previous similar headaches",
            "family history of headaches",
        ],
        strong: [
            "when did the headache start",
            "where exactly is the headache",
            "any problem with your vision?",
            "any nausea or vomiting",
            "any weakness or numbness in your arms or legs",
            "is your neck stiff",
            "any fever",
            "what medicines have you taken for it",
            "have you had similar headaches before",
            "does anyone in your family get headaches",
        ],
        partial: ["when did the headache start", "where exactly is the headache", "any problem with your vision?", "any fever", "anything else?"],
        poor: ["hello", "tell me more", "where exactly is the headache"],
    },
} as const;

const keywordsOnly = (required: readonly string[], questions: readonly string[], aiQuality?: unknown) =>
    scoreHistory({ required, questions, aiQuality });

describe("history calibration: the keyword fallback alone puts histories in the right band", () => {
    for (const [name, c] of Object.entries(CASES)) {
        it(`${name}: strong >= 20, partial 8-15, poor <= 6`, () => {
            const strong = keywordsOnly(c.required, c.strong);
            const partial = keywordsOnly(c.required, c.partial);
            const poor = keywordsOnly(c.required, c.poor);
            assert.ok(strong.total >= 20, `strong scored ${strong.total}; missed: ${historyReview(strong).missed.join(" | ")}`);
            assert.ok(partial.total >= 8 && partial.total <= 15, `partial scored ${partial.total}`);
            assert.ok(poor.total <= 6, `poor scored ${poor.total}`);
        });
    }
});

describe("history calibration: with the AI's answer", () => {
    it("a strong history the AI marks fully asked, with good quality, scores near the top", () => {
        const c = CASES.cough;
        const ai = c.required.map((_, i) => ({ item: i + 1, asked: true, message: i + 1 }));
        const h = scoreHistory({ required: c.required, questions: c.strong, aiCoverage: ai, aiQuality: 6.5 });
        assert.equal(h.coverageBy, "ai");
        assert.equal(h.total, 24);
    });

    it("the AI's judgement of meaning wins over a keyword match it rejects", () => {
        // "do you get fever" shares no word with "night sweats", but the AI also says sweats were not asked.
        const c = CASES.cough;
        const ai = c.required.map((_, i) => ({ item: i + 1, asked: i !== 4, message: i !== 4 ? i + 1 : null }));
        const h = scoreHistory({ required: c.required, questions: c.strong, aiCoverage: ai });
        assert.equal(h.items[4].covered, false);
        assert.equal(h.items[4].by, "ai");
    });
});

// ── Invariants ──────────────────────────────────────────────────────────────

function rng(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const ALL_QUESTIONS = Object.values(CASES).flatMap((c) => [...c.strong, ...c.partial, ...c.poor]);

describe("history invariants", () => {
    it("always within bounds: 0 <= coverage <= 17.5, 0 <= quality <= 7.5, total <= 25", () => {
        const r = rng(7);
        for (let n = 0; n < 300; n++) {
            const c = Object.values(CASES)[n % 3];
            const qs = ALL_QUESTIONS.filter(() => r() < 0.3);
            const aiQuality = [undefined, -3, 0, 4, 7.5, 40, "5", "x"][n % 8];
            const h = scoreHistory({ required: c.required, questions: qs, aiQuality });
            assert.ok(h.coverage >= 0 && h.coverage <= HISTORY_COVERAGE_MAX);
            assert.ok(h.quality >= 0 && h.quality <= HISTORY_QUALITY_MAX);
            assert.ok(h.total >= 0 && h.total <= HISTORY_MAX);
            assert.ok(Math.abs(h.total - (h.coverage + h.quality)) <= 0.11);
        }
    });

    it("asking one more question never lowers the score", () => {
        const r = rng(11);
        for (const c of Object.values(CASES)) {
            for (let n = 0; n < 60; n++) {
                const qs = ALL_QUESTIONS.filter(() => r() < 0.25);
                const extra = ALL_QUESTIONS[Math.floor(r() * ALL_QUESTIONS.length)];
                const before = keywordsOnly(c.required, qs, 5);
                const after = keywordsOnly(c.required, [...qs, extra], 5);
                assert.ok(after.total >= before.total, `"${extra}" lowered ${before.total} to ${after.total}`);
            }
        }
    });

    it("the same questions in another order score the same", () => {
        const r = rng(3);
        for (const c of Object.values(CASES)) {
            const shuffled = [...c.strong].sort(() => r() - 0.5);
            assert.equal(keywordsOnly(c.required, shuffled).total, keywordsOnly(c.required, c.strong).total);
        }
    });

    it("a short and a long way of asking the same thing count the same", () => {
        const pairs: Array<[string, string, string]> = [
            ["blood in the sputum", "blood in sputum?", "Have you noticed any blood when you cough up phlegm in the mornings?"],
            ["fever", "fever?", "Have you been having a fever, and if so at what time of the day does it usually come?"],
            ["diabetes", "diabetic?", "Has any doctor ever told you that you have diabetes or high sugar?"],
            ["vomiting", "vomitting?", "Has he been vomiting after feeds?"],
        ];
        for (const [req, short, long] of pairs) {
            assert.equal(keywordCovers(req, short), true, short);
            assert.equal(keywordCovers(req, long), true, long);
        }
    });

    it("more coverage never scores less, at any AI quality: there is no band that switches quality on or off", () => {
        const required = CASES.headache.required;
        for (const q of [0, 2.5, 5, 7.5]) {
            let last = -1;
            for (let k = 0; k <= required.length; k++) {
                const ai = required.map((_, i) => ({ item: i + 1, asked: i < k, message: i < k ? 1 : null }));
                const h = scoreHistory({ required, questions: ["when did the headache start"], aiCoverage: ai, aiQuality: q });
                assert.ok(h.total >= last, `quality ${q}: ${k} items scored ${h.total} after ${last}`);
                last = h.total;
            }
        }
    });

    it("quality cannot outrun coverage: a history covering a tenth of the case gets at most a tenth of the quality", () => {
        const required = CASES.headache.required;
        const ai = required.map((_, i) => ({ item: i + 1, asked: i === 0, message: i === 0 ? 1 : null }));
        const h = scoreHistory({ required, questions: ["when did the headache start"], aiCoverage: ai, aiQuality: 7.5 });
        assert.equal(h.quality, 0.8);
    });

    it("no AI judgement: quality is a modest estimate from coverage, never zero for a good history", () => {
        const h = keywordsOnly(CASES.diarrhoea.required, CASES.diarrhoea.strong);
        assert.equal(h.qualityBy, "estimate");
        assert.ok(h.quality > 4.5 && h.quality <= 5);
    });

    it("a case with no required questions has nothing to miss", () => {
        assert.equal(scoreHistory({ required: [], questions: [] }).coverage, HISTORY_COVERAGE_MAX);
    });
});

// ── The AI's answer is checked, not trusted ──────────────────────────────────

describe("reading the AI's coverage answer", () => {
    const questions = ["since when is the cough?", "anything else?", "any blood when you cough?"];

    it("accepts a citation of a real question", () => {
        assert.deepEqual(readAiCoverage([{ item: 1, asked: true, message: 1 }, { item: 2, asked: false, message: null }], 2, questions), [
            { state: "asked", message: 1 },
            { state: "not_asked" },
        ]);
    });

    it("rejects a message number that does not exist, and the item falls back to keywords", () => {
        const h = scoreHistory({
            required: ["how long the cough", "blood in sputum"],
            questions,
            aiCoverage: [{ item: 1, asked: true, message: 1 }, { item: 2, asked: true, message: 99 }],
        });
        assert.equal(h.items[1].by, "keywords");
        assert.equal(h.items[1].covered, true); // "any blood when you cough?" matches on its own words
        assert.equal(h.items[1].message, 3);
    });

    it("rejects a citation of a catch-all message", () => {
        const v = readAiCoverage([{ item: 1, asked: true, message: 2 }, { item: 2, asked: false }], 2, questions);
        assert.deepEqual(v?.[0], { state: "invalid" });
    });

    it("cannot give credit when the student asked nothing", () => {
        const h = scoreHistory({ required: ["fever", "cough"], questions: [], aiCoverage: [{ item: 1, asked: true, message: 1 }, { item: 2, asked: true, message: 1 }], aiQuality: 7.5 });
        assert.equal(h.total, 0);
    });

    it("distrusts the whole answer when more than half of it is unusable", () => {
        assert.equal(readAiCoverage([{ item: 1, asked: "yes" }, { item: 2, asked: true, message: 0 }, { item: 3, asked: false }], 3, questions), null);
        assert.equal(readAiCoverage("all asked", 3, questions), null);
        assert.equal(readAiCoverage(undefined, 3, questions), null);
    });

    it("takes only the first answer for an item", () => {
        const v = readAiCoverage([{ item: 1, asked: false }, { item: 1, asked: true, message: 1 }], 1, questions);
        assert.deepEqual(v, [{ state: "not_asked" }]);
    });
});

// ── Matching details that once went wrong ────────────────────────────────────

describe("keyword matching", () => {
    it("never finds a word inside another word ('ache' in 'headache')", () => {
        assert.equal(topicIntents("any headache?").has("abdominal_pain"), false);
        assert.equal(topicIntents("any tummy ache or belly pain?").has("abdominal_pain"), true);
    });

    it("knows a catch-all from a real question", () => {
        for (const q of ["anything else?", "any other symptoms?", "tell me more", "ok", "go on", "..."]) assert.equal(isCatchAll(q), true, q);
        for (const q of ["any other illness, like diabetes?", "TB?", "HIV test?", "How long has this been going on?", "since when?"]) assert.equal(isCatchAll(q), false, q);
    });

    it("lets British and American spellings and small typos meet", () => {
        assert.deepEqual(contentTokens("diarrhoea oedema"), contentTokens("diarrhea edema"));
        assert.equal(keywordCovers("breathlessness", "any breathlesness?"), true);
    });

    it("a word every required question shares (the complaint itself) does not tick them all", () => {
        const required = ["when the headache started", "location of the headache", "previous similar headaches", "family history of headaches"];
        const h = scoreHistory({ required, questions: ["tell me about the headache"] });
        assert.equal(h.asked, 0);
        assert.equal(keywordCovers("location of the headache", "where is the headache?", required), true);
        assert.equal(keywordCovers("previous similar headaches", "when did the headache start?", required), false);
    });

    it("knows everyday words for the same idea", () => {
        assert.equal(keywordCovers("dietary habits", "what do you usually eat?"), true);
        assert.equal(keywordCovers("previous cardiac history", "any heart problems?"), true);
        assert.equal(keywordCovers("previous similar episodes", "has this happened before?"), true);
        assert.equal(keywordCovers("urinary symptoms", "any burning passing urine?"), true);
        assert.equal(keywordCovers("photophobia or phonophobia", "does light or noise bother you?"), true);
        assert.equal(keywordCovers("radiation of the pain", "does the pain spread anywhere?"), true);
        assert.equal(keywordCovers("dizziness before the fall", "did you feel dizzy?"), true);
        assert.equal(keywordCovers("frequency of episodes", "how often do you get them?"), true);
    });

    it("does not join unrelated topics through broad words like 'before' or 'work'", () => {
        assert.equal(keywordCovers("previous TB treatment", "any illness before?"), false);
        assert.equal(keywordCovers("smoking and alcohol", "what work do you do?"), false);
    });
});

describe("the switch", () => {
    it("is version 2 unless it says v1 or shadow exactly, so a typo can only leave the current scorer in place", () => {
        assert.equal(historyScoringMode(undefined), "v2");
        assert.equal(historyScoringMode(""), "v2");
        assert.equal(historyScoringMode("V1 "), "v1");
        assert.equal(historyScoringMode("shadow"), "shadow");
        assert.equal(historyScoringMode("vl"), "v2");
    });
});
