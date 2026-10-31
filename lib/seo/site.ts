import type { Metadata } from "next"

// What every public page tells search engines and link previews about itself, in one place. A page that sets its own
// openGraph replaces the layout's whole openGraph object (Next merges metadata one key deep), so before this each
// page that set a title lost og:url, og:site_name and og:locale, and the ones without a twitter block showed the home
// page's title on X and WhatsApp previews. pageMetadata() fills them all in from the page's path.

export const SITE_URL = "https://www.medikarya.in"
export const SITE_NAME = "MediKarya"
export const OG_IMAGE = `${SITE_URL}/og-image.png`

/** The profiles linked from the footer: the same organisation, so search engines can join them up. */
export const SOCIAL_PROFILES = [
    "https://www.linkedin.com/company/medikarya",
    "https://x.com/Medikaryain",
    "https://www.instagram.com/medikarya.in/",
    "https://www.youtube.com/channel/UCyH4fMcICK2ghsKZqM6wOBg",
]

type PageMetaInput = {
    /** "/about"; "" or "/" for the home page. */
    path: string
    /** Goes through the layout's "%s | MediKarya" template unless absoluteTitle is set. */
    title: string
    /** Use the title as written, for titles that already name MediKarya ("About MediKarya | MediKarya" reads badly). */
    absoluteTitle?: boolean
    description: string
    /** Link previews can say it differently from the search result; both default to the title and description. */
    socialTitle?: string
    socialDescription?: string
    imageAlt?: string
    type?: "website" | "article"
    noindex?: boolean
}

export function absoluteUrl(path: string): string {
    if (!path || path === "/") return `${SITE_URL}/`
    return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export function pageMetadata(p: PageMetaInput): Metadata {
    const url = absoluteUrl(p.path)
    const socialTitle = p.socialTitle ?? (p.absoluteTitle ? p.title : `${p.title} | ${SITE_NAME}`)
    const socialDescription = p.socialDescription ?? p.description
    const image = { url: OG_IMAGE, width: 1200, height: 630, alt: p.imageAlt ?? socialTitle }
    return {
        title: p.absoluteTitle ? { absolute: p.title } : p.title,
        description: p.description,
        alternates: { canonical: url },
        robots: p.noindex ? { index: false, follow: true } : { index: true, follow: true },
        openGraph: {
            type: p.type ?? "website",
            locale: "en_IN",
            siteName: SITE_NAME,
            url,
            title: socialTitle,
            description: socialDescription,
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            site: "@Medikaryain",
            title: socialTitle,
            description: socialDescription,
            images: [OG_IMAGE],
        },
    }
}

/**
 * The organisation behind the site, as the footer states it. Only facts printed on every page go in here, so the
 * markup never says more than a visitor can read.
 */
export function organizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        legalName: "MEDIKARYA TECHNOLOGIES PRIVATE LIMITED",
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
        image: OG_IMAGE,
        description:
            "Clinical case practice for MBBS students in India: take a history from a patient, examine, order tests, rank a differential and get a debrief on your reasoning and bedside care.",
        email: "contact@medikarya.in",
        address: {
            "@type": "PostalAddress",
            streetAddress: "V-214, Second Floor, Gandhi Colony",
            addressLocality: "Faridabad",
            addressRegion: "Haryana",
            postalCode: "121001",
            addressCountry: "IN",
        },
        contactPoint: [
            { "@type": "ContactPoint", contactType: "customer support", email: "contact@medikarya.in", telephone: "+91-87965-02901", areaServed: "IN", availableLanguage: ["en"] },
        ],
        areaServed: "IN",
        knowsAbout: ["Clinical reasoning", "Medical education", "MBBS", "History taking", "Differential diagnosis", "Case-based learning"],
        sameAs: SOCIAL_PROFILES,
    }
}

export function websiteJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: "en-IN",
        publisher: { "@id": `${SITE_URL}/#organization` },
    }
}
