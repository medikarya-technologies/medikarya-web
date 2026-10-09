import "server-only"

import { headers } from "next/headers"

/** This site's address as the visitor reached it (https://www.medikarya.in live, http://localhost:3000 in development). */
export async function siteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.medikarya.in"
  return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`
}

/** A link as it is read aloud or shown on a screen: no "https://www.". */
export const shortLink = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "")
