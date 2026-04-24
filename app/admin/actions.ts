"use server"

import { auth } from "@clerk/nextjs/server"
import { supabaseServer } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Check admin role from Supabase — no hardcoded env var needed
export async function isAdminUser(userId: string | null): Promise<boolean> {
    if (!userId) return false
    const { data } = await supabaseServer
        .from("user_profiles")
        .select("role")
        .eq("clerk_user_id", userId)
        .single()
    return data?.role === "admin"
}

export async function setUserRole(clerkUserId: string, newRole: "student" | "admin") {
    const { userId } = await auth()
    if (!(await isAdminUser(userId))) throw new Error("Unauthorized")

    // Prevent admins from demoting themselves — would cause instant lockout
    if (clerkUserId === userId && newRole === "student") {
        throw new Error("You cannot remove your own admin role")
    }

    const { error } = await supabaseServer
        .from("user_profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("clerk_user_id", clerkUserId)

    if (error) throw new Error(error.message)

    revalidatePath("/admin")
}
