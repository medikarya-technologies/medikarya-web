"use client"

// The Progress page: how a student is doing, in three tabs that each fit one screen. (It used to be everything in
// one column on the Profile page, four screens tall, with the numbers repeated from the dashboard.)
//
//   Overview   the training numbers and XP case by case (the same section as the dashboard home)
//   Skills     which parts of a case score lowest, what keeps being missed, how each specialty is going
//   Activity   the latest attempts, and the milestones reached
//
// The address remembers the tab (?tab=skills), so a link or a reload lands on it. A student with no attempts gets
// one panel saying what will appear, not three tabs of nothing. All the numbers come from lib/library.

import { useMemo, useState } from "react"
import Link from "next/link"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { Stethoscope, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { NO_STATS, specialtyStrength, type DashboardStats, type LibraryCase, type ProgressMap } from "@/lib/library/case-library"
import type { Milestone } from "@/lib/library/milestones"
import { DEFAULT_PROGRESS_TAB, parseProgressTab, PROGRESS_TABS, PROGRESS_TAB_LABEL, queryWithTab, type ProgressTab } from "@/lib/library/progress-tabs"
import { NO_SKILLS, type SkillProfile } from "@/lib/library/skills"
import { Button } from "@/components/ui/button"
import { Paper } from "@/components/cases/encounter-ui"
import { MilestonesCard, MissedCard, SkillsCard, SpecialtyCard } from "./progress-cards"
import { PageContainer, PageHeader, PRIMARY_BUTTON } from "./dashboard-ui"
import { RecentAttempts } from "./recent-attempts"
import { TrainingPanel } from "./training-panel"

interface Props {
  /** The tab the address named, read on the server so the first paint is already the right one. */
  initialTab?: ProgressTab
  initialStats?: DashboardStats
  cases?: LibraryCase[]
  progress?: ProgressMap
  /** What the attempts say about which parts of a case cost marks, and what keeps being missed. */
  skills?: SkillProfile
  milestones?: Milestone[]
}

// The open tab has a brand-blue rule drawn over the grey one under the list. All three panels stay mounted (forceMount)
// and the two not open are `hidden`, so switching is instant and nothing draws in again.
const TRIGGER = cn(
  "relative -mb-px inline-flex h-11 shrink-0 items-center rounded-t-md px-3.5 text-[14px] font-medium whitespace-nowrap text-enc-ink-2 outline-none transition-colors",
  "hover:text-enc-ink focus-visible:bg-enc-console-hover data-[state=active]:text-enc-ink",
  "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-brand-600"
)

const PANEL = "mt-6 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-4 focus-visible:ring-offset-enc-desk"

/** A student with no attempts: say what will appear, and how to get it. */
function NothingYet() {
  return (
    <Paper className="mt-8 px-6 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-enc-console text-enc-ink-2" aria-hidden>
        <TrendingUp className="h-6 w-6" strokeWidth={1.7} />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold text-enc-ink">Nothing to chart yet</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-enc-ink-2">
        Finish a case and this page fills in: your XP and streak, which parts of a case cost you marks, how each specialty is going, and the milestones you reach.
      </p>
      <Button asChild className={cn(PRIMARY_BUTTON, "mt-6")}>
        <Link href="/dashboard/cases">
          <Stethoscope className="h-4 w-4" strokeWidth={1.9} />
          Start a case
        </Link>
      </Button>
    </Paper>
  )
}

/** Attempts with no stored feedback have nothing to break down; say so instead of showing an empty tab. */
function NoBreakdown() {
  return (
    <Paper className="p-6 text-center">
      <p className="text-[15px] font-medium text-enc-ink">No breakdown yet</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-enc-ink-2">Your scores for each part of a case come with the feedback at the end of a case.</p>
    </Paper>
  )
}

export function StudentProgress({ initialTab = DEFAULT_PROGRESS_TAB, initialStats, cases = [], progress = {}, skills = NO_SKILLS, milestones = [] }: Props) {
  const stats = initialStats ?? NO_STATS
  const [tab, setTab] = useState<ProgressTab>(initialTab)
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const strength = useMemo(() => specialtyStrength(cases, progress), [cases, progress])

  const hasSkills = skills.skills.length > 0
  const hasSpecialties = strength.some((s) => s.tried > 0)
  const hasGaps = skills.gaps.length > 0

  // The address follows the tab. It replaces the history entry, so Back still leaves the page (a tab is not a place).
  const show = (next: string) => {
    const value = parseProgressTab(next)
    setTab(value)
    const query = queryWithTab(window.location.search, value)
    window.history.replaceState(window.history.state, "", window.location.pathname + (query ? `?${query}` : ""))
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Practice" title="Progress" description="How you are doing, where the marks go, and what you have earned." />

      {stats.attempts === 0 ? (
        <NothingYet />
      ) : (
        <TabsPrimitive.Root value={tab} onValueChange={show} className="mt-7">
          <TabsPrimitive.List aria-label="Progress sections" className="flex gap-1 border-b border-enc-line-strong">
            {PROGRESS_TABS.map((id) => (
              <TabsPrimitive.Trigger key={id} value={id} className={TRIGGER}>
                {PROGRESS_TAB_LABEL[id]}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          <TabsPrimitive.Content value="overview" forceMount hidden={tab !== "overview"} className={PANEL}>
            <TrainingPanel stats={stats} cases={cases} progress={progress} />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="skills" forceMount hidden={tab !== "skills"} className={PANEL}>
            <div className="@container space-y-6">
              {(hasSkills || hasSpecialties) && (
                <div className="grid gap-6 @3xl:grid-cols-2">
                  {hasSkills && <SkillsCard profile={skills} />}
                  {hasSpecialties && <SpecialtyCard rows={strength} />}
                </div>
              )}
              {hasGaps && <MissedCard profile={skills} />}
              {!hasSkills && !hasSpecialties && !hasGaps && <NoBreakdown />}
            </div>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="activity" forceMount hidden={tab !== "activity"} className={PANEL}>
            <div className="@container">
              <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_320px]">
                <RecentAttempts attempts={stats.recentCases} byId={byId} />
                {milestones.length > 0 && <MilestonesCard milestones={milestones} />}
              </div>
            </div>
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      )}
    </PageContainer>
  )
}
