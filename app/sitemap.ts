import { MetadataRoute } from 'next'
import { getCases } from '@/data/cases'
import { CASE_GUIDES } from '@/lib/seo/case-guides'

const blogPosts: { slug: string; lastModified: string }[] = [
    { slug: 'ai-revolutionizing-medical-education',    lastModified: '2026-10-04' },
    { slug: 'feynman-technique-clinical-reasoning',    lastModified: '2026-04-20' },
    { slug: 'sepsis-case-based-approach',              lastModified: '2026-04-18' },
    { slug: 'why-medical-students-need-simulation',    lastModified: '2026-04-16' },
    { slug: 'breaking-down-diagnostic-process',        lastModified: '2026-04-14' },
    { slug: 'future-ai-assisted-diagnosis',            lastModified: '2026-10-06' },
]

const staticRoutes: { path: string; lastModified: string; priority: number }[] = [
    { path: '',              lastModified: '2026-04-20', priority: 1.0 },
    { path: '/about',        lastModified: '2026-10-04', priority: 0.8 },
    { path: '/features',     lastModified: '2026-10-04', priority: 0.9 },
    { path: '/how-it-works', lastModified: '2026-10-04', priority: 0.9 },
    { path: '/try',          lastModified: '2026-10-04', priority: 0.8 },
    { path: '/blog',         lastModified: '2026-10-04', priority: 0.9 },
    { path: '/contact',      lastModified: '2026-10-04', priority: 0.6 },
    { path: '/privacy',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/terms',        lastModified: '2025-12-01', priority: 0.3 },
    { path: '/refund-policy', lastModified: '2026-09-27', priority: 0.3 },
    { path: '/cookies',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/tutorials',    lastModified: '2026-10-04', priority: 0.8 },
    { path: '/case-studies', lastModified: '2026-10-06', priority: 0.9 },
    { path: '/contribute',   lastModified: '2026-10-04', priority: 0.7 },
    { path: '/contributors', lastModified: '2026-10-04', priority: 0.7 },
    { path: '/api-docs',     lastModified: '2026-10-04', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medikarya.in'

    const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ path, lastModified, priority }) => ({
        url: `${baseUrl}${path}`,
        lastModified: new Date(lastModified),
        changeFrequency: 'weekly' as const,
        priority,
    }))

    const blogEntries: MetadataRoute.Sitemap = blogPosts.map(({ slug, lastModified }) => ({
        url: `${baseUrl}/blog/${slug}`,
        lastModified: new Date(lastModified),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }))

    // One study page per published case that has a guide (a case without one is noindex, so it stays out of here)
    const cases = await getCases().catch(() => [])
    const caseEntries: MetadataRoute.Sitemap = cases
        .filter((c) => CASE_GUIDES[c.id])
        .map((c) => ({
            url: `${baseUrl}/case-studies/${c.id}`,
            lastModified: new Date('2026-10-06'),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        }))

    return [...staticEntries, ...blogEntries, ...caseEntries]
}

