import { test } from "node:test";
import assert from "node:assert/strict";
import { DeterministicScorer } from "../../../engine/evaluation/DeterministicScorer";

const cfg: any = {
  testing: {
    testing_required: true,
    core_tests: ["ecg"],
    core_test_groups: [["vbg", "glucose_random"]],
    optional_tests: [],
    distractor_tests: [],
    dangerous_tests: [],
  },
};
const order = (...ids: string[]) => DeterministicScorer.scoreTesting(ids.map((id) => ({ id, name: id })), cfg);

test("ordering either member of a core group earns the core marks once", () => {
  assert.equal(order("ecg", "vbg").breakdown.coreMatched, 2);
  assert.equal(order("ecg", "glucose_random").breakdown.coreMatched, 2);
  assert.equal(order("ecg", "vbg", "glucose_random").breakdown.coreMatched, 2);
});

test("ordering no member of a group costs the missed-core penalty once", () => {
  const r = order("ecg");
  assert.deepEqual(r.breakdown.missedCore, ["vbg or glucose_random"]);
  assert.ok(order("ecg", "vbg").testingScore > r.testingScore);
});
