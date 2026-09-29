"use client"

// The dashboard's "Your plan" card: which plan the student is on, what it opens, how much of today's allowance is
// used, how much of the library is theirs, and (below Resident) the way up, in place.

import { Check, Infinity as InfinityIcon, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/dashboard/dashboard-ui"
import { difficultyLevel, DIFFICULTY_LABEL, type LibraryCase } from "@/lib/library/case-library"
import { PLAN_OFFERS } from "@/lib/plans/catalog"
import { GUEST_CASE_IDS, lockedFor } from "@/lib/plans/limits"
import { usePlan, type PlanInfo } from "./use-plan"
import { useUpgrade } from "./upgrade-dialog"

function Meter({ label, used, cap }: { label: string; used: number; cap: number | null }) {
  const full = cap !== null && used >= cap
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-enc-ink-2">{label}</span>
        <span className={cn("font-mono tabular-nums", full ? "font-semibold text-enc-warn" : "text-enc-ink")}>
          {cap === null ? (
            <span className="inline-flex items-center gap-1">
              {used} <InfinityIcon className="h-3.5 w-3.5 text-enc-ink-3" aria-label="no limit" />
            </span>
          ) : (
            `${used} / ${cap}`
          )}
        </span>
      </div>
      {cap !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-enc-console">
          <div className={cn("h-full rounded-full transition-[width]", full ? "bg-enc-warn" : "bg-brand-600")} style={{ width: `${Math.min(100, (used / Math.max(cap, 1)) * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** What the plan opens, in the student's words. */
function includes(info: PlanInfo): string[] {
  const { maxDifficulty, casesPerDay, livePerDay } = info.limits
  const levels = [1, 2, 3].filter((l) => l <= maxDifficulty).map((l) => DIFFICULTY_LABEL[l as 1 | 2 | 3])
  const cases = `${levels.join(" & ")} cases, ${casesPerDay === null ? "unlimited" : `${casesPerDay} a day`}`
  const live = info.plan === "student" ? "One free live emergency case" : `${livePerDay} live emergency cases a day`
  return [cases, live]
}

export function PlanCard({ cases }: { cases: readonly LibraryCase[] }) {
  const info = usePlan()
  const openUpgrade = useUpgrade()
  if (!info) return null

  const offer = PLAN_OFFERS[info.plan]
  const open = info.admin
    ? cases.length
    : cases.filter((c) => GUEST_CASE_IDS.includes(c.id) || !lockedFor(info.plan, { live: !!c.live, difficulty: difficultyLevel(c.difficulty) }, info.liveEver)).length
  const locked = cases.length - open

  return (
    <Paper className="h-fit p-5">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Your plan</Eyebrow>
        {info.admin && <span className="text-[11px] font-semibold text-enc-ink-3">Admin · no limits</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <h2 className="text-[20px] font-bold text-enc-ink">{offer.name}</h2>
        <span className="rounded-full bg-enc-console px-2 py-0.5 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">{offer.sub}</span>
      </div>
      {info.grant && info.grant.plan === info.plan && (
        <p className="mt-1 text-[12.5px] text-enc-ok">
          Free until {new Date(info.grant.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}, thanks to your published case
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {includes(info).map((line) => (
          <li key={line} className="flex items-start gap-2 text-[13px] text-enc-ink-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-enc-ok" strokeWidth={2.4} />
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-3 border-t border-enc-line pt-4">
        <Eyebrow>Today</Eyebrow>
        <Meter label="Cases opened" used={info.casesToday} cap={info.limits.casesPerDay} />
        {info.plan === "student" ? (
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-enc-ink-2">Free live case</span>
            <span className={cn("font-semibold", info.liveEver >= 1 ? "text-enc-ink-3" : "text-enc-ok")}>{info.liveEver >= 1 ? "Used" : "Still yours"}</span>
          </div>
        ) : (
          <Meter label="Live cases" used={info.liveToday} cap={info.limits.livePerDay} />
        )}
        <p className="text-[12px] text-enc-ink-3">Opening the same case again today does not count twice. New cases open at midnight.</p>
      </div>

      {cases.length > 0 && (
        <p className="mt-4 flex items-center gap-2 border-t border-enc-line pt-4 text-[13px] text-enc-ink-2">
          {locked > 0 && <Lock className="h-3.5 w-3.5 shrink-0 text-enc-ink-3" strokeWidth={2} />}
          <span>
            <span className="font-semibold text-enc-ink">{open}</span> of {cases.length} library cases are open to you
            {locked > 0 && <>; {locked} need a higher plan</>}.
          </span>
        </p>
      )}

      {info.plan !== "resident" && !info.admin && (
        <Button
          type="button"
          onClick={() => openUpgrade({ source: "plan_card", highlight: info.plan === "student" ? "intern" : "resident" })}
          className={cn(info.plan === "student" ? PRIMARY_BUTTON : SECONDARY_BUTTON, "mt-4 w-full")}
        >
          {info.plan === "student" ? "Upgrade your plan" : "See Resident"}
        </Button>
      )}
    </Paper>
  )
}
