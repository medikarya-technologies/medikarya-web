import type { Metadata } from "next"
import ApiDocsClient from "./ApiDocsClient"

export const metadata: Metadata = {
    title: "API & Institutional Access | MediKarya",
    description: "Integrate MediKarya's AI patient simulation engine, case library, and analytics into your medical school or hospital training programme.",
    robots: { index: true, follow: true },
    openGraph: {
        title: "MediKarya for Institutions — AI Simulation API",
        description: "Integrate our AI patient simulation engine, case library, and performance analytics into your medical school or training programme.",
    },
}

export default function ApiDocsPage() {
    return <ApiDocsClient />
}
