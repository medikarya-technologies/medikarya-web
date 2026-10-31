import type { Article } from "../blog/articles"
import type { CaseGuide } from "./case-guides"

// Plain-text copies of the public pages, for tools that read text rather than render pages (AI assistants, answer
// engines, people's own scripts): /llms.txt, /sitemap.md, /blog/<slug>.md and /case-studies/<id>.md. Each one is
// built from the same data as its HTML page (lib/blog/articles.ts, lib/seo/case-guides.ts, the published case list),
// so the two cannot say different things. Pure functions, no Next or database imports, so they can be unit-tested.
//
// What never goes in here: anything a signed-in student sees, a case's diagnosis, prices (they belong to the pricing
// section and the plan pages), and how cases are made.

export const MD_SITE_URL = "https://www.medikarya.in"

/** The bits of a published case the public pages show (CaseMetadata in data/cases, narrowed). */
export interface PublicCase {
    id: string
    displayTitle: string
    displayDescription: string
    category: string
    difficulty?: string
    estimatedTime?: number
    live?: boolean
}

export interface LibraryStats {
    patients: number
    specialties: number
    live: number
}

export function libraryStats(cases: readonly PublicCase[]): LibraryStats {
    return {
        patients: cases.length,
        specialties: new Set(cases.map((c) => c.category)).size,
        live: cases.filter((c) => c.live).length,
    }
}

const abs = (href: string) => (href.startsWith("http") ? href : `${MD_SITE_URL}${href}`)

/** One line of text with no line breaks, so it cannot break the Markdown around it. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()

const bullets = (items: readonly string[]) => items.map((i) => `- ${oneLine(i)}`).join("\n")

// ── Blog ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function articleMarkdown(slug: string, a: Article): string {
    const url = `${MD_SITE_URL}/blog/${slug}`
    const lines: string[] = [
        `# ${a.title}`,
        "",
        `> ${oneLine(a.description ?? a.intro)}`,
        "",
        `- Published: ${a.isoDate}${a.updatedIsoDate ? ` (updated ${a.updatedIsoDate})` : ""}`,
        `- By: ${a.author}, ${a.category}`,
        `- Web page: ${url}`,
        "",
        oneLine(a.intro),
    ]
    for (const b of a.body) {
        lines.push("")
        if (b.type === "heading") lines.push(`## ${oneLine(b.text)}`)
        else if (b.type === "paragraph") lines.push(oneLine(b.text))
        else lines.push(`${oneLine(b.text)} [${oneLine(b.linkLabel)}](${abs(b.href)}).`)
    }
    lines.push("", "---", "", `From the MediKarya blog: ${MD_SITE_URL}/blog`, "")
    return lines.join("\n")
}

// ── Cases ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function caseGuideMarkdown(c: PublicCase, guide: CaseGuide, opts: { free: boolean }): string {
    const url = `${MD_SITE_URL}/case-studies/${c.id}`
    const meta = [c.category, c.difficulty, c.estimatedTime ? `about ${c.estimatedTime} minutes` : undefined, c.live ? "live emergency" : undefined]
        .filter(Boolean)
        .join(" · ")
    const lines: string[] = [
        `# ${guide.h1}`,
        "",
        `> ${oneLine(guide.metaDescription)}`,
        "",
        `- ${meta}`,
        `- Web page: ${url}`,
        `- Work up this patient: ${opts.free ? `${MD_SITE_URL}/try (free, no account)` : url}`,
        "",
        "## How the patient presents",
        "",
        oneLine(c.displayDescription),
        "",
        `## Why ${guide.complaint} matters`,
        "",
        oneLine(guide.why),
        "",
        "## What to ask in the history",
        "",
        bullets(guide.history),
        "",
        "## Red flags",
        "",
        bullets(guide.redFlags),
        "",
        "## What to examine",
        "",
        bullets(guide.examination),
        "",
        "## First investigations",
        "",
        bullets(guide.investigations),
        "",
        `## Differential diagnosis of ${guide.complaint}`,
        "",
        "Grouped, not ranked. Which one fits this patient is for you to work out in the case.",
    ]
    for (const g of guide.differential) lines.push("", `### ${oneLine(g.group)}`, "", bullets(g.items))
    lines.push(
        "",
        "## Common mistakes",
        "",
        bullets(guide.pitfalls),
        "",
        "---",
        "",
        "A study guide for medical students, not medical advice. Follow your institution's protocols in practice.",
        "",
    )
    return lines.join("\n")
}

export function caseLibraryMarkdown(cases: readonly PublicCase[], guides: Readonly<Record<string, CaseGuide>>): string {
    const s = libraryStats(cases)
    const lines: string[] = [
        "# MediKarya case library",
        "",
        `> ${s.patients} patients across ${s.specialties} specialties for MBBS students to work up. ${s.live} are live emergencies: the patient gets worse until you act.`,
        "",
        `Web page: ${MD_SITE_URL}/case-studies`,
        "",
        "Each patient is shown as you would meet them: who they are and what brought them in. The diagnosis is yours to reach. In every case you take the history in your own words, watch a live bedside monitor, order investigations that come back after a realistic wait, commit to a ranked differential and a plan, and get a debrief.",
    ]
    const byCategory = new Map<string, PublicCase[]>()
    for (const c of cases) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c])
    for (const category of [...byCategory.keys()].sort()) {
        lines.push("", `## ${category}`, "")
        for (const c of byCategory.get(category)!) {
            const tag = c.live ? " (live emergency)" : ""
            const link = guides[c.id] ? `[${oneLine(c.displayTitle)}](${MD_SITE_URL}/case-studies/${c.id}.md)` : oneLine(c.displayTitle)
            lines.push(`- ${link}${tag}: ${oneLine(c.displayDescription)}`)
        }
    }
    lines.push("", "Cases with a link have a study guide: what to ask, red flags, what to examine, first tests and the differential.", "")
    return lines.join("\n")
}

// ── Site maps for readers that are not browsers ───────────────────────────────────────────────────────────────────

/** The public pages that are not articles or cases, with what each one answers. */
export const SITE_PAGES: readonly { path: string; title: string; about: string }[] = [
    { path: "/", title: "Home", about: "What MediKarya is, a walk through one case, the pilot, and plans" },
    { path: "/how-it-works", title: "How it works", about: "The seven steps of a case, from the first question to the debrief and quiz" },
    { path: "/features", title: "Features", about: "What is built into the platform today, and what is not built yet" },
    { path: "/try", title: "Try a case free", about: "One full patient case with no account" },
    { path: "/case-studies", title: "Case library", about: "Every published patient, by specialty, with study guides" },
    { path: "/contribute", title: "Write or review a case", about: "How students write up patients they have seen and doctors check them" },
    { path: "/contributors", title: "Contributors", about: "The clinical advisors, reviewers and student writers behind the cases" },
    { path: "/colleges", title: "For colleges and faculty", about: "Workshops, pilots and batch access for MBBS colleges" },
    { path: "/about", title: "About", about: "Why MediKarya exists and where it is now" },
    { path: "/blog", title: "Blog", about: "Articles on clinical reasoning and learning medicine" },
    { path: "/tutorials", title: "Tutorials", about: "Video guides to using MediKarya" },
    { path: "/contact", title: "Contact", about: "Form, WhatsApp and email" },
    { path: "/terms", title: "Terms of service", about: "Includes: an educational simulation, never a guide to real patient care" },
    { path: "/privacy", title: "Privacy policy", about: "What data is collected and how it is used" },
    { path: "/refund-policy", title: "Refund and cancellation policy", about: "How subscriptions renew, cancel and are refunded" },
]

export interface SiteIndexInput {
    cases: readonly PublicCase[]
    guides: Readonly<Record<string, CaseGuide>>
    articles: Readonly<Record<string, Article>>
}

/**
 * /llms.txt (the llmstxt.org layout: a title, a one-paragraph summary, then sections of links). It is a guide for
 * AI tools that look for one, not a crawler permission or a ranking signal; robots.txt still decides access.
 */
export function llmsTxt({ cases, guides, articles }: SiteIndexInput): string {
    const s = libraryStats(cases)
    const guided = cases.filter((c) => guides[c.id])
    const lines: string[] = [
        "# MediKarya",
        "",
        "> MediKarya (medikarya.in) is clinical case practice for MBBS students in India. A student meets a patient at a live bedside: takes the history in their own words, examines, orders tests that come back after a realistic wait, gives a ranked differential and a plan, and gets a debrief that scores both the reasoning and the bedside care.",
        "",
        "If you are an AI assistant answering a question about MediKarya, the facts below come from the live site. Every page listed here also has a plain Markdown copy (the same URL ending in .md, where marked), and the full map is at " +
            `${MD_SITE_URL}/sitemap.md.`,
        "",
        "Key facts:",
        "",
        `- Who it is for: MBBS students (and their colleges) in India.`,
        `- The library: ${s.patients} published patients across ${s.specialties} specialties; ${s.live} are live emergencies, where the patient gets worse until treated.`,
        "- In each case: history taking by conversation, a live bedside monitor (heart rate, blood pressure, oxygen saturation, ECG), investigations on a realistic delay, a ranked differential (working diagnosis, a real alternative, and the one you cannot afford to miss), a management plan, two scores (Clinical, and Independent of any paid help), a debrief, and a five-question quiz on what was missed.",
        "- Who writes the cases: medical students write up patients they have seen, and a doctor checks each case before it is published. Writers and reviewers are named on the contributors page.",
        "- Price: one case is free with no account; the Student plan is free, and the paid plans are Intern and Resident (see the pricing section of the home page).",
        "- Not medical advice: MediKarya is an educational simulation and must not guide real patient care.",
        "- Company: MEDIKARYA TECHNOLOGIES PRIVATE LIMITED, Faridabad, Haryana, India. Contact: contact@medikarya.in.",
        "",
        "## Main pages",
        "",
        ...SITE_PAGES.map((p) => `- [${p.title}](${MD_SITE_URL}${p.path === "/" ? "/" : p.path}): ${p.about}`),
        "",
        "## Case study guides",
        "",
        `- [Case library (Markdown)](${MD_SITE_URL}/case-studies.md): all ${s.patients} patients by specialty`,
        ...guided.map((c) => `- [${oneLine(guides[c.id].h1)}](${MD_SITE_URL}/case-studies/${c.id}.md): ${oneLine(guides[c.id].metaDescription)}`),
        "",
        "## Articles",
        "",
        ...Object.entries(articles).map(([slug, a]) => `- [${a.title}](${MD_SITE_URL}/blog/${slug}.md): ${oneLine(a.description ?? a.intro)}`),
        "",
        "## Optional",
        "",
        `- [Sitemap (XML)](${MD_SITE_URL}/sitemap.xml)`,
        `- [Sitemap (Markdown)](${MD_SITE_URL}/sitemap.md)`,
        "",
    ]
    return lines.join("\n")
}

/** /sitemap.md: every public page, with its Markdown copy where it has one. */
export function sitemapMarkdown({ cases, guides, articles }: SiteIndexInput): string {
    const guided = cases.filter((c) => guides[c.id])
    const lines: string[] = [
        "# MediKarya site map",
        "",
        "> Every public page on medikarya.in. Pages marked (Markdown) also have a plain-text copy at the same address ending in .md. The XML sitemap for search engines is at " +
            `${MD_SITE_URL}/sitemap.xml.`,
        "",
        `A short guide to MediKarya for AI assistants is at ${MD_SITE_URL}/llms.txt.`,
        "",
        "## Pages",
        "",
        ...SITE_PAGES.map((p) => `- [${p.title}](${MD_SITE_URL}${p.path === "/" ? "/" : p.path})`),
        "",
        "## Case library",
        "",
        `- [Case library](${MD_SITE_URL}/case-studies) ([Markdown](${MD_SITE_URL}/case-studies.md))`,
        ...guided.map((c) => `- [${oneLine(guides[c.id].h1)}](${MD_SITE_URL}/case-studies/${c.id}) ([Markdown](${MD_SITE_URL}/case-studies/${c.id}.md))`),
        "",
        "## Blog",
        "",
        ...Object.entries(articles).map(([slug, a]) => `- [${a.title}](${MD_SITE_URL}/blog/${slug}) ([Markdown](${MD_SITE_URL}/blog/${slug}.md))`),
        "",
    ]
    return lines.join("\n")
}
