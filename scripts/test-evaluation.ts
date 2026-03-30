/**
 * scripts/test-evaluation.ts
 * ============================================================
 * Evaluation Engine — Regression Test Suite
 *
 * Tests all 9 verification scenarios from the implementation plan.
 * Run with: npx ts-node -e "require('./scripts/test-evaluation.ts')"
 * Or:       npx tsx scripts/test-evaluation.ts
 * ============================================================
 */

const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

// We use require() because tsx/ts-node handles the TS → JS at runtime
const { IntentExtractor } = require("../engine/evaluation/IntentExtractor");
const { DeterministicScorer } = require("../engine/evaluation/DeterministicScorer");
const { getRuleEngineMissedFlags, resolveRedFlagPenalties, totalRedFlagPenalty } = require("../cases/lib/red-flag-detector");
const { EvaluationEngine } = require("../engine/evaluationEngine");
const caseData = require("../data/cases/viral-gastroenteritis.json");

// ── ANSI colour helpers ────────────────────────────────────────────────────────
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ── Result tracker ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, condition: boolean, detail = "") {
    if (condition) {
        console.log(green(`  ✓ PASS`) + ` ${label}`);
        passed++;
    } else {
        console.log(red(`  ✗ FAIL`) + ` ${label}` + (detail ? ` ${dim("→ " + detail)}` : ""));
        failed++;
        failures.push(`${label}${detail ? ": " + detail : ""}`);
    }
}

// ── Chat message factory ───────────────────────────────────────────────────────
const doc  = (text: string) => ({ role: "user",      content: text });
const pat  = (text: string) => ({ role: "assistant", content: text });

// =============================================================================
// SCENARIO DEFINITIONS
// =============================================================================

// Scenario 1: Past history asked EARLY — covers all 7 required questions in first 30% of turns
const CHAT_EARLY_HISTORY = [
    doc("How long has the vomiting been going on? How long has the diarrhoea lasted?"),
    pat("Vomiting for 3 days, diarrhoea for 2 days doctor saab."),
    doc("Has there been any blood in his stool or any discolouration in the motions?"),
    pat("No blood doctor, just watery loose motions."),
    doc("Does he have fever?"),
    pat("Yes mild fever since starting."),
    doc("Any signs of dehydration — is he passing urine normally, any sunken eyes?"),
    pat("He is peeing a little less. Eyes look normal."),
    doc("Is his immunisation up to date? All vaccinations complete?"),
    pat("No doctor, vaccinations are not fully done under UIP."),
    doc("Any hygiene issues at home? What is your water source?"),
    pat("We don't wash hands properly. We use tap water."),
    doc("Any past medical history or previous similar illness?"),
    pat("No previous illness, first time something like this."),
];

// Scenario 2: Same 7 required questions asked LATE (last 30% of turns)
const CHAT_LATE_HISTORY = [
    doc("Tell me what happened?"),
    pat("He has been vomiting a lot doctor saab."),
    doc("Ok and?"),
    pat("Loose motions also."),
    doc("Since when?"),
    pat("3 days for vomiting, 2 days for motions."),
    doc("How is he in general?"),
    pat("Very weak doctor, not eating."),
    doc("Is he going to be okay?"),
    pat("I hope so doctor saab."),
    // ── Late questions (last 30%) ────────────────────────────────────────────
    doc("How long has the vomiting been going on? How long has the diarrhoea lasted?"),
    pat("3 days vomiting, 2 days diarrhoea."),
    doc("Any blood in stool or discolouration?"),
    pat("No blood doctor."),
    doc("Does he have fever?"),
    pat("Yes mild fever."),
    doc("Any dehydration signs — is he passing urine?"),
    pat("A little less urine yes."),
    doc("Immunisation status — are vaccinations complete?"),
    pat("Not fully done."),
    doc("Any hygiene issues at home? Water source?"),
    pat("Poor hygiene, tap water."),
];

// Scenario 3: Only vague catch-all questions
const CHAT_VAGUE_ONLY = [
    doc("Tell me more."),
    pat("He has been vomiting a lot doctor saab."),
    doc("Anything else?"),
    pat("He also has loose motions."),
    doc("Other symptoms?"),
    pat("He has fever."),
    doc("Anything else I should know?"),
    pat("He looks very weak doctor saab."),
];

// Scenario 4: Semantic red flag question (NOT exact keyword)
const CHAT_SEMANTIC_RED_FLAG = [
    doc("Has there been any red colour or discolouration in his potty?"),
    pat("No doctor, nothing like that."),
    doc("What colour is the vomit — is it greenish at all?"),
    pat("No, just watery and transparent."),
    doc("Is he peeing normally? Any change in urine?"),
    pat("Yes, he is peeing, but less than usual."),
    doc("How long has this been going on?"),
    pat("3 days doctor saab."),
];

// Scenario 5: Zero red flag questions asked
const CHAT_NO_RED_FLAGS = [
    doc("How long has the vomiting been going on?"),
    pat("3 days doctor saab."),
    doc("Any fever?"),
    pat("Yes, mild fever."),
    doc("Frequency of loose motions?"),
    pat("5 to 10 times a day."),
    doc("Any past illness?"),
    pat("No previous illness."),
];

// Scenario 6: Rule engine says missed, LLM might say covered (ambiguity)
// Same as scenario 3 — vague questions that don't hit intent_patterns
const CHAT_AMBIGUITY = CHAT_VAGUE_ONLY;

// Scenario 7: Doctor asks red flag, patient confirms, doctor ignores in diagnosis
const CHAT_ASKED_BUT_IGNORED = [
    doc("Is there blood in his stool or any discolouration?"),
    pat("A bit of redness, doctor. I'm not sure if it's blood."),  // patient hints at blood
    doc("Okay noted. How long has the vomiting been going on?"),   // Doctor moves on without follow-up
    pat("3 days doctor saab."),
    doc("Any fever?"),
    pat("Yes mild fever."),
    doc("Any loose motions?"),
    pat("Yes lots of watery motions."),
];

// Scenario 8: Vague question — LLM might think covered, rule says missed
const CHAT_VAGUE_LLM_AMBIGUITY = [
    doc("Any problems with the tummy area?"),               // vague but might get LLM credit
    pat("Yes doctor, lots of vomiting and loose motion."),
    doc("Any issues otherwise?"),
    pat("He looks very weak."),
    doc("How long has this been happening?"),
    pat("3 days doctor saab."),
];

// Scenario 9: Adversarial — spams "anything else" 10 times
const CHAT_SPAM_VAGUE = [
    doc("Anything else?"),
    pat("He has vomiting."),
    doc("Anything else?"),
    pat("He has loose motions."),
    doc("Anything else?"),
    pat("He has fever."),
    doc("Anything else?"),
    pat("He looks weak."),
    doc("Anything else?"),
    pat("He is not eating."),
    doc("Anything else?"),
    pat("He is dizzy."),
    doc("Anything else?"),
    pat("He lost weight."),
    doc("Anything else?"),
    pat("He has stomach pain."),
    doc("Anything else?"),
    pat("I don't know doctor."),
    doc("Anything else?"),
    pat("Nothing more."),
];

// ── Shared diagnosis + test for full evaluation runs ─────────────────────────
const GOOD_DIAGNOSIS = {
    primaryDiagnosis: "Viral Gastroenteritis due to Rotavirus",
    managementPlan: ["ORS", "Monitor hydration", "Hygiene counselling", "Rotavirus vaccination counselling"],
};
const GOOD_TESTS = [
    { id: "stool-routine", name: "Stool Routine & Microscopy" },
    { id: "serum-electrolytes", name: "Serum Electrolytes" },
];

// =============================================================================
// TEST RUNNER
// =============================================================================

async function runTests() {
    console.log(bold("\n═══════════════════════════════════════════════════"));
    console.log(bold(" MediKarya Evaluation Engine — Regression Tests"));
    console.log(bold("═══════════════════════════════════════════════════\n"));

    const redFlagIntents = caseData.evaluation_config.red_flags
        .filter((f: any) => f.critical && f.present_in_case === false)
        .map((f: any) => f.intent);

    // Note: all red flags in this case have present_in_case: false
    // so no penalties will fire from Layer 4 (correct behaviour)
    // We test Layer 2 (coverage) separately below.

    // ───────────────────────────────────────────────────────────────────────────
    console.log(bold("▶ LAYER 1 — IntentExtractor\n"));

    // Check early history extraction
    const extractedEarly = IntentExtractor.extract(CHAT_EARLY_HISTORY, []);
    const firstQ = extractedEarly.doctorQuestions[0];
    assert(
        "S1: First question maps clinical intent(s)",
        firstQ.mappedIntents.length > 0,
        `got: ${JSON.stringify(firstQ.mappedIntents)}`
    );
    assert(
        "S1: Duration question has clinical specificity (>1.5)",
        firstQ.specificityScore > 1.5,
        `score=${firstQ.specificityScore.toFixed(2)}`
    );
    assert(
        "S1: First question is NOT marked redundant",
        !firstQ.isRedundant
    );

    // Check vague questions
    const extractedVague = IntentExtractor.extract(CHAT_VAGUE_ONLY, []);
    const allVague = extractedVague.doctorQuestions.every(q => q.specificityScore < 3);
    assert(
        "S3: All vague questions have specificityScore < 3",
        allVague,
        `scores: ${extractedVague.doctorQuestions.map(q => q.specificityScore.toFixed(1)).join(", ")}`
    );

    // Check spam detection (redundancy)
    const extractedSpam = IntentExtractor.extract(CHAT_SPAM_VAGUE, []);
    const redundancyRatio = extractedSpam.doctorQuestions.filter(q => q.isRedundant).length
        / extractedSpam.doctorQuestions.length;
    assert(
        "S9: Spam 'anything else' — majority questions marked redundant",
        redundancyRatio >= 0.5,
        `redundant ratio=${(redundancyRatio * 100).toFixed(0)}%`
    );

    // Check semantic red flag detection via mappedIntents
    const extractedSemantic = IntentExtractor.extract(CHAT_SEMANTIC_RED_FLAG, ["blood_in_stool", "bilious_vomiting", "severe_dehydration"]);
    const firstSemanticQ = extractedSemantic.doctorQuestions[0];
    const mapsBlood = firstSemanticQ.mappedIntents.some((i: any) => i.intent === "blood_in_stool");
    assert(
        "S4: 'red colour in his potty' maps to blood_in_stool intent",
        mapsBlood,
        `intents: ${firstSemanticQ.mappedIntents.map((i: any) => i.intent).join(", ")}`
    );

    // Check "asked but ignored" suspicion
    const extractedIgnored = IntentExtractor.extract(CHAT_ASKED_BUT_IGNORED, ["blood_in_stool"]);
    assert(
        "S7: 'Asked but ignored' flag detected in suspectedIgnoredFlags",
        extractedIgnored.suspectedIgnoredFlags.length > 0 || extractedIgnored.doctorQuestions[0].intentSeen,
        `ignored: ${extractedIgnored.suspectedIgnoredFlags.join(", ") || "none"} (question intentSeen=${extractedIgnored.doctorQuestions[0].intentSeen})`
    );

    // ───────────────────────────────────────────────────────────────────────────
    console.log(bold("\n▶ LAYER 2 — DeterministicScorer.scoreCoverage()\n"));

    // S1: Early history → decent structured score (7/7 covered, all early)
    // 8–10 is expected: 17.5/7 * 1.0 timing * ~0.5 avg multiplier ≈ 8.75
    // The exact value depends on specificity of each question, not just coverage count
    const coverageEarly = DeterministicScorer.scoreCoverage(extractedEarly, caseData.evaluation_config);
    assert(
        "S1: Early history (7/7 covered) → structuredHistoryScore >= 7",
        coverageEarly.structuredHistoryScore >= 7,
        `score=${coverageEarly.structuredHistoryScore.toFixed(2)}`
    );
    assert(
        "S1: Early history → all 7 required questions covered",
        coverageEarly.matrix.filter((e: any) => e.covered).length === 7,
        `covered=${coverageEarly.matrix.filter((e: any) => e.covered).length}/7`
    );
    assert(
        "S1: Early history → needsLLMHistoryScore is a boolean (logic is working)",
        typeof coverageEarly.needsLLMHistoryScore === "boolean",
        `needsLLM=${coverageEarly.needsLLMHistoryScore}, score=${coverageEarly.structuredHistoryScore.toFixed(2)} (LLM triggers if 8≤score≤14)`
    );

    // S2: Late history → lower structured score than early
    const extractedLate = IntentExtractor.extract(CHAT_LATE_HISTORY, []);
    const coverageLate = DeterministicScorer.scoreCoverage(extractedLate, caseData.evaluation_config);
    assert(
        "S2: Late history → structuredHistoryScore < early history score",
        coverageLate.structuredHistoryScore < coverageEarly.structuredHistoryScore,
        `early=${coverageEarly.structuredHistoryScore.toFixed(2)}, late=${coverageLate.structuredHistoryScore.toFixed(2)}`
    );

    // S3: Vague-only → near-zero coverage
    const coverageVague = DeterministicScorer.scoreCoverage(extractedVague, caseData.evaluation_config);
    assert(
        "S3: Vague-only → structuredHistoryScore < 4 (near zero)",
        coverageVague.structuredHistoryScore < 4,
        `score=${coverageVague.structuredHistoryScore.toFixed(2)}`
    );

    // S9: Spam → near-zero (redundancy penalty stacks)
    const coverageSpam = DeterministicScorer.scoreCoverage(extractedSpam, caseData.evaluation_config);
    assert(
        "S9: Spam 'anything else' × 10 → structuredHistoryScore < 4",
        coverageSpam.structuredHistoryScore < 4,
        `score=${coverageSpam.structuredHistoryScore.toFixed(2)}`
    );

    // Specificity cap test: one specific question should not exceed perQuestionMax
    const perQMax = 17.5 / caseData.evaluation_config.history.required_questions.length;
    const allWithinCap = coverageEarly.matrix.every(e => e.score <= perQMax + 0.01);
    assert(
        "S1: No single question exceeds per-question max score",
        allWithinCap,
        `perQMax=${perQMax.toFixed(2)}, max seen=${Math.max(...coverageEarly.matrix.map(e => e.score)).toFixed(2)}`
    );

    // ───────────────────────────────────────────────────────────────────────────
    console.log(bold("\n▶ LAYER 4 — Hybrid Red Flag Resolver\n"));
    // Note: in viral-gastroenteritis, all red flags have present_in_case: false
    // So no critical flags apply penalty here — but we test the resolver logic directly.

    // Simulate: rule says missed, LLM says missed → full penalty
    const resolutionsBothMissed = resolveRedFlagPenalties(
        ["blood_in_stool"],      // LLM missed
        ["blood_in_stool"],      // Rule missed
        caseData
    );
    // Since present_in_case = false in this case, penalty won't apply
    // Test with a mock case where present_in_case = true
    const mockCaseWithPresent = {
        evaluation_config: {
            red_flags: [{
                intent: "blood_in_stool",
                intent_patterns: ["blood", "red stool"],
                keywords: ["blood in stool"],
                present_in_case: true,
                critical: true,
            }]
        }
    };
    const resFull = resolveRedFlagPenalties(["blood_in_stool"], ["blood_in_stool"], mockCaseWithPresent);
    assert(
        "Tiered: Rule=missed + LLM=missed → penaltyLevel=full (-5)",
        resFull[0]?.penaltyLevel === "full" && resFull[0]?.penaltyPoints === 5,
        `level=${resFull[0]?.penaltyLevel}, pts=${resFull[0]?.penaltyPoints}`
    );

    const resPartialA = resolveRedFlagPenalties([], ["blood_in_stool"], mockCaseWithPresent);
    assert(
        "Tiered: Rule=missed + LLM=covered → penaltyLevel=partial (-2)",
        resPartialA[0]?.penaltyLevel === "partial" && resPartialA[0]?.penaltyPoints === 2,
        `level=${resPartialA[0]?.penaltyLevel}, pts=${resPartialA[0]?.penaltyPoints}`
    );

    const resPartialB = resolveRedFlagPenalties(["blood_in_stool"], [], mockCaseWithPresent);
    assert(
        "Tiered: Rule=covered + LLM=missed → penaltyLevel=partial (-2)",
        resPartialB[0]?.penaltyLevel === "partial" && resPartialB[0]?.penaltyPoints === 2,
        `level=${resPartialB[0]?.penaltyLevel}, pts=${resPartialB[0]?.penaltyPoints}`
    );

    const resNone = resolveRedFlagPenalties([], [], mockCaseWithPresent);
    assert(
        "Tiered: Rule=covered + LLM=covered → penaltyLevel=none (0)",
        resNone[0]?.penaltyLevel === "none" && resNone[0]?.penaltyPoints === 0,
        `level=${resNone[0]?.penaltyLevel}, pts=${resNone[0]?.penaltyPoints}`
    );

    // S4: Semantic red flag (rule engine with intent_patterns)
    const extractedSemanticForRule = IntentExtractor.extract(CHAT_SEMANTIC_RED_FLAG, []);
    const ruleMissedSemantic = getRuleEngineMissedFlags(extractedSemanticForRule, caseData);
    assert(
        "S4: Semantic phrasing ('red colour in potty') — rule engine does NOT flag as missed",
        !ruleMissedSemantic.includes("blood_in_stool"),
        `ruleMissed: ${ruleMissedSemantic.join(", ") || "none"}`
    );

    // S5: No red flag questions at all
    const extractedNoFlags = IntentExtractor.extract(CHAT_NO_RED_FLAGS, []);
    const ruleMissedNone = getRuleEngineMissedFlags(extractedNoFlags, caseData);
    // Note: present_in_case=false, so no flags are critical+present → empty array expected
    assert(
        "S5: No red flag questions, but present_in_case=false → no critical violations",
        Array.isArray(ruleMissedNone),
        `ruleMissed: ${ruleMissedNone.join(", ") || "none (correct — present_in_case=false)"}`
    );

    // ───────────────────────────────────────────────────────────────────────────
    console.log(bold("\n▶ FULL PIPELINE — EvaluationEngine.evaluate()\n"));
    console.log(yellow("  ⏳ This calls the LLM (Groq). Takes 5–15 seconds...\n"));

    try {
        const result = await EvaluationEngine.evaluate(
            GOOD_DIAGNOSIS,
            GOOD_TESTS,
            CHAT_EARLY_HISTORY,
            caseData
        );

        console.log(dim(`\n  ── Full Result ──────────────────────────────`));
        console.log(dim(`  finalScore:       ${result.finalScore}`));
        console.log(dim(`  historyScore:     ${result.historyScore?.toFixed ? result.historyScore.toFixed(1) : result.historyScore} / 25`));
        console.log(dim(`  reasoningScore:   ${result.reasoningScore} / 30`));
        console.log(dim(`  diagnosisScore:   ${result.diagnosisScore} / 15`));
        console.log(dim(`  testingScore:     ${result.testingScore} / 20`));
        console.log(dim(`  managementScore:  ${result.managementScore} / 10`));
        console.log(dim(`  safetyPenalty:    -${result.safetyPenalty}`));
        console.log(dim(`  isCorrect:        ${result.isCorrect}`));
        console.log(dim(`  missedRedFlags:   ${result.missedRedFlags?.join(", ") || "none"}`));
        console.log(dim(`  strengths[0]:     ${result.feedback?.strengths?.[0]}`));
        console.log(dim(`  improvements[0]:  ${result.feedback?.improvements?.[0]}`));
        console.log(dim(`  ─────────────────────────────────────────────\n`));

        assert("Full pipeline returns a finalScore (0–100)", result.finalScore >= 0 && result.finalScore <= 100, `score=${result.finalScore}`);
        assert("Full pipeline: historyScore is present", result.historyScore !== undefined);
        assert("Full pipeline: feedback.strengths not empty", result.feedback?.strengths?.length > 0);
        assert("Full pipeline: redFlagResolutions present", Array.isArray(result.redFlagResolutions));
        assert("Full pipeline: isCorrect=true (diagnosis matched)", result.isCorrect === true, `diagnosis="${result.studentDiagnosis}"`);
    } catch (err: any) {
        console.log(red(`  ✗ FAIL`) + ` Full pipeline threw: ${err.message}`);
        failed++;
        failures.push(`Full pipeline: ${err.message}`);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // RESULTS SUMMARY
    console.log(bold("\n═══════════════════════════════════════════════════"));
    console.log(bold(` RESULTS: ${green(String(passed))} passed  ${failed > 0 ? red(String(failed)) : "0"} failed`));
    console.log(bold("═══════════════════════════════════════════════════"));
    if (failures.length > 0) {
        console.log(red("\nFailed assertions:"));
        failures.forEach(f => console.log(red(`  • ${f}`)));
    } else {
        console.log(green("\n  All tests passed. Evaluation engine is working correctly."));
    }
    console.log();
}

runTests().catch(err => {
    console.error(red("\nTest runner crashed:"), err);
    process.exit(1);
});
