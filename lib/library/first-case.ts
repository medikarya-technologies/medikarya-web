// A brand-new account's first visit: straight to its first patient instead of an empty dashboard. People who signed
// up and landed on the dashboard were leaving without opening a case (Clarity, October 2026). It happens once per
// browser: the dashboard and the welcome itself both set a cookie, so nobody is ever sent there twice.
// Pure, so it is tested; lib/library/first-case-server.ts reads the database.

import { GUEST_CASE_IDS } from "../plans/limits";

/** The 2-year-old with diarrhoea: Beginner, on every plan, and the case visitors play on /try. */
export const FIRST_CASE_ID = GUEST_CASE_IDS[0];

/** Where a brand-new account is sent; `first=1` shows the welcome above the briefing. */
export const FIRST_CASE_HREF = `/dashboard/cases/${FIRST_CASE_ID}?first=1`;

export const WELCOMED_COOKIE = "mk_welcomed";

/** Only someone who has never opened or finished a case, has not been welcomed on this browser, and is not an admin. */
export function sendToFirstCase(who: { welcomed: boolean; admin: boolean; starts: number; attempts: number }): boolean {
  return !who.welcomed && !who.admin && who.starts === 0 && who.attempts === 0;
}

/** Remembers, in this browser, that the welcome is done (or not needed). For a year; harmless if it cannot be set. */
export function markWelcomed(): void {
  const page = (globalThis as { document?: { cookie: string } }).document;
  try {
    if (page) page.cookie = `${WELCOMED_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* no cookies: the redirect checks the database again next time, and still only sends someone with no cases */
  }
}
