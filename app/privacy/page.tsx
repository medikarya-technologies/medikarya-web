import type { Metadata } from "next"
import PrivacyClient from "./PrivacyClient"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
    path: "/privacy",
    title: "Privacy Policy",
    description: "How MediKarya collects, uses and protects your personal data.",
})

export default function PrivacyPage() {
    return <PrivacyClient />
}
