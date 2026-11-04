import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normaliseObviousClinicalTypos } from "../clinical-typos";

describe("obvious clinical spelling slips", () => {
    it("maps common keyboard slips for pain to the intended clinical word", () => {
        assert.equal(normaliseObviousClinicalTypos("pane pian paim pain"), "pain pain pain pain");
        assert.equal(normaliseObviousClinicalTypos("feaver"), "fever");
    });
});
