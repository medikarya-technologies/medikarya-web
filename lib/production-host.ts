/** True on medikarya.in and its subdomains only: not localhost, not a Vercel preview, not a look-alike domain. */
export function isProductionHost(hostname: string): boolean {
  return hostname === "medikarya.in" || hostname.endsWith(".medikarya.in")
}
