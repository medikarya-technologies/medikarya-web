import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FIRST_CASE_HREF, FIRST_CASE_ID, sendToFirstCase } from "../first-case";
import { GUEST_CASE_IDS } from "../../plans/limits";

describe("sendToFirstCase", () => {
  const brandNew = { welcomed: false, admin: false, starts: 0, attempts: 0 };

  it("sends someone who has never opened a case to their first patient", () => {
    assert.equal(sendToFirstCase(brandNew), true);
  });

  it("never sends anyone twice, nor anyone who has opened or finished a case, nor an admin", () => {
    assert.equal(sendToFirstCase({ ...brandNew, welcomed: true }), false);
    assert.equal(sendToFirstCase({ ...brandNew, starts: 1 }), false);
    assert.equal(sendToFirstCase({ ...brandNew, attempts: 2 }), false);
    assert.equal(sendToFirstCase({ ...brandNew, admin: true }), false);
  });

  it("starts with the free Beginner case, with the welcome shown", () => {
    assert.equal(FIRST_CASE_ID, GUEST_CASE_IDS[0]);
    assert.equal(FIRST_CASE_HREF, `/dashboard/cases/${FIRST_CASE_ID}?first=1`);
  });
});
