import type { Metadata } from "next"
import RefundPolicyClient from "./RefundPolicyClient"
import { pageMetadata } from "@/lib/seo/site"

export const metadata: Metadata = pageMetadata({
    path: "/refund-policy",
    title: "Refund and Cancellation Policy",
    description: "How MediKarya subscriptions renew, how to cancel, and when payments are refunded.",
})

export default function RefundPolicyPage() {
    return <RefundPolicyClient />
}
