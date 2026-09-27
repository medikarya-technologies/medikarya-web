"use client"

// Shown on a case's briefing when the student's plan will not open it (a locked case, or today's allowance used),
// with the reason from the server and the way forward: the upgrade dialog, right here.

import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/dashboard/dashboard-ui"
import type { Plan } from "@/lib/plans/limits"
import { PLAN_NAME } from "@/lib/plans/limits"
import { useUpgrade } from "./upgrade-dialog"

export interface PlanBlock {
  message: string
  needs: Plan | null
}

export function PlanNotice({ block }: { block: PlanBlock }) {
  const openUpgrade = useUpgrade()
  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white" aria-hidden>
        <Lock className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="flex-1 text-[14.5px] leading-relaxed text-enc-ink">{block.message}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {block.needs && (
          <Button type="button" onClick={() => openUpgrade({ source: "case_notice", highlight: block.needs, reason: block.message })} className={PRIMARY_BUTTON}>
            Unlock with {PLAN_NAME[block.needs]}
          </Button>
        )}
        <Button asChild variant="outline" className={SECONDARY_BUTTON}>
          <Link href="/dashboard/cases">Case library</Link>
        </Button>
      </div>
    </div>
  )
}
