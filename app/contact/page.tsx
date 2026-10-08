import type { Metadata } from "next"
import ContactClient, { type ContactTopic } from "./ContactClient"

export const metadata: Metadata = {
    alternates: { canonical: "https://www.medikarya.in/contact" },
    title: "Contact",
    description: "Join MediKarya's Clinical Advisory Board, bring MediKarya to your college, or ask us anything. By form, WhatsApp or email.",
    robots: { index: true, follow: true },
    openGraph: {
        title: "Contact MediKarya",
        description: "Join the Clinical Advisory Board, run a workshop with your students, or ask us anything.",
    },
}

const TOPICS: ContactTopic[] = ["advisor", "college", "other"]

/** /contact?topic=advisor (or college) opens on that form. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
    const { topic } = await searchParams
    return <ContactClient initialTopic={TOPICS.includes(topic as ContactTopic) ? (topic as ContactTopic) : "other"} />
}
