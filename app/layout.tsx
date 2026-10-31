import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"
import { LayoutClient } from "@/components/LayoutClient"
import { Toaster } from "@/components/ui/toaster"
import { ThemeController } from "@/components/theme-controller"
import { themeInitScript } from "@/lib/theme"
import { CookieConsent } from "@/components/privacy/cookie-consent"
import { organizationJsonLd, websiteJsonLd, OG_IMAGE } from "@/lib/seo/site"

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.medikarya.in"),
  // No site-wide canonical here: every page would inherit it and tell Google it is a copy of the home page. Each
  // public page sets its own (alternates.canonical in its metadata).
  title: {
    default: "MediKarya: Clinical Case Practice for MBBS Students",
    template: "%s | MediKarya"
  },
  description: "Practise on patients before your first real one: take the history, examine, order tests, rank a differential and get a debrief on your reasoning and your bedside care. Built for MBBS students in India.",
  applicationName: "MediKarya",
  authors: [{ name: "MediKarya", url: "https://www.medikarya.in/about" }],
  creator: "MediKarya",
  publisher: "MediKarya",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.medikarya.in/",
    title: "MediKarya: Clinical Case Practice for MBBS Students",
    description: "Take the history from a live patient, order tests, rank your differential, then see where your reasoning broke and practise what you missed.",
    siteName: "MediKarya",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "MediKarya: clinical case practice for MBBS students" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Medikaryain",
    title: "MediKarya: Clinical Case Practice for MBBS Students",
    description: "Take the history from a live patient, rank your differential and see where your reasoning broke, before your first real patient.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // app/favicon.ico is added by Next on its own. Listing icons here replaces app/icon.svg's automatic tag, so it is
  // named again; the PNG is for search results and home screens that want a bitmap of at least 48px.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/medikarya.png",
  },
  generator: 'Next.js'
}

export const viewport = {
  themeColor: "#0f172a",
  minimumScale: 1,
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en-IN" className="scroll-smooth" suppressHydrationWarning>
        <head>
          {/* Puts the dark theme on before the first paint, for someone who chose it (lib/theme.ts) */}
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          {/* Preconnect hints — warm up TCP/TLS before JS requests these origins */}
          <link rel="preconnect" href="https://clerk.medikarya.in" />
          <link rel="dns-prefetch" href="https://clerk.medikarya.in" />
        </head>
        <body
          className={cn(geistSans.variable, geistMono.variable, geistSans.className)}
          suppressHydrationWarning={true}
        >
          <ThemeController />
          {/* Organization + WebSite JSON-LD. A plain script, so it is in the HTML the server sends: next/script put it
              in only after hydration, which crawlers that do not run JavaScript never saw. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]) }}
          />
          {/* Script to clean up browser extension attributes */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Clean up attributes added by browser extensions
                  function cleanupAttributes() {
                    const body = document.body;
                    const html = document.documentElement;

                    // Remove common extension attributes
                    const extensionAttrs = [
                      'cz-shortcut-listen',
                      'data-cursor',
                      'data-codeium',
                      'data-tabnine'
                    ];

                    extensionAttrs.forEach(attr => {
                      body.removeAttribute(attr);
                      html.removeAttribute(attr);
                    });
                  }

                  // Clean up immediately
                  cleanupAttributes();

                  // Clean up after DOM is ready
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', cleanupAttributes);
                  } else {
                    cleanupAttributes();
                  }

                  // Clean up after React hydration
                  document.addEventListener('DOMContentLoaded', function() {
                    setTimeout(cleanupAttributes, 100);
                  });
                })();
              `
            }}
          />
          <LayoutClient>
            {children}
          </LayoutClient>
          <CookieConsent />
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
