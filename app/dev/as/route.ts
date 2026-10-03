import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { DEV_CLERK_PREFIX, DEV_USER_COOKIE, testLoginEnabled } from "@/lib/dev/dev-user"

// TEST MODE ONLY: /dev/as?user=dev_admin&next=/admin opens a page as a dummy user in one step (for scripts and
// screenshots); /dev/as?user=none signs out. 404 anywhere but `npm run dev:test`.

export async function GET(request: NextRequest) {
  if (!testLoginEnabled()) return new NextResponse("Not found", { status: 404 })
  const clerkId = request.nextUrl.searchParams.get("user") ?? ""
  const next = request.nextUrl.searchParams.get("next") || "/"
  if (!next.startsWith("/")) return new NextResponse("Not found", { status: 404 })
  const response = NextResponse.redirect(new URL(next, request.url))
  if (clerkId === "none") {
    response.cookies.delete(DEV_USER_COOKIE)
    return response
  }
  if (!clerkId.startsWith(DEV_CLERK_PREFIX)) return new NextResponse("Not found", { status: 404 })
  const { data: u } = await supabaseServer.from("user_profiles").select("clerk_user_id, full_name, email").eq("clerk_user_id", clerkId).maybeSingle()
  if (!u) return new NextResponse("No such dummy user: run node scripts/test-users.mjs create", { status: 404 })
  response.cookies.set(DEV_USER_COOKIE, JSON.stringify({ clerkId: u.clerk_user_id, name: u.full_name ?? clerkId, email: u.email ?? "" }), { path: "/" })
  return response
}
