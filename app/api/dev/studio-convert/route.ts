import { NextRequest, NextResponse } from "next/server"
import { getStudioCase, listStudioCases } from "@/lib/studio/source"
import { convertStudioCase } from "@/lib/studio/convert"

// Dev-only: run the studio converter on one case and return the draft WITHOUT saving it, to judge the
// converter's output (e.g. after changing its rules). ?id= a studio case id or its first characters.
// Returns 404 in production builds; the real flow is /admin/studio.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 })

  const prefix = request.nextUrl.searchParams.get("id") ?? ""
  const match = (await listStudioCases()).find((c) => prefix && c.id.startsWith(prefix))
  if (!match) return NextResponse.json({ error: "No studio case with that id" }, { status: 404 })

  const sc = await getStudioCase(match.id)
  if (!sc) return NextResponse.json({ error: "No studio case with that id" }, { status: 404 })

  const started = Date.now()
  const conversion = await convertStudioCase(sc)
  return NextResponse.json({ seconds: Math.round((Date.now() - started) / 1000), ...conversion })
}
