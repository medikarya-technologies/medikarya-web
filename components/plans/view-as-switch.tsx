"use client"

// "View as student", for admins only (lib/plans/view-as.ts): a switch at the foot of the dashboard's side rail, and a
// banner across the page while it is on, so it is never on by accident. Everything re-reads the plan when it changes.

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { setViewAs } from "@/app/actions/view-as"
import { PLAN_NAME, type Plan } from "@/lib/plans/limits"
import { refreshPlan, usePlan } from "./use-plan"

const OPTIONS: Array<{ value: Plan | null; label: string }> = [
  { value: null, label: "Admin" },
  { value: "student", label: "Student" },
  { value: "intern", label: "Intern" },
  { value: "resident", label: "Resident" },
]

function useSwitch() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const change = (plan: Plan | null) =>
    start(async () => {
      await setViewAs(plan)
      await refreshPlan()
      router.refresh()
    })
  return { pending, change }
}

export function ViewAsSwitch() {
  const info = usePlan()
  const { pending, change } = useSwitch()
  if (!info?.realAdmin) return null
  const current = info.viewingAs ?? null

  return (
    <div className="rounded-lg border border-enc-line-strong bg-enc-sheet p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-enc-ink-3 uppercase">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} View as
      </p>
      <div role="radiogroup" aria-label="View the site as" className="mt-2 grid grid-cols-2 gap-1">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={current === o.value}
            disabled={pending}
            onClick={() => change(o.value)}
            className={cn(
              "rounded-md px-2 py-1 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-60",
              current === o.value ? "bg-brand-600 text-white" : "text-enc-ink-2 hover:bg-enc-console-hover hover:text-enc-ink"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ViewAsBanner() {
  const info = usePlan()
  const { pending, change } = useSwitch()
  if (!info?.realAdmin || !info.viewingAs) return null
  return (
    <div role="status" className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-enc-warn px-4 py-2 text-center text-[13px] font-medium text-white">
      <span>
        <Eye className="mr-1.5 inline h-3.5 w-3.5" />
        You are viewing MediKarya as a <strong>{PLAN_NAME[info.viewingAs]}</strong>: that plan&apos;s locks and daily limits apply to you.
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => change(null)}
        className="rounded-md bg-white/20 px-2.5 py-0.5 font-semibold outline-none hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
      >
        {pending ? "Switching…" : "Back to admin"}
      </button>
    </div>
  )
}
