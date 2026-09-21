"use client"

// Who is signed in, as the dashboard shows them: the name from Clerk, else a readable name made from
// the email ("priya.sharma@…" → "Priya Sharma"), and the two-letter initials for the avatar.

import { useUser } from "@clerk/nextjs"
import { firstNameOf } from "@/lib/library/case-library"

export interface DisplayName {
  isLoaded: boolean
  /** "Priya Sharma", or "" until it is known. */
  name: string
  /** "Priya", or "". */
  firstName: string
  initials: string
  imageUrl?: string
}

function fromEmail(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

export function useDisplayName(override?: string): DisplayName {
  const { user, isLoaded } = useUser()

  let name = override ?? ""
  if (!name && isLoaded && user) {
    name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
    if (!name && user.primaryEmailAddress?.emailAddress) name = fromEmail(user.primaryEmailAddress.emailAddress)
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "U"

  return { isLoaded: isLoaded || !!override, name, firstName: firstNameOf(name), initials, imageUrl: user?.imageUrl }
}
