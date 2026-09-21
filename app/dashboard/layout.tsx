import { after } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

// Always re-run server-side — never serve from Next.js router cache.
// Without this, client-side navigations (e.g. post-Clerk sign-in) can hit a
// cached layout, skipping the auth check.
export const dynamic = "force-dynamic"

/**
 * Safety net: make sure a user_profiles row exists for the signed-in user. The Clerk webhook normally
 * creates it, so the row is looked for first (a ~60 ms query) and Clerk's API (a ~300 ms call, ~1 s cold)
 * is only asked when it is missing. It runs after the response has been sent, so no dashboard page ever
 * waits for it; this used to be awaited before every dashboard page could start to render.
 */
async function ensureProfile(userId: string) {
    try {
        const { data: existing } = await supabaseServer.from("user_profiles").select("clerk_user_id").eq("clerk_user_id", userId).maybeSingle()
        if (existing) return

        const client = await clerkClient()
        const user = await client.users.getUser(userId)
        const email = user.emailAddresses?.[0]?.emailAddress ?? null
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null

        // No-op if the webhook got there first (onConflict + ignore).
        await supabaseServer.from("user_profiles").upsert(
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
    } catch (err) {
        // Non-fatal: the student is already on the dashboard.
        console.error("[DashboardLayout] Failed to sync user_profile:", err)
    }
}

export default async function DashboardRootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { userId } = await auth()

    if (!userId) {
        redirect("/login")
    }

    after(() => ensureProfile(userId))

    return <>{children}</>
}
