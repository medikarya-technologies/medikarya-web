// =========================
// lib/simulation/portrait-palette.ts
// =========================
// The colours of the patient's portrait. This is where "very pale and yellow"
// becomes pixels: pallor drains the skin, jaundice tints it (and the whites of the
// eyes far more than the skin), cyanosis blues the lips, a flush warms the cheeks.
//
// It is kept apart from the drawing so it can be tested: the meaning of the
// portrait is in these numbers, and a portrait that draws "very pale" as a
// healthy tan would be worse than no portrait.
//
// The same finding shows differently on different skin, as it does in life: on
// lighter skin pallor is a pale cream, on deeper skin it is an ashen grey; jaundice
// is seen first in the sclerae whatever the skin.

import type { ResolvedLook, SkinTone } from "./appearance";

interface ToneSpec {
    base: string;
    /** What pallor drains the skin toward on this tone. */
    pallorTo: string;
    lips: string;
    /** How strongly jaundice tints the skin itself (the eyes are always tinted fully). */
    jaundiceFactor: number;
}

const TONES: Record<SkinTone, ToneSpec> = {
    light: { base: "#f1cdb0", pallorTo: "#f0e6de", lips: "#cf8378", jaundiceFactor: 1 },
    medium: { base: "#dcae84", pallorTo: "#d9c7b8", lips: "#b8695a", jaundiceFactor: 0.9 },
    brown: { base: "#b98459", pallorTo: "#a4897a", lips: "#94584a", jaundiceFactor: 0.75 },
    deep: { base: "#7d5035", pallorTo: "#75625a", lips: "#6c3d34", jaundiceFactor: 0.6 },
};

const JAUNDICE_SKIN = "#d2b03f";
const JAUNDICE_SCLERA = "#e0bd38";
const CYANOSIS_SKIN = "#8089ac";
const CYANOSIS_LIPS = "#6a6d9c";
const SCLERA = "#f7f4ef";
const FLUSH = "#d8574a";

// ── Colour maths ────────────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function parse(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

/** `a` blended toward `b` by `t` (0 = a, 1 = b), in sRGB. */
export function mixHex(a: string, b: string, t: number): string {
    const k = clamp01(t);
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    return `#${toHex(ar + (br - ar) * k)}${toHex(ag + (bg - ag) * k)}${toHex(ab + (bb - ab) * k)}`;
}

/** Perceived brightness 0–255 (Rec. 601). */
export function luma(hex: string): number {
    const [r, g, b] = parse(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ── The palette ─────────────────────────────────────────────────────────────

export interface PortraitPalette {
    skin: string;
    /** A shade darker: the neck, under the jaw, the creases. */
    skinShade: string;
    lips: string;
    /** The whites of the eyes. */
    sclera: string;
    /** Cheek colour and how strong it is (0–1). */
    blush: string;
    blushOpacity: number;
}

export function portraitPalette(tone: SkinTone, look: ResolvedLook): PortraitPalette {
    const t = TONES[tone];

    // Order matters: drain the colour, then tint what is left.
    let skin = mixHex(t.base, t.pallorTo, look.pallor * 0.24);
    skin = mixHex(skin, JAUNDICE_SKIN, look.jaundice * 0.14 * t.jaundiceFactor);
    skin = mixHex(skin, CYANOSIS_SKIN, look.cyanosis * 0.05);

    let lips = mixHex(t.lips, t.pallorTo, look.pallor * 0.18);
    lips = mixHex(lips, CYANOSIS_LIPS, look.cyanosis * 0.3);

    // Jaundice shows in the sclerae at any depth of skin: a slight tint is already plain.
    const sclera = mixHex(SCLERA, JAUNDICE_SCLERA, look.jaundice * 0.32);

    return {
        skin,
        skinShade: mixHex(skin, "#3b2418", 0.18),
        lips,
        sclera,
        blush: FLUSH,
        blushOpacity: look.flushed * 0.13,
    };
}
