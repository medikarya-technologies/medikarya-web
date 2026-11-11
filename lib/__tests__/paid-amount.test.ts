import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { paidAmount } from "../payments/paid-amount";

describe("paid amount for the Purchase event", () => {
    it("turns paise into rupees for a payment that went through", () => {
        assert.deepEqual(paidAmount({ amount: 19900, currency: "INR", status: "captured" }), { amount: 199, currency: "INR" });
        assert.deepEqual(paidAmount({ amount: 17910, currency: "INR", status: "authorized" }), { amount: 179.1, currency: "INR" });
    });

    it("reports nothing for a failed, empty or malformed payment", () => {
        assert.equal(paidAmount(null), null);
        assert.equal(paidAmount({ amount: 19900, currency: "INR", status: "failed" }), null);
        assert.equal(paidAmount({ amount: 0, currency: "INR", status: "captured" }), null);
        assert.equal(paidAmount({ amount: "19900", currency: "INR", status: "captured" }), null);
        assert.equal(paidAmount({ amount: 19900, status: "captured" }), null);
    });
});
