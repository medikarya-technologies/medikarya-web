import type { Metadata } from "next"
import ContributeForm from "./ContributeForm"

export const metadata: Metadata = {
    title: "Contribute",
    description: "Join MediKarya as a case contributor. Craft clinical scenarios, share your expertise, and help train the next generation of doctors.",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "Become a Case Contributor | MediKarya",
        description: "Craft clinical scenarios, share your expertise, and help train the next generation of doctors.",
        url: "/contribute",
    },
}

export default function ContributePage() {
    return <ContributeForm />
}
