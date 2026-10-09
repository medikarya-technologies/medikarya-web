// Workshop passes: free plan time for everyone at an event, given in one go from Admin → Workshop passes. A pass is
// a row in plan_grants (the same table as a case writer's free Resident months), one per email, with the reason
// "workshop: <name of the event>" so a batch can be listed and removed together. It applies when the student signs
// in with that email (lib/plans/server.ts), starts at midnight India time on the chosen day, and simply ends: the
// student goes back to the free plan, nothing is charged. Pure, so it is tested.

import { indiaDay, type Plan } from "./limits";

export const PASS_REASON_PREFIX = "workshop: ";

export const PASS_LIMITS = { maxEmails: 1000, minDays: 1, maxDays: 60, nameChars: 80 } as const;

const DAY_MS = 86_400_000;

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

/**
 * The emails in whatever was pasted: one per line, comma-separated, or a column copied from a spreadsheet with names
 * beside it. Words without an "@" (names, years) are ignored; something with an "@" that is not an email is listed as
 * a mistake. Lower-cased and each one once.
 */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.replace(/^[<("'[]+|[>)"'\].]+$/g, "").trim().toLowerCase();
    if (!token.includes("@")) continue;
    (EMAIL.test(token) ? valid : invalid).add(token);
  }
  return { valid: [...valid], invalid: [...invalid] };
}

/** From midnight India time on `startDay` (YYYY-MM-DD) for `days` days. null if the day is not a real date. */
export function passWindow(startDay: string, days: number): { startsAt: Date; endsAt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return null;
  const startsAt = new Date(`${startDay}T00:00:00+05:30`);
  if (Number.isNaN(startsAt.getTime())) return null;
  // a day like 2026-02-31 can roll over into March; refuse it rather than give a different day
  if (indiaDay(startsAt) !== startDay) return null;
  return { startsAt, endsAt: new Date(startsAt.getTime() + days * DAY_MS) };
}

/** Whole days a pass covers, from its two ends. */
export const passDays = (startsAt: Date, endsAt: Date) => Math.round((endsAt.getTime() - startsAt.getTime()) / DAY_MS);

/**
 * plan_grants records a length in whole months (and refuses 0); the end date is what actually ends a pass, so a
 * 14-day pass is stored as 1 month with the right end date. Only case-writer rewards add months up, and passes are
 * never counted there.
 */
export const monthsLabel = (days: number) => Math.max(1, Math.ceil(days / 30));

export interface PassRequest {
  name: string;
  plan: Plan;
  startDay: string;
  days: number;
  emailsText: string;
}

export type PassCheck =
  | { ok: true; reason: string; plan: "intern" | "resident"; startsAt: Date; endsAt: Date; emails: string[]; invalid: string[] }
  | { ok: false; error: string };

/** Everything wrong with a request, in words, or what to give. */
export function checkPassRequest(r: PassRequest): PassCheck {
  const name = r.name.trim().replace(/\s+/g, " ");
  if (name.length < 3) return { ok: false, error: "Give the batch a name, for example “MAMC workshop, Nov 2026”." };
  if (name.length > PASS_LIMITS.nameChars) return { ok: false, error: `Keep the name under ${PASS_LIMITS.nameChars} characters.` };
  if (r.plan !== "intern" && r.plan !== "resident") return { ok: false, error: "Choose Intern or Resident." };
  if (!Number.isInteger(r.days) || r.days < PASS_LIMITS.minDays || r.days > PASS_LIMITS.maxDays) {
    return { ok: false, error: `A pass lasts ${PASS_LIMITS.minDays} to ${PASS_LIMITS.maxDays} days.` };
  }
  const window = passWindow(r.startDay, r.days);
  if (!window) return { ok: false, error: "Choose the day the pass starts." };
  const { valid, invalid } = parseEmails(r.emailsText);
  if (valid.length === 0) return { ok: false, error: "Paste at least one email." };
  if (valid.length > PASS_LIMITS.maxEmails) return { ok: false, error: `That is ${valid.length} emails; give up to ${PASS_LIMITS.maxEmails} at a time.` };
  return { ok: true, reason: `${PASS_REASON_PREFIX}${name}`, plan: r.plan, ...window, emails: valid, invalid };
}
