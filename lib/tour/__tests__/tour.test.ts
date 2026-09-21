import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { placeCard } from "../place";
import { markTourSeen, shouldAutoTour, tourSeen, tourStorageKey } from "../tour-storage";

const PHONE = { w: 375, h: 700 };
const DESKTOP = { w: 1280, h: 800 };
const CARD = { w: 340, h: 180 };

/** Every card must sit fully inside the screen, with its margin. */
function inside(p: { top: number; left: number }, card: { w: number; h: number }, view: { w: number; h: number }, margin = 12) {
    assert.ok(p.left >= margin, `left ${p.left}`);
    assert.ok(p.top >= margin, `top ${p.top}`);
    assert.ok(p.left + card.w <= view.w - margin, `right edge ${p.left + card.w}`);
    assert.ok(p.top + card.h <= view.h - margin, `bottom edge ${p.top + card.h}`);
}

describe("tour: where the card goes", () => {
    it("goes below a target near the top, centred on it", () => {
        const target = { x: 300, y: 60, w: 100, h: 40 };
        const p = placeCard(target, CARD, DESKTOP);
        assert.equal(p.placement, "bottom");
        assert.equal(p.top, 60 + 40 + 14);
        assert.equal(p.left, 350 - 170);
        inside(p, CARD, DESKTOP);
    });

    it("goes above a target at the bottom of the screen", () => {
        const target = { x: 500, y: 700, w: 200, h: 56 };
        const p = placeCard(target, CARD, DESKTOP);
        assert.equal(p.placement, "top");
        assert.equal(p.top, 700 - 14 - 180);
        inside(p, CARD, DESKTOP);
    });

    it("goes beside a tall target that runs down the side of the screen", () => {
        const rail = { x: 0, y: 56, w: 340, h: 744 };
        const p = placeCard(rail, CARD, DESKTOP);
        assert.equal(p.placement, "right");
        assert.equal(p.left, 340 + 14);
        inside(p, CARD, DESKTOP);
    });

    it("goes to the left of a tall target on the right-hand side", () => {
        const side = { x: 940, y: 56, w: 340, h: 744 };
        const p = placeCard(side, CARD, DESKTOP);
        assert.equal(p.placement, "left");
        inside(p, CARD, DESKTOP);
    });

    it("is pushed back inside the screen when its target is at a corner", () => {
        const corner = { x: 1200, y: 8, w: 76, h: 40 };
        const p = placeCard(corner, CARD, DESKTOP);
        assert.equal(p.placement, "bottom");
        assert.equal(p.left, DESKTOP.w - 12 - CARD.w);
        inside(p, CARD, DESKTOP);
    });

    it("stays on a phone, whichever edge the target is on", () => {
        const narrow = { w: 351, h: 190 };
        for (const target of [
            { x: 8, y: 8, w: 60, h: 40 },
            { x: 300, y: 8, w: 60, h: 40 },
            { x: 0, y: 644, w: 94, h: 56 },
            { x: 281, y: 644, w: 94, h: 56 },
            { x: 12, y: 60, w: 351, h: 44 },
        ]) {
            inside(placeCard(target, narrow, PHONE), narrow, PHONE);
        }
    });

    it("sits in the middle when the target is as big as the screen", () => {
        const p = placeCard({ x: 0, y: 0, w: DESKTOP.w, h: DESKTOP.h }, CARD, DESKTOP);
        assert.equal(p.placement, "center");
        assert.deepEqual({ top: p.top, left: p.left }, { top: (800 - 180) / 2, left: (1280 - 340) / 2 });
    });

    it("never returns a card off-screen when the screen is smaller than the card", () => {
        const p = placeCard({ x: 0, y: 0, w: 10, h: 10 }, { w: 500, h: 400 }, { w: 300, h: 300 });
        assert.ok(Number.isFinite(p.top) && Number.isFinite(p.left));
        assert.ok(p.top >= 12 && p.left >= 12);
    });
});

describe("tour: who is shown it", () => {
    const store = () => {
        const data: Record<string, string> = {};
        return {
            data,
            getItem: (k: string) => (k in data ? data[k] : null),
            setItem: (k: string, v: string) => {
                data[k] = v;
            },
        };
    };

    it("starts by itself only for someone with no attempts who has not seen it", () => {
        assert.equal(shouldAutoTour({ hasAttempts: false, seen: false }), true);
        assert.equal(shouldAutoTour({ hasAttempts: true, seen: false }), false);
        assert.equal(shouldAutoTour({ hasAttempts: false, seen: true }), false);
        assert.equal(shouldAutoTour({ hasAttempts: true, seen: true }), false);
    });

    it("remembers, per person", () => {
        const s = store();
        assert.equal(tourSeen("user_a", s), false);
        markTourSeen("user_a", s, 1_700_000_000_000);
        assert.equal(tourSeen("user_a", s), true);
        assert.equal(tourSeen("user_b", s), false);
        assert.equal(s.data[tourStorageKey("user_a")], "1700000000000");
    });

    it("copes with storage that is missing or throws", () => {
        assert.equal(tourSeen("u", undefined), false);
        markTourSeen("u", undefined);
        const angry = {
            getItem() {
                throw new Error("blocked");
            },
            setItem() {
                throw new Error("blocked");
            },
        };
        assert.equal(tourSeen("u", angry), false);
        assert.doesNotThrow(() => markTourSeen("u", angry));
    });
});
