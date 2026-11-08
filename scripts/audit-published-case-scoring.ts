import path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { CATALOG_TEST_IDS } from "../lib/clinical-catalog";
import { INTERVENTION_IDS } from "../lib/simulation/intervention-catalog";
import { checkLivePlan, isLivePlan, measuredOnArrival, normaliseLivePlan } from "../lib/simulation/live-plan";
import { isSimulationCase } from "../lib/simulation/case-schema";
import { validateSimulationCase } from "../lib/simulation/validate-config";
import { upgradeLegacyCase } from "../lib/simulation/legacy-adapter";
import { appearanceOverlays } from "../data/cases/simulation/appearance";
import { checkDraft } from "../lib/studio/validate";
import bundledStemi from "../data/cases/simulation/acute-anterior-stemi.json";

// Read-only structural audit of every published case's scoring configuration. It does not judge clinical truth.
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function main() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials in .env.local");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: rows, error } = await db.from("cases").select("id, case_json").eq("status", "published");
    if (error) throw error;

    let casesWithErrors = 0;
    let issueCount = 0;
    let errorCount = 0;
    let classic = 0;
    let rubric = 0;
    let legacyUpgraded = 0;
    for (const row of [...(rows ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
        const source = row.case_json as any;
        const upgraded = upgradeLegacyCase({ ...source, id: row.id }, { appearance: (appearanceOverlays as any)[row.id] });
        const c = upgraded;
        const errors: string[] = [];
        const warnings: string[] = [];
        const simulation = isSimulationCase(c);
        if (simulation) {
            if (!isSimulationCase(source)) legacyUpgraded++;
            const knownActions = [...INTERVENTION_IDS, ...(Array.isArray(c.custom_interventions) ? c.custom_interventions.map((x: any) => x.id).filter(Boolean) : [])];
            const validation = validateSimulationCase(c, { knownActions, knownTestIds: CATALOG_TEST_IDS });
            errors.push(...validation.errors.map((i) => `${i.path}: ${i.message}`));
            warnings.push(...validation.warnings.map((i) => `${i.path}: ${i.message}`));
            if (c.scoring_mode === "classic") classic++;
            else rubric++;
        const livePlan = (c as typeof c & { live_plan?: unknown }).live_plan;
        if (isLivePlan(livePlan)) {
                const plan = normaliseLivePlan(livePlan, "author");
                const checked = checkLivePlan(plan, measuredOnArrival(c), c.patient?.age);
                errors.push(...checked.errors.map((m) => `live_plan: ${m}`));
                warnings.push(...checked.warnings.map((m) => `live_plan: ${m}`));
            }
        }
        if (source?.evaluation_config) {
            const validated = checkDraft(source, { catalogIds: new Set(CATALOG_TEST_IDS), identifiers: { names: [], places: [] } });
            errors.push(...validated.errors);
            const testingRequired = c.evaluation_config?.testing?.testing_required === true;
            warnings.push(...validated.warnings.filter((message) => {
                if (!testingRequired && (message.startsWith("No core tests:") || message.startsWith("Fewer than 3 distractor tests:"))) return false;
                return true;
            }));
            if (!simulation) classic++;
        }
        if (!simulation && !c?.evaluation_config) errors.push("No recognized scoring configuration.");

        if (errors.length || warnings.length) {
            if (errors.length) casesWithErrors++;
            errorCount += errors.length;
            issueCount += errors.length + warnings.length;
            console.log(`- ${row.id} (${simulation ? c.scoring_mode ?? "simulation" : "classic"})`);
            for (const message of errors) console.log(`  ERROR ${message}`);
            for (const message of warnings) console.log(`  REVIEW ${message}`);
        }
    }
    const bundled = bundledStemi as any;
    if (isSimulationCase(bundled)) {
        const validation = validateSimulationCase(bundled, { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS });
        const livePlan = (bundled as typeof bundled & { live_plan?: unknown }).live_plan;
        const bundledErrors = validation.errors.map((i) => `${i.path}: ${i.message}`);
        const bundledWarnings = validation.warnings.map((i) => `${i.path}: ${i.message}`);
        if (isLivePlan(livePlan)) {
            const checked = checkLivePlan(normaliseLivePlan(livePlan, "author"), measuredOnArrival(bundled), bundled.patient?.age);
            bundledErrors.push(...checked.errors.map((m) => `live_plan: ${m}`));
            bundledWarnings.push(...checked.warnings.map((m) => `live_plan: ${m}`));
        }
        if (bundled.scoring_mode === "classic") classic++;
        else rubric++;
        if (bundledErrors.length || bundledWarnings.length) {
            if (bundledErrors.length) casesWithErrors++;
            errorCount += bundledErrors.length;
            issueCount += bundledErrors.length + bundledWarnings.length;
            console.log(`- ${bundled.id} (bundled ${bundled.scoring_mode ?? "rubric"})`);
            for (const message of bundledErrors) console.log(`  ERROR ${message}`);
            for (const message of bundledWarnings) console.log(`  REVIEW ${message}`);
        }
    }
    console.log(`\n${rows?.length ?? 0} published cases + ${isSimulationCase(bundled) ? 1 : 0} bundled simulation checked: ${classic} classic, ${rubric} rubric (${legacyUpgraded} classic cases upgraded for runtime); ${casesWithErrors} case(s) with structural errors (${errorCount} errors); ${issueCount - errorCount} review notes.`);
    console.log("Read-only structural validation only. It cannot establish clinical correctness or semantic grading fairness; those require clinician review and transcript calibration.");
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
