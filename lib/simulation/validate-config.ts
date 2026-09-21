// =========================
// lib/simulation/validate-config.ts
// =========================
// Validates the simulation block of a case JSON.
//
// Cases are pure data, so a typo is the most likely way to ship a broken one:
// a flag misspelt in a rule silently never fires, and nothing crashes. This
// catches that class of mistake at authoring time. Errors make the case
// invalid; warnings flag things that are legal but probably not intended.

import { ASSIST_TYPES } from "./encounter-events";
import {
    ASSIST_MODES,
    CONSCIOUSNESS_LEVELS,
    PHYSIOLOGICAL_PARAMETERS,
    RHYTHM_TYPES,
    SCORING_DOMAINS,
    STABILITY_LEVELS,
} from "./case-schema";
import { tryParseBpDelta, tryParseDelta } from "./patient-state";
import { ACCESSORIES, EXPRESSIONS, GARMENTS, SKIN_TONES, SWELLINGS } from "./appearance";

export interface ValidationIssue {
    path: string;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
}

export interface ValidationOptions {
    /** Intervention ids the tray offers. Unknown ids in consequences / rubrics become warnings. */
    knownActions?: readonly string[];
    /** Catalog test ids. Unknown ids in `investigation_results` / rubrics become warnings. */
    knownTestIds?: readonly string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const COMPARATORS = ["lt", "lte", "gt", "gte", "eq", "neq", "in"] as const;

const CONDITION_KEYS = new Set([
    "all", "any", "not",
    "time_elapsed_gte_minutes", "time_elapsed_lt_minutes",
    "flag", "is", "state", "alarm", "minutes_since_flag",
    "parameter", ...COMPARATORS,
]);

const ENCOUNTER_PREDICATE_KEYS = new Set([
    "ordered", "within_minutes", "within_actions", "gave", "performed", "asked_about",
    "interpretation_mentions", "reasoning_mentions", "diagnosis_matches", "differential_slot",
    "differential_contains", "plan_mentions", "revealed", "rule_fired", "budgeted_actions_lte",
]);

export function validateSimulationCase(input: unknown, options: ValidationOptions = {}): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const error = (path: string, message: string): void => {
        errors.push({ path, message });
    };
    const warn = (path: string, message: string): void => {
        warnings.push({ path, message });
    };

    if (!isObj(input)) {
        error("$", "Case must be a JSON object.");
        return { ok: false, errors, warnings };
    }
    const c = input;
    if (!isStr(c.id)) error("id", "Case needs a string `id`.");

    // ── clinical_constraints ────────────────────────────────────────────────
    const constraints = c.clinical_constraints;
    if (!isObj(constraints)) {
        error("clinical_constraints", "Missing `clinical_constraints`.");
    } else {
        // All optional: a case shows only the pressure it defines. When present, each must be sensible.
        for (const key of ["recommended_actions", "critical_window_minutes", "hard_time_limit_minutes"]) {
            if (constraints[key] !== undefined && (!isNum(constraints[key]) || (constraints[key] as number) <= 0)) {
                error(`clinical_constraints.${key}`, "Must be a positive number.");
            }
        }
        if (constraints.untimed !== undefined && typeof constraints.untimed !== "boolean") {
            error("clinical_constraints.untimed", "Must be true or false.");
        }
        if (constraints.time_scale !== undefined && (!isNum(constraints.time_scale) || constraints.time_scale <= 0)) {
            error("clinical_constraints.time_scale", "Must be a positive number.");
        }
        if (
            isNum(constraints.critical_window_minutes) &&
            isNum(constraints.hard_time_limit_minutes) &&
            constraints.critical_window_minutes >= constraints.hard_time_limit_minutes
        ) {
            warn("clinical_constraints", "critical_window_minutes should be shorter than hard_time_limit_minutes.");
        }
    }

    // ── assist_config ───────────────────────────────────────────────────────
    const assist = c.assist_config;
    if (!isObj(assist)) {
        error("assist_config", "Missing `assist_config`.");
    } else {
        if (!(ASSIST_MODES as readonly unknown[]).includes(assist.mode)) {
            error("assist_config.mode", `Must be one of ${ASSIST_MODES.join(", ")}.`);
        }
        for (const list of ["allowed", "disabled"] as const) {
            const value = assist[list];
            if (value === undefined) continue;
            if (!Array.isArray(value)) {
                error(`assist_config.${list}`, "Must be an array of assist types.");
                continue;
            }
            value.forEach((t, i) => {
                if (!(ASSIST_TYPES as readonly unknown[]).includes(t)) {
                    error(`assist_config.${list}[${i}]`, `Unknown assist type "${String(t)}".`);
                }
            });
        }
        if (Array.isArray(assist.allowed) && Array.isArray(assist.disabled)) {
            for (const t of assist.allowed) {
                if (assist.disabled.includes(t)) {
                    warn("assist_config", `"${String(t)}" is both allowed and disabled — disabled wins.`);
                }
            }
        }
        if (assist.costs !== undefined) {
            if (!isObj(assist.costs)) {
                error("assist_config.costs", "Must be an object keyed by assist type.");
            } else {
                for (const [type, cost] of Object.entries(assist.costs)) {
                    if (!(ASSIST_TYPES as readonly string[]).includes(type)) {
                        error(`assist_config.costs.${type}`, "Unknown assist type.");
                    } else if (!isObj(cost) || !isNum(cost.independent_penalty) || cost.independent_penalty < 0) {
                        error(`assist_config.costs.${type}`, "Needs a non-negative numeric `independent_penalty`.");
                    }
                }
            }
        }
    }

    // ── initial_state ───────────────────────────────────────────────────────
    const declaredFlags = new Set<string>();
    const initialFlags: Record<string, boolean> = {};
    let initialStateName = "baseline";
    const init = c.initial_state;
    if (!isObj(init)) {
        error("initial_state", "Missing `initial_state`.");
    } else {
        if (!(RHYTHM_TYPES as readonly unknown[]).includes(init.rhythm)) {
            error("initial_state.rhythm", `Must be one of ${RHYTHM_TYPES.join(", ")}.`);
        }
        if (!isNum(init.rate) || init.rate < 0 || init.rate > 240) {
            error("initial_state.rate", "Must be a heart rate between 0 and 240.");
        }
        if (!(STABILITY_LEVELS as readonly unknown[]).includes(init.stability)) {
            error("initial_state.stability", `Must be one of ${STABILITY_LEVELS.join(", ")}.`);
        }
        if (init.consciousness !== undefined && !(CONSCIOUSNESS_LEVELS as readonly unknown[]).includes(init.consciousness)) {
            error("initial_state.consciousness", `Must be one of ${CONSCIOUSNESS_LEVELS.join(", ")}.`);
        }
        for (const key of ["systolic", "diastolic", "spo2", "rr", "temperature"]) {
            if (init[key] !== undefined && !isNum(init[key])) error(`initial_state.${key}`, "Must be a number.");
        }
        if (init.unmeasured !== undefined) {
            const known = ["hr", "bp", "spo2", "rr", "temperature"];
            if (!Array.isArray(init.unmeasured) || init.unmeasured.some((k) => !known.includes(k as string))) {
                error("initial_state.unmeasured", `Must be a list drawn from ${known.join(", ")}.`);
            }
        }
        if (isStr(init.state)) initialStateName = init.state;
        if (!isObj(init.flags)) {
            error("initial_state.flags", "Missing `flags` — every named flag must be declared here.");
        } else {
            for (const [name, value] of Object.entries(init.flags)) {
                if (typeof value !== "boolean") error(`initial_state.flags.${name}`, "Must be true or false.");
                else initialFlags[name] = value;
                declaredFlags.add(name);
            }
        }
    }

    // ── Condition checking (closes over the declared flags/states/alarms) ──
    const alarmNames = new Set<string>();
    if (Array.isArray(c.state_thresholds)) {
        for (const t of c.state_thresholds) if (isObj(t) && isStr(t.trigger)) alarmNames.add(t.trigger);
    }
    const enteredStates = new Set<string>([initialStateName]);
    if (Array.isArray(c.event_rules)) {
        for (const r of c.event_rules) if (isObj(r) && isStr(r.transition)) enteredStates.add(r.transition);
    }

    const flagsRequiredTrue = new Set<string>();
    const flagsRequiredFalse = new Set<string>();
    const referencedStates: Array<{ path: string; state: string }> = [];

    const checkCondition = (cond: unknown, path: string, allowEncounter: boolean): void => {
        if (!isObj(cond)) return error(path, "Condition must be an object.");
        const keys = Object.keys(cond);
        if (keys.length === 0) return error(path, "Condition is empty.");

        for (const k of keys) {
            const known = CONDITION_KEYS.has(k) || (allowEncounter && ENCOUNTER_PREDICATE_KEYS.has(k));
            if (!known) error(`${path}.${k}`, `Unknown condition key "${k}".`);
        }

        if ("all" in cond || "any" in cond) {
            const which = "all" in cond ? "all" : "any";
            const list = cond[which];
            if (!Array.isArray(list) || list.length === 0) return error(`${path}.${which}`, "Must be a non-empty array.");
            list.forEach((child, i) => checkCondition(child, `${path}.${which}[${i}]`, allowEncounter));
            return;
        }
        if ("not" in cond) return checkCondition(cond.not, `${path}.not`, allowEncounter);

        if ("time_elapsed_gte_minutes" in cond && !(isNum(cond.time_elapsed_gte_minutes) && cond.time_elapsed_gte_minutes >= 0)) {
            error(`${path}.time_elapsed_gte_minutes`, "Must be a number of minutes ≥ 0.");
        }
        if ("time_elapsed_lt_minutes" in cond && !(isNum(cond.time_elapsed_lt_minutes) && cond.time_elapsed_lt_minutes > 0)) {
            error(`${path}.time_elapsed_lt_minutes`, "Must be a number of minutes > 0.");
        }
        if ("flag" in cond) {
            if (!isStr(cond.flag)) error(`${path}.flag`, "Must be a flag name.");
            else if (!declaredFlags.has(cond.flag)) {
                error(`${path}.flag`, `Flag "${cond.flag}" is not declared in initial_state.flags.`);
            } else if (typeof cond.is !== "boolean") {
                error(`${path}.is`, "`flag` conditions need `is: true|false`.");
            } else if (!allowEncounter) {
                (cond.is ? flagsRequiredTrue : flagsRequiredFalse).add(cond.flag);
            }
        }
        if ("state" in cond) {
            if (!isStr(cond.state)) error(`${path}.state`, "Must be a state name.");
            else referencedStates.push({ path: `${path}.state`, state: cond.state });
        }
        if ("alarm" in cond) {
            if (!isStr(cond.alarm)) error(`${path}.alarm`, "Must be an alarm name.");
            else if (!alarmNames.has(cond.alarm)) {
                error(`${path}.alarm`, `Alarm "${cond.alarm}" is not defined in state_thresholds.`);
            }
        }
        if ("minutes_since_flag" in cond) {
            const m = cond.minutes_since_flag;
            if (!isObj(m) || !isStr(m.flag) || !isNum(m.gte)) {
                error(`${path}.minutes_since_flag`, "Needs { flag, gte } with a numeric gte.");
            } else if (!declaredFlags.has(m.flag)) {
                error(`${path}.minutes_since_flag.flag`, `Flag "${m.flag}" is not declared in initial_state.flags.`);
            }
        }
        if ("parameter" in cond) {
            if (!(PHYSIOLOGICAL_PARAMETERS as readonly unknown[]).includes(cond.parameter)) {
                error(`${path}.parameter`, `Unknown parameter "${String(cond.parameter)}".`);
            }
            if (!COMPARATORS.some((k) => k in cond)) {
                error(path, `Needs one of ${COMPARATORS.join(", ")}.`);
            }
            for (const k of ["lt", "lte", "gt", "gte"] as const) {
                if (k in cond && !isNum(cond[k])) error(`${path}.${k}`, "Must be a number.");
            }
        }
        if (allowEncounter) checkEncounterLeaf(cond, path);
    };

    const checkEncounterLeaf = (cond: Obj, path: string): void => {
        const idList = (v: unknown) => (typeof v === "string" ? [v] : Array.isArray(v) ? v : null);
        for (const key of ["ordered", "gave", "performed", "revealed"] as const) {
            if (!(key in cond)) continue;
            const ids = idList(cond[key]);
            if (!ids || ids.length === 0 || !ids.every(isStr)) {
                error(`${path}.${key}`, "Must be an id or a non-empty list of ids.");
                continue;
            }
            const known = key === "gave" ? options.knownActions : key === "ordered" ? options.knownTestIds : undefined;
            if (known) {
                for (const id of ids as string[]) {
                    if (!known.includes(id)) warn(`${path}.${key}`, `"${id}" is not a known ${key === "gave" ? "intervention" : "test"} id.`);
                }
            }
        }
        for (const key of ["asked_about", "reasoning_mentions", "diagnosis_matches", "differential_contains", "plan_mentions"] as const) {
            if (key in cond && !(Array.isArray(cond[key]) && (cond[key] as unknown[]).length > 0 && (cond[key] as unknown[]).every(isStr))) {
                error(`${path}.${key}`, "Must be a non-empty list of phrases.");
            }
        }
        if ("interpretation_mentions" in cond) {
            const m = cond.interpretation_mentions;
            if (!isObj(m) || !Array.isArray(m.any_of) || m.any_of.length === 0 || !m.any_of.every(isStr)) {
                error(`${path}.interpretation_mentions`, "Needs { testId?, any_of: [phrases] }.");
            }
        }
        if ("differential_slot" in cond) {
            const m = cond.differential_slot;
            if (!isObj(m) || ![1, 2, 3].includes(m.slot as number) || !Array.isArray(m.matches) || m.matches.length === 0) {
                error(`${path}.differential_slot`, "Needs { slot: 1|2|3, matches: [phrases] }.");
            }
        }
        if ("budgeted_actions_lte" in cond && !(isNum(cond.budgeted_actions_lte) || cond.budgeted_actions_lte === "recommended")) {
            error(`${path}.budgeted_actions_lte`, 'Must be a number or "recommended".');
        }
        for (const key of ["within_minutes", "within_actions"] as const) {
            if (key in cond && !isNum(cond[key])) error(`${path}.${key}`, "Must be a number.");
        }
    };

    const checkChanges = (changes: unknown, path: string): void => {
        if (changes === undefined) return;
        if (!isObj(changes)) return error(path, "Must be an object.");
        for (const key of ["hr_delta", "spo2_delta", "rr_delta", "temp_delta"] as const) {
            if (key in changes && tryParseDelta(changes[key] as string | number) === null) {
                error(`${path}.${key}`, `"${String(changes[key])}" is not a delta like "+8" or "-3".`);
            }
        }
        if ("hr_set" in changes && !isNum(changes.hr_set)) error(`${path}.hr_set`, "Must be a number.");
        if ("bp_delta" in changes && (typeof changes.bp_delta !== "string" || tryParseBpDelta(changes.bp_delta) === null)) {
            error(`${path}.bp_delta`, 'Must look like "-14/-8".');
        }
        if ("rhythm" in changes && !(RHYTHM_TYPES as readonly unknown[]).includes(changes.rhythm)) {
            error(`${path}.rhythm`, `Unknown rhythm "${String(changes.rhythm)}".`);
        }
        if ("consciousness" in changes && !(CONSCIOUSNESS_LEVELS as readonly unknown[]).includes(changes.consciousness)) {
            error(`${path}.consciousness`, `Unknown level "${String(changes.consciousness)}".`);
        }
        if ("stability" in changes && !(STABILITY_LEVELS as readonly unknown[]).includes(changes.stability)) {
            error(`${path}.stability`, `Unknown stability "${String(changes.stability)}".`);
        }
    };

    const checkSets = (sets: unknown, path: string): string[] => {
        if (sets === undefined) return [];
        if (!isObj(sets)) {
            error(path, "Must be an object of flag: boolean.");
            return [];
        }
        const written: string[] = [];
        for (const [flag, value] of Object.entries(sets)) {
            if (!declaredFlags.has(flag)) error(`${path}.${flag}`, `Flag "${flag}" is not declared in initial_state.flags.`);
            if (typeof value !== "boolean") error(`${path}.${flag}`, "Must be true or false.");
            else if (value !== initialFlags[flag]) written.push(`${flag}:${value}`);
        }
        return written;
    };

    // ── action_consequences ────────────────────────────────────────────────
    const consequenceActions = new Set<string>();
    const settableTo = new Set<string>(); // "flag:value" reachable by some consequence/rule
    if (!Array.isArray(c.action_consequences)) {
        error("action_consequences", "Missing `action_consequences` array.");
    } else {
        c.action_consequences.forEach((entry, i) => {
            const path = `action_consequences[${i}]`;
            if (!isObj(entry) || !isStr(entry.action)) return error(path, "Needs a string `action`.");
            consequenceActions.add(entry.action);
            if (entry.when !== undefined) checkCondition(entry.when, `${path}.when`, false);
            checkSets(entry.sets, `${path}.sets`).forEach((s) => settableTo.add(s));
            checkChanges(entry.physiological_changes, `${path}.physiological_changes`);
            if (entry.trajectory_note !== undefined && typeof entry.trajectory_note !== "string") {
                error(`${path}.trajectory_note`, "Must be a string.");
            }
            if (options.knownActions && !options.knownActions.includes(entry.action)) {
                const derived = /_ordered$|_performed$/.test(entry.action);
                const recognised = Array.isArray(c.recognition_rules) &&
                    c.recognition_rules.some((r) => isObj(r) && r.action === entry.action);
                const emitted = Array.isArray(c.event_rules) &&
                    c.event_rules.some((r) => isObj(r) && (r.emits === entry.action || (Array.isArray(r.emits) && r.emits.includes(entry.action))));
                const stateConsequence = isObj(c.investigation_results) &&
                    Object.values(c.investigation_results).some((r) => isObj(r) && r.state_consequence === entry.action);
                if (!derived && !recognised && !emitted && !stateConsequence) {
                    warn(`${path}.action`, `"${entry.action}" is not a tray intervention, a derived action or a system action — nothing will trigger it.`);
                }
            }
        });
    }

    // ── event_rules ─────────────────────────────────────────────────────────
    if (!Array.isArray(c.event_rules)) {
        error("event_rules", "Missing `event_rules` array.");
    } else {
        const seen = new Set<string>();
        c.event_rules.forEach((rule, i) => {
            const path = `event_rules[${i}]`;
            if (!isObj(rule)) return error(path, "Must be an object.");
            if (!isStr(rule.id)) error(`${path}.id`, "Needs a string `id`.");
            else if (seen.has(rule.id)) error(`${path}.id`, `Duplicate rule id "${rule.id}".`);
            else seen.add(rule.id);
            if (!isStr(rule.transition)) error(`${path}.transition`, "Needs a `transition` state name.");
            if (rule.when === undefined) error(`${path}.when`, "Needs a `when` condition.");
            else checkCondition(rule.when, `${path}.when`, false);
            checkChanges(rule.physiological_changes, `${path}.physiological_changes`);
            checkSets(rule.sets, `${path}.sets`).forEach((s) => settableTo.add(s));
            if (rule.narrative !== undefined && rule.narrative !== null && typeof rule.narrative !== "string") {
                error(`${path}.narrative`, "Must be a string or null.");
            }
            const emits = rule.emits === undefined ? [] : Array.isArray(rule.emits) ? rule.emits : [rule.emits];
            for (const action of emits) {
                if (!isStr(action)) error(`${path}.emits`, "Must be an action name or list of them.");
                else if (!consequenceActions.has(action)) {
                    warn(`${path}.emits`, `"${action}" has no entry in action_consequences — emitting it does nothing.`);
                }
            }
        });
    }

    // ── state_thresholds ────────────────────────────────────────────────────
    if (c.state_thresholds !== undefined) {
        if (!Array.isArray(c.state_thresholds)) error("state_thresholds", "Must be an array.");
        else {
            c.state_thresholds.forEach((t, i) => {
                const path = `state_thresholds[${i}]`;
                if (!isObj(t)) return error(path, "Must be an object.");
                if (!isStr(t.trigger)) error(`${path}.trigger`, "Needs a `trigger` (alarm name).");
                if (!(PHYSIOLOGICAL_PARAMETERS as readonly unknown[]).includes(t.parameter)) {
                    error(`${path}.parameter`, `Unknown parameter "${String(t.parameter)}".`);
                }
                if (!COMPARATORS.some((k) => k in t)) error(path, `Needs one of ${COMPARATORS.join(", ")}.`);
            });
        }
    }

    // ── recognition_rules ───────────────────────────────────────────────────
    if (c.recognition_rules !== undefined) {
        if (!Array.isArray(c.recognition_rules)) error("recognition_rules", "Must be an array.");
        else {
            c.recognition_rules.forEach((r, i) => {
                const path = `recognition_rules[${i}]`;
                if (!isObj(r)) return error(path, "Must be an object.");
                if (!isStr(r.id)) error(`${path}.id`, "Needs an `id`.");
                if (!isStr(r.action)) error(`${path}.action`, "Needs an `action`.");
                else if (!consequenceActions.has(r.action)) {
                    warn(`${path}.action`, `"${r.action}" has no entry in action_consequences.`);
                }
                if (!Array.isArray(r.sources) || r.sources.length === 0 ||
                    !r.sources.every((s) => s === "interpretation" || s === "differential" || s === "diagnosis")) {
                    error(`${path}.sources`, 'Must list "interpretation", "differential" and/or "diagnosis".');
                }
                if (!Array.isArray(r.any_of) || r.any_of.length === 0 || !r.any_of.every(isStr)) {
                    error(`${path}.any_of`, "Needs a non-empty list of phrases.");
                }
            });
        }
    }

    // ── examination ─────────────────────────────────────────────────────────
    if (c.examination !== undefined) {
        if (!Array.isArray(c.examination)) error("examination", "Must be an array.");
        else {
            const seen = new Set<string>();
            c.examination.forEach((m, i) => {
                const path = `examination[${i}]`;
                if (!isObj(m)) return error(path, "Must be an object.");
                if (!isStr(m.id)) error(`${path}.id`, "Needs an `id`.");
                else if (seen.has(m.id)) error(`${path}.id`, `Duplicate manoeuvre id "${m.id}".`);
                else seen.add(m.id);
                if (!isStr(m.label)) error(`${path}.label`, "Needs a `label`.");
                if (!isStr(m.findings)) error(`${path}.findings`, "Needs `findings` text.");
                if (m.findings_by_state !== undefined) {
                    if (!Array.isArray(m.findings_by_state)) error(`${path}.findings_by_state`, "Must be an array.");
                    else {
                        m.findings_by_state.forEach((v, j) => {
                            if (!isObj(v) || !isStr(v.findings)) return error(`${path}.findings_by_state[${j}]`, "Needs { when, findings }.");
                            checkCondition(v.when, `${path}.findings_by_state[${j}].when`, false);
                        });
                    }
                }
            });
        }
    }

    // ── custom_tests / order_menu / scoring_mode ────────────────────────────
    const customTestIds = new Set<string>();
    if (c.custom_tests !== undefined) {
        if (!Array.isArray(c.custom_tests)) error("custom_tests", "Must be an array.");
        else {
            const kinds = ["lab", "ecg", "imaging", "bedside", "procedure"];
            c.custom_tests.forEach((t, i) => {
                const path = `custom_tests[${i}]`;
                if (!isObj(t) || !isStr(t.id) || !isStr(t.name) || !isStr(t.category)) {
                    return error(path, "Needs { id, name, category, kind }.");
                }
                if (customTestIds.has(t.id)) error(`${path}.id`, `Duplicate test id "${t.id}".`);
                customTestIds.add(t.id);
                if (!kinds.includes(t.kind as string)) error(`${path}.kind`, `Must be one of ${kinds.join(", ")}.`);
                if (t.turnaround_minutes !== undefined && (!isNum(t.turnaround_minutes) || t.turnaround_minutes < 0)) {
                    error(`${path}.turnaround_minutes`, "Must be a number ≥ 0.");
                }
            });
        }
    }
    if (c.order_menu !== undefined && c.order_menu !== "catalog" && c.order_menu !== "case_only") {
        error("order_menu", "Must be \"catalog\" or \"case_only\".");
    }
    if (c.scoring_mode !== undefined && c.scoring_mode !== "rubric" && c.scoring_mode !== "classic") {
        error("scoring_mode", "Must be \"rubric\" or \"classic\".");
    }
    if (c.available_interventions !== undefined && (!Array.isArray(c.available_interventions) || c.available_interventions.some((a) => !isStr(a)))) {
        error("available_interventions", "Must be a list of intervention ids (`[]` for no tray).");
    }

    // ── investigation_results ───────────────────────────────────────────────
    if (c.investigation_results !== undefined) {
        if (!isObj(c.investigation_results)) error("investigation_results", "Must be an object keyed by test id.");
        else {
            for (const [testId, result] of Object.entries(c.investigation_results)) {
                const path = `investigation_results.${testId}`;
                if (options.knownTestIds && !options.knownTestIds.includes(testId) && !customTestIds.has(testId)) {
                    warn(path, `"${testId}" is not in the master catalog.`);
                }
                if (!isObj(result)) {
                    error(path, "Must be an object.");
                    continue;
                }
                if (result.turnaround_minutes !== undefined && (!isNum(result.turnaround_minutes) || result.turnaround_minutes < 0)) {
                    error(`${path}.turnaround_minutes`, "Must be a number ≥ 0.");
                }
                if (result.rows !== undefined) {
                    if (!Array.isArray(result.rows)) error(`${path}.rows`, "Must be an array of { parameter, value }.");
                    else {
                        result.rows.forEach((row, j) => {
                            if (!isObj(row) || !isStr(row.parameter) || (!isStr(row.value) && !isNum(row.value))) {
                                error(`${path}.rows[${j}]`, "Needs { parameter, value }.");
                            }
                        });
                    }
                }
                if (Array.isArray(result.variants)) {
                    result.variants.forEach((v, j) => {
                        if (!isObj(v)) return error(`${path}.variants[${j}]`, "Must be an object.");
                        checkCondition(v.when, `${path}.variants[${j}].when`, false);
                    });
                }
                if (isObj(result.ecg)) {
                    if (result.ecg.rhythm !== undefined && !(RHYTHM_TYPES as readonly unknown[]).includes(result.ecg.rhythm)) {
                        error(`${path}.ecg.rhythm`, `Unknown rhythm "${String(result.ecg.rhythm)}".`);
                    }
                    if (result.ecg.rate !== undefined && !isNum(result.ecg.rate)) {
                        error(`${path}.ecg.rate`, "Must be a number.");
                    }
                }
            }
        }
    }

    // ── socratic_hints ──────────────────────────────────────────────────────
    if (Array.isArray(c.socratic_hints)) {
        const seen = new Set<string>();
        c.socratic_hints.forEach((h, i) => {
            const path = `socratic_hints[${i}]`;
            if (!isObj(h) || !isStr(h.id) || !isStr(h.hint)) return error(path, "Needs { id, when, hint }.");
            if (seen.has(h.id)) error(`${path}.id`, `Duplicate hint id "${h.id}".`);
            seen.add(h.id);
            checkCondition(h.when, `${path}.when`, false);
        });
    }

    // ── appearance ──────────────────────────────────────────────────────────
    if (c.appearance !== undefined) {
        if (!isObj(c.appearance)) error("appearance", "Must be an object.");
        else {
            const checkLook = (look: Obj, path: string): void => {
                for (const key of ["pallor", "jaundice", "cyanosis", "flushed", "sweating", "sunken_eyes"]) {
                    if (look[key] !== undefined && ![0, 1, 2, 3].includes(look[key] as number)) error(`${path}.${key}`, "Must be 0, 1, 2 or 3.");
                }
                if (look.expression !== undefined && !(EXPRESSIONS as readonly unknown[]).includes(look.expression)) {
                    error(`${path}.expression`, `Must be one of ${EXPRESSIONS.join(", ")}.`);
                }
                if (look.swelling !== undefined && !(SWELLINGS as readonly unknown[]).includes(look.swelling)) {
                    error(`${path}.swelling`, `Must be one of ${SWELLINGS.join(", ")}.`);
                }
                if (look.note !== undefined && typeof look.note !== "string") error(`${path}.note`, "Must be text.");
            };
            checkLook(c.appearance, "appearance");
            if (c.appearance.skin_tone !== undefined && !(SKIN_TONES as readonly unknown[]).includes(c.appearance.skin_tone)) {
                error("appearance.skin_tone", `Must be one of ${SKIN_TONES.join(", ")}.`);
            }
            if (c.appearance.attire !== undefined && !(GARMENTS as readonly unknown[]).includes(c.appearance.attire)) {
                error("appearance.attire", `Must be one of ${GARMENTS.join(", ")}.`);
            }
            if (c.appearance.accessories !== undefined) {
                if (!Array.isArray(c.appearance.accessories)) error("appearance.accessories", "Must be a list.");
                else {
                    c.appearance.accessories.forEach((a, i) => {
                        if (!(ACCESSORIES as readonly unknown[]).includes(a)) error(`appearance.accessories[${i}]`, `Must be one of ${ACCESSORIES.join(", ")}.`);
                    });
                }
            }
            if (c.appearance.variants !== undefined) {
                if (!Array.isArray(c.appearance.variants)) error("appearance.variants", "Must be an array.");
                else {
                    c.appearance.variants.forEach((v, i) => {
                        const path = `appearance.variants[${i}]`;
                        if (!isObj(v)) return error(path, "Must be an object.");
                        checkLook(v, path);
                        checkCondition(v.when, `${path}.when`, false);
                    });
                }
            }
        }
    }

    // ── scoring_rubric ──────────────────────────────────────────────────────
    const rubricGaps = new Set<string>();
    if (c.scoring_rubric === undefined) {
        // A classically scored case is judged by its `evaluation_config`, not a rubric.
        if (c.scoring_mode !== "classic") {
            warn("scoring_rubric", "No scoring_rubric: the case runs, but the encounter cannot be scored.");
        }
    } else {
        const rubric = c.scoring_rubric;
        if (!isObj(rubric)) error("scoring_rubric", "Must be an object.");
        else {
            if (!isObj(rubric.weights)) error("scoring_rubric.weights", "Missing domain weights.");
            else {
                let total = 0;
                for (const d of SCORING_DOMAINS) {
                    const w = rubric.weights[d];
                    if (!isNum(w) || w < 0) error(`scoring_rubric.weights.${d}`, "Must be a number ≥ 0.");
                    else total += w;
                }
                if (total <= 0) error("scoring_rubric.weights", "Weights must not all be zero.");
            }
            if (!isObj(rubric.diagnosis) || !isStr(rubric.diagnosis.ground_truth) ||
                !Array.isArray(rubric.diagnosis.accepted) || rubric.diagnosis.accepted.length === 0) {
                error("scoring_rubric.diagnosis", "Needs { ground_truth, accepted: [phrases] }.");
            }
            if (!Array.isArray(rubric.items) || rubric.items.length === 0) {
                error("scoring_rubric.items", "Needs at least one rubric item.");
            } else {
                const seen = new Set<string>();
                const perDomain: Record<string, number> = {};
                rubric.items.forEach((item, i) => {
                    const path = `scoring_rubric.items[${i}]`;
                    if (!isObj(item)) return error(path, "Must be an object.");
                    if (!isStr(item.id)) error(`${path}.id`, "Needs an `id`.");
                    else if (seen.has(item.id)) error(`${path}.id`, `Duplicate rubric id "${item.id}".`);
                    else seen.add(item.id);
                    if (!isStr(item.label)) error(`${path}.label`, "Needs a `label`.");
                    if (!(SCORING_DOMAINS as readonly unknown[]).includes(item.domain)) {
                        error(`${path}.domain`, `Must be one of ${SCORING_DOMAINS.join(", ")}.`);
                    } else {
                        perDomain[item.domain as string] = (perDomain[item.domain as string] ?? 0) + (isNum(item.weight) ? item.weight : 0);
                    }
                    if (!isNum(item.weight) || item.weight <= 0) error(`${path}.weight`, "Must be a number > 0.");
                    if (item.met_when === undefined && item.graded === undefined) {
                        error(path, "Needs `met_when` or `graded`.");
                    }
                    if (item.met_when !== undefined) checkCondition(item.met_when, `${path}.met_when`, true);
                    if (item.partial_when !== undefined) checkCondition(item.partial_when, `${path}.partial_when`, true);
                    if (item.graded !== undefined) {
                        const g = item.graded;
                        if (!isObj(g) || !isNum(g.full_within_minutes) || !isNum(g.zero_after_minutes) || g.zero_after_minutes <= g.full_within_minutes) {
                            error(`${path}.graded`, "Needs { measure, full_within_minutes, zero_after_minutes } with zero_after > full_within.");
                        } else checkCondition(g.measure, `${path}.graded.measure`, true);
                    }
                    if (isStr(item.knowledge_gap)) rubricGaps.add(item.knowledge_gap);
                });
                if (isObj(rubric.weights)) {
                    for (const d of SCORING_DOMAINS) {
                        if (isNum(rubric.weights[d]) && rubric.weights[d] > 0 && !perDomain[d]) {
                            warn(`scoring_rubric.weights.${d}`, "Domain has weight but no rubric items — it will always score 100.");
                        }
                    }
                }
            }
            if (Array.isArray(rubric.penalties)) {
                rubric.penalties.forEach((p, i) => {
                    const path = `scoring_rubric.penalties[${i}]`;
                    if (!isObj(p) || !isStr(p.id) || !isNum(p.points) || p.points < 0) return error(path, "Needs { id, label, domain, points ≥ 0, when }.");
                    if (!(SCORING_DOMAINS as readonly unknown[]).includes(p.domain)) error(`${path}.domain`, "Unknown domain.");
                    checkCondition(p.when, `${path}.when`, true);
                    if (isStr(p.knowledge_gap)) rubricGaps.add(p.knowledge_gap);
                });
            }
            if (Array.isArray(rubric.misconceptions)) {
                rubric.misconceptions.forEach((m, i) => {
                    const path = `scoring_rubric.misconceptions[${i}]`;
                    if (!isObj(m) || !isStr(m.id) || !isStr(m.error) || !isStr(m.why_it_mattered) || !isStr(m.knowledge_gap)) {
                        return error(path, "Needs { id, title, when, error, why_it_mattered, knowledge_gap, priority }.");
                    }
                    if (!isNum(m.priority)) error(`${path}.priority`, "Must be a number.");
                    checkCondition(m.when, `${path}.when`, true);
                    rubricGaps.add(m.knowledge_gap);
                });
            }
        }
    }

    // ── reinforcement ───────────────────────────────────────────────────────
    if (c.reinforcement !== undefined) {
        if (!isObj(c.reinforcement)) error("reinforcement", "Must be an object keyed by knowledge-gap id.");
        else {
            for (const [gap, bank] of Object.entries(c.reinforcement)) {
                const path = `reinforcement.${gap}`;
                if (!isObj(bank) || !isStr(bank.title) || !Array.isArray(bank.questions) || bank.questions.length === 0) {
                    error(path, "Needs { title, summary, questions: [...] }.");
                    continue;
                }
                bank.questions.forEach((q, i) => {
                    const qp = `${path}.questions[${i}]`;
                    if (!isObj(q) || !isStr(q.id) || !isStr(q.stem) || !isStr(q.explanation)) return error(qp, "Needs { id, stem, options, correctIndex, explanation }.");
                    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isStr)) error(`${qp}.options`, "Needs exactly four non-empty options.");
                    if (!Number.isInteger(q.correctIndex) || (q.correctIndex as number) < 0 || (q.correctIndex as number) > 3) {
                        error(`${qp}.correctIndex`, "Must be 0–3.");
                    }
                });
            }
            for (const gap of rubricGaps) {
                if (!(gap in c.reinforcement)) {
                    warn(`reinforcement.${gap}`, `Knowledge gap "${gap}" is referenced by the rubric but has no reinforcement questions.`);
                }
            }
        }
    }

    // ── Reachability: flags a rule waits on that nothing can ever set ───────
    for (const flag of flagsRequiredTrue) {
        if (initialFlags[flag] !== true && !settableTo.has(`${flag}:true`)) {
            warn(`flag:${flag}`, `Flag "${flag}" is required to be true but starts false and nothing sets it — rules waiting on it can never fire.`);
        }
    }
    for (const flag of flagsRequiredFalse) {
        if (initialFlags[flag] === true && !settableTo.has(`${flag}:false`)) {
            warn(`flag:${flag}`, `Flag "${flag}" is required to be false but starts true and nothing clears it.`);
        }
    }
    for (const ref of referencedStates) {
        if (!enteredStates.has(ref.state)) {
            warn(ref.path, `State "${ref.state}" is never entered (not the initial state and no rule transitions to it).`);
        }
    }

    // ── Cross-check the legacy vitals block against initial_state ───────────
    if (isObj(init) && isObj(c.patient) && isObj(c.patient.vitalSigns)) {
        const vs = c.patient.vitalSigns;
        const hr = isObj(vs.heartRate) ? vs.heartRate.value : undefined;
        if (isNum(hr) && isNum(init.rate) && hr !== init.rate) {
            warn("initial_state.rate", `initial_state.rate (${init.rate}) differs from patient.vitalSigns.heartRate (${hr}).`);
        }
        const bp = isObj(vs.bloodPressure) ? vs.bloodPressure : undefined;
        if (bp && isNum(bp.systolic) && isNum(init.systolic) && bp.systolic !== init.systolic) {
            warn("initial_state.systolic", `initial_state.systolic (${init.systolic}) differs from patient.vitalSigns.bloodPressure.systolic (${bp.systolic}).`);
        }
        const spo2 = isObj(vs.oxygenSaturation) ? vs.oxygenSaturation.value : undefined;
        if (isNum(spo2) && isNum(init.spo2) && spo2 !== init.spo2) {
            warn("initial_state.spo2", `initial_state.spo2 (${init.spo2}) differs from patient.vitalSigns.oxygenSaturation (${spo2}).`);
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}

/** Human-readable report, for scripts and test failure messages. */
export function formatValidation(result: ValidationResult): string {
    const lines: string[] = [];
    for (const e of result.errors) lines.push(`  ✗ ${e.path}: ${e.message}`);
    for (const w of result.warnings) lines.push(`  ! ${w.path}: ${w.message}`);
    return lines.join("\n");
}
