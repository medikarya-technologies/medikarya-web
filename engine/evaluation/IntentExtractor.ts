// =========================
// engine/evaluation/IntentExtractor.ts
// =========================
// Layer 1: Transforms raw chatHistory into structured signals.
// No LLM calls — pure rule-based extraction.
//
// Outputs:
//   - multi-label intents with confidence per doctor question
//   - composite specificity score (0–10) per question
//   - token-budget-aware transcript with guaranteed critical turns

import {
    ExtractedConsultation,
    ExtractedQuestion,
    MappedIntent,
} from "./types";

// ── Intent catalogue ─────────────────────────────────────────────────────────
// Maps intent slug → patterns to scan for in the question text.
// Confidence = how many pattern groups match / total groups.

const INTENT_CATALOGUE: Record<string, string[][]> = {
    // ── History of present illness (universal) ────────────────────────────────
    duration_of_symptoms:    [["how long", "since when", "duration", "days", "weeks", "started", "onset"]],
    onset_character:         [["sudden", "gradual", "onset", "started", "began", "acute", "chronic"]],
    symptom_severity:        [["severe", "mild", "moderate", "scale", "1 to 10", "how bad", "intensity", "worst"]],
    symptom_progression:     [["getting worse", "improving", "same", "better", "worse", "progress"]],
    aggravating_factors:     [["worse with", "triggers", "aggravate", "provoke", "worsens"]],
    relieving_factors:       [["better with", "relieves", "relief", "helps", "reduced by"]],

    // ── GI symptoms ───────────────────────────────────────────────────────────
    vomiting_character:      [["vomit", "vomiting", "throw up", "nausea", "puke", "emesis"]],
    diarrhea_character:      [["diarrhea", "diarrhoea", "loose stool", "loose motion", "watery stool", "motions"]],
    abdominal_pain:          [["stomach", "abdomen", "belly", "abdominal pain", "cramp", "ache", "colic"]],
    appetite_change:         [["appetite", "eating", "hunger", "not eating", "food intake", "anorexia"]],

    // ── Neurological symptoms ─────────────────────────────────────────────────
    headache_character:      [["headache", "head pain", "head ache", "migraine", "cephalalgia"]],
    headache_location:       [["location", "where", "one side", "both sides", "unilateral", "bilateral", "frontal", "occipital", "temporal"]],
    visual_symptoms:         [["vision", "visual", "aura", "seeing", "blurred", "double vision", "diplopia", "scotoma", "spots", "zigzag"]],
    neurological_deficit:    [["weakness", "numb", "tingling", "focal", "paralysis", "drift", "face drop", "slurred", "dysarthria"]],
    seizure:                 [["seizure", "fit", "convulsion", "epilepsy", "shaking", "jerking", "tonic", "clonic"]],
    consciousness:           [["conscious", "awareness", "drowsy", "alert", "confusion", "LOC", "fainted", "blackout", "syncope"]],
    photophobia_phonophobia: [["light", "photophobia", "sensitive to light", "noise", "sound", "phonophobia"]],
    neck_stiffness:          [["neck", "stiff", "rigid", "meningism", "kernig", "brudzinski"]],

    // ── Cardiovascular symptoms ───────────────────────────────────────────────
    chest_pain:              [["chest", "chest pain", "chest tightness", "pressure", "squeezing", "crushing", "angina"]],
    palpitation:             [["palpitation", "heart racing", "irregular heartbeat", "fast heart", "flutter", "skipping"]],
    syncope_presyncope:      [["fainting", "faint", "syncope", "blackout", "dizzy", "lightheaded", "pre-syncope"]],
    radiation_of_pain:       [["radiate", "spread", "radiating", "arm", "jaw", "shoulder", "back pain"]],
    oedema:                  [["swelling", "swollen", "oedema", "edema", "pitting", "ankles"]],

    // ── Respiratory symptoms ──────────────────────────────────────────────────
    dyspnoea:               [["breathless", "shortness of breath", "dyspnea", "dyspnoea", "breathing difficulty", "SOB"]],
    cough_character:        [["cough", "coughing", "productive", "dry cough", "wheezing", "sputum", "phlegm"]],
    haemoptysis:            [["blood in sputum", "coughing blood", "haemoptysis", "hemoptysis", "blood in phlegm"]],
    pleuritic_pain:         [["chest pain on breathing", "worse on breathing", "pleuritic", "on inspiration"]],

    // ── Musculoskeletal symptoms ──────────────────────────────────────────────
    joint_pain:             [["joint", "arthritis", "arthralgia", "swollen joint", "stiff joint", "morning stiffness"]],
    back_pain:              [["back", "spine", "lumbar", "backache", "disc", "sciatica", "radiculopathy"]],

    // ── Psychiatric / behavioural ─────────────────────────────────────────────
    mood_symptoms:          [["mood", "depressed", "depression", "anxiety", "sad", "hopeless", "tearful", "low"]],
    sleep_disturbance:      [["sleep", "insomnia", "nightmare", "waking", "difficulty sleeping", "fatigue", "tired"]],
    psychotic_symptoms:     [["hearing voices", "hallucination", "delusion", "paranoid", "psychosis"]],

    // ── Urological / gynaecological ───────────────────────────────────────────
    urine_symptoms:         [["urine", "urination", "dysuria", "burning urine", "frequency of urine", "haematuria", "blood in urine"]],
    menstrual_history:      [["period", "menstrual", "menstruation", "cycle", "LMP", "last period", "irregular"]],

    // ── Dermatological ────────────────────────────────────────────────────────
    skin_rash:              [["rash", "skin", "itching", "pruritus", "lesion", "eruption", "urticaria", "hives"]],
    skin_colour_change:     [["yellow", "jaundice", "pale", "cyanosis", "blue", "pallor", "icterus"]],

    // ── GI red flags ─────────────────────────────────────────────────────────
    blood_in_stool:         [["blood", "bleeding", "red", "red stool", "black stool", "tarry", "melena", "haematochezia", "bloody", "red colour in motion", "red in potty", "discolouration"]],
    bilious_vomiting:       [["green", "bile", "bilious", "yellow green", "dark vomit", "greenish vomit"]],
    severe_dehydration:     [["no urine", "sunken", "turgor", "passing urine", "not peeing", "wet diaper", "fontanelle"]],

    // ── Universal systemic ────────────────────────────────────────────────────
    fever:                  [["fever", "temperature", "pyrexia", "febrile", "hot", "chills", "rigors"]],
    weight_change:          [["weight", "loss", "gain", "losing", "thin", "wasting", "gained weight"]],
    fatigue:                [["tired", "fatigue", "weakness", "lethargy", "energy", "exhausted"]],

    // ── Past history & social (universal) ────────────────────────────────────
    past_medical_history:   [["past", "history", "before", "previous", "ever had", "earlier illness", "medical history"]],
    surgical_history:       [["surgery", "operation", "operated", "procedure", "surgical"]],
    medication_history:     [["medicine", "medication", "drug", "tablet", "syrup", "treatment", "currently on"]],
    allergy_history:        [["allergy", "allergic", "reaction", "intolerance"]],
    family_history:         [["family", "parent", "sibling", "relative", "household", "contact", "hereditary", "runs in family"]],
    social_history:         [["smoking", "alcohol", "drink", "smoke", "occupation", "travel", "living"]],
    immunization_status:    [["vaccine", "vaccination", "immuniz", "immunis", "shot", "jab"]],
    hygiene_habits:         [["hygiene", "wash", "hand", "sanitation", "clean", "water source"]],

    // ── Review of systems (universal) ────────────────────────────────────────
    oral_intake:            [["drinking", "fluid", "water", "oral", "intake", "breast", "feed"]],
    contact_history:        [["contact", "sick", "similar", "school", "daycare", "travel", "exposure"]],
};

// ── Vague catch-all phrases (score near zero) ─────────────────────────────────
const VAGUE_PHRASES = [
    "anything else", "other issues", "other symptoms", "any other",
    "something else", "more to add", "what else", "other complaints",
    "tell me more", "go on", "continue",
];

// ── Medical terms for specificity scoring ─────────────────────────────────────
const MEDICAL_TERMS = [
    // GI
    "bilious", "projectile", "haematochezia", "melena", "tarry", "pyrexia",
    "febrile", "dehydration", "turgor", "fontanelle", "immunization",
    "gastroenteritis", "rotavirus", "norovirus", "electrolyte", "hyponatraemia",
    "diarrhea", "diarrhoea", "vomitus", "abdomen", "abdominal",
    "peristalsis", "bowel", "sepsis", "perforation", "obstruction",
    // Neurology
    "migraine", "cephalalgia", "photophobia", "phonophobia", "aura",
    "diplopia", "dysarthria", "aphasia", "ataxia", "nystagmus",
    "meningism", "kernig", "brudzinski", "papilloedema", "syncope",
    "seizure", "epilepsy", "hemiplegia", "paraplegia", "radiculopathy",
    // Cardiology / respiratory
    "angina", "palpitation", "dyspnoea", "dyspnea", "orthopnoea",
    "haemoptysis", "hemoptysis", "pleuritic", "crepitations", "wheeze",
    "tachycardia", "bradycardia", "arrhythmia", "oedema", "cyanosis",
    // Psychiatry
    "anhedonia", "insomnia", "hallucination", "delusion", "paranoia",
    // Musculoskeletal
    "arthritis", "arthralgia", "myalgia", "sciatica", "spondylosis",
    // Dermatology
    "pruritus", "urticaria", "erythema", "purpura", "petechiae", "jaundice",
    // Gynaecology / urology
    "dysuria", "haematuria", "menorrhagia", "dysmenorrhoea",
];

// ── Specificity sub-scorers ───────────────────────────────────────────────────

function keywordDepthScore(text: string): number {
    const lower = text.toLowerCase();
    // Broad multi-specialty signals: body system / organ / clinical domain / timeline
    const depthSignals = [
        // GI
        "stomach", "bowel", "gut", "GI", "gastro", "urine", "stool", "blood",
        "vomit", "abdomen", "diarrhea", "diarrhoea", "nausea",
        // Neurology
        "headache", "head", "migraine", "vision", "aura", "seizure", "weakness",
        "numbness", "tingling", "neck", "consciousness", "fainting", "dizzy",
        // Cardiology / respiratory
        "chest", "heart", "breathing", "breath", "cough", "palpitation",
        "swelling", "ankle", "shortness",
        // Musculoskeletal
        "joint", "back", "spine", "muscle", "pain", "ache",
        // Dermatology
        "rash", "skin", "itch", "yellow", "jaundice",
        // Psychiatry
        "mood", "sleep", "anxiety", "depressed", "tired", "energy",
        // Universal history domains
        "history", "past", "previous", "illness", "episode",
        "hygiene", "sanitation", "immunis", "vaccination", "vaccin",
        "fever", "temperature",
        // Timing / quantification
        "days", "weeks", "since", "how long", "frequency", "times a day",
        "onset", "duration", "started", "when did",
        // Dehydration / fluid status
        "urine output", "sunken", "turgor", "passing urine", "wet diaper",
        "dry", "thirst",
    ];
    const matches = depthSignals.filter(t => lower.includes(t.toLowerCase())).length;
    return Math.min(4, matches * 0.5); // 0.5 per match, max 4 (8+ terms needed for cap)
}

function medicalTermPresence(text: string): number {
    const lower = text.toLowerCase();
    const matches = MEDICAL_TERMS.filter(t => lower.includes(t)).length;
    return Math.min(3, matches * 1.5);
}

function questionStructureScore(text: string): number {
    const lower = text.toLowerCase();
    if (VAGUE_PHRASES.some(p => lower.includes(p))) return 0;
    // Specific open-ended clinical question
    if (lower.includes("how") || lower.includes("when") || lower.includes("describe") ||
        lower.includes("frequency") || lower.includes("how many")) return 3;
    // Clinical closed question
    if (lower.includes("any") && lower.length > 20) return 2;
    // Very short yes/no style
    if (lower.length < 15) return 0.5;
    return 1.5;
}

function computeSpecificityScore(text: string): number {
    const score =
        keywordDepthScore(text) +
        medicalTermPresence(text) +
        questionStructureScore(text);
    return Math.min(10, score);
}

// ── Intent mapping ────────────────────────────────────────────────────────────

function mapIntents(text: string): MappedIntent[] {
    const lower = text.toLowerCase();
    const results: MappedIntent[] = [];

    for (const [intent, patternGroups] of Object.entries(INTENT_CATALOGUE)) {
        let matchedGroups = 0;
        for (const group of patternGroups) {
            if (group.some(kw => lower.includes(kw.toLowerCase()))) {
                matchedGroups++;
            }
        }
        if (matchedGroups > 0) {
            const confidence = matchedGroups / patternGroups.length;
            if (confidence >= 0.3) { // minimum threshold to register
                results.push({ intent, confidence: Math.min(1.0, confidence) });
            }
        }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
}

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
    // ~4 chars per token (conservative estimate)
    return Math.ceil(text.length / 4);
}

// ── Build full transcript ─────────────────────────────────────────────────────

function buildTranscript(chatHistory: { role: string; content: string }[]): string {
    return chatHistory
        .map(m => {
            const label = m.role === "user" ? "Doctor" : "Patient";
            return `${label}: ${String(m.content ?? "").trim()}`;
        })
        .join("\n");
}

// ── Extract patient-revealed facts ────────────────────────────────────────────

function extractPatientFacts(chatHistory: { role: string; content: string }[]): string[] {
    return chatHistory
        .filter(m => m.role === "assistant")
        .map(m => String(m.content ?? "").trim())
        .filter(t => t.length > 10)
        .slice(0, 30); // cap at 30 to avoid bloat
}

// ── Detect suspected "asked but not actioned" flags ──────────────────────────

function detectIgnoredFlags(
    questions: ExtractedQuestion[],
    patientFacts: string[],
    redFlagIntents: string[]
): string[] {
    const ignored: string[] = [];
    for (const flagIntent of redFlagIntents) {
        // Was the flag asked about?
        const askedTurn = questions.find(q =>
            q.mappedIntents.some(i => i.intent === flagIntent && i.confidence >= 0.5)
        );
        if (!askedTurn) continue; // never asked — handled by penalty resolver

        // Was there a meaningful patient reply after that turn?
        // (we can't perfectly parse here — we flag this for LLM adjudication)
        const patientMentionedFlag = patientFacts.some(fact => {
            const lower = fact.toLowerCase();
            // Check if patient confirmed or gave info about this flag
            return INTENT_CATALOGUE[flagIntent]?.some(group =>
                group.some(kw => lower.includes(kw.toLowerCase()))
            ) ?? false;
        });

        if (patientMentionedFlag) {
            // Flag was asked AND patient gave info. Mark for LLM to check actioning.
            ignored.push(flagIntent);
        }
    }
    return ignored;
}

// ── Build compressed transcript (token budget aware) ─────────────────────────

function buildBudgetedTranscript(
    chatHistory: { role: string; content: string }[],
    extractedQuestions: ExtractedQuestion[],
    tokenTarget = 3000
): string {
    const allTurns = chatHistory;
    const totalTurns = allTurns.length;

    if (estimateTokens(buildTranscript(allTurns)) <= tokenTarget) {
        return buildTranscript(allTurns); // full transcript fits
    }

    // Guaranteed turns: first 5 exchanges, last 5 exchanges,
    // AND any turn where the doctor asked a specific clinical question
    // (regardless of whether it mapped a known intent — fallback via specificityScore)
    const guaranteedIndices = new Set<number>();
    for (let i = 0; i < Math.min(10, totalTurns); i++) guaranteedIndices.add(i);
    for (let i = Math.max(0, totalTurns - 10); i < totalTurns; i++) guaranteedIndices.add(i);
    for (const q of extractedQuestions) {
        // Include if intent mapped (catalogue match) OR if it's a specific clinical question
        // This ensures non-GI specialties get their questions included even if catalogue misses
        const isClinicallySalient = q.intentSeen || q.specificityScore > 2.0;
        if (isClinicallySalient) {
            const chatIdx = q.turnIndex * 2;
            guaranteedIndices.add(chatIdx);
            guaranteedIndices.add(chatIdx + 1); // include patient reply too
        }
    }

    // Build from guaranteed turns first
    const selected = [...guaranteedIndices].sort((a, b) => a - b);

    // Fill remaining budget from middle
    let budget = tokenTarget;
    const guaranteed = selected.map(i => allTurns[i]).filter(Boolean);
    budget -= estimateTokens(guaranteed.map(m => String(m.content)).join(" "));

    // Add middle turns if budget allows
    const middle = allTurns
        .filter((_, i) => !guaranteedIndices.has(i))
        .slice(0, Math.floor(budget / 30)); // ~30 tokens per turn estimate

    const finalTurns = [...new Set([...guaranteed, ...middle])];

    return finalTurns
        .map(m => {
            const label = m.role === "user" ? "Doctor" : "Patient";
            return `${label}: ${String(m.content ?? "").trim()}`;
        })
        .join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export class IntentExtractor {
    /**
     * Transforms raw chatHistory into a structured ExtractedConsultation.
     * No LLM calls. Pure deterministic extraction.
     */
    static extract(
        chatHistory: { role: string; content: string }[],
        redFlagIntents: string[] = []
    ): ExtractedConsultation {
        const doctorMessages = chatHistory
            .map((m, chatIdx) => ({ ...m, chatIdx }))
            .filter(m => m.role === "user");

        const seenIntents = new Set<string>();
        let questionTurnIndex = 0;

        const doctorQuestions: ExtractedQuestion[] = doctorMessages.map(m => {
            const text = String(m.content ?? "").trim();
            const specificityScore = computeSpecificityScore(text);
            const mappedIntents = mapIntents(text);
            const intentSeen = mappedIntents.some(i => i.confidence >= 0.5);

            // Redundancy: check if primary intent already seen
            const primaryIntent = mappedIntents[0]?.intent;
            const isRedundant = !!(primaryIntent && seenIntents.has(primaryIntent));

            // Register all high-confidence intents
            mappedIntents
                .filter(i => i.confidence >= 0.5)
                .forEach(i => seenIntents.add(i.intent));

            const result: ExtractedQuestion = {
                text,
                turnIndex: questionTurnIndex++,
                specificityScore,
                mappedIntents,
                intentSeen,
                isRedundant,
            };
            return result;
        });

        const patientRevealedFacts = extractPatientFacts(chatHistory);
        const rawTranscript = buildTranscript(chatHistory);
        const tokenCount = estimateTokens(rawTranscript);

        // Build optimal transcript (respects token budget)
        const transcript = buildBudgetedTranscript(chatHistory, doctorQuestions, 3000);

        // Detect "asked but not actioned" flags
        const suspectedIgnoredFlags = detectIgnoredFlags(
            doctorQuestions,
            patientRevealedFacts,
            redFlagIntents
        );

        console.log(
            `IntentExtractor: ${doctorQuestions.length} doctor turns, ` +
            `tokenCount=${tokenCount}, ` +
            `intentSeen=${doctorQuestions.filter(q => q.intentSeen).length}, ` +
            `redundant=${doctorQuestions.filter(q => q.isRedundant).length}, ` +
            `ignoredFlags=${suspectedIgnoredFlags.join(", ") || "none"}`
        );

        return {
            turns: chatHistory.length,
            transcript,
            doctorQuestions,
            patientRevealedFacts,
            tokenCount,
            suspectedIgnoredFlags,
        };
    }
}
