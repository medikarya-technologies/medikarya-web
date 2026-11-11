// A visitor plays the free case on /try, reads the debrief, and signs up because it says "save your progress". Their
// attempt was filed under "guest:<id>" and stayed there, so the new account opened empty and was sent to the same
// patient again. Now the server keeps the guest id in its own cookie (a browser cannot name someone else's), and the
// account's first dashboard visit takes over the plays made just before it was created.
// Pure, so it is tested; lib/library/guest-claim-server.ts reads and writes the database.

/** httpOnly, set by the server when a guest's attempt is saved. */
export const GUEST_COOKIE = "mk_guest";

/** A random UUID, the shape both the browser and the server make. */
export const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How a guest's attempts are filed in case_attempts.user_id. */
export const guestOwner = (guestId: string) => `guest:${guestId}`;

/** Plays this long before the account was made still count as "played, then signed up". */
export const CLAIM_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;
/** A little after, for clocks that disagree. */
export const CLAIM_AFTER_MS = 30 * 60 * 1000;

/**
 * Whether a guest play belongs to this new account. Only plays from shortly before the account was created: on a
 * shared computer, someone else's guest plays from later on (or from long ago) stay where they are.
 */
export function claimable(playedAt: Date | string, accountCreatedAt: Date | number): boolean {
  const played = new Date(playedAt).getTime();
  const created = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(played) || !Number.isFinite(created)) return false;
  return played >= created - CLAIM_BEFORE_MS && played <= created + CLAIM_AFTER_MS;
}
