// =========================
// lib/tour/place.ts
// =========================
// Where a tour's card goes: beside the thing it explains, and inside the screen. Pure geometry, so the part of
// a tour that is easy to get wrong (a card hanging off the edge of a phone) can be tested.
//
// All numbers are CSS pixels in the viewport: a box is { x, y } of its top-left corner and { w, h } its size.

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Size {
    w: number;
    h: number;
}

export type Placement = "bottom" | "top" | "right" | "left" | "center";

export interface Placed {
    top: number;
    left: number;
    placement: Placement;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Tries below, above, to the right and to the left of the target, in that order, and takes the first that fits
 * on the screen. Across the other axis the card is centred on the target, then pushed back inside the margins.
 * When none fits (a target about as big as the screen) the card goes in the middle.
 */
export function placeCard(target: Box, card: Size, view: Size, opts: { gap?: number; margin?: number } = {}): Placed {
    const gap = opts.gap ?? 14;
    const margin = opts.margin ?? 12;

    const across = { x: target.x + target.w / 2 - card.w / 2, y: target.y + target.h / 2 - card.h / 2 };
    const tries: Array<{ placement: Exclude<Placement, "center">; top: number; left: number; fits: boolean }> = [
        { placement: "bottom", top: target.y + target.h + gap, left: across.x, fits: target.y + target.h + gap + card.h <= view.h - margin },
        { placement: "top", top: target.y - gap - card.h, left: across.x, fits: target.y - gap - card.h >= margin },
        { placement: "right", top: across.y, left: target.x + target.w + gap, fits: target.x + target.w + gap + card.w <= view.w - margin },
        { placement: "left", top: across.y, left: target.x - gap - card.w, fits: target.x - gap - card.w >= margin },
    ];

    for (const t of tries) {
        if (!t.fits) continue;
        return {
            placement: t.placement,
            top: clamp(t.top, margin, view.h - margin - card.h),
            left: clamp(t.left, margin, view.w - margin - card.w),
        };
    }
    return { placement: "center", top: Math.max(margin, (view.h - card.h) / 2), left: Math.max(margin, (view.w - card.w) / 2) };
}
