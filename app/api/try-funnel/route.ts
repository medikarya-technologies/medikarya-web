import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { allow, clientIp } from "@/lib/rate-limit"
import { isProductionHost } from "@/lib/production-host"
import { parseTryStep } from "@/lib/try-funnel"

// Saves one step of a guest's way through the free case (lib/try-funnel.ts). Open to signed-out visitors, so it takes
// only the fixed step names and ids, at a pace no real play reaches; anything else is dropped. It always answers 204:
// a step that cannot be saved (no table yet, a bad request) must never disturb the case.
export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!allow(`try-funnel:m:${ip}`, 40, 60_000) || !allow(`try-funnel:d:${ip}`, 600, 86_400_000)) {
    return new NextResponse(null, { status: 204 })
  }
  try {
    const row = parseTryStep(await request.json())
    if (!row) return new NextResponse(null, { status: 204 })
    // Anything not on the real site (localhost, test mode, a preview) is our own testing.
    const host = new URL(request.url).hostname
    if (!isProductionHost(host)) row.internal = true
    const { error } = await supabaseServer
      .from("try_funnel")
      .upsert(row, { onConflict: "guest_id,play_id,step", ignoreDuplicates: true })
    if (error) console.error("Could not save a /try step:", error.message)
  } catch {
    /* not JSON: ignore */
  }
  return new NextResponse(null, { status: 204 })
}
