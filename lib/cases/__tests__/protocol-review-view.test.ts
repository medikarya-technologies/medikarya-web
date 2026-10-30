// A reviewer's credit names what they reviewed, which can hint at the answer: it stays out of the play view and arrives
// with the debrief, including through the case as the server scores it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { upgradeLegacyCase } from "../../simulation/legacy-adapter";
import { goldenFixtureCase } from "../../simulation/__tests__/live-plan-golden-fixture";
import { debriefOf, playView } from "../views";

const credit = { scope: "Fluid protocol", reviewer_name: "Dr A", show_name: true };

describe("protocol review credit", () => {
    it("is withheld while playing and sent with the debrief", () => {
        const c = { ...goldenFixtureCase, protocol_review: credit };
        assert.equal("protocol_review" in playView(c), false);
        assert.deepEqual(debriefOf(c).protocol_review, credit);
    });

    it("survives the upgrade to a bedside case", () => {
        const upgraded = upgradeLegacyCase({ ...goldenFixtureCase, protocol_review: credit } as Record<string, unknown>) as Record<string, any>;
        assert.deepEqual(debriefOf(upgraded).protocol_review, credit);
    });
});
