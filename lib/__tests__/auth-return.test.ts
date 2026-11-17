import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loginUrlFor, safeReturnPath } from "../auth-return";

describe("auth return: where to go after signing in", () => {
    it("keeps paths on this site, with their query", () => {
        assert.equal(safeReturnPath("/admin"), "/admin");
        assert.equal(safeReturnPath("/checkout?tier=resident&period=monthly"), "/checkout?tier=resident&period=monthly");
        assert.equal(loginUrlFor("/checkout?tier=resident&period=yearly"), "/login?redirect_url=%2Fcheckout%3Ftier%3Dresident%26period%3Dyearly");
    });

    it("refuses other sites and the sign-in pages themselves", () => {
        for (const bad of ["https://evil.example/x", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "", null, undefined, "/login", "/login?x=1", "/signup/sso-callback", "/signup"]) {
            assert.equal(safeReturnPath(bad), null, String(bad));
        }
        assert.equal(loginUrlFor("//evil.example"), "/login");
        assert.equal(loginUrlFor(null), "/login");
    });

    it("does not mistake look-alike pages for the sign-in pages", () => {
        assert.equal(safeReturnPath("/loginhelp"), "/loginhelp");
        assert.equal(safeReturnPath("/signups"), "/signups");
    });
});
