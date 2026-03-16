import type { Metadata } from "next"
import TermsClient from "./TermsClient"

export const metadata: Metadata = {
    title: "Terms of Service | MediKarya",
    description: "Read MediKarya's terms of service. Our platform is strictly an educational simulation tool and must not be used to guide real patient care.",
    robots: { index: true, follow: true },
}

export default function TermsPage() {
    return <TermsClient />
}
