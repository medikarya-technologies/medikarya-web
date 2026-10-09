import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PASS_LIMITS,
  checkJoinRequest,
  checkPassRequest,
  cleanJoinCode,
  joinCodeFor,
  joinState,
  monthsLabel,
  parseEmails,
  passDays,
  passWindow,
  type JoinRequest,
  type PassRequest,
} from "../passes";

describe("parseEmails", () => {
  it("reads one per line, commas, semicolons and a pasted spreadsheet column, once each and in lower case", () => {
    const pasted = "Asha Rao\tAsha.Rao@Gmail.com\t2nd year\nravi@mamc.ac.in, neha@gmail.com; ASHA.RAO@gmail.com\n<kabir@yahoo.in>";
    assert.deepEqual(parseEmails(pasted), { valid: ["asha.rao@gmail.com", "ravi@mamc.ac.in", "neha@gmail.com", "kabir@yahoo.in"], invalid: [] });
  });

  it("ignores words without an @ and lists the ones that only look like emails", () => {
    assert.deepEqual(parseEmails("Name Email\nriya@gmail riya@@gmail.com @gmail.com ok@x.com."), {
      valid: ["ok@x.com"],
      invalid: ["riya@gmail", "riya@@gmail.com", "@gmail.com"],
    });
  });

  it("gives nothing for nothing", () => {
    assert.deepEqual(parseEmails("  \n "), { valid: [], invalid: [] });
  });
});

describe("passWindow", () => {
  it("starts at midnight in India and lasts the days asked", () => {
    const w = passWindow("2026-10-20", 14)!;
    assert.equal(w.startsAt.toISOString(), "2026-10-19T18:30:00.000Z");
    assert.equal(w.endsAt.toISOString(), "2026-11-02T18:30:00.000Z");
    assert.equal(passDays(w.startsAt, w.endsAt), 14);
  });

  it("refuses a day that does not exist instead of moving it", () => {
    assert.equal(passWindow("2026-02-31", 14), null);
    assert.equal(passWindow("20-10-2026", 14), null);
    assert.equal(passWindow("", 14), null);
  });
});

describe("monthsLabel", () => {
  it("is never 0, since the table refuses it; the end date is what counts", () => {
    assert.equal(monthsLabel(1), 1);
    assert.equal(monthsLabel(14), 1);
    assert.equal(monthsLabel(45), 2);
  });
});

describe("checkPassRequest", () => {
  const ok: PassRequest = { name: "  the MAMC   workshop ", plan: "intern", startDay: "2026-10-20", days: 14, emailsText: "a@b.com\nc@d.in, oops@" };

  it("gives the batch name, plan, dates and emails", () => {
    const r = checkPassRequest(ok);
    assert.ok(r.ok);
    assert.equal(r.reason, "workshop: the MAMC workshop");
    assert.equal(r.plan, "intern");
    assert.deepEqual(r.emails, ["a@b.com", "c@d.in"]);
    assert.deepEqual(r.invalid, ["oops@"]);
  });

  it("says what is wrong", () => {
    const wrong: Array<Partial<PassRequest>> = [
      { name: "x" },
      { name: "x".repeat(PASS_LIMITS.nameChars + 1) },
      { plan: "student" },
      { days: 0 },
      { days: PASS_LIMITS.maxDays + 1 },
      { days: 2.5 },
      { startDay: "2026-13-01" },
      { emailsText: "no emails here" },
      { emailsText: Array.from({ length: PASS_LIMITS.maxEmails + 1 }, (_, i) => `s${i}@x.com`).join("\n") },
    ];
    for (const change of wrong) {
      const r = checkPassRequest({ ...ok, ...change });
      assert.equal(r.ok, false, JSON.stringify(change).slice(0, 80));
    }
  });
});

describe("join links", () => {
  const fixed = () => 0.5; // always the same random letters, for the tests

  it("makes a short code from the event's first real word", () => {
    assert.equal(joinCodeFor("the MAMC workshop", fixed), "mamc-ssss");
    assert.equal(joinCodeFor("Workshop at Lady Hardinge", fixed), "lady-ssss");
    assert.equal(joinCodeFor("!!!", fixed), "join-ssss");
    assert.match(joinCodeFor("the MAMC workshop"), /^mamc-[a-z2-9]{4}$/);
  });

  it("reads a code from a link, and refuses anything that cannot be one", () => {
    assert.equal(cleanJoinCode("MAMC-4K7Q"), "mamc-4k7q");
    assert.equal(cleanJoinCode("mamc-4k7q%20"), "mamc-4k7q");
    for (const bad of ["mamc", "mamc-4k7", "../admin", "%E0%A4%A", "a b-cdef"]) assert.equal(cleanJoinCode(bad), null, bad);
  });

  const request: JoinRequest = { name: "the MAMC workshop", plan: "intern", startDay: "2026-10-24", days: 14, openDay: "2026-10-24", openDays: 1, maxJoins: 250 };

  it("opens the link for the days asked, while the pass runs", () => {
    const r = checkJoinRequest(request);
    assert.ok(r.ok);
    assert.equal(r.opensAt.toISOString(), "2026-10-23T18:30:00.000Z");
    assert.equal(r.closesAt.toISOString(), "2026-10-24T18:30:00.000Z");
    assert.equal(r.pass.reason, "workshop: the MAMC workshop");
  });

  it("says what is wrong", () => {
    for (const change of [{ openDays: 0 }, { openDays: 15 }, { maxJoins: 0 }, { maxJoins: 5000 }, { openDay: "2026-12-01" }, { openDay: "" }, { name: "x" }]) {
      assert.equal(checkJoinRequest({ ...request, ...change }).ok, false, JSON.stringify(change));
    }
  });

  it("lets people in only while the link is on, open and not full", () => {
    const link = { active: true, opensAt: "2026-10-23T18:30:00Z", closesAt: "2026-10-24T18:30:00Z", maxJoins: 2 };
    const during = new Date("2026-10-24T05:00:00Z");
    assert.equal(joinState(link, 0, during), "open");
    assert.equal(joinState(link, 2, during), "full");
    assert.equal(joinState({ ...link, active: false }, 0, during), "off");
    assert.equal(joinState(link, 0, new Date("2026-10-23T18:00:00Z")), "not_yet");
    assert.equal(joinState(link, 0, new Date("2026-10-24T18:30:00Z")), "closed");
  });
});
