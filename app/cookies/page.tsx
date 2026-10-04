import type { Metadata } from "next"
import CookiesClient from "./CookiesClient"

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/cookies" },
    title: "Cookie Policy",
    description: "Read MediKarya's cookie policy to understand how we use cookies and similar technologies on our platform.",
    robots: { index: true, follow: true },
}

export default function CookiesPage() {
    return <CookiesClient />
}
