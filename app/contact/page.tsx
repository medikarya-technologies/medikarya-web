import type { Metadata } from "next"
import ContactClient, { type ContactTopic } from "./ContactClient"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
    path: "/contact",
    title: "Contact",
    description: "Join MediKarya's Clinical Advisory Board, bring MediKarya to your college, or ask us anything. By form, WhatsApp or email.",
    socialTitle: "Contact MediKarya",
    socialDescription: "Join the Clinical Advisory Board, run a workshop with your students, or ask us anything.",
})

const TOPICS: ContactTopic[] = ["advisor", "college", "other"]

/** /contact?topic=advisor (or college) opens on that form. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
    const { topic } = await searchParams
    return <ContactClient initialTopic={TOPICS.includes(topic as ContactTopic) ? (topic as ContactTopic) : "other"} />
}
