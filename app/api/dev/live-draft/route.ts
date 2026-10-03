import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"
import { isSimulationCase } from "@/lib/simulation/case-schema"
import { upgradeLegacyCase } from "@/lib/simulation/legacy-adapter"
import { compileLivePlan, measuredOnArrival } from "@/lib/simulation/live-plan"
import { validateSimulationCase } from "@/lib/simulation/validate-config"
import { INTERVENTION_IDS } from "@/lib/simulation/intervention-catalog"
import { CATALOG_TEST_IDS } from "@/lib/clinical-catalog"
import { draftLivePlan } from "@/lib/studio/live-draft"

// Dev-only: draft a live plan for one case and return it WITHOUT saving it, with the engine's own check of the
// compiled case, to judge the drafter's output (e.g. after changing its rules). ?case= a case id.
// Returns 404 in production builds; the real flow is /admin/live.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 })

  const id = request.nextUrl.searchParams.get("case") ?? ""
  const { data } = await supabaseServer.from("cases").select("case_json").eq("id", id).maybeSingle()
  if (!data) return NextResponse.json({ error: "No case with that id" }, { status: 404 })

  const caseJson = data.case_json as Record<string, any>
  const base = upgradeLegacyCase(caseJson)
  if (!isSimulationCase(base)) return NextResponse.json({ error: "Not playable at the bedside" }, { status: 400 })

  const started = Date.now()
  const draft = await draftLivePlan(caseJson, measuredOnArrival(base))
  const seconds = Math.round((Date.now() - started) / 1000)
  if (!draft.ok) return NextResponse.json({ seconds, ...draft })

  const compiled = compileLivePlan(base, draft.plan)
  const engineCheck = validateSimulationCase(compiled, { knownActions: INTERVENTION_IDS, knownTestIds: CATALOG_TEST_IDS })
  return NextResponse.json({ seconds, plan: draft.plan, planWarnings: draft.check.warnings, engineErrors: engineCheck.errors, engineWarnings: engineCheck.warnings })
}
