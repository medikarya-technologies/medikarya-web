import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CLAIM_AFTER_MS, CLAIM_BEFORE_MS, GUEST_ID, claimable, guestOwner } from "../guest-claim";

describe("claimable", () => {
  const created = new Date("2026-11-11T10:00:00Z");
  const at = (ms: number) => new Date(created.getTime() + ms).toISOString();

  it("takes the free case played just before signing up", () => {
    assert.equal(claimable(at(-5 * 60 * 1000), created), true);
    assert.equal(claimable(at(-CLAIM_BEFORE_MS), created), true);
  });

  it("allows a little clock skew after the account was made", () => {
    assert.equal(claimable(at(CLAIM_AFTER_MS), created), true);
  });

  it("leaves plays from long before, or from someone else later on a shared computer", () => {
    assert.equal(claimable(at(-CLAIM_BEFORE_MS - 1), created), false);
    assert.equal(claimable(at(CLAIM_AFTER_MS + 1), created), false);
    assert.equal(claimable(at(7 * 24 * 60 * 60 * 1000), created), false);
  });

  it("refuses dates it cannot read", () => {
    assert.equal(claimable("not a date", created), false);
    assert.equal(claimable(at(0), Number.NaN), false);
  });
});

describe("guest ids", () => {
  it("files a guest's plays the way the admin pages read them", () => {
    assert.equal(guestOwner("abc"), "guest:abc");
  });

  it("accepts only a UUID, so nothing else can be passed off as a guest", () => {
    assert.equal(GUEST_ID.test(crypto.randomUUID()), true);
    assert.equal(GUEST_ID.test("advisor:123"), false);
    assert.equal(GUEST_ID.test("user_2abc"), false);
  });
});
