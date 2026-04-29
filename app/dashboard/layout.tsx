import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

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

    // Safety net: ensure a user_profiles row always exists.
    // This is a no-op if the Clerk webhook already created it (onConflict + ignore).
    // It only does real work when the webhook missed the user.
    try {
        // Parallelize currentUser fetch with the auth() we already did
        const user = await currentUser()
        const email = user?.emailAddresses?.[0]?.emailAddress ?? null
        const fullName =
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null

        // Fire-and-forget the upsert — don't block rendering
        supabaseServer
            .from("user_profiles")
            .upsert(
                {
                    clerk_user_id: userId,
                    full_name: fullName,
                    email: email,
                    role: "student",
                    current_streak: 0,
                    longest_streak: 0,
                },
                { onConflict: "clerk_user_id", ignoreDuplicates: true }
            )
            .then(() => {}) // intentionally fire-and-forget
            .catch((err: unknown) => {
                console.error("[DashboardLayout] Failed to sync user_profile:", err)
            })
    } catch (err) {
        // Non-fatal — log and continue so the user still reaches the dashboard
        console.error("[DashboardLayout] currentUser() failed:", err)
    }

    return <>{children}</>
}
