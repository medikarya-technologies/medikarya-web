import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

// Always re-run server-side — never serve from Next.js router cache.
// Without this, client-side navigations (e.g. post-Clerk sign-in) can hit a
// cached layout, skipping the auth check.
export const dynamic = "force-dynamic"

export default async function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { userId } = await auth()

    if (!userId) {
        redirect("/login")
    }

    return <>{children}</>
}
