import { GUEST_CASE_IDS } from "@/lib/plans/limits"

// robots.txt, written out by hand rather than with app/robots.ts so it can carry comments for the people and tools
// that read it. The rules decide crawling only; pages that must stay out of search carry noindex themselves.
//
// /try loads its free case from /api/cases/<id> in the browser. With all of /api blocked, Google's renderer cannot
// fetch it, so the only /try it can see is the error state; the Allow lines (more specific than Disallow: /api, so they win) let it fetch that one
// case's briefing, which anyone can already read without an account. next.config.mjs marks every /api response noindex.
export const dynamic = "force-static"

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://www.medikarya.in"

function robotsTxt(): string {
    return [
        "# MediKarya: clinical case practice for MBBS students.",
        `# A short guide to the site for AI assistants: ${SITE}/llms.txt`,
        `# Every public page, with plain Markdown copies: ${SITE}/sitemap.md`,
        "",
        "User-Agent: *",
        "Allow: /",
        ...GUEST_CASE_IDS.map((id) => `Allow: /api/cases/${id}$`),
        "Disallow: /dashboard",
        "Disallow: /api",
        "Disallow: /login",
        "Disallow: /signup",
        "Disallow: /admin",
        "Disallow: /review/",
        "Disallow: /advisor/",
        "Disallow: /dev/",
        "Disallow: /sim-preview",
        "Disallow: /og-card",
        "Disallow: /md/",
        "",
        `Sitemap: ${SITE}/sitemap.xml`,
        "",
    ].join("\n")
}

export function GET() {
    return new Response(robotsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
