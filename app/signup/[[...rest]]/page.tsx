import type { Metadata } from "next"
import SignUpClient from "./SignUpClient"

export const metadata: Metadata = {
    title: "Sign Up",
    description: "Create your MediKarya account and start your AI-powered medical education journey.",
    robots: {
        index: false,
        follow: false,
    },
}

export default function SignUpPage() {
    return <SignUpClient />
}
