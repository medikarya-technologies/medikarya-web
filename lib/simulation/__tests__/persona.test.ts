import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ACCESSORIES, GARMENTS, type Garment } from "../appearance";
import { ageCues, CLOTH_PALETTES, hairColourFor, personaFor, unit } from "../persona";
import { luma } from "../portrait-palette";

const seeds = Array.from({ length: 200 }, (_, i) => `case-${i}`);
const HEX = /^#[0-9a-f]{6}$/i;

describe("persona: how age shows", () => {
    it("shows nothing before adulthood, and nothing on a young adult", () => {
        for (const seed of seeds.slice(0, 40)) {
            for (const age of [0.08, 2, 8, 12, 17]) assert.deepEqual(ageCues(age, seed), { grey: 0, lines: 0, hollow: 0 }, `${age}`);
            const young = ageCues(24, seed);
            assert.equal(young.grey, 0, "no grey hair at 24");
            assert.equal(young.lines, 0, "no lines at 24");
            assert.equal(young.hollow, 0);
        }
    });

    it("never goes backwards as a person gets older, and never leaves 0–1", () => {
        for (const seed of seeds.slice(0, 40)) {
            let prev = ageCues(18, seed);
            for (let age = 19; age <= 100; age++) {
                const now = ageCues(age, seed);
                for (const key of ["grey", "lines", "hollow"] as const) {
                    assert.ok(now[key] >= prev[key] - 1e-9, `${key} fell at ${age} for ${seed}`);
                    assert.ok(now[key] >= 0 && now[key] <= 1, `${key} out of range at ${age}`);
                }
                prev = now;
            }
        }
    });

    it("nothing jumps at a birthday: a year makes a small difference", () => {
        for (const seed of seeds.slice(0, 40)) {
            for (let age = 18; age < 100; age++) {
                const a = ageCues(age, seed);
                const b = ageCues(age + 1, seed);
                assert.ok(b.grey - a.grey < 0.12 && b.lines - a.lines < 0.12, `a jump at ${age} for ${seed}`);
            }
        }
    });

    it("makes a 72-year-old plainly old and a 58-year-old in between", () => {
        for (const seed of seeds) {
            const at58 = ageCues(58, seed);
            const at72 = ageCues(72, seed);
            assert.ok(at72.grey > 0.6 && at72.lines > 0.7, `72 should look old (${seed}: ${JSON.stringify(at72)})`);
            assert.ok(at72.lines > at58.lines && at72.grey > at58.grey, "72 looks older than 58");
            assert.ok(at58.lines > 0.3 && at58.lines < 0.9, "58 is visibly middle-aged, not old");
        }
    });

    it("greys hair from black-brown to white", () => {
        assert.ok(luma(hairColourFor(0)) < 60);
        assert.ok(luma(hairColourFor(1)) > 200);
        assert.ok(luma(hairColourFor(0.5)) > luma(hairColourFor(0.2)));
    });
});

describe("persona: who they are", () => {
    it("draws a 2-year-old as a toddler and a newborn as an infant, in the clothes of a child", () => {
        const baby = personaFor({ age: 0.08, gender: "Male", seed: "a" });
        assert.equal(baby.figure, "infant");
        assert.equal(baby.attire.garment, "swaddle");
        assert.equal(baby.attire.head, "cap");
        assert.equal(baby.hair, "none", "the cap covers the hair");

        const boy = personaFor({ age: 2, gender: "Male", seed: "b" });
        assert.equal(boy.figure, "toddler");
        assert.ok(["kurta", "tee"].includes(boy.attire.garment));
        assert.equal(boy.hair, "crop");
        assert.equal(boy.earrings, false);

        const girl = personaFor({ age: 3, gender: "Female", seed: "c" });
        assert.equal(girl.figure, "toddler");
        assert.equal(girl.attire.garment, "frock");
        assert.equal(girl.hair, "pigtails");
    });

    it("gives every child, boy or girl, no lines, no grey hair, no glasses, no moustache", () => {
        for (const seed of seeds) {
            for (const age of [0.5, 2, 4, 7, 12]) {
                for (const gender of ["Male", "Female"]) {
                    const p = personaFor({ age, gender, seed });
                    assert.equal(p.grey, 0);
                    assert.equal(p.lines, 0);
                    assert.equal(p.glasses, false);
                    assert.equal(p.moustache, "none");
                }
            }
        }
    });

    it("dresses people in ordinary clothes for their age and sex", () => {
        for (const seed of seeds) {
            for (const age of [3, 8, 16, 24, 40, 60, 78]) {
                const woman = personaFor({ age, gender: "Female", seed }).attire.garment;
                const man = personaFor({ age, gender: "Male", seed }).attire.garment;
                assert.ok(!["kurta", "kurta_jacket", "shirt", "gown"].includes(woman) || age < 13, `a woman in ${woman} at ${age}`);
                assert.ok(!["saree", "salwar", "frock"].includes(man), `a man in ${man} at ${age}`);
                if (age >= 13) assert.notEqual(woman, "frock", "a frock is a child's garment");
                if (age < 20) assert.notEqual(woman, "saree", `no saree at ${age}`);
                if (age < 13) assert.ok(!["kurta_jacket", "saree"].includes(woman) && man !== "kurta_jacket", "a child is not in a saree or a Nehru jacket");
            }
        }
    });

    it("puts most older women in a saree, and only they draw it over the head", () => {
        let sarees = 0;
        for (const seed of seeds) {
            const old = personaFor({ age: 75, gender: "Female", seed });
            if (old.attire.garment === "saree") sarees++;
            const young = personaFor({ age: 30, gender: "Female", seed });
            assert.equal(young.attire.head, null, "the pallu over the head is for older women");
            if (old.attire.head === "pallu") assert.equal(old.attire.garment, "saree");
            assert.equal(personaFor({ age: 75, gender: "Male", seed }).attire.head, null);
        }
        assert.ok(sarees > seeds.length * 0.7, `${sarees} of ${seeds.length}`);
        assert.ok(seeds.some((s) => personaFor({ age: 75, gender: "Female", seed: s }).attire.head === "pallu"), "some do wear it");
    });

    it("gives adult women earrings and men a moustache more often than not, and never the community markers", () => {
        let moustaches = 0;
        for (const seed of seeds) {
            const woman = personaFor({ age: 40, gender: "Female", seed });
            const man = personaFor({ age: 40, gender: "Male", seed });
            assert.equal(woman.earrings, true);
            assert.equal(man.earrings, false);
            assert.equal(woman.moustache, "none");
            if (man.moustache !== "none") moustaches++;
            for (const p of [woman, man, personaFor({ age: 3, gender: "Female", seed })]) {
                assert.equal(p.bindi, false, "a bindi is never a default");
                assert.equal(p.noseStud, false, "a nose stud is never a default");
            }
        }
        assert.ok(moustaches > seeds.length * 0.4 && moustaches < seeds.length * 0.9, `${moustaches} moustaches`);
    });

    it("gives glasses to older people more often than to younger ones", () => {
        const rate = (age: number) => seeds.filter((s) => personaFor({ age, gender: "Male", seed: s }).glasses).length / seeds.length;
        assert.ok(rate(75) > rate(30), `${rate(75)} vs ${rate(30)}`);
        assert.ok(rate(75) > 0.35 && rate(75) < 0.75);
    });
});

describe("persona: the same case, the same person", () => {
    it("is a pure function of the age, the gender and the seed", () => {
        for (const seed of seeds.slice(0, 30)) {
            assert.deepEqual(personaFor({ age: 58, gender: "Male", seed }), personaFor({ age: 58, gender: "Male", seed }));
        }
    });

    it("looks different from one case to the next", () => {
        const persons = seeds.map((seed) => personaFor({ age: 40, gender: "Female", seed }));
        const colours = new Set(persons.map((p) => `${p.attire.garment}:${p.attire.base}`));
        assert.ok(colours.size >= 8, `only ${colours.size} different outfits in ${seeds.length} cases`);
        assert.ok(new Set(persons.map((p) => p.attire.garment)).size >= 2);
        assert.ok(new Set(persons.map((p) => p.hair)).size >= 2);
        assert.ok(new Set(persons.map((p) => p.tone)).size >= 2);
    });

    it("has a fallback when there is no seed", () => {
        assert.deepEqual(personaFor({ age: 30, gender: "Male" }), personaFor({ age: 30, gender: "Male", seed: "" }));
        assert.doesNotThrow(() => personaFor({}));
        assert.doesNotThrow(() => personaFor({ age: Number.NaN, gender: undefined }));
        assert.equal(personaFor({}).figure, "adult_m");
    });

    it("rolls a spread of numbers in [0, 1) for a spread of seeds", () => {
        const values = seeds.map((s) => unit(s, "x"));
        assert.ok(values.every((v) => v >= 0 && v < 1));
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        assert.ok(mean > 0.4 && mean < 0.6, `mean ${mean}`);
        assert.notEqual(unit("s", "hair"), unit("s", "colour"), "different purposes are independent");
    });
});

describe("persona: what a case can say for itself", () => {
    it("overrides the clothes, and only the clothes", () => {
        const base = personaFor({ age: 60, gender: "Male", seed: "x" });
        const gown = personaFor({ age: 60, gender: "Male", seed: "x", spec: { attire: "gown" } });
        assert.equal(gown.attire.garment, "gown");
        assert.equal(gown.attire.head, null);
        assert.equal(gown.grey, base.grey);
        assert.equal(gown.hair, base.hair);
    });

    it("takes exactly the accessories a case lists, and none if it lists none", () => {
        const ordinary = personaFor({ age: 70, gender: "Female", seed: "k" });
        assert.equal(ordinary.earrings, true);

        const none = personaFor({ age: 70, gender: "Female", seed: "k", spec: { accessories: [] } });
        assert.deepEqual([none.earrings, none.glasses, none.moustache, none.bindi, none.noseStud], [false, false, "none", false, false]);

        const some = personaFor({ age: 70, gender: "Female", seed: "k", spec: { accessories: ["bindi", "glasses"] } });
        assert.deepEqual([some.earrings, some.glasses, some.bindi, some.noseStud], [false, true, true, false]);

        const all = personaFor({ age: 40, gender: "Male", seed: "k", spec: { accessories: [...ACCESSORIES] } });
        assert.deepEqual([all.earrings, all.glasses, all.bindi, all.noseStud, all.moustache], [true, true, true, true, "full"]);
    });

    it("takes the skin tone the case gives", () => {
        for (const tone of ["light", "medium", "brown", "deep"] as const) assert.equal(personaFor({ age: 30, gender: "Female", seed: "z", spec: { skin_tone: tone } }).tone, tone);
    });
});

describe("persona: the fabric palette", () => {
    it("has colours for every garment, all valid", () => {
        for (const garment of GARMENTS) {
            const cloths = CLOTH_PALETTES[garment];
            assert.ok(cloths.length >= 1, garment);
            for (const c of cloths) for (const hex of [c.base, c.trim, c.accent]) assert.match(hex, HEX, `${garment} ${hex}`);
        }
    });

    it("keeps coloured garments off the pale backdrop (the backdrop is about luma 225)", () => {
        // Kurtas, shirts and swaddles may be pale (a garment edge and shading keep them legible); a saree, salwar, frock or tee may not.
        for (const garment of ["saree", "salwar", "frock", "tee"] as Garment[]) {
            for (const c of CLOTH_PALETTES[garment]) assert.ok(luma(c.base) < 200, `${garment} ${c.base} is too pale (${luma(c.base).toFixed(0)})`);
        }
    });

    it("gives a border or dupatta that shows against the cloth", () => {
        for (const garment of ["saree", "salwar", "frock"] as Garment[]) {
            for (const c of CLOTH_PALETTES[garment]) {
                const differs = c.trim !== c.base && Math.abs(luma(c.trim) - luma(c.base)) > 15;
                assert.ok(differs, `${garment}: ${c.trim} on ${c.base}`);
            }
        }
    });

    it("never lets a garment's palette entry be picked out of range", () => {
        for (const seed of seeds) {
            for (const [age, gender] of [[0.1, "Male"], [2, "Female"], [9, "Male"], [30, "Female"], [70, "Male"]] as const) {
                const p = personaFor({ age, gender, seed });
                assert.ok(CLOTH_PALETTES[p.attire.garment].some((c) => c.base === p.attire.base && c.trim === p.attire.trim && c.accent === p.attire.accent));
            }
        }
    });
});
