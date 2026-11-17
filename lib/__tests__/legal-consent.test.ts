import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { consentMetadata, hasRecordedConsent, LEGAL_NOTICE_VERSION } from "../legal-consent";

describe("legal consent on the account", () => {
    it("is recorded once the sign-up page or the dashboard prompt has stored it", () => {
        assert.equal(hasRecordedConsent(consentMetadata("2026-11-17T10:00:00.000Z", "signup")), true);
        assert.equal(hasRecordedConsent(consentMetadata("2026-11-17T10:00:00.000Z", "prompt")), true);
        // what the sign-up page stored before the source field existed
        assert.equal(hasRecordedConsent({
            medikaryaLegalNoticeVersion: LEGAL_NOTICE_VERSION,
            medikaryaTermsAcceptedAt: "2026-11-01T10:00:00.000Z",
            medikaryaPrivacyNoticeAcceptedAt: "2026-11-01T10:00:00.000Z",
        }), true);
    });

    it("is missing on accounts made without the sign-up page, or for an older notice", () => {
        assert.equal(hasRecordedConsent(undefined), false);
        assert.equal(hasRecordedConsent(null), false);
        assert.equal(hasRecordedConsent({}), false);
        assert.equal(hasRecordedConsent({ somethingElse: true }), false);
        assert.equal(hasRecordedConsent({ ...consentMetadata("2026-11-17T10:00:00.000Z", "signup"), medikaryaLegalNoticeVersion: "2026-01-01" }), false);
        assert.equal(hasRecordedConsent({ ...consentMetadata("2026-11-17T10:00:00.000Z", "signup"), medikaryaTermsAcceptedAt: "" }), false);
    });

    it("keeps the sign-up page's field names", () => {
        const meta = consentMetadata("2026-11-17T10:00:00.000Z", "signup");
        assert.equal(meta.medikaryaLegalNoticeVersion, LEGAL_NOTICE_VERSION);
        assert.equal(meta.medikaryaTermsAcceptedAt, "2026-11-17T10:00:00.000Z");
        assert.equal(meta.medikaryaPrivacyNoticeAcceptedAt, "2026-11-17T10:00:00.000Z");
    });
});
