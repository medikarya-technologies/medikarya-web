// Prerequisites on the real plans (data/cases, not in git): every treatment that needs another one first is refused
// without it, is not counted when refused, and is given and scored once the prerequisite is in. Runs for every plan
// present on this machine, so a plan converted later is covered without writing a new test.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import type { SimulationCaseConfig } from "../case-schema";
import { EncounterEngine } from "../encounter-engine";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { compileLivePlan, scoreBedside, type LivePlan } from "../live-plan";

const MIN = 60;
const DIR = path.join(process.cwd(), "data", "cases");
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

for (const f of files) {
    const c = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const plan = c.live_plan as LivePlan | undefined;
    if (!plan) continue;
    // Only the plain "X must have been given" prerequisites; richer conditions have their own tests.
    // One prerequisite, and not also gated by state: those combinations have their own tests.
    const gated = plan.treatments.filter((t) => t.requires?.length === 1 && !t.available_when && !t.required_when).flatMap((t) =>
        (t.requires ?? []).flatMap((r) => ("given" in r.when && typeof r.when.given === "string" && !("doses" in r.when) ? [{ t, prereq: r.when.given as string, says: r.says }] : [])));
    if (!gated.length) continue;

    describe(`${c.id}: prerequisites`, () => {
        const compiled = () => compileLivePlan(upgradeLegacyCase(c) as unknown as SimulationCaseConfig, plan);
        for (const { t, prereq, says } of gated) {
            it(`${t.id} is refused without ${prereq}, and the refusal is not counted`, () => {
                const cfg = compiled();
                const e = new EncounterEngine(cfg);
                const refused = e.giveIntervention(t.id, 1 * MIN);
                assert.match(refused.consequence ?? JSON.stringify(refused), /^Not given/);
                assert.ok(String(refused.consequence).includes(says));
                // Then the right order: the prerequisite, then the treatment. Both are given, and the earlier attempt does not count.
                e.giveIntervention(prereq, 2 * MIN);
                const given = e.giveIntervention(t.id, 3 * MIN);
                assert.doesNotMatch(String(given.consequence), /^Not given/);
                const end = plan.time_limit_minutes - 1;
                e.advanceTo(end * MIN);
                const item = scoreBedside(cfg, plan, e.events, end).items.find((i) => i.id === t.id);
                // Only essential treatments are scored items; a supportive one is simply given.
                if (t.role === "essential") assert.ok(item && item.status !== "missed", `${t.id} should be credited once given after ${prereq}`);
                // The server's replay must see exactly the same.
                const r = replayStudentEvents(cfg, e.events.filter((x) => x.type === "INTERVENTION_GIVEN"));
                r.advanceTo(end * MIN);
                assert.deepEqual(scoreBedside(cfg, plan, r.events, end), scoreBedside(cfg, plan, e.events, end));
            });

            it(`${t.id} alone earns nothing`, () => {
                const cfg = compiled();
                const e = new EncounterEngine(cfg);
                e.giveIntervention(t.id, 1 * MIN);
                const end = plan.time_limit_minutes - 1;
                e.advanceTo(end * MIN);
                const item = scoreBedside(cfg, plan, e.events, end).items.find((i) => i.id === t.id);
                if (t.role === "essential") assert.ok(!item || item.status === "missed" || item.status === "not_needed", `${t.id} counted although refused`);
            });
        }
    });
}
