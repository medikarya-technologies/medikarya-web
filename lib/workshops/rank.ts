// The arithmetic behind a workshop's top scores (Admin → Top scores) and its participation certificates (Admin →
// Workshop passes → Certificates). Pure, so it is tested; lib/workshops/server.ts reads the rows.

export interface AttemptRow {
  user_id: string;
  case_id: string;
  score: number | null;
  created_at: string;
}

/** Which attempt counts: the first one (fair for prizes: retrying cannot help) or the best one. */
export type Count = "first" | "best";

export interface Ranked {
  userId: string;
  score: number;
  /** When the counted attempt was finished. */
  at: string;
  /** How many times they finished this case in the window. */
  attempts: number;
}

/**
 * Per case, one line per student (the attempt that counts), highest score first. A tie goes to whoever finished the
 * counted attempt first. Attempts without a score are ignored.
 */
export function rankByCase(rows: readonly AttemptRow[], count: Count): Map<string, Ranked[]> {
  const byCase = new Map<string, Map<string, Ranked>>();
  const sorted = rows.filter((r) => typeof r.score === "number").sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of sorted) {
    const students = byCase.get(r.case_id) ?? new Map<string, Ranked>();
    byCase.set(r.case_id, students);
    const seen = students.get(r.user_id);
    if (!seen) students.set(r.user_id, { userId: r.user_id, score: r.score as number, at: r.created_at, attempts: 1 });
    else {
      seen.attempts += 1;
      if (count === "best" && (r.score as number) > seen.score) Object.assign(seen, { score: r.score, at: r.created_at });
    }
  }
  const out = new Map<string, Ranked[]>();
  for (const [caseId, students] of byCase) {
    out.set(caseId, [...students.values()].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)));
  }
  return out;
}

/** Positions with ties shared: scores 90, 90, 85 are places 1, 1, 3. Ties are still listed in finishing order. */
export function places(ranked: readonly Ranked[]): number[] {
  const out: number[] = [];
  ranked.forEach((r, i) => out.push(i > 0 && ranked[i - 1].score === r.score ? out[i - 1] : i + 1));
  return out;
}

/** "Riya Sharma" → "Riya S.", for a screen the whole room can see. */
export function shortName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A student";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Students who finished every one of `required` (at least once each in the rows given). */
export function finishedAll(rows: readonly AttemptRow[], required: readonly string[]): Set<string> {
  const done = new Map<string, Set<string>>();
  for (const r of rows) {
    if (typeof r.score !== "number") continue;
    const cases = done.get(r.user_id) ?? new Set<string>();
    cases.add(r.case_id);
    done.set(r.user_id, cases);
  }
  const out = new Set<string>();
  if (required.length === 0) return out;
  for (const [userId, cases] of done) if (required.every((c) => cases.has(c))) out.add(userId);
  return out;
}

const longDate = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * The line under the event's name on a participation certificate: "…has taken part in the <title> held at <venue>
 * on 24 October 2026, working through 2 simulated patient cases on MediKarya."
 */
export function workshopDetail(venue: string, day: string, cases: number): string {
  const where = venue.trim().replace(/\s+/g, " ");
  const n = cases === 1 ? "1 simulated patient case" : `${cases} simulated patient cases`;
  return `held ${where ? `at ${where} ` : ""}on ${longDate(day)}, working through ${n} on MediKarya`;
}

export const CERTIFICATE_LIMITS = {
  titleChars: 80,
  venueChars: 120,
  nameChars: 80,
  /** Certificates issued in one request; the admin page sends a long list in parts, so no request runs for long. */
  perCall: 20,
} as const;

/** What is wrong with a certificate's wording, in words, or null. */
export function certificateProblem(f: { title: string; venue: string; day: string; cases: readonly string[] }): string | null {
  if (f.title.trim().length < 5) return "Give the certificate a title, for example “Clinical Reasoning Workshop”.";
  if (f.title.length > CERTIFICATE_LIMITS.titleChars) return `Keep the title under ${CERTIFICATE_LIMITS.titleChars} characters.`;
  if (f.venue.length > CERTIFICATE_LIMITS.venueChars) return `Keep the place under ${CERTIFICATE_LIMITS.venueChars} characters.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.day) || Number.isNaN(Date.parse(`${f.day}T00:00:00+05:30`))) return "Choose the day of the workshop.";
  if (f.cases.length === 0) return "Tick the cases a student must finish to get a certificate.";
  return null;
}

/** A name fit to print: trimmed, single spaces, 3 to 80 characters, at least one letter. */
export function printableName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 3 || clean.length > CERTIFICATE_LIMITS.nameChars || !/\p{L}/u.test(clean)) return null;
  return clean;
}
