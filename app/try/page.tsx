import { getCaseById } from "@/data/cases"
import { briefingOnly, isDraft } from "@/lib/plans/access"
import { GUEST_CASE_IDS } from "@/lib/plans/limits"
import TryClient from "./TryClient"

// The free case's briefing (who the patient is, how they look, their vitals on arrival; nothing that answers the case)
// is read here on the server and sent with the page, so /try has its patient in the HTML instead of a spinner.
export const revalidate = 300

export default async function TryPage() {
  const caseData = await getCaseById(GUEST_CASE_IDS[0]).catch(() => null)
  const initialCase = caseData && !isDraft(caseData) ? briefingOnly(caseData as Record<string, any>) : null
  return <TryClient initialCase={initialCase} />
}
