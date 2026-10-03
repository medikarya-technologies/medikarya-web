// TEST MODE ONLY. next.config.mjs swaps "@clerk/nextjs/server" for this file when the site is started with
// `npm run dev:test` (see ./clerk-client-stub.tsx). It answers "who is signed in" with the dummy user chosen at
// /dev/login. Never loaded by a normal dev server or a production build.

import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { DEV_USER_COOKIE, parseDevUser, type DevUser } from "./dev-user"

async function devUser(): Promise<DevUser | null> {
  return parseDevUser((await cookies()).get(DEV_USER_COOKIE)?.value)
}

export async function auth() {
  const user = await devUser()
  return { userId: user?.clerkId ?? null, sessionClaims: null }
}

function asClerkUser(u: DevUser) {
  const [firstName, ...rest] = u.name.split(" ")
  return { id: u.clerkId, firstName, lastName: rest.join(" ") || null, fullName: u.name, username: u.name, emailAddresses: [{ emailAddress: u.email }] }
}

export async function currentUser() {
  const user = await devUser()
  return user ? asClerkUser(user) : null
}

export async function clerkClient() {
  return {
    users: {
      getUser: async (id: string) => {
        const user = await devUser()
        if (!user || user.clerkId !== id) throw new Error("Test mode: no such dummy user")
        return asClerkUser(user)
      },
    },
  }
}

type Handler = (auth: () => Promise<{ userId: string | null }>, req: NextRequest) => unknown

/** The middleware reads the dummy user from the request itself (next/headers is not available there). */
export function clerkMiddleware(handler?: Handler) {
  return async (req: NextRequest) => {
    const user = parseDevUser(req.cookies.get(DEV_USER_COOKIE)?.value)
    return handler ? handler(async () => ({ userId: user?.clerkId ?? null }), req) : undefined
  }
}

export function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((p) => new RegExp(`^${p}$`))
  return (req: NextRequest) => regexes.some((r) => r.test(req.nextUrl.pathname))
}
