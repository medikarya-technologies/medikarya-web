/**
 * The scoring rules live with each case and can change after an attempt. Keep the exact rule set
 * beside the saved result so a later review can tell which version produced the mark.
 * Patient dialogue and identifiers are deliberately excluded.
 */
export function gradingAuditFor(config: Record<string, any>) {
    return {
        version: 1,
        caseRevisionUpdatedAt: config.caseRevisionUpdatedAt ?? config.updatedAt ?? null,
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

