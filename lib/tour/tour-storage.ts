// =========================
// lib/tour/tour-storage.ts
// =========================
// Whether to walk a student through the encounter, and remembering that they have been. The first case is
// the only time it starts by itself: for someone with no attempts on any case, who has not seen it on this
// device. It is kept in the browser (per signed-in user, so a second student on the same browser still gets
// theirs), and can always be replayed from the button in the encounter's top bar.
//
// Pure apart from the browser's storage, which is passed in so it can be tested. No `@/` imports.

/** How the encounter is asked to run its tour. */
export interface EncounterTourConfig {
    /** Who the "seen" flag belongs to (the user id). Without it nothing is remembered, and nothing starts by itself unless `auto` says so. */
    who?: string;
    /** Start it by itself when the encounter opens. */
    auto?: boolean;
}

export const tourStorageKey = (who: string): string => `medikarya-tour-v1:${who}`;

interface Store {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const browserStorage = (): Store | undefined => (globalThis as { localStorage?: Store }).localStorage;

export function tourSeen(who: string, storage: Store | undefined = browserStorage()): boolean {
    try {
        return !!storage?.getItem(tourStorageKey(who));
    } catch {
        return false;
    }
}

export function markTourSeen(who: string, storage: Store | undefined = browserStorage(), now: number = Date.now()): void {
    try {
        storage?.setItem(tourStorageKey(who), String(now));
    } catch {
        /* storage blocked: the tour may show once more, which is harmless */
    }
}

/** Start by itself only for a student who has never finished a case and has not seen it here. */
export function shouldAutoTour({ hasAttempts, seen }: { hasAttempts: boolean; seen: boolean }): boolean {
    return !hasAttempts && !seen;
}
