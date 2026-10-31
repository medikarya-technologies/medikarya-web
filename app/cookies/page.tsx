import type { Metadata } from "next"
import CookiesClient from "./CookiesClient"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
    path: "/cookies",
    title: "Cookie Policy",
    description: "How MediKarya uses cookies and similar technologies.",
})

export default function CookiesPage() {
    return <CookiesClient />
}
