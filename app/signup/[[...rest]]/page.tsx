import type { Metadata } from "next"
import SignUpClient from "./SignUpClient"

export const metadata: Metadata = {
    title: "Sign Up",
    description: "Create a MediKarya account and start practising clinical cases.",
    robots: {
        index: false,
        follow: false,
    },
}

export default function SignUpPage() {
    return <SignUpClient />
}
