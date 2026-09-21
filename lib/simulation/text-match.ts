// =========================
// lib/simulation/text-match.ts
// =========================
// Negation-aware phrase matching for free text the student writes
// ("Record your interpretation", the differential, the reasoning box).
//
// Recognition and scoring are keyword rubrics authored in the case JSON, so
// the one thing they must get right is "no ST elevation" NOT counting as
// recognising ST elevation. Deliberately small and predictable — no NLP.

/** Words that negate a phrase that follows them in the same clause. */
const NEGATORS = new RegExp(
    "\\b(?:no|not|without|absent|absence of|negative for|nor|never|denies|denied|unlikely|isn't|is not|doesn't|does not|don't|do not|wasn't|was not|neither)\\b"
);

/** Clause boundaries: punctuation, plus conjunctions that end a negation's scope. */
const CLAUSE_SPLIT = /[.;,:\n]|\s(?:but|however|although|and|with|while|whereas)\s/;

/** Lower-case, collapse whitespace, treat hyphens/underscores/slashes as spaces. */
export function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[-_/]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const isWordChar = (ch: string | undefined): boolean => !!ch && /[a-z0-9]/.test(ch);

/**
 * Index of `phrase` in `clause`, or -1.
 *
 * A phrase must START at a word boundary, so "stemi" does not match inside
 * "nstemi" (NSTEMI is a different diagnosis). Phrases of 3 chars or fewer must
 * also END at one ("mi" ≠ "mild"); longer phrases may be stems ("radiat" →
 * "radiates", "radiating").
 */
function indexOfPhrase(clause: string, phrase: string): number {
    const mustEndAtBoundary = phrase.length <= 3;
    let from = 0;
    for (;;) {
        const at = clause.indexOf(phrase, from);
        if (at < 0) return -1;
        const startsClean = !isWordChar(clause[at - 1]);
        const endsClean = !mustEndAtBoundary || !isWordChar(clause[at + phrase.length]);
        if (startsClean && endsClean) return at;
        from = at + 1;
    }
}

export interface MatchOptions {
    /** Ignore matches that a negator precedes within the same clause. Default true. */
    negationAware?: boolean;
}

/** True when ANY phrase appears in the text (and is not negated). */
export function textMatchesAny(text: string, phrases: readonly string[], options: MatchOptions = {}): boolean {
    const negationAware = options.negationAware !== false;
    if (!text || phrases.length === 0) return false;

    const clauses = normalizeText(text).split(CLAUSE_SPLIT);
    const needles = phrases.map(normalizeText).filter(Boolean);

    for (const clause of clauses) {
        for (const needle of needles) {
            const at = indexOfPhrase(clause, needle);
            if (at < 0) continue;
            if (negationAware && NEGATORS.test(clause.slice(0, at))) continue;
            return true;
        }
    }
    return false;
}

/** True when EVERY phrase appears (and is not negated). */
export function textMatchesAll(text: string, phrases: readonly string[], options: MatchOptions = {}): boolean {
    if (phrases.length === 0) return true;
    return phrases.every((p) => textMatchesAny(text, [p], options));
}

/** Convenience for structured lists (differential slots, plan steps). */
export function anyTextMatches(
    texts: readonly string[],
    phrases: readonly string[],
    options: MatchOptions = {}
): boolean {
    return texts.some((t) => textMatchesAny(t, phrases, options));
}
