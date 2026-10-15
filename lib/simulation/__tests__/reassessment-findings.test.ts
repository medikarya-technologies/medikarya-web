// S1 of the fluid-engine specification: pulse pressure as a derived condition, and the REASSESSED event.
// What a reassessment finds is read by the engine from the patient; the student only asks. Played through the real
// engine and the server's replay, on a synthetic plan (no case data needed).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SimulationCaseConfig } from "../case-schema";
import { testParameter } from "../conditions";
import { EncounterEngine } from "../encounter-engine";
import { isClinicalEvent, sanitizeEvents, type ClinicalEvent, type EventOf } from "../encounter-events";
import { upgradeLegacyCase } from "../legacy-adapter";
import { replayStudentEvents } from "../replay";
import { availableFlag, checkLivePlan, compileLivePlan, measuredOnArrival, normaliseLivePlan, REASSESS_ID, scoreBedside, type LivePlan } from "../live-plan";
import { deriveFindings, describeFindings, reportFor } from "../reassessment";
import { goldenFixtureCase } from "./live-plan-golden-fixture";

const MIN = 60;
const base = () => upgradeLegacyCase(goldenFixtureCase as unknown as Record<string, unknown>) as unknown as SimulationCaseConfig;
const reasserted = (events: readonly ClinicalEvent[]) => events.filter((e): e is EventOf<"REASSESSED"> => e.type === "REASSESSED");

// The shocked toddler's case (arrives HR 148, BP 86/54), with this plan's own course: the pulse pressure narrows at 6 and
// 12 minutes, a fluid bolus lifts the pressure, and the patient settles 4 minutes after the stabilising treatments.
function raw(over: Record<string, unknown> = {}, report: Record<string, unknown> | null = { vitals: ["hr", "sbp", "dbp", "pp", "map"], consciousness: true, findings: ["cold_hands"] }): Record<string, unknown> {
    return {
        summary: "Untreated, the pulse pressure narrows and the pressure falls.",
        critical_window_minutes: 5,
        time_limit_minutes: 20,
        findings: [{ id: "cold_hands", label: "Cold hands", present: true }],
        reassessment: {
            label: "Reassess: circulation",
            detail: "Pulse, BP and perfusion",
            checks: [{ when: { vital: "pp", at_most: 20 }, says: "The pulse pressure is narrow.", otherwise: "The pulse pressure is wide enough." }],
            ...(report ? { report } : {}),
        },
        stages: [
            { id: "narrowing", name: "Narrowing", at_minutes: 6, vitals: { hr: 160, sbp: 80, dbp: 62 }, nurse_says: "Pulse {hr}, BP {bp}." },
            { id: "worse", name: "Worse", at_minutes: 12, vitals: { hr: 172, sbp: 70, dbp: 60 }, nurse_says: "BP {bp} now." },
        ],
        treatments: [
            { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
            { id: "bolus", label: "Fluid bolus", detail: "A bolus", group: "circulation", role: "essential", within_minutes: 8, effect: { hr: -10, sbp: 12, dbp: 2 }, says: "The bolus runs in.", requires: [{ when: { given: "iv_access" }, says: "there is no IV access yet." }] },
        ],
        stabilised_by: ["iv_access", "bolus"],
        recovery: { after_minutes: 4, vitals: { hr: 130, sbp: 96, dbp: 60, spo2: 97, rr: 26 }, consciousness: "alert", nurse_says: "He is settling.", findings: { cold_hands: false } },
        ...over,
    };
}
const plan = (over: Record<string, unknown> = {}, report: Record<string, unknown> | null = undefined as never): LivePlan => normaliseLivePlan(report === (undefined as never) ? raw(over) : raw(over, report), "ai");
const errorsOf = (p: LivePlan) => checkLivePlan(p, measuredOnArrival(base())).errors.join(" | ");

function play(p: LivePlan, steps: Array<[string, number]>, until = 19) {
    const c = compileLivePlan(base(), p);
    const e = new EncounterEngine(c);
    const results = steps.map(([a, s]) => e.giveIntervention(a, s));
    e.advanceTo(until * MIN);
    return { c, e, results };
}

describe("pulse pressure as a derived condition parameter", () => {
    const at = (sbp: number, dbp: number) => ({ hr: 80, sbp, dbp, map: 0, spo2: 98, rr: 16, temperature: 36.8, rhythm: "sinus_normal", consciousness: "alert" });

    it("is systolic minus diastolic, under, at and above each threshold", () => {
        for (const name of ["pulse_pressure", "pp"]) {
            assert.equal(testParameter(name, { lt: 20 }, at(99, 80)), true, "19 is below 20");
            assert.equal(testParameter(name, { lt: 20 }, at(100, 80)), false, "20 is not below 20");
            assert.equal(testParameter(name, { lte: 20 }, at(100, 80)), true, "20 is at most 20");
            assert.equal(testParameter(name, { lte: 20 }, at(101, 80)), false, "21 is not at most 20");
            assert.equal(testParameter(name, { gte: 20 }, at(100, 80)), true, "20 is at least 20");
            assert.equal(testParameter(name, { gt: 20 }, at(100, 80)), false, "20 is not above 20");
            assert.equal(testParameter(name, { gt: 20 }, at(101, 80)), true, "21 is above 20");
            assert.equal(testParameter(name, { eq: 20 }, at(100, 80)), true);
        }
    });

    it("still rejects a name that is not a parameter", () => {
        assert.throws(() => testParameter("pulse_pressures", { lt: 20 }, at(100, 80)), /Unknown physiological parameter/);
    });

    it("a plan can gate a treatment on it: available once the pulse pressure has narrowed to 20, not before", () => {
        // 21 at 1 min, 20 at 2, 19 at 3: only the stages move the patient.
        const p = normaliseLivePlan(
            raw({
                stages: [
                    { id: "s1", name: "S1", at_minutes: 1, vitals: { sbp: 100, dbp: 79 }, nurse_says: "Doctor, the blood pressure is {bp} now." },
                    { id: "s2", name: "S2", at_minutes: 2, vitals: { sbp: 99, dbp: 79 }, nurse_says: "Doctor, the blood pressure is {bp} now." },
                    { id: "s3", name: "S3", at_minutes: 3, vitals: { sbp: 98, dbp: 79 }, nurse_says: "Doctor, the blood pressure is {bp} now." },
                ],
                treatments: [
                    { id: "iv_access", role: "essential", within_minutes: 4, says: "A cannula is in." },
                    { id: "bolus", label: "Fluid bolus", detail: "A bolus", group: "circulation", role: "essential", within_minutes: 8, effect: { sbp: 12, dbp: 2 }, says: "The bolus runs in.", available_when: { vital: "pp", at_most: 20 }, required_when: { vital: "pp", at_most: 20 } },
                ],
                stabilised_by: ["iv_access"],
            }),
            "ai"
        );
        assert.equal(errorsOf(p), "");
        const c = compileLivePlan(base(), p);
        const flagAt = (m: number) => {
            const e = new EncounterEngine(c);
            e.advanceTo(m * MIN);
            return { pp: e.state.systolic - e.state.diastolic, available: e.state.flags[availableFlag("bolus")] };
        };
        assert.deepEqual(flagAt(1), { pp: 21, available: false });
        assert.deepEqual(flagAt(2), { pp: 20, available: true });
        assert.deepEqual(flagAt(3), { pp: 19, available: true });
    });

    it("the plan check reads it, and refuses a value no monitor could show", () => {
        const ok = normaliseLivePlan(raw({ stabilised_by_while: { vital: "pp", above: 20 } }), "ai");
        assert.doesNotMatch(errorsOf(ok), /pp/);
        const bad = normaliseLivePlan(raw({ end_points: { vital: "pp", below: 5 } }), "ai");
        assert.match(errorsOf(bad), /pp below 5 is outside what a monitor can show/);
        const unknown = normaliseLivePlan(raw({ end_points: { vital: "ppp", below: 20 } }), "ai");
        assert.match(errorsOf(unknown), /could not read this condition/);
    });
});

describe("the REASSESSED event: found by the engine, from the patient at that instant", () => {
    it("a plan with a report records exactly what it was asked for, read from the patient", () => {
        const p = plan();
        assert.equal(errorsOf(p), "");
        const { e, results } = play(p, [[REASSESS_ID, 30]]);
        const [found] = reasserted(e.events);
        assert.ok(found);
        assert.equal(found.action, REASSESS_ID);
        assert.equal(found.timestamp, 30);
        assert.deepEqual(found.findings.vitals, { hr: 148, sbp: 86, dbp: 54, pp: 32, map: 65 });
        assert.equal(found.findings.consciousness, "alert");
        assert.deepEqual(found.findings.findings, [{ id: "cold_hands", label: "Cold hands", present: true }]);
        // The student gets it in the result of the request, straight after the request itself.
        assert.equal(results[0].appended.filter((x) => x.type === "REASSESSED").length, 1);
        const types = e.events.map((x) => x.type);
        assert.equal(types[types.indexOf("REASSESSED") - 1], "INTERVENTION_GIVEN");
    });

    it("after a deterioration the findings show the deterioration, and the pulse pressure is always sbp minus dbp", () => {
        const { e } = play(plan(), [[REASSESS_ID, 5 * MIN], [REASSESS_ID, 7 * MIN], [REASSESS_ID, 13 * MIN]]);
        const v = reasserted(e.events).map((r) => r.findings.vitals!);
        assert.deepEqual(v.map((x) => x.sbp), [86, 80, 70]);
        assert.deepEqual(v.map((x) => x.pp), [32, 18, 10]);
        for (const x of v) assert.equal(x.pp, x.sbp! - x.dbp!);
    });

    it("after treatment the findings show the effect, and after recovery the tracked finding has cleared", () => {
        const { e } = play(plan(), [["iv_access", 60], ["bolus", 120], [REASSESS_ID, 150], [REASSESS_ID, 12 * MIN]]);
        const [justAfter, settled] = reasserted(e.events);
        // The bolus adds +12 / +2 and the patient is stabilised by it; the settle comes 4 minutes later.
        assert.deepEqual(justAfter.findings.vitals, { hr: 138, sbp: 98, dbp: 56, pp: 42, map: 70 });
        assert.equal(justAfter.findings.findings![0].present, true);
        assert.deepEqual(settled.findings.vitals, { hr: 130, sbp: 96, dbp: 60, pp: 36, map: 72 });
        assert.equal(settled.findings.findings![0].present, false);
    });

    it("ordering: at the exact second of a deterioration it shows the patient just before it; a second later, after", () => {
        const { e } = play(plan(), [[REASSESS_ID, 6 * MIN], [REASSESS_ID, 6 * MIN + 1]]);
        const [atBoundary, after] = reasserted(e.events);
        assert.equal(atBoundary.findings.vitals!.sbp, 86, "the stage due at this instant has not happened yet");
        assert.equal(after.findings.vitals!.sbp, 80, "one second later it has");
    });

    it("a plan with no report writes no REASSESSED, and its reassessment is the sentences alone, as before", () => {
        const p = plan({}, null);
        assert.equal(p.reassessment!.report, undefined);
        const { c, e, results } = play(p, [[REASSESS_ID, 30]]);
        assert.equal(reasserted(e.events).length, 0);
        assert.equal(reportFor(c, REASSESS_ID), undefined);
        assert.ok(!c.custom_interventions!.some((i) => "report" in i), "the tray entry carries no report");
        assert.match(results[0].consequence, /^Reassessment:/);
    });

    it("the compiled tray action carries the report only when the plan asks for one", () => {
        const c = compileLivePlan(base(), plan());
        assert.deepEqual(reportFor(c, REASSESS_ID), { vitals: ["hr", "sbp", "dbp", "pp", "map"], consciousness: true, findings: [{ id: "cold_hands", flag: "finding_cold_hands", label: "Cold hands" }] });
    });

    it("the check refuses an empty report or one that names a finding the plan does not have", () => {
        assert.match(errorsOf(plan({}, {})), /name at least one vital/);
        assert.match(errorsOf(plan({}, { findings: ["warm_hands"] })), /"warm_hands" is not one of the plan's findings/);
        assert.match(errorsOf(plan({}, { vitals: ["bp_machine"] })), /name at least one vital/);
    });

    it("describeFindings gives short readable lines", () => {
        const { e } = play(plan(), [[REASSESS_ID, 30]]);
        assert.deepEqual(describeFindings(reasserted(e.events)[0].findings), ["BP 86/54, pulse pressure 32, MAP 65", "HR 148", "Consciousness: alert", "Cold hands: present"]);
    });
});

describe("a client cannot supply a reassessment's findings", () => {
    const honest = () => {
        const p = plan();
        const { c, e } = play(p, [["iv_access", 60], [REASSESS_ID, 7 * MIN], ["bolus", 8 * MIN], [REASSESS_ID, 9 * MIN]], 12);
        return { p, c, e };
    };

    it("the server throws away a forged REASSESSED and writes its own, equal to the browser's", () => {
        const { c, e } = honest();
        const log = e.events.map((x) => (x.type === "REASSESSED" ? { ...x, findings: { vitals: { hr: 70, sbp: 300, dbp: 2, pp: 298 }, consciousness: "alert", findings: [{ id: "cold_hands", label: "Cold hands", present: false }] } } : x));
        const replayed = replayStudentEvents(c, log);
        assert.deepEqual(reasserted(replayed.events), reasserted(e.events), "the server's findings are the engine's, not the client's");
        assert.notEqual(reasserted(replayed.events)[0].findings.vitals!.sbp, 300);
    });

    it("a REASSESSED with no request behind it is dropped: nothing appears", () => {
        const { c } = honest();
        const forged: ClinicalEvent = { type: "REASSESSED", timestamp: 100, action: REASSESS_ID, findings: { vitals: { hr: 1 } } };
        const replayed = replayStudentEvents(c, [forged, { type: "INTERVENTION_GIVEN", timestamp: 200, action: "iv_access", consequence: "x" }]);
        assert.equal(reasserted(replayed.events).length, 0);
    });

    it("an altered consequence text on the request is replaced too, as before", () => {
        const { c, e } = honest();
        const log = e.events.map((x) => (x.type === "INTERVENTION_GIVEN" && x.action === REASSESS_ID ? { ...x, consequence: "Everything is normal." } : x));
        const replayed = replayStudentEvents(c, log);
        for (const x of replayed.events) if (x.type === "INTERVENTION_GIVEN") assert.notEqual(x.consequence, "Everything is normal.");
    });

    it("a malformed REASSESSED does not survive sanitising, and none can be dispatched into the engine", () => {
        const bad = [
            { type: "REASSESSED", timestamp: 1, findings: { vitals: { hr: 70 } } },
            { type: "REASSESSED", timestamp: 1, action: REASSESS_ID, findings: { vitals: { hr: "70" } } },
            { type: "REASSESSED", timestamp: 1, action: REASSESS_ID, findings: { vitals: { heartbeat: 70 } } },
            { type: "REASSESSED", timestamp: 1, action: REASSESS_ID, findings: { findings: [{ id: "x", present: "yes", label: "X" }] } },
            { type: "REASSESSED", timestamp: 1, action: REASSESS_ID, findings: [] },
            { type: "REASSESSED", timestamp: -5, action: REASSESS_ID, findings: {} },
        ];
        for (const b of bad) assert.equal(isClinicalEvent(b), false, JSON.stringify(b));
        assert.equal(sanitizeEvents(bad).length, 0);
        assert.equal(isClinicalEvent({ type: "REASSESSED", timestamp: 1, action: REASSESS_ID, findings: { vitals: { hr: 70 } } }), true);
        const e = new EncounterEngine(compileLivePlan(base(), plan()));
        const before = e.events.length;
        assert.deepEqual(e.dispatch({ type: "REASSESSED", timestamp: 5, action: REASSESS_ID, findings: { vitals: { hr: 1 } } }), []);
        assert.equal(e.events.length, before);
    });

    it("a request for a reassessment in a plan without a report finds nothing and records nothing", () => {
        const p = plan({}, null);
        const c = compileLivePlan(base(), p);
        const replayed = replayStudentEvents(c, [{ type: "INTERVENTION_GIVEN", timestamp: 60, action: REASSESS_ID, consequence: "x" }, { type: "REASSESSED", timestamp: 60, action: REASSESS_ID, findings: { vitals: { hr: 1 } } }]);
        assert.equal(reasserted(replayed.events).length, 0);
    });
});

describe("browser and server agree", () => {
    it("the same requests give the same findings, the same patient and the same bedside score", () => {
        const p = plan();
        const steps: Array<[string, number]> = [["iv_access", 60], [REASSESS_ID, 6 * MIN], [REASSESS_ID, 6 * MIN], ["bolus", 8 * MIN], [REASSESS_ID, 8 * MIN + 30], [REASSESS_ID, 13 * MIN]];
        const { c, e } = play(p, steps, 19);
        const replayed = replayStudentEvents(c, e.events.filter((x) => x.type === "INTERVENTION_GIVEN"));
        replayed.advanceTo(19 * MIN);
        assert.deepEqual(reasserted(replayed.events), reasserted(e.events));
        assert.deepEqual(replayed.state.snapshot(), e.state.snapshot());
        assert.deepEqual(scoreBedside(c, p, replayed.events, 19), scoreBedside(c, p, e.events, 19));
        assert.equal(reasserted(e.events).length, 4);
    });

    it("deriveFindings reads only the patient it is given", () => {
        const c = compileLivePlan(base(), plan());
        const a = new EncounterEngine(c);
        const b = new EncounterEngine(c);
        b.advanceTo(13 * MIN);
        const report = reportFor(c, REASSESS_ID)!;
        assert.notDeepEqual(deriveFindings(report, a.state), deriveFindings(report, b.state));
        assert.deepEqual(deriveFindings(report, a.state), deriveFindings(report, new EncounterEngine(c).state));
    });
});
