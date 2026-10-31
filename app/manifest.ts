import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'MediKarya',
        short_name: 'MediKarya',
        description: 'Clinical case practice for MBBS students',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        // Each size is a real file of that size: one 500px PNG listed as 192, 512 and 180 made browsers scale it themselves.
        icons: [
            { src: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
    }
}
