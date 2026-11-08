import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildBudgetedTranscript } from "../IntentExtractor";

describe("budgeted examiner transcript", () => {
    it("sends unfamiliar lay wording in full when the conversation fits", () => {
        const transcript = buildBudgetedTranscript([
            { role: "user", content: "Any wee?" },
            { role: "assistant", content: "Yes, less than usual." },
        ]);
        assert.match(transcript, /Doctor: Any wee\?/);
        assert.match(transcript, /Patient: Yes, less than usual\./);
    });

    it("samples long conversations evenly instead of selecting turns by local keyword matches", () => {
        const makeConversation = (wording: "known" | "unfamiliar") => Array.from({ length: 40 }, (_, i) => [
            { role: "user", content: `TURN_${i} ${wording === "known" ? "Any fever?" : "Any wee?"} ` + "detail ".repeat(24) },
            { role: "assistant", content: `REPLY_${i} ` + "patient detail ".repeat(24) },
        ]).flat();

        const included = (conversation: { role: string; content: string }[]) => {
            const transcript = buildBudgetedTranscript(conversation, 1800);
            return [...transcript.matchAll(/TURN_(\d+)/g)].map((m) => Number(m[1]));
        };

        assert.deepEqual(included(makeConversation("known")), included(makeConversation("unfamiliar")));
        const chosen = included(makeConversation("unfamiliar"));
        assert.ok(chosen.some((turn) => turn > 5 && turn < 34), "keeps representative middle exchanges");
    });
});
