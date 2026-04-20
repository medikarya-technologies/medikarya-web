import { MetadataRoute } from 'next'

const blogPosts: { slug: string; lastModified: string }[] = [
    { slug: 'ai-revolutionizing-medical-education',    lastModified: '2025-03-10' },
    { slug: 'feynman-technique-clinical-reasoning',    lastModified: '2025-03-10' },
    { slug: 'sepsis-case-based-approach',              lastModified: '2025-03-10' },
    { slug: 'why-medical-students-need-simulation',    lastModified: '2025-03-10' },
    { slug: 'breaking-down-diagnostic-process',        lastModified: '2025-03-10' },
    { slug: 'future-ai-assisted-diagnosis',            lastModified: '2025-03-10' },
]

const staticRoutes: { path: string; lastModified: string; priority: number }[] = [
    { path: '',              lastModified: '2026-04-20', priority: 1.0 },
    { path: '/about',        lastModified: '2026-04-20', priority: 0.8 },
    { path: '/blog',         lastModified: '2026-04-20', priority: 0.9 },
    { path: '/contact',      lastModified: '2025-12-01', priority: 0.6 },
    { path: '/privacy',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/terms',        lastModified: '2025-12-01', priority: 0.3 },
    { path: '/cookies',      lastModified: '2025-12-01', priority: 0.3 },
    { path: '/tutorials',    lastModified: '2026-04-20', priority: 0.8 },
    { path: '/case-studies', lastModified: '2026-04-20', priority: 0.8 },
    { path: '/contribute',   lastModified: '2026-01-01', priority: 0.7 },
    { path: '/api-docs',     lastModified: '2026-01-01', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
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
        priority: 0.7,
    }))

    return [...staticEntries, ...blogEntries]
}

