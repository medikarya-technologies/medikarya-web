"use client"

import dynamic from "next/dynamic"
import { ArrowLeft, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SECONDARY_BUTTON, StatePanel } from "@/components/dashboard/dashboard-ui"
import { isSimulationCase } from "@/lib/simulation/case-schema"
import type { EncounterTourConfig } from "@/lib/tour/tour-storage"

interface CaseInteractionProps {
  caseData: any
  onExit: () => void
  guestId?: string
  /** Walk the student through the bedside screen. */
  tour?: EncounterTourConfig
}

// The encounter (real-time engine, 183-test catalog, ECG synthesis, scorer) is loaded on demand, which keeps it
// out of the first-load bundle of the briefing page and of the public /try page.
const SimulationInteraction = dynamic(
  () => import("./simulation-interaction").then((m) => m.SimulationInteraction),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-enc-desk">
        <p className="animate-pulse text-[14px] font-medium text-enc-ink-2">Preparing clinical environment...</p>
      </div>
    ),
  }
)

/**
 * Every case runs as a bedside encounter: an authored simulation as it is, an older case sheet upgraded on the
 * server from its own data (lib/simulation/legacy-adapter.ts). A case the bedside cannot run has no heart rate
 * or no test to order; the studio checker refuses to publish one (lib/studio/validate.ts), and the start route
 * refuses one (app/api/cases/[id]/start), so the panel below is a last line of defence.
 */
export function CaseInteraction(props: CaseInteractionProps) {
  if (isSimulationCase(props.caseData)) return <SimulationInteraction {...props} />
  return (
    <div className="min-h-screen bg-enc-desk">
      <StatePanel
        icon={<TriangleAlert className="h-6 w-6" strokeWidth={1.6} />}
        title="This case is not ready to open"
        actions={
          <Button variant="outline" onClick={props.onExit} className={SECONDARY_BUTTON}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
            Back
          </Button>
        }
      >
        It is missing something the bedside needs. Please tell us from the Support page so we can fix it.
      </StatePanel>
    </div>
  )
}
