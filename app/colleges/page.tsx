import type { Metadata } from "next"
import CollegesClient from "./CollegesClient"
import { pageMetadata } from "@/lib/seo/site"

// This page was /api-docs until 2026-10-31; next.config.mjs sends the old address here for good.
export const metadata: Metadata = pageMetadata({
    path: "/colleges",
    title: "For Colleges and Faculty",
    description: "Run a MediKarya workshop or pilot with your MBBS students, give a whole batch access for a term, or have your faculty write and review cases.",
    socialTitle: "MediKarya for Colleges and Faculty",
    socialDescription: "Workshops, pilots and batch access to MediKarya's patient cases for MBBS students, first piloted at Maulana Azad Medical College.",
})

export default function CollegesPage() {
    return <CollegesClient />
}
