// =========================
// engine/evaluation/historyCoverage.ts
// =========================
// History scoring, version 2. The rule, in one sentence (EVALUATION_ENGINE.md, "History"):
//
//   History (25) = how much of what this case needs the student asked (17.5) + how well they asked it (7.5).
//
// Coverage: each of the case's required history questions is either asked or not, and every one is worth the
// same. The AI examiner judges "asked" by meaning (students type in lay words, with typos, several questions in
// one message), and must cite the number of the student's message that asked it; a citation that does not point
// at a real, non-empty question is not accepted. Where the AI gives no usable answer, a keyword matcher decides.
// Quality: the AI's 0-7.5 judgement of relevance, depth and focus, always asked for; its share of 7.5 can never be
// more than the coverage share (a history that covers a fifth of the case gets at most a fifth of the quality marks).
//
// Why version 1 was replaced (2026-10-31): a strong history scored 3 to 6 of 25. Each question's credit was
// multiplied by a "specificity" score that short, good questions never reach and by a timing weight that took 60%
// off anything asked in the last third (where social history belongs), coverage only counted questions matching a
// fixed intent list, and the AI quality score was added only between 8 and 14, so a perfect history was capped at
// 17.5. The invariants in __tests__/historyCoverage.test.ts are there so none of that can come back unnoticed.
//
// Pure: no I/O, no AI calls. The AI's answer comes in as data.

import { INTENT_CATALOGUE } from "./IntentExtractor";

export const HISTORY_COVERAGE_MAX = 17.5;
export const HISTORY_QUALITY_MAX = 7.5;
export const HISTORY_MAX = HISTORY_COVERAGE_MAX + HISTORY_QUALITY_MAX;
export const HISTORY_SCORING_VERSION = 2;

/** Which history score the student sees. "shadow": version 1, with version 2 worked out and stored alongside. */
export type HistoryScoringMode = "v1" | "shadow" | "v2";

/** HISTORY_SCORING in the environment. Anything unrecognised is "shadow", so a typo can never switch scoring over. */
export function historyScoringMode(value: string | undefined): HistoryScoringMode {
    const v = (value ?? "").trim().toLowerCase();
    return v === "v1" || v === "v2" ? v : "shadow";
}

export interface HistoryItem {
    /** The required question, as the case words it. */
    required: string;
    covered: boolean;
    /** 1-based number of the student's message that asked it. */
    message: number | null;
    /** Who decided. */
    by: "ai" | "keywords";
}

export interface HistoryV2 {
    version: 2;
    total: number;
    coverage: number;
    quality: number;
    asked: number;
    of: number;
    /** "ai" when the AI's coverage answer was usable (single items it got wrong fall back to keywords). */
    coverageBy: "ai" | "keywords";
    qualityBy: "ai" | "estimate";
    items: HistoryItem[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── Questions that count ─────────────────────────────────────────────────────

/** A message that asks nothing in particular ("anything else?", "any other symptoms?", "ok") never covers a
 *  required question: it has no topic word and names no topic. "Any other illness, like diabetes?" and "How long
 *  has this been going on?" (a duration) both ask something. */
export function isCatchAll(text: string): boolean {
    if (contentTokens(text).length > 0) return false;
    const lower = text.toLowerCase();
    return !ALL_INTENTS.some((re) => re.test(lower));
}

// ── Keyword matching (the fallback) ──────────────────────────────────────────

// Words that carry no topic: question words, fillers, people, and the examiner's own vocabulary.
const STOPWORDS = new Set(
    (
        "what when where which while whether have has had having does did done doing your yours you with from that this " +
        "there their they them then than about into over such been being were will would could should much many long " +
        "since ever also just only some other tell know any anything anyone something patient doctor she her his him " +
        "ask asked feel feeling get getting got like more most very okay ok please today time times who whose how why " +
        "the and for are not yet make made take taken give given need these those each every both after first next now " +
        "still well good bad day days week weeks month months year years hour hours ago recent recently lately problem " +
        "problems issue issues thing things kind sort way whatever able does whether he history check checked present " +
        "happen happened happening come came going there here can cannot let say said see seen use used " +
        // catch-all words: "anything else?", "any other symptoms or complaints?", "tell me more", "go on"
        "else symptom symptoms complaint complaints concern concerns continue mention add worry worried"
    ).split(/\s+/)
);

// Short words that do carry a topic.
const SHORT_TERMS = new Set([
    "tb", "hiv", "bp", "lmp", "ors", "uti", "ecg", "sti", "std", "gcs", "pee", "flu", "fit", "cut", "dog", "bite",
    // the body, in three letters
    "eye", "ear", "leg", "arm", "hip", "jaw", "gum", "lip", "toe", "rib", "gut", "fat",
]);

/** A crude stem: British and American spellings meet, and common endings go ("smoking", "smoker", "smoke" → "smok";
 *  "painful" → "pain"; "suddenly" → "sudden"). */
export function stem(word: string): string {
    let w = word.toLowerCase().replace(/'s$/, "").replace(/ae/g, "e").replace(/oe/g, "e");
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    for (const suffix of ["ations", "ation", "ments", "ment", "ness", "ings", "ing", "ful", "es", "ed", "er", "ly", "s", "e"]) {
        const min = suffix === "er" || suffix === "ly" ? 4 : 3;
        if (w.endsWith(suffix) && w.length - suffix.length >= min && !(suffix === "s" && w.endsWith("ss"))) {
            w = w.slice(0, -suffix.length);
            break;
        }
    }
    return w;
}

export function contentTokens(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .map((t) => t.replace(/^'+|'+$/g, ""))
        .filter((t) => t && !STOPWORDS.has(t) && (t.length >= 4 || SHORT_TERMS.has(t)))
        .map(stem);
}

/** The same word: equal stems, one a longer form of the other ("diabet", "diabetic"; at least 5 letters shared),
 *  or a one-letter typo in a long word. */
function sameWord(a: string, b: string): boolean {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (short.length >= 5 && long.startsWith(short)) return true;
    return nearlyEqual(a, b);
}

/** Edit distance of at most one (a typo), for words long enough that this does not join two different words. */
function nearlyEqual(a: string, b: string): boolean {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i++;
            j++;
            continue;
        }
        if (++edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else {
            i++;
            j++;
        }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
}

// Intents too broad to stand for one topic ("where", "before", "treatment", "work" would join unrelated questions).
const BROAD_INTENTS = new Set([
    "symptom_severity", "symptom_progression", "aggravating_factors", "relieving_factors", "past_medical_history",
    "medication_history", "social_history", "hygiene_habits", "photophobia_phonophobia", "fatigue",
]);

// Each pattern matches as a word start ("pregnan" finds "pregnant"), never inside another word (the old matcher
// found "ache" inside "headache"); patterns of three letters or fewer ("hot", "fit", "sob") only as whole words.
const escape = (p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPILED_INTENTS: Array<[string, RegExp]> = Object.entries(INTENT_CATALOGUE)
    .filter(([intent]) => !BROAD_INTENTS.has(intent))
    .map(([intent, groups]) => {
        const alternatives = groups.flat().map((p) => {
            const word = escape(p.toLowerCase());
            return p.length <= 3 ? `${word}(?![a-z0-9])` : word;
        });
        return [intent, new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})`)];
    });

// Every intent, broad ones included: only used to tell a real question from a catch-all.
const ALL_INTENTS: RegExp[] = Object.values(INTENT_CATALOGUE).map((groups) => {
    const alternatives = groups.flat().map((p) => {
        const word = escape(p.toLowerCase());
        return p.length <= 3 ? `${word}(?![a-z0-9])` : word;
    });
    return new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})`);
});

/** The specific topics (intents) a text names. */
export function topicIntents(text: string): Set<string> {
    const lower = text.toLowerCase();
    return new Set(COMPILED_INTENTS.filter(([, re]) => re.test(lower)).map(([intent]) => intent));
}

/** What sets one required question apart from the case's others. A word or topic shared by several required
 *  questions (the complaint itself: "headache" in "when the headache started" and "where the headache is") says
 *  nothing about which one was asked, so only the distinctive ones count; a question with nothing distinctive
 *  needs all of its words asked. */
export interface RequiredKey {
    tokens: string[];
    intents: Set<string>;
    distinctTokens: string[];
    distinctIntents: Set<string>;
}

export function requiredKeys(required: readonly string[]): RequiredKey[] {
    const tokens = required.map(contentTokens);
    const intents = required.map(topicIntents);
    return required.map((_, i) => {
        const otherTokens = tokens.flatMap((t, j) => (j === i ? [] : t));
        const otherIntents = new Set(intents.flatMap((t, j) => (j === i ? [] : [...t])));
        return {
            tokens: tokens[i],
            intents: intents[i],
            distinctTokens: tokens[i].filter((t) => !otherTokens.some((o) => sameWord(o, t))),
            distinctIntents: new Set([...intents[i]].filter((x) => !otherIntents.has(x))),
        };
    });
}

function keyCovers(key: RequiredKey, question: string): boolean {
    if (isCatchAll(question)) return false;
    const q = contentTokens(question);
    const has = (t: string) => q.some((b) => sameWord(t, b));
    if (key.distinctTokens.some(has)) return true;
    if (key.distinctIntents.size > 0) {
        for (const i of topicIntents(question)) if (key.distinctIntents.has(i)) return true;
    }
    if (key.distinctTokens.length === 0 && key.distinctIntents.size === 0) return key.tokens.length > 0 && key.tokens.every(has);
    return false;
}

/** Does this student message ask about this required question? Shared topic word (after stemming, allowing one
 *  typo in a long word) or a shared specific topic, among what sets it apart from the case's other required
 *  questions (`allRequired`; alone, everything about it counts). */
export function keywordCovers(required: string, question: string, allRequired: readonly string[] = [required]): boolean {
    const keys = requiredKeys(allRequired.includes(required) ? allRequired : [...allRequired, required]);
    const idx = allRequired.includes(required) ? allRequired.indexOf(required) : allRequired.length;
    return keyCovers(keys[idx], question);
}

// ── The AI's coverage answer ─────────────────────────────────────────────────

type AiVerdict = { state: "asked"; message: number } | { state: "not_asked" } | { state: "invalid" };

/**
 * Checks the AI's `historyCoverage` against what really happened. Each required item must be answered once, with
 * `asked` true or false; `asked` true must cite the number of one of the student's own messages, and that message
 * must actually ask something. An item that fails gets the keyword matcher's answer instead. If more than half
 * fail, the whole answer is not trusted and the keyword matcher decides everything.
 */
export function readAiCoverage(raw: unknown, requiredCount: number, questions: readonly string[]): AiVerdict[] | null {
    if (!Array.isArray(raw) || requiredCount === 0) return null;
    const verdicts: AiVerdict[] = Array.from({ length: requiredCount }, () => ({ state: "invalid" as const }));
    const seen = new Set<number>();
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const item = Number(e.item);
        if (!Number.isInteger(item) || item < 1 || item > requiredCount || seen.has(item)) continue;
        seen.add(item);
        if (e.asked === false) {
            verdicts[item - 1] = { state: "not_asked" };
            continue;
        }
        if (e.asked !== true) continue;
        const message = Number(e.message);
        if (!Number.isInteger(message) || message < 1 || message > questions.length) continue;
        if (isCatchAll(questions[message - 1])) continue;
        verdicts[item - 1] = { state: "asked", message };
    }
    const invalid = verdicts.filter((v) => v.state === "invalid").length;
    return invalid * 2 > requiredCount ? null : verdicts;
}

// ── The score ────────────────────────────────────────────────────────────────

export interface ScoreHistoryInput {
    /** evaluation_config.history.required_questions */
    required: readonly string[];
    /** The student's messages to the patient, in order. */
    questions: readonly string[];
    /** The AI's `historyCoverage` answer, as it came (validated here). Undefined when there was no AI answer. */
    aiCoverage?: unknown;
    /** The AI's `historyQualityScore`, as it came. */
    aiQuality?: unknown;
}

export function scoreHistory(input: ScoreHistoryInput): HistoryV2 {
    const required = input.required.filter((r) => typeof r === "string" && r.trim());
    const questions = input.questions.map((q) => String(q ?? ""));
    const verdicts = readAiCoverage(input.aiCoverage, required.length, questions);
    const keys = requiredKeys(required);

    const items: HistoryItem[] = required.map((req, i) => {
        const v = verdicts?.[i];
        if (v && v.state === "asked") return { required: req, covered: true, message: v.message, by: "ai" };
        if (v && v.state === "not_asked") return { required: req, covered: false, message: null, by: "ai" };
        const at = questions.findIndex((q) => keyCovers(keys[i], q));
        return { required: req, covered: at >= 0, message: at >= 0 ? at + 1 : null, by: "keywords" };
    });

    const asked = items.filter((i) => i.covered).length;
    // No required questions: nothing to miss (as in version 1).
    const share = required.length === 0 ? 1 : asked / required.length;
    const coverage = HISTORY_COVERAGE_MAX * share;

    // Quality can never outrun coverage: its share of 7.5 is at most the coverage share. (A looser cap, twice the
    // share, let a one-question history earn a third of the quality marks on the real-attempt replay.)
    const qualityCap = HISTORY_QUALITY_MAX * share;
    const ai = typeof input.aiQuality === "number" ? input.aiQuality : typeof input.aiQuality === "string" ? Number(input.aiQuality) : NaN;
    const qualityBy: HistoryV2["qualityBy"] = Number.isFinite(ai) ? "ai" : "estimate";
    // With no AI judgement, a modest estimate from coverage alone (two-thirds of the cap), so an AI outage moves no
    // one far either way.
    const raw = qualityBy === "ai" ? Math.max(0, Math.min(HISTORY_QUALITY_MAX, ai)) : (HISTORY_QUALITY_MAX * share * 2) / 3;
    const quality = Math.min(raw, qualityCap);

    return {
        version: 2,
        total: round1(Math.min(HISTORY_MAX, coverage + quality)),
        coverage: round1(coverage),
        quality: round1(quality),
        asked,
        of: required.length,
        coverageBy: verdicts ? "ai" : "keywords",
        qualityBy,
        items,
    };
}

/** What the debrief shows: how many required questions were asked, and which were not. */
export function historyReview(h: HistoryV2): { version: 2; asked: number; of: number; missed: string[] } {
    return { version: 2, asked: h.asked, of: h.of, missed: h.items.filter((i) => !i.covered).map((i) => i.required) };
}

// ── What the AI is asked ─────────────────────────────────────────────────────

const MAX_LISTED = 80;

/** The prompt section that asks the AI for coverage (by message number) and quality. */
export function historyPromptSection(required: readonly string[], questions: readonly string[]): string {
    const listed = questions.slice(0, MAX_LISTED).map((q, i) => `${i + 1}. ${q.replace(/\s+/g, " ").trim().slice(0, 240)}`);
    const items = required.map((r, i) => `${i + 1}. ${r}`);
    return `HISTORY COVERAGE:
The student's messages to the patient, numbered:
${listed.join("\n") || "(none)"}

Required history items for this case, numbered:
${items.join("\n") || "(none)"}

For each required item, decide whether the student asked about it in substance. Lay words, spelling mistakes and one
message that asks about several items all count, and a general question counts for every item it plainly covers ("How
long has this been going on?" asks the duration of each presenting complaint). It does NOT count if the patient
volunteered it without being asked, if the student only said or explained something to the patient instead of asking,
or if the student only examined or ordered a test. When asked is true, give the number of the student's message that
asked it; when false, message is null.

HISTORY QUALITY SCORING (0-7.5), always:
  - relevance (0-2.5): did the questions target this patient's problem, or was it a generic checklist?
  - depth     (0-2.5): were positives followed up (onset, amount, pattern, what makes it better or worse)?
  - focus     (0-2.5): organised, without repeating the same question?
Do not score coverage here; it is scored from your coverage answer. historyQualityScore must not exceed 7.5.`;
}
