import type { Metadata } from "next"
import TermsClient from "./TermsClient"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
    path: "/terms",
    title: "Terms of Service",
    description: "MediKarya's terms of service. The platform is an educational simulation and must not be used to guide real patient care.",
})

export default function TermsPage() {
    return <TermsClient />
}
