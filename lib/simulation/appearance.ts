// =========================
// lib/simulation/appearance.ts
// =========================
// How the patient LOOKS: the pallor, the yellow eyes, the sweat, the tired face.
// This is what a doctor takes in on walking up to the bed, before any question is
// asked or any test ordered, so it costs the student nothing.
//
// The portrait and the one-line observation are both drawn from the same
// structured description, so they can never disagree. A case describes its
// patient once (`appearance`), optionally changing with the patient's state
// (`variants`, using the same condition grammar as everything else), and this
// module turns that into a `ResolvedLook`.
//
// A classic case has no `appearance`. `deriveAppearance` reads one out of the
// case's own examination findings and structured facts (never out of the history
// text, which describes symptoms, not appearance) and says nothing where the
// case says nothing.
//
// Pure: no React, no I/O.

import type { RuleCondition } from "./case-schema";
import { evaluateCondition, type ConditionContext } from "./conditions";

// ── Vocabulary ──────────────────────────────────────────────────────────────

/** 0 none · 1 slight · 2 obvious · 3 marked */
export type Level = 0 | 1 | 2 | 3;

export const SKIN_TONES = ["light", "medium", "brown", "deep"] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

export const EXPRESSIONS = ["calm", "tired", "anxious", "pain", "distress", "breathless", "drowsy", "irritable", "photophobic"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const SWELLINGS = ["neck_right", "neck_left", "neck_front"] as const;
export type Swelling = (typeof SWELLINGS)[number];

/** What a patient can be wearing. Omit it and they wear something ordinary for their age and sex (see persona.ts). */
export const GARMENTS = ["saree", "salwar", "kurta", "kurta_jacket", "shirt", "tee", "frock", "swaddle", "gown"] as const;
export type Garment = (typeof GARMENTS)[number];

/** Small things on the face and ears. "bindi" and "nose_stud" depend on the patient's community, so they are never a default. */
export const ACCESSORIES = ["glasses", "earrings", "moustache", "bindi", "nose_stud"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export interface AppearanceLook {
    pallor?: Level;
    jaundice?: Level;
    cyanosis?: Level;
    flushed?: Level;
    sweating?: Level;
    sunken_eyes?: Level;
    expression?: Expression;
    swelling?: Swelling;
    /** The observation as the case words it. When omitted it is composed from the fields above. */
    note?: string;
}

export interface AppearanceSpec extends AppearanceLook {
    skin_tone?: SkinTone;
    /** What they are wearing. Omit for something ordinary for their age and sex. */
    attire?: Garment;
    /** Exactly these accessories (an empty list is none). Omit to get the ones a person of that age and sex would ordinarily have. */
    accessories?: Accessory[];
    /** The first variant whose condition holds overrides the base look. */
    variants?: Array<AppearanceLook & { when: RuleCondition }>;
}

export interface ResolvedLook {
    pallor: Level;
    jaundice: Level;
    cyanosis: Level;
    flushed: Level;
    sweating: Level;
    sunken_eyes: Level;
    expression: Expression;
    swelling?: Swelling;
    note?: string;
}

// ── Who is in the bed ───────────────────────────────────────────────────────

/**
 * The body the portrait is drawn on. How old an adult looks (grey hair, lines, glasses) is not part of
 * this: it follows the actual age, continuously, in persona.ts, so a 58-year-old and a 72-year-old are
 * not the same drawing.
 */
export type Figure = "infant" | "toddler" | "child" | "adult_f" | "adult_m";

export const isFemale = (gender: string | undefined): boolean => /^f/i.test((gender ?? "").trim());

export function figureFor(age: number | undefined, gender: string | undefined): Figure {
    if (typeof age === "number" && Number.isFinite(age)) {
        if (age < 1) return "infant";
        if (age < 5) return "toddler";
        if (age < 13) return "child";
    }
    return isFemale(gender) ? "adult_f" : "adult_m";
}

// ── Resolving ───────────────────────────────────────────────────────────────

const LOOK_KEYS = ["pallor", "jaundice", "cyanosis", "flushed", "sweating", "sunken_eyes", "expression", "swelling", "note"] as const;

function pickLook(source: AppearanceLook | undefined): AppearanceLook {
    const out: Record<string, unknown> = {};
    for (const key of LOOK_KEYS) {
        const value = source?.[key];
        if (value !== undefined) out[key] = value;
    }
    return out as AppearanceLook;
}

/** The base look, overridden by the first variant that holds for the patient right now. */
export function resolveLook(spec: AppearanceSpec | undefined, ctx: ConditionContext): ResolvedLook {
    const variant = spec?.variants?.find((v) => evaluateCondition(v.when, ctx));
    // A variant that gives its own `note` replaces the base note; one that doesn't inherits none, so a
    // stale sentence can never describe a patient who has changed.
    const base = pickLook(spec);
    const merged: AppearanceLook = variant ? { ...base, note: undefined, ...pickLook(variant) } : base;
    return {
        pallor: merged.pallor ?? 0,
        jaundice: merged.jaundice ?? 0,
        cyanosis: merged.cyanosis ?? 0,
        flushed: merged.flushed ?? 0,
        sweating: merged.sweating ?? 0,
        sunken_eyes: merged.sunken_eyes ?? 0,
        expression: merged.expression ?? "calm",
        ...(merged.swelling ? { swelling: merged.swelling } : {}),
        ...(merged.note ? { note: merged.note } : {}),
    };
}

// ── Saying it ───────────────────────────────────────────────────────────────

const PALLOR_WORD: Record<Level, string> = { 0: "", 1: "slightly pale", 2: "pale", 3: "very pale" };
const SWEAT_PHRASE: Record<Level, string> = { 0: "", 1: "slightly sweaty", 2: "sweating", 3: "drenched in sweat" };

const EXPRESSION_SENTENCE: Record<Expression, string> = {
    calm: "",
    tired: "Looks tired.",
    anxious: "Looks anxious.",
    pain: "In obvious pain.",
    distress: "Clearly distressed.",
    breathless: "Short of breath at rest.",
    drowsy: "Drowsy.",
    irritable: "Irritable and unsettled.",
    photophobic: "Squinting against the light.",
};

const SWELLING_SENTENCE: Record<Swelling, string> = {
    neck_right: "Visible swelling on the right side of the neck.",
    neck_left: "Visible swelling on the left side of the neck.",
    neck_front: "Visible swelling at the front of the neck.",
};

const sentence = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");

function list(parts: string[]): string {
    if (parts.length <= 1) return parts.join("");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The colour of the skin and eyes, in one sentence: "Face is very pale and yellow." */
function colourSentence(look: ResolvedLook): string {
    const pale = PALLOR_WORD[look.pallor];
    if (pale && look.jaundice >= 2) return `Face is ${pale} and yellow.`;
    if (pale && look.jaundice === 1) return `Looks ${pale}, with a slight yellow tint to the eyes.`;
    if (pale) return `Looks ${pale}.`;
    if (look.jaundice === 1) return "A slight yellow tint to the eyes.";
    if (look.jaundice === 2) return "Eyes and face look yellow.";
    if (look.jaundice === 3) return "Deeply yellow, eyes and skin.";
    return "";
}

/**
 * The observation the student reads. The case's own words win; otherwise it is composed from
 * the same fields that draw the portrait, so the two always agree. Empty when there is nothing
 * to remark on.
 */
export function describeLook(look: ResolvedLook): string {
    if (look.note) return look.note;

    const sweat = SWEAT_PHRASE[look.sweating];
    const others = [
        sweat,
        look.flushed >= 1 ? "flushed" : "",
        look.cyanosis >= 1 ? "bluish around the lips" : "",
        look.sunken_eyes >= 1 ? "with sunken eyes" : "",
    ].filter(Boolean);

    return [
        colourSentence(look),
        others.length > 0 ? `${sentence(list(others))}.` : "",
        EXPRESSION_SENTENCE[look.expression],
        look.swelling ? SWELLING_SENTENCE[look.swelling] : "",
    ]
        .filter(Boolean)
        .join(" ");
}

// ── Reading a classic case ──────────────────────────────────────────────────

type Json = Record<string, any>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * How strongly a finding is stated: "Absent" 0, "Mild pallor present" 1,
 * "Present; conjunctivae are pale" 2, "marked" 3. A finding that is not there,
 * not recorded or merely "documented" counts as 0: nothing is drawn that the
 * case did not say.
 */
export function levelOfFinding(text: string): Level {
    const t = text.toLowerCase();
    if (/\b(absent|nil|none|negative|normal)\b|\bnot (specifically )?(documented|present|seen|noted|evident|recorded)\b|\bno\b/.test(t)) return 0;
    if (/\b(severe|marked|profound|deep|intense|florid)\b/.test(t)) return 3;
    if (/\b(moderate|obvious|prominent|definite)\b/.test(t)) return 2;
    if (/\b(mild|slight|faint|trace|minimal|lemon)\b/.test(t)) return 1;
    if (/\b(present|yes|pale|yellow|icteric|jaundiced|cyanosed|cyanotic|visible|evident)\b/.test(t)) return 2;
    return 0;
}

const EXPRESSION_RULES: Array<[RegExp, Expression]> = [
    [/drows|lethargic|obtunded|sleepy/, "drowsy"],
    [/breathless|short of breath|tachypno|laboured breathing|labored breathing|dyspno/, "breathless"],
    [/comfortable/, "calm"],
    [/distress|in pain|painful|writh|grimac|wince/, "distress"],
    [/anxious|worried|frightened|apprehensive/, "anxious"],
    [/irritab|restless|crying/, "irritable"],
    [/fatigue|tired|weak|unwell|exhausted|lethargy|\bill\b/, "tired"],
];

function expressionOf(text: string): Expression {
    const t = text.toLowerCase();
    for (const [pattern, expression] of EXPRESSION_RULES) if (pattern.test(t)) return expression;
    return "calm";
}

function endWithStop(text: string): string {
    const t = text.trim().replace(/[.;:,]+$/, "");
    return `${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

/**
 * An appearance for a classic case, from what the case itself records: the general
 * examination (pallor, jaundice, cyanosis, general condition), a documented neck swelling, a
 * structured jaundice fact, or a chief complaint that says the eyes are yellow. Undefined
 * when the case says nothing about how the patient looks.
 */
export function deriveAppearance(legacy: Json): AppearanceSpec | undefined {
    const facts = isObj(legacy?.patient_facts) ? legacy.patient_facts : {};
    const general = [facts.general_physical_examination, facts.general_examination, facts.general_appearance].find(isObj) as Json | undefined;

    const look: AppearanceLook = {};
    let condition: string | undefined;

    for (const [key, value] of Object.entries(general ?? {})) {
        if (typeof value !== "string") continue;
        if (/pallor/i.test(key)) look.pallor = levelOfFinding(value);
        else if (/jaundice|icterus/i.test(key)) look.jaundice = levelOfFinding(value);
        else if (/cyanosis/i.test(key)) look.cyanosis = levelOfFinding(value);
        else if (/^(general_)?(condition|appearance)$/i.test(key)) condition = value;
    }

    // A structured jaundice fact, and a chief complaint that says the eyes and face are yellow.
    if (look.jaundice === undefined) {
        const fact = isObj(facts.jaundice) ? facts.jaundice : undefined;
        const complaint = String(legacy?.patient?.chiefComplaint ?? legacy?.patient_facts?.chief_complaint ?? "");
        const fromFact: Level = fact?.present === true ? (/sever|marked/i.test(String(fact.severity)) ? 3 : /moder/i.test(String(fact.severity)) ? 2 : 1) : 0;
        const fromComplaint: Level = /\b(yellow|jaundice)/i.test(complaint) ? 2 : 0;
        const level = Math.max(fromFact, fromComplaint) as Level;
        if (level > 0) look.jaundice = level;
    }

    // A documented swelling in the neck (the local examination of a thyroid case).
    const local = JSON.stringify(facts.local_examination ?? "");
    if (/swelling/i.test(local) && /neck/i.test(local)) {
        look.swelling = /right (side|lobe)/i.test(local) ? "neck_right" : /left (side|lobe)/i.test(local) ? "neck_left" : "neck_front";
    }

    // Behaviour at the bedside from the general condition; else from a documented symptom that
    // is visible on the face (photophobia).
    if (condition) look.expression = expressionOf(condition);
    else if (JSON.stringify(legacy?.patient?.history_of_present_illness ?? "").match(/(?<![Nn]o )photophobia/i)) look.expression = "photophobic";

    // The observation in the case's own words, plus any skin finding those words leave out.
    if (condition) {
        const skin = [
            (look.pallor ?? 0) > 0 && !/pale|pallor/i.test(condition) ? colourSentence({ ...blankLook(), pallor: look.pallor as Level }) : "",
            (look.jaundice ?? 0) > 0 && !/yellow|icter|jaund/i.test(condition) ? colourSentence({ ...blankLook(), jaundice: look.jaundice as Level }) : "",
        ].filter(Boolean);
        look.note = [endWithStop(condition), ...skin].join(" ");
    }

    const meaningful =
        (look.pallor ?? 0) > 0 || (look.jaundice ?? 0) > 0 || (look.cyanosis ?? 0) > 0 || look.swelling !== undefined || look.note !== undefined || (look.expression !== undefined && look.expression !== "calm");
    return meaningful ? look : undefined;
}

function blankLook(): ResolvedLook {
    return { pallor: 0, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 0, sunken_eyes: 0, expression: "calm" };
}
