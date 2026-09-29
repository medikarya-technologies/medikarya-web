"use server"

// Turns "View as student" on or off for an admin (lib/plans/view-as.ts). Anyone else is refused.

import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { isAdmin } from "@/lib/plans/access"
import { VIEW_AS_COOKIE } from "@/lib/plans/view-as"
import type { Plan } from "@/lib/plans/limits"

export async function setViewAs(plan: Plan | null): Promise<{ ok: boolean }> {
  const { userId } = await auth()
  if (!userId || !(await isAdmin(userId))) return { ok: false }
  const jar = await cookies()
  if (plan === null) jar.delete(VIEW_AS_COOKIE)
  else if (["student", "intern", "resident"].includes(plan)) {
    // Ends by itself after a working day, so an admin is never left limited by a switch they forgot.
    jar.set(VIEW_AS_COOKIE, plan, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 })
  }
  return { ok: true }
}
