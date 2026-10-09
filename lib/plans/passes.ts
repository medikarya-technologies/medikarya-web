// Workshop passes: free plan time for everyone at an event, given in one go from Admin → Workshop passes. A pass is
// a row in plan_grants (the same table as a case writer's free Resident months), one per email, with the reason
// "workshop: <name of the event>" so a batch can be listed and removed together. It applies when the student signs
// in with that email (lib/plans/server.ts), starts at midnight India time on the chosen day, and simply ends: the
// student goes back to the free plan, nothing is charged. Pure, so it is tested.
//
// Two ways in: the admin pastes the registered emails, or makes a join link (medikarya.in/join/<code>, shown in the
// room as a QR code) that gives the pass to whichever account opens it, while the link is open and not full.

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

/** What every pass has, however it is given. */
export interface PassDetails {
  name: string;
  plan: Plan;
  startDay: string;
  days: number;
}

export interface PassRequest extends PassDetails {
  emailsText: string;
}

type Checked<T> = ({ ok: true } & T) | { ok: false; error: string };

export type PassDetailsCheck = Checked<{ name: string; reason: string; plan: "intern" | "resident"; startsAt: Date; endsAt: Date }>;
export type PassCheck = Checked<{ reason: string; plan: "intern" | "resident"; startsAt: Date; endsAt: Date; emails: string[]; invalid: string[] }>;

/** The event name, plan and dates, or what is wrong with them, in words. */
export function checkPassDetails(r: PassDetails): PassDetailsCheck {
  const name = r.name.trim().replace(/\s+/g, " ");
  if (name.length < 3) return { ok: false, error: "Give the batch a name, for example “the MAMC workshop”." };
  if (name.length > PASS_LIMITS.nameChars) return { ok: false, error: `Keep the name under ${PASS_LIMITS.nameChars} characters.` };
  if (r.plan !== "intern" && r.plan !== "resident") return { ok: false, error: "Choose Intern or Resident." };
  if (!Number.isInteger(r.days) || r.days < PASS_LIMITS.minDays || r.days > PASS_LIMITS.maxDays) {
    return { ok: false, error: `A pass lasts ${PASS_LIMITS.minDays} to ${PASS_LIMITS.maxDays} days.` };
  }
  const window = passWindow(r.startDay, r.days);
  if (!window) return { ok: false, error: "Choose the day the pass starts." };
  return { ok: true, name, reason: `${PASS_REASON_PREFIX}${name}`, plan: r.plan, ...window };
}

/** Everything wrong with a request, in words, or what to give. */
export function checkPassRequest(r: PassRequest): PassCheck {
  const details = checkPassDetails(r);
  if (!details.ok) return details;
  const { valid, invalid } = parseEmails(r.emailsText);
  if (valid.length === 0) return { ok: false, error: "Paste at least one email." };
  if (valid.length > PASS_LIMITS.maxEmails) return { ok: false, error: `That is ${valid.length} emails; give up to ${PASS_LIMITS.maxEmails} at a time.` };
  return { ok: true, reason: details.reason, plan: details.plan, startsAt: details.startsAt, endsAt: details.endsAt, emails: valid, invalid };
}

// ── Join links ───────────────────────────────────────────────────────────────

export const JOIN_LIMITS = { minJoins: 1, maxJoins: 1000, defaultJoins: 250, maxOpenDays: 14 } as const;

/** Letters and digits that cannot be mistaken for each other when read off a screen (no 0/o, 1/l/i). */
const CODE_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";
const FILLER = new Set(["the", "a", "an", "at", "of", "for", "in", "on", "workshop", "event", "session"]);

/**
 * The end of the join link: the event's first real word and four random characters, e.g. "the MAMC workshop" →
 * "mamc-4k7q". The random part keeps outsiders from guessing it. `random` gives numbers in [0, 1).
 */
export function joinCodeFor(name: string, random: () => number = Math.random): string {
  const word =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .find((w) => w.length > 1 && !FILLER.has(w)) ?? "join";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  return `${word.slice(0, 10)}-${tail}`;
}

/** A code as it arrives in a link: lower case, only what a code can contain. null if it cannot be one. */
export function cleanJoinCode(raw: string): string | null {
  let code: string;
  try {
    code = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  return /^[a-z0-9]{1,10}-[a-z0-9]{4}$/.test(code) ? code : null;
}

export interface JoinRequest extends PassDetails {
  /** The first day the link works, and for how many days. */
  openDay: string;
  openDays: number;
  maxJoins: number;
}

export type JoinCheck = Checked<{ pass: Extract<PassDetailsCheck, { ok: true }>; opensAt: Date; closesAt: Date; maxJoins: number }>;

/** A new join link's details, or what is wrong with them, in words. */
export function checkJoinRequest(r: JoinRequest): JoinCheck {
  const pass = checkPassDetails(r);
  if (!pass.ok) return pass;
  if (!Number.isInteger(r.openDays) || r.openDays < 1 || r.openDays > JOIN_LIMITS.maxOpenDays) {
    return { ok: false, error: `The link can stay open 1 to ${JOIN_LIMITS.maxOpenDays} days.` };
  }
  const open = passWindow(r.openDay, r.openDays);
  if (!open) return { ok: false, error: "Choose the day the link starts working." };
  if (open.endsAt <= pass.startsAt || open.startsAt >= pass.endsAt) return { ok: false, error: "The link has to be open while the pass runs." };
  if (!Number.isInteger(r.maxJoins) || r.maxJoins < JOIN_LIMITS.minJoins || r.maxJoins > JOIN_LIMITS.maxJoins) {
    return { ok: false, error: `Allow ${JOIN_LIMITS.minJoins} to ${JOIN_LIMITS.maxJoins} students.` };
  }
  return { ok: true, pass, opensAt: open.startsAt, closesAt: open.endsAt, maxJoins: r.maxJoins };
}

export type JoinState = "open" | "off" | "not_yet" | "closed" | "full";

/** Whether a join link lets someone new in right now. */
export function joinState(
  link: { active: boolean; opensAt: string | Date; closesAt: string | Date; maxJoins: number },
  joined: number,
  now = new Date()
): JoinState {
  if (!link.active) return "off";
  if (now < new Date(link.opensAt)) return "not_yet";
  if (now >= new Date(link.closesAt)) return "closed";
  if (joined >= link.maxJoins) return "full";
  return "open";
}
