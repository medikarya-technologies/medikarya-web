// A clock time for the encounter clock. Kept apart from encounter-events.ts (which re-exports it) so a screen that
// only needs this, like the briefing card, does not carry the whole event model with it.
//
// Pure: no React, no I/O, no `@/` imports.

/** "08:32" for under an hour, "1:08:32" beyond. Negative/NaN clamp to 00:00. */
export function formatClock(totalSeconds: number): string {
    const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
