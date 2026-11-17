// Where to send someone after they sign in. Pages that need an account send the visitor to /login with
// ?redirect_url=<the page they wanted>, which Clerk's sign-in and sign-up boxes follow once the account is ready, so a
// student who tapped "Become a Resident", or an organiser who opened the event desk, comes back to it instead of the
// dashboard. Only paths on this site are kept: anything else would let a link send people to another site.

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  // the sign-in pages themselves would loop
  if (/^\/(login|signup)(\/|\?|#|$)/.test(value)) return null
  return value
}

export function loginUrlFor(returnTo: string | null | undefined): string {
  const path = safeReturnPath(returnTo)
  return path ? `/login?redirect_url=${encodeURIComponent(path)}` : "/login"
}
