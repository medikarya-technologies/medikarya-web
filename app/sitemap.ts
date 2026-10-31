import { MetadataRoute } from 'next'
import { getCases } from '@/data/cases'
import { ARTICLES, articleLastModified } from '@/lib/blog/articles'
import { CASE_GUIDES } from '@/lib/seo/case-guides'

// lastModified is the day a page's content last really changed (Google uses it only while it stays accurate), so
// bump a date here when a page's words change, not for a restyle. The blog's dates come from the articles themselves.
const staticRoutes: { path: string; lastModified: string; priority: number }[] = [
    { path: '',              lastModified: '2026-10-31', priority: 1.0 },
    { path: '/about',        lastModified: '2026-10-31', priority: 0.8 },
    { path: '/features',     lastModified: '2026-10-31', priority: 0.9 },
    { path: '/how-it-works', lastModified: '2026-10-31', priority: 0.9 },
    { path: '/try',          lastModified: '2026-10-29', priority: 0.8 },
    { path: '/blog',         lastModified: '2026-10-09', priority: 0.9 },
    { path: '/contact',      lastModified: '2026-10-29', priority: 0.6 },
    { path: '/privacy',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/terms',        lastModified: '2025-12-01', priority: 0.3 },
    { path: '/refund-policy', lastModified: '2026-09-27', priority: 0.3 },
    { path: '/cookies',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/tutorials',    lastModified: '2026-10-31', priority: 0.8 },
    { path: '/case-studies', lastModified: '2026-10-31', priority: 0.9 },
    { path: '/contribute',   lastModified: '2026-10-31', priority: 0.7 },
    { path: '/contributors', lastModified: '2026-10-31', priority: 0.7 },
    { path: '/colleges',     lastModified: '2026-10-31', priority: 0.7 },
]

/** The day the case study guides (lib/seo/case-guides.ts) last changed. */
const CASE_GUIDES_UPDATED = '2026-10-09'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medikarya.in'

    const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ path, lastModified, priority }) => ({
        url: `${baseUrl}${path}`,
        lastModified: new Date(lastModified),
        changeFrequency: 'weekly' as const,
        priority,
    }))

    const blogEntries: MetadataRoute.Sitemap = Object.entries(ARTICLES).map(([slug, article]) => ({
        url: `${baseUrl}/blog/${slug}`,
        lastModified: new Date(articleLastModified(article)),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }))

    // One study page per published case that has a guide (a case without one is noindex, so it stays out of here)
    const cases = await getCases().catch(() => [])
    const caseEntries: MetadataRoute.Sitemap = cases
        .filter((c) => CASE_GUIDES[c.id])
        .map((c) => ({
            url: `${baseUrl}/case-studies/${c.id}`,
            lastModified: new Date(CASE_GUIDES_UPDATED),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        }))

    return [...staticEntries, ...blogEntries, ...caseEntries]
}
