"use client"

// Who you are on MediKarya. Identity comes from the sign-in (Clerk), which is also where it is edited (the "Manage
// account" button opens Clerk's own profile). The page is short on purpose: how you are doing lives on the Progress
// page, and this only says where you stand in one card, with the way there. Nothing here is made up (it used to show
// fixed figures, level 12, 47 cases, 87%, to everyone).
//
// Three cards. On a wide screen the identity card stands on the left, as tall as the other two stacked on the right;
// below that they sit in a row of two under a full-width identity card, and on a phone in one column.

import Link from "next/link"
import { ArrowRight, Settings2 } from "lucide-react"
import { useClerk, useUser } from "@clerk/nextjs"
import { NO_STATS, summarise, type DashboardStats, type LibraryCase, type ProgressMap } from "@/lib/library/case-library"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { ThemeChoice } from "@/components/theme-toggle"
import { PageContainer, PageHeader, SECONDARY_BUTTON } from "./dashboard-ui"
import { useDisplayName } from "./use-display-name"
import { cn } from "@/lib/utils"

interface Props {
  initialStats?: DashboardStats
  /** The library, to say how many of its cases have been tried. */
  cases?: LibraryCase[]
  progress?: ProgressMap
  /** Shown instead of the signed-in user's name (the dev preview). */
  userName?: string
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">{label}</dt>
      <dd className="mt-1 text-[14px] break-words text-enc-ink">{children}</dd>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">{label}</dt>
      <dd className="mt-1.5 font-mono text-[20px] leading-none font-medium text-enc-ink tabular-nums">{value}</dd>
    </div>
  )
}

const OPEN_PROGRESS = "inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-300"

export function Profile({ initialStats, cases = [], progress = {}, userName }: Props) {
  const { user } = useUser()
  const { openUserProfile } = useClerk()
  const me = useDisplayName(userName)

  const stats: DashboardStats = initialStats ?? NO_STATS
  const summary = summarise(cases, progress)

  const email = user?.primaryEmailAddress?.emailAddress
  const phone = user?.primaryPhoneNumber?.phoneNumber
  const since = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : undefined

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Who you are on MediKarya."
        actions={
          <Button variant="outline" className={cn(SECONDARY_BUTTON)} onClick={() => user && openUserProfile()} disabled={!user}>
            <Settings2 className="h-4 w-4" strokeWidth={1.9} />
            Manage account
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Paper className="p-5 sm:p-6 md:col-span-2 xl:col-span-1 xl:row-span-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-1 ring-enc-line-strong">
              <AvatarImage src={me.imageUrl} alt={me.name} />
              <AvatarFallback className="bg-enc-console text-[20px] font-semibold text-enc-ink-2">{me.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] leading-tight font-semibold text-enc-ink">{me.name || "Your name"}</h2>
              <p className="mt-0.5 text-[13.5px] text-enc-ink-3">Medical student</p>
            </div>
          </div>
          {email || phone || since ? (
            <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-enc-line pt-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-1">
              {email && <Detail label="Email">{email}</Detail>}
              {phone && <Detail label="Phone">{phone}</Detail>}
              {since && <Detail label="Member since">{since}</Detail>}
            </dl>
          ) : (
            <p className="mt-5 border-t border-enc-line pt-5 text-[13.5px] text-enc-ink-3">Your details appear here once you are signed in.</p>
          )}
        </Paper>

        <Paper className="p-5">
          <Eyebrow>Appearance</Eyebrow>
          <div className="mt-3">
            <ThemeChoice />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-enc-ink-3">Dark is easier on the eyes for late-night study. It applies to the dashboard and the cases. System follows your device.</p>
        </Paper>

        {/* four figures in a row once the card is wide enough, two by two before that */}
        <Paper className="@container p-5">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Your record</Eyebrow>
            <Link href="/dashboard/progress" className={OPEN_PROGRESS}>
              Open progress <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {stats.attempts > 0 ? (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 @lg:grid-cols-4">
              <Figure label="Total XP" value={stats.totalXP.toLocaleString("en-US")} />
              <Figure label="Cases done" value={summary.total > 0 ? `${summary.attempted} of ${summary.total}` : String(summary.attempted)} />
              <Figure label="Streak" value={`${stats.streakDays} ${stats.streakDays === 1 ? "day" : "days"}`} />
              <Figure label="Average score" value={stats.averageScore === null ? "—" : `${Math.round(stats.averageScore)}%`} />
            </dl>
          ) : (
            <p className="mt-3 text-[13.5px] leading-relaxed text-enc-ink-2">You have not finished a case yet. Your XP, streak and skills appear on the Progress page as you go.</p>
          )}
        </Paper>
      </div>
    </PageContainer>
  )
}
