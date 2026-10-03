// TEST MODE ONLY (see ./clerk-client-stub.tsx). The dummy user you are acting as, kept in a cookie.

export const DEV_USER_COOKIE = "medikarya_dev_user"

/** Dummy users are user_profiles rows whose clerk_user_id starts with this; no real Clerk account can have such an id. */
export const DEV_CLERK_PREFIX = "dev_"

export interface DevUser {
  clerkId: string
  name: string
  email: string
}

export function parseDevUser(raw: string | undefined): DevUser | null {
  // The server hands the value over already decoded; the browser's document.cookie does not.
  let text = raw ?? ""
  for (let i = 0; i < 3 && text; i++) {
    try {
      const u = JSON.parse(text)
      return typeof u?.clerkId === "string" && u.clerkId.startsWith(DEV_CLERK_PREFIX) ? (u as DevUser) : null
    } catch {
      try {
        text = decodeURIComponent(text)
      } catch {
        return null
      }
    }
  }
  return null
}

/** True only for a development server started in test mode (`npm run dev:test`). */
export function testLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MEDIKARYA_TEST_LOGIN === "1"
}
