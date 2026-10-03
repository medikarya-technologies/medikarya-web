"use client"

// TEST MODE ONLY. When the site is started with `npm run dev:test`, next.config.mjs swaps "@clerk/nextjs" for this
// file, so you can be any of the dummy users without Clerk: pick one at /dev/login. A normal `npm run dev`, and every
// production build, never loads this file (see next.config.mjs).

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { DEV_USER_COOKIE, parseDevUser, type DevUser } from "./dev-user"

function readCookie(): DevUser | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${DEV_USER_COOKIE}=`))
  return hit ? parseDevUser(hit.slice(DEV_USER_COOKIE.length + 1)) : null
}

function useDevUser() {
  const [state, setState] = useState<{ loaded: boolean; user: DevUser | null }>({ loaded: false, user: null })
  useEffect(() => setState({ loaded: true, user: readCookie() }), [])
  return state
}

function asClerkUser(u: DevUser) {
  const [firstName, ...rest] = u.name.split(" ")
  return {
    id: u.clerkId,
    fullName: u.name,
    firstName,
    lastName: rest.join(" ") || null,
    username: u.name,
    imageUrl: "",
    primaryEmailAddress: { emailAddress: u.email },
    emailAddresses: [{ emailAddress: u.email }],
    createdAt: new Date(),
  }
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useUser() {
  const { loaded, user } = useDevUser()
  // the same object between renders, as Clerk's is (pages put it in effect dependencies)
  const clerkUser = useMemo(() => (user ? asClerkUser(user) : null), [user])
  return { isLoaded: loaded, isSignedIn: loaded ? !!user : undefined, user: clerkUser }
}

export function useAuth() {
  const { loaded, user } = useDevUser()
  return { isLoaded: loaded, isSignedIn: loaded ? !!user : undefined, userId: user?.clerkId ?? null, getToken: async () => null }
}

export function useClerk() {
  return {
    openUserProfile: () => window.alert("Test mode: there is no Clerk profile to open."),
    signOut: async () => {
      document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0`
      window.location.href = "/"
    },
  }
}

export function UserButton() {
  const { user } = useDevUser()
  return (
    <a href="/dev/login" title="Test mode: switch user" className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-3 text-xs font-semibold text-amber-900">
      {user ? `${user.name} (test)` : "Test login"}
    </a>
  )
}

function ToLogin() {
  return (
    <a href="/dev/login" className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      Test mode: choose a dummy user
    </a>
  )
}

export const SignIn = ToLogin
export const SignUp = ToLogin
export function SignInButton({ children }: { children?: ReactNode }) {
  return <a href="/dev/login">{children ?? "Sign in"}</a>
}
export const SignUpButton = SignInButton
