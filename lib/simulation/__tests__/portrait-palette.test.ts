import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { luma, mixHex, portraitPalette } from "../portrait-palette";
import { SKIN_TONES, type ResolvedLook } from "../appearance";

const look = (over: Partial<ResolvedLook> = {}): ResolvedLook => ({
    pallor: 0, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 0, sunken_eyes: 0, expression: "calm", ...over,
});

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** How saturated a colour is: the spread of its channels. */
const chroma = (hex: string) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
/** How yellow: red and green high, blue low. */
const yellowness = (hex: string) => {
    const [r, g, b] = rgb(hex);
    return (r + g) / 2 - b;
};

describe("portrait palette: colour maths", () => {
    it("mixes between two colours", () => {
        assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
        assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
        assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
        assert.equal(mixHex("#102030", "#ffffff", -3), "#102030", "clamped");
        assert.equal(mixHex("#102030", "#ffffff", 9), "#ffffff", "clamped");
    });
});

describe("portrait palette: what the findings look like", () => {
    it("draws a healthy patient unchanged", () => {
        for (const tone of SKIN_TONES) {
            const p = portraitPalette(tone, look());
            assert.ok(chroma(p.skin) > 25, `${tone} skin is coloured`);
            assert.equal(p.blushOpacity, 0);
        }
    });

    it("drains the colour from a pale patient, on every skin tone", () => {
        for (const tone of SKIN_TONES) {
            const healthy = portraitPalette(tone, look());
            const pale = portraitPalette(tone, look({ pallor: 3 }));
            assert.ok(chroma(pale.skin) < chroma(healthy.skin), `${tone}: paler means less colour`);
            assert.ok(chroma(pale.lips) < chroma(healthy.lips), `${tone}: the lips lose colour too`);
            const slight = portraitPalette(tone, look({ pallor: 1 }));
            assert.ok(chroma(healthy.skin) > chroma(slight.skin) && chroma(slight.skin) > chroma(pale.skin), `${tone}: it is graded`);
        }
    });

    it("makes the lightest skin lighter and the darkest ashen when pale", () => {
        assert.ok(luma(portraitPalette("light", look({ pallor: 3 })).skin) > luma(portraitPalette("light", look()).skin));
        assert.ok(luma(portraitPalette("deep", look({ pallor: 3 })).skin) > luma(portraitPalette("deep", look()).skin));
    });

    it("turns the eyes yellow before it turns the skin, and more so", () => {
        for (const tone of SKIN_TONES) {
            const healthy = portraitPalette(tone, look());
            const yellow = portraitPalette(tone, look({ jaundice: 2 }));
            const eyes = yellowness(yellow.sclera) - yellowness(healthy.sclera);
            const skin = yellowness(yellow.skin) - yellowness(healthy.skin);
            assert.ok(eyes > 60, `${tone}: the sclerae are plainly yellow (Δ${eyes})`);
            assert.ok(skin > 0, `${tone}: the skin is tinted`);
            assert.ok(eyes > skin * 2, `${tone}: the eyes show it far more than the skin`);
        }
    });

    it("grades jaundice from a slight tint to deep yellow", () => {
        const at = (level: 0 | 1 | 2 | 3) => yellowness(portraitPalette("medium", look({ jaundice: level })).sclera);
        assert.ok(at(0) < at(1) && at(1) < at(2) && at(2) < at(3));
        assert.ok(at(1) - at(0) > 20, "even a slight tint is visible");
    });

    it("blues the lips in cyanosis", () => {
        for (const tone of SKIN_TONES) {
            const healthy = rgb(portraitPalette(tone, look()).lips);
            const blue = rgb(portraitPalette(tone, look({ cyanosis: 3 })).lips);
            assert.ok(blue[2] - blue[0] > healthy[2] - healthy[0] + 20, `${tone}: less red, more blue`);
        }
    });

    it("warms the cheeks in a flush", () => {
        assert.ok(portraitPalette("brown", look({ flushed: 3 })).blushOpacity > portraitPalette("brown", look({ flushed: 1 })).blushOpacity);
    });

    it("draws 'very pale and yellow' as both at once", () => {
        for (const tone of SKIN_TONES) {
            const healthy = portraitPalette(tone, look());
            const both = portraitPalette(tone, look({ pallor: 3, jaundice: 2 }));
            assert.ok(chroma(both.skin) < chroma(healthy.skin) + 10, `${tone}: not a healthy glow`);
            assert.ok(yellowness(both.sclera) - yellowness(healthy.sclera) > 60, `${tone}: yellow eyes`);
            assert.notEqual(both.skin, healthy.skin);
        }
    });

    it("keeps the skin's shade darker than the skin", () => {
        for (const tone of SKIN_TONES) {
            const p = portraitPalette(tone, look({ pallor: 2, jaundice: 1 }));
            assert.ok(luma(p.skinShade) < luma(p.skin));
        }
    });
});
