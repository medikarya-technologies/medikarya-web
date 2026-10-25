import { PROTOCOL_CARDS, PROTOCOL_PACKAGE } from "./decisions";
import { SHORT_CARDS, SHORT_PACKAGE } from "./short";

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
/** What a card needs to be checked against: its id, its options, and whether several may be ticked. */
export interface CheckableCard {
  id: string;
  options?: Array<{ id: string }>;
  multi?: boolean;
}

/** The questions a link's package asks. An unknown package gets none, so nothing can be stored against it. */
export function cardsFor(pkg: string): CheckableCard[] {
  if (pkg === PROTOCOL_PACKAGE) return PROTOCOL_CARDS;
  if (pkg === SHORT_PACKAGE) return SHORT_CARDS;
  return [];
}

export function cleanAnswers(input: unknown, cards: CheckableCard[] = PROTOCOL_CARDS): Answers {
  const out: Answers = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  for (const card of cards) {
    const raw = (input as Record<string, unknown>)[card.id];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const a: Answer = {};
    const known = (id: string) => card.options?.some((o) => o.id === id) ?? false;
    if (card.multi) {
      // Tick-all questions store the ticked ids as "A,C,E": known ids only, each once, in option order.
      const ticked = new Set(text(r.choice, 60).split(",").map((x) => x.trim()));
      const choice = (card.options ?? []).map((o) => o.id).filter((id) => ticked.has(id)).join(",");
      if (choice) a.choice = choice;
    } else {
      const choice = text(r.choice, 4);
      if (choice && known(choice)) a.choice = choice;
    }
    const other = text(r.other, 1500);
    if (other) a.other = other;
    const note = text(r.note, 3000);
    if (note) a.note = note;
    if (Object.keys(a).length > 0) out[card.id] = a;
  }
  return out;
}
