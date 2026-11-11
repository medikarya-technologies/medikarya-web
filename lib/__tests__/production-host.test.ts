import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isProductionHost } from "../production-host";

describe("meta pixel: which hosts send events", () => {
    it("is the real site and its subdomains", () => {
        for (const host of ["medikarya.in", "www.medikarya.in", "casestudio.medikarya.in"]) assert.equal(isProductionHost(host), true, host);
    });

    it("is not local, preview or look-alike hosts", () => {
        for (const host of ["localhost", "127.0.0.1", "medikarya.vercel.app", "medikarya-git-main.vercel.app", "notmedikarya.in", "medikarya.in.example.com"]) {
            assert.equal(isProductionHost(host), false, host);
        }
    });
});
