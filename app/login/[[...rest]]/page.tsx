import type { Metadata } from "next"
import LoginClient from "./LoginClient"

export const metadata: Metadata = {
    title: "Sign In",
    description: "Sign in to MediKarya to continue your AI-powered medical education journey.",
    robots: {
        index: false,
        follow: false,
    },
}

export default function LoginPage() {
    return <LoginClient />
}
