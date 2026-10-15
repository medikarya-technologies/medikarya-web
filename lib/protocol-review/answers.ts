import { PROTOCOL_CARDS } from "./decisions";

// What a professor's answers look like, and the one function that decides what is kept. Pure, so the page, the server
// and the tests share it.

export interface Answer {
  choice?: string;
  other?: string;
  note?: string;
}
export type Answers = Record<string, Answer>;

/**
 * Keeps only what the page could have sent: a known card, a choice that is one of its options, and text of a sane
 * length. Anything else is dropped, so a hand-made request cannot store junk.
 */
export function cleanAnswers(input: unknown): Answers {
  const out: Answers = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  for (const card of PROTOCOL_CARDS) {
    const raw = (input as Record<string, unknown>)[card.id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const a: Answer = {};
    const choice = text(r.choice, 4);
    if (choice && card.options?.some((o) => o.id === choice)) a.choice = choice;
    const other = text(r.other, 1500);
    if (other) a.other = other;
    const note = text(r.note, 3000);
    if (note) a.note = note;
    if (Object.keys(a).length > 0) out[card.id] = a;
  }
  return out;
}
