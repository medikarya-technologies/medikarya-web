import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { PASS_LIMITS, checkPassRequest, monthsLabel, parseEmails, passDays, passWindow, type PassRequest } from "../passes";

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
