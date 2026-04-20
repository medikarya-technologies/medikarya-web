import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/dashboard', '/api', '/login', '/signup', '/admin'],
        },
        sitemap: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml` : 'https://www.medikarya.in/sitemap.xml',
    }
}
