import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"
import NextTopLoader from 'nextjs-toploader';
import { SpeedInsights } from "@vercel/speed-insights/next"
import Script from "next/script"
import { LayoutClient } from "@/components/LayoutClient"
import { Toaster } from "@/components/ui/toaster"

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
  alternates: {
    canonical: "/",
  },
  title: {
    default: "MediKarya - AI-Powered Medical Education",
    template: "%s | MediKarya"
  },
  description: "Gain clinical confidence before your first real patient. Simulate consults, order diagnostics, and get instant feedback with our advanced AI medical education platform.",
  keywords: ["Medical Education", "AI Patient Simulation", "Clinical Training", "Medical Students", "Diagnosis Practice"],
  authors: [{ name: "MediKarya Team" }], // Replace with actual author if known
  creator: "MediKarya",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "MediKarya - Gain Clinical Confidence",
    description: "Gain clinical confidence before your first real patient. Simulate consults, order diagnostics, and get instant feedback.",
    siteName: "MediKarya",
    images: [
      {
        url: "https://www.medikarya.in/og-image.png",
        width: 1200,
        height: 630,
        alt: "MediKarya Platform Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediKarya - AI-Powered Medical Education",
    description: "Advance your clinical skills with AI patient simulations.",
    images: ["https://www.medikarya.in/og-image.png"],
    creator: "@medikarya", // Replace with actual handle
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
  icons: {
    icon: "/icon.svg",
    apple: "/medikarya.png",
  },
  generator: 'v0.app'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="scroll-smooth">
        <body
          className={cn(geistSans.variable, geistMono.variable, geistSans.className)}
          suppressHydrationWarning={true}
        >
          <NextTopLoader
            color="#2563EB"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #2563EB,0 0 5px #2563EB"
          />
          <Script id="clarity-script" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "vhuxiqi1u5");
            `}
          </Script>
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
          <SpeedInsights />
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
