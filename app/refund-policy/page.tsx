import type { Metadata } from "next"
import RefundPolicyClient from "./RefundPolicyClient"

export const metadata: Metadata = {
    title: "Refund & Cancellation Policy",
    description: "How MediKarya subscriptions renew, how to cancel, and when payments are refunded.",
    robots: { index: true, follow: true },
}

export default function RefundPolicyPage() {
    return <RefundPolicyClient />
}
