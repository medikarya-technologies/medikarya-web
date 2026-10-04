import type { Metadata } from "next"
import ApiDocsClient from "./ApiDocsClient"

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/api-docs" },
    title: "For Colleges and Faculty",
    description: "Run a MediKarya workshop or pilot with your MBBS students, give a whole batch access for a term, or have your faculty write and review cases.",
    robots: { index: true, follow: true },
    openGraph: {
        title: "MediKarya for Colleges and Faculty",
        description: "Workshops, pilots and batch access to MediKarya's patient cases for MBBS students, first piloted at Maulana Azad Medical College.",
    },
}

export default function ApiDocsPage() {
    return <ApiDocsClient />
}
