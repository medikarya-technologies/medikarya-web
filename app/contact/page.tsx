import type { Metadata } from "next"
import ContactClient from "./ContactClient"

export const metadata: Metadata = {
    title: "Contact & Partner | MediKarya",
    description: "Get in touch with MediKarya to explore institutional partnerships, curriculum integration, or API access for AI-powered medical education.",
    robots: { index: true, follow: true },
    openGraph: {
        title: "Partner with MediKarya",
        description: "Explore institutional partnerships and API access for AI-powered medical education.",
    },
}

export default function ContactPage() {
    return <ContactClient />
}
