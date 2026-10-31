// How the plain-text copies (lib/seo/markdown.ts) are served. Each one names its HTML page as the canonical copy, so
// search engines treat the .md file as the same page and do not index it twice; a reader that wants text still gets it.
export function markdownResponse(body: string, canonical?: string, contentType = "text/markdown; charset=utf-8"): Response {
    const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
    }
    if (canonical) headers["Link"] = `<${canonical}>; rel="canonical"`
    return new Response(body, { headers })
}

/** The case list could not be read: say so, and let nothing (browser or edge) keep this answer. */
export function unavailableResponse(): Response {
    return new Response("Temporarily unavailable, please try again shortly.\n", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "120" },
    })
}
