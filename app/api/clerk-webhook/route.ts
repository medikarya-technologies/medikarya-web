import { Webhook } from "svix"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

// Add this route to the public whitelist in middleware.ts → isPublicRoute
// Pattern: "/api/clerk-webhook(.*)"

export async function POST(req: Request) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

    if (!webhookSecret) {
        console.error("CLERK_WEBHOOK_SECRET is not set")
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    // Grab the Svix headers Clerk sends for verification
    const headerPayload = await headers()
    const svix_id = headerPayload.get("svix-id")
    const svix_timestamp = headerPayload.get("svix-timestamp")
    const svix_signature = headerPayload.get("svix-signature")

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
    }

    const payload = await req.text()

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret)
    let evt: any
    try {
        evt = wh.verify(payload, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        })
    } catch (err) {
        console.error("Webhook verification failed:", err)
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const { type, data } = evt

    if (type === "user.created" || type === "user.updated") {
        const clerkUserId: string = data.id
        const firstName: string = data.first_name || ""
        const lastName: string = data.last_name || ""
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || null
        const email: string | null =
            data.email_addresses?.[0]?.email_address || null

        if (type === "user.created") {
            // Eagerly create the profile row so the user appears in admin from day 1
            const { error } = await supabaseServer
                .from("user_profiles")
                .insert({
                    clerk_user_id: clerkUserId,
                    full_name: fullName,
                    email: email,
                    role: "student",
                    current_streak: 0,
                    longest_streak: 0,
                })
                // If somehow a row already exists (e.g. from evaluate.ts fallback), do nothing
                .onConflict("clerk_user_id")
                .ignore()

            if (error) {
                console.error("Failed to create user profile on signup:", error)
                return NextResponse.json({ error: "DB insert failed" }, { status: 500 })
            }

            console.log("Created user_profile for:", clerkUserId, email)
        }

        if (type === "user.updated") {
            // Keep name and email in sync if the user updates their Clerk profile
            const { error } = await supabaseServer
                .from("user_profiles")
                .update({
                    full_name: fullName,
                    email: email,
                    updated_at: new Date().toISOString(),
                })
                .eq("clerk_user_id", clerkUserId)

            if (error) {
                console.error("Failed to update user profile on user.updated:", error)
            }

            console.log("Updated user_profile for:", clerkUserId)
        }
    }

    return NextResponse.json({ received: true })
}
