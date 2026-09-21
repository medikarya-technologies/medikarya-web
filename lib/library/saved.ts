// =========================
// lib/library/saved.ts
// =========================
// Cases a student has saved for later. It lives in the browser (one list per signed-in user, so two students on
// one browser keep their own), not in the account, so it does not follow them to another device. Storing it in
// the account is the natural next step if students ask for it; nothing else here would change.
//
// Pure: takes and returns text and arrays; the browser's storage is passed in.

export const SAVED_KEY = "medikarya-saved-cases";

/** The most a student can keep: far more than the library has, and a bound on what a stray script could write. */
export const MAX_SAVED = 200;

/** One list per signed-in user; a shared list when there is nobody (the dev preview). */
export const savedKeyFor = (scope?: string): string => (scope ? `${SAVED_KEY}:${scope}` : SAVED_KEY);

/** The saved ids from stored text: anything that is not a list of non-empty strings is an empty list. */
export function parseSaved(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        for (const item of parsed) if (typeof item === "string" && item && seen.size < MAX_SAVED) seen.add(item);
        return [...seen];
    } catch {
        return [];
    }
}

/** Adds the id at the front when it is not saved, removes it when it is. Never changes the list it was given. */
export function toggleSaved(ids: readonly string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, MAX_SAVED);
}

export const serialiseSaved = (ids: readonly string[]): string => JSON.stringify(ids);

interface Store {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const browserStorage = (): Store | undefined => (globalThis as { localStorage?: Store }).localStorage;

export function readSaved(scope?: string, storage: Store | undefined = browserStorage()): string[] {
    try {
        return parseSaved(storage?.getItem(savedKeyFor(scope)));
    } catch {
        return [];
    }
}

/** Returns false when the browser would not keep it (storage blocked or full), so the screen can say so. */
export function writeSaved(ids: readonly string[], scope?: string, storage: Store | undefined = browserStorage()): boolean {
    try {
        if (!storage) return false;
        storage.setItem(savedKeyFor(scope), serialiseSaved(ids));
        return true;
    } catch {
        return false;
    }
}
