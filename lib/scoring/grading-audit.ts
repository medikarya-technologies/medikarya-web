import {
    CLASSIC_EXAMINER_MODEL,
    CLASSIC_PROMPT_REVISION,
    GRADING_ENGINE_REVISION,
    RUBRIC_EXAMINER_MODEL,
    RUBRIC_PROMPT_REVISION,
} from "../../engine/evaluation/gradingVersion";
import { HISTORY_SCORING_VERSION } from "../../engine/evaluation/historyCoverage";

/**
 * The scoring rules live with each case and can change after an attempt. Keep the exact rule set
 * beside the saved result so a later review can tell which version produced the mark.
 * Patient dialogue and identifiers are deliberately excluded.
 */
export function gradingAuditFor(config: Record<string, any>) {
    return {
        version: 2,
        engineRevision: GRADING_ENGINE_REVISION,
        grader: {
            classicModel: CLASSIC_EXAMINER_MODEL,
            classicPromptRevision: CLASSIC_PROMPT_REVISION,
            rubricModel: RUBRIC_EXAMINER_MODEL,
            rubricPromptRevision: RUBRIC_PROMPT_REVISION,
            historyScoringVersion: HISTORY_SCORING_VERSION,
        },
        caseRevisionUpdatedAt: config.caseRevisionUpdatedAt ?? config.updatedAt ?? null,
        case: {
            id: config.id ?? null,
            title: config.title ?? null,
            displayTitle: config.displayTitle ?? null,
            diagnosis: config.diagnosis ?? null,
            patient: config.patient ? {
                age: config.patient.age ?? null,
                gender: config.patient.gender ?? null,
                chiefComplaint: config.patient.chiefComplaint ?? null,
                final_diagnosis: config.patient.final_diagnosis ?? null,
            } : null,
        },
        scoringMode: config.scoring_mode ?? null,
        evaluationConfig: config.evaluation_config ?? null,
        scoringRubric: config.scoring_rubric ?? null,
        simulationRules: {
            initialState: config.initial_state ?? null,
            eventRules: config.event_rules ?? null,
            actionConsequences: config.action_consequences ?? null,
            clinicalConstraints: config.clinical_constraints ?? null,
            livePlan: config.live_plan ?? null,
        },
    };
}

