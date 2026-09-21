// =========================
// lib/simulation/resume.ts
// =========================
// Whether a case is "in progress" on this device, read from what the encounter already keeps in the browser:
//
//   medikarya-sim-<id>      the event log and the clock                   (components/cases/clinical-event-manager.tsx)
//   medikarya-sim-ui-<id>   the chat, and the result once it has been scored (components/cases/simulation-interaction.tsx)
//
// A case is in progress when the student has done something at the bedside (asked, examined, ordered,
// treated) and has not been scored yet. The encounter picks itself up when the case is opened again; this only
// lets the library and the home page say so. It lives in the browser, not the account, so it does not follow
// a student to another device, and two people sharing one browser share it.
//
// Pure: takes the stored text and returns a value. Relative imports only (the test runner compiles it alone).

import { sanitizeEvents } from "./encounter-events";

export const simStorageKey = (caseId: string): string => `medikarya-sim-${caseId}`;
export const uiStorageKey = (caseId: string): string => `medikarya-sim-ui-${caseId}`;

export interface InProgress {
    caseId: string;
    /** Simulation seconds on the encounter clock when the student left. */
    elapsedSeconds: number;
    /** How many things the student has done: questions asked, examinations, tests, treatments. */
    actions: number;
    /** When it was last saved, in ms since the epoch; absent on a save written before that was recorded. */
    savedAt?: number;
}

/** The patient changing on their own is not the student doing something. */
const NOT_THE_STUDENT: ReadonlySet<string> = new Set(["STATE_TRANSITION", "PATIENT_DETERIORATED"]);

function parse(raw: string | null | undefined): unknown {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * `sim` and `ui` are the stored text under the two keys (null when there is none). Returns null when there is
 * nothing to pick up: no save, nothing done yet, or the case has already been scored.
 */
export function describeInProgress(caseId: string, sim: string | null | undefined, ui: string | null | undefined): InProgress | null {
    const shown = parse(ui) as { feedback?: unknown } | null;
    if (shown && typeof shown === "object" && shown.feedback != null) return null;

    const saved = parse(sim) as { v?: unknown; events?: unknown; elapsedSeconds?: unknown; savedAt?: unknown } | null;
    if (!saved || typeof saved !== "object" || saved.v !== 1) return null;

    const events = sanitizeEvents(saved.events);
    const actions = events.filter((e) => !NOT_THE_STUDENT.has(e.type)).length;
    if (actions === 0) return null;

    const last = events[events.length - 1]?.timestamp ?? 0;
    const elapsed = typeof saved.elapsedSeconds === "number" && Number.isFinite(saved.elapsedSeconds) ? Math.max(0, saved.elapsedSeconds) : 0;
    const savedAt = typeof saved.savedAt === "number" && Number.isFinite(saved.savedAt) ? saved.savedAt : undefined;
    return { caseId, elapsedSeconds: Math.max(elapsed, last), actions, savedAt };
}

// ── Reading and clearing the browser's copy ─────────────────────────────────

interface Reader {
    getItem(key: string): string | null;
}
interface Remover {
    removeItem(key: string): void;
}

const browserStorage = (): (Reader & Remover) | undefined => (globalThis as { localStorage?: Reader & Remover }).localStorage;

export function readInProgress(caseId: string, storage: Reader | undefined = browserStorage()): InProgress | null {
    try {
        if (!storage) return null;
        return describeInProgress(caseId, storage.getItem(simStorageKey(caseId)), storage.getItem(uiStorageKey(caseId)));
    } catch {
        return null; // storage blocked or full: nothing to resume
    }
}

export function readAllInProgress(caseIds: readonly string[], storage: Reader | undefined = browserStorage()): Map<string, InProgress> {
    const found = new Map<string, InProgress>();
    for (const id of caseIds) {
        const one = readInProgress(id, storage);
        if (one) found.set(id, one);
    }
    return found;
}

/** The case worked on most recently, if there is more than one. */
export function mostRecent(inProgress: ReadonlyMap<string, InProgress>): InProgress | undefined {
    let best: InProgress | undefined;
    for (const one of inProgress.values()) if (!best || (one.savedAt ?? 0) > (best.savedAt ?? 0)) best = one;
    return best;
}

/** Forget the encounter on this device, so opening the case starts it afresh. */
export function clearInProgress(caseId: string, storage: Remover | undefined = browserStorage()): void {
    try {
        storage?.removeItem(simStorageKey(caseId));
        storage?.removeItem(uiStorageKey(caseId));
    } catch {
        /* nothing to do: it will simply not be cleared */
    }
}
