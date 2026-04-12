import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'MediKarya',
        short_name: 'MediKarya',
        description: 'AI-Powered Medical Education Platform',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            {
                src: '/medikarya.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
            {
                src: '/medikarya.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/medikarya.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/medikarya.png',
                sizes: '180x180',
                type: 'image/png'
            }
        ],
    }
}
