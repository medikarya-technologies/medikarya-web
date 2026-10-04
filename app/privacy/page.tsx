import type { Metadata } from "next"
import PrivacyClient from "./PrivacyClient"

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/privacy" },
    title: "Privacy Policy",
    description: "Read MediKarya's privacy policy. Learn how we collect, use, and protect your personal data on our AI-powered medical education platform.",
    robots: { index: true, follow: true },
}

export default function PrivacyPage() {
    return <PrivacyClient />
}
