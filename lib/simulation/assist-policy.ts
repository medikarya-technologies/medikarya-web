// =========================
// lib/simulation/assist-policy.ts
// =========================
// The case-configurable assist ladder.
//
// The ladder is semantic, not numeric: a case declares which assist TYPES are
// allowed or disabled and what each costs on the Independent track. The engine
// enforces it. Same code, different case configuration:
//
//   beginner      every assist
//   intermediate  highlights, hints, impressions — no diagnosis reveal / management
//   advanced      vital highlights only
//   assessment    nothing

import { ASSIST_TYPES, type AssistType } from "./encounter-events";
import type { AssistConfig, AssistMode } from "./case-schema";

/** Independent-score penalty per assist type when a case doesn't price it. */
export const DEFAULT_ASSIST_COSTS: Readonly<Record<AssistType, number>> = {
    highlight_abnormal: 1,
    explain_abnormal: 2,
    ecg_interpretation_hint: 3,
    radiology_impression: 3,
    socratic_hint: 3,
    diagnostic_hint: 5,
    management_guidance: 7,
    reveal_diagnosis: 10,
};

/** How each assist reads in the audit trail: "Vital abnormality highlights −1 (02:14)". */
export const ASSIST_LABELS: Readonly<Record<AssistType, string>> = {
    highlight_abnormal: "Vital abnormality highlights",
    explain_abnormal: "Abnormal value explained",
    ecg_interpretation_hint: "ECG interpretation assist",
    radiology_impression: "Radiology impression revealed",
    socratic_hint: "Socratic hint",
    diagnostic_hint: "Diagnostic hint",
    management_guidance: "Management guidance",
    reveal_diagnosis: "Diagnosis revealed",
};

interface ModePreset {
    allowed: readonly AssistType[];
    disabled: readonly AssistType[];
}

export const ASSIST_MODE_PRESETS: Readonly<Record<AssistMode, ModePreset>> = {
    beginner: { allowed: ASSIST_TYPES, disabled: [] },
    intermediate: {
        allowed: [
            "highlight_abnormal",
            "explain_abnormal",
            "ecg_interpretation_hint",
            "radiology_impression",
            "socratic_hint",
        ],
        disabled: ["reveal_diagnosis", "management_guidance"],
    },
    advanced: {
        allowed: ["highlight_abnormal"],
        disabled: [
            "explain_abnormal",
            "ecg_interpretation_hint",
            "radiology_impression",
            "socratic_hint",
            "diagnostic_hint",
            "reveal_diagnosis",
            "management_guidance",
        ],
    },
    assessment: { allowed: [], disabled: ASSIST_TYPES },
};

export type AssistDenialReason = "disabled" | "not_allowed";

export interface AssistAvailability {
    type: AssistType;
    available: boolean;
    cost: number;
    reason?: AssistDenialReason;
}

export class AssistPolicy {
    readonly mode: AssistMode;
    private readonly allowed: ReadonlySet<AssistType>;
    private readonly disabled: ReadonlySet<AssistType>;
    private readonly costs: Partial<Record<AssistType, number>>;

    constructor(config: AssistConfig | undefined) {
        this.mode = config?.mode ?? "intermediate";
        const preset = ASSIST_MODE_PRESETS[this.mode] ?? ASSIST_MODE_PRESETS.intermediate;
        this.allowed = new Set(config?.allowed ?? preset.allowed);
        this.disabled = new Set(config?.disabled ?? preset.disabled);

        this.costs = {};
        for (const type of ASSIST_TYPES) {
            const configured = config?.costs?.[type]?.independent_penalty;
            if (typeof configured === "number" && Number.isFinite(configured) && configured >= 0) {
                this.costs[type] = configured;
            }
        }
    }

    /** `disabled` always wins; otherwise the type must be on the allowlist. */
    canUse(type: AssistType): boolean {
        return this.allowed.has(type) && !this.disabled.has(type);
    }

    costOf(type: AssistType): number {
        return this.costs[type] ?? DEFAULT_ASSIST_COSTS[type];
    }

    availability(type: AssistType): AssistAvailability {
        const cost = this.costOf(type);
        if (this.disabled.has(type)) return { type, available: false, cost, reason: "disabled" };
        if (!this.allowed.has(type)) return { type, available: false, cost, reason: "not_allowed" };
        return { type, available: true, cost };
    }

    /** Every assist type with its availability — drives the UI. */
    all(): AssistAvailability[] {
        return ASSIST_TYPES.map((t) => this.availability(t));
    }
}

export function resolveAssistPolicy(config: AssistConfig | undefined): AssistPolicy {
    return new AssistPolicy(config);
}
