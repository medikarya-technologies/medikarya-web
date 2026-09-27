"use client"

// Plan & billing: the student's subscription (what it costs, when it renews or ends), a way to change it, and a
// way to cancel that keeps the plan to the end of the period already paid for. Beside it, the same "Your plan"
// card as the dashboard, with today's usage.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarClock, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { trackEvent } from "@/lib/clarity"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { PageContainer, PageHeader, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/dashboard/dashboard-ui"
import type { LibraryCase } from "@/lib/library/case-library"
import { PLAN_OFFERS, rupees } from "@/lib/plans/catalog"
import { PlanCard } from "./plan-card"
import { refreshPlan, usePlan } from "./use-plan"
import { useUpgrade } from "./upgrade-dialog"

export interface Subscription {
  tier: "intern" | "resident"
  period: "monthly" | "yearly"
  status: string
  currentEnd: string | null
  cancelAt: string | null
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

/** preview: the dev preview page's made-up subscription, instead of fetching (undefined = fetch). */
function useSubscription(preview?: Subscription | null) {
  const [state, setState] = useState<{ loading: boolean; sub: Subscription | null; failed: boolean }>({ loading: preview === undefined, sub: preview ?? null, failed: false })
  const load = useCallback(async () => {
    if (preview !== undefined) return
    try {
      const res = await fetch("/api/payments/subscription")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setState({ loading: false, sub: data.subscription, failed: false })
    } catch {
      setState({ loading: false, sub: null, failed: true })
    }
  }, [preview])
  // Re-read whenever the plan changes (a payment in the upgrade dialog, a cancellation).
  const plan = usePlan()?.plan
  useEffect(() => {
    void load()
  }, [load, plan])
  return { ...state, reload: load }
}

function CancelButton({ sub, onCancelled }: { sub: Subscription; onCancelled: () => void }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const name = PLAN_OFFERS[sub.tier].name
  const until = sub.currentEnd ? longDate(sub.currentEnd) : "the end of this billing period"

  const cancel = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/payments/cancel-subscription", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      trackEvent("Plan_Cancelled", { cancelled_plan: `${sub.tier}_${sub.period}` })
      toast({ title: "Subscription cancelled", description: `You won't be charged again. ${name} stays until ${data.cancelAt ? longDate(data.cancelAt) : until}.` })
      await refreshPlan()
      onCancelled()
    } catch (error) {
      toast({ title: "Could not cancel", description: error instanceof Error && error.message ? error.message : "Please try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={busy} className="h-10 rounded-lg px-4 text-[14px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-crit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel subscription"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your {name} plan?</AlertDialogTitle>
          <AlertDialogDescription>
            You won&apos;t be charged again. You keep {name} until {until}, then move to the free Student plan. Your attempts, scores and
            progress stay.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my plan</AlertDialogCancel>
          <AlertDialogAction onClick={() => void cancel()} className="bg-enc-crit text-white hover:bg-enc-crit/90">
            Cancel subscription
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SubscriptionPanel({ preview }: { preview?: Subscription | null }) {
  const { loading, sub, failed, reload } = useSubscription(preview)
  const openUpgrade = useUpgrade()

  if (loading) {
    return (
      <Paper className="flex h-48 items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-enc-ink-3" />
      </Paper>
    )
  }

  if (failed) {
    return (
      <Paper className="p-6">
        <p className="text-[14px] text-enc-ink-2">We could not load your subscription just now.</p>
        <Button onClick={() => void reload()} variant="outline" className={SECONDARY_BUTTON + " mt-4"}>
          Try again
        </Button>
      </Paper>
    )
  }

  if (!sub) {
    return (
      <Paper className="p-6">
        <Eyebrow>Subscription</Eyebrow>
        <h2 className="mt-2 text-[20px] font-bold text-enc-ink">You&apos;re on the free Student plan</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-enc-ink-2">
          No subscription and nothing to pay. Upgrade for Intermediate and Advanced cases, more cases each day, and live emergencies every day.
        </p>
        <Button onClick={() => openUpgrade({ source: "billing" })} className={PRIMARY_BUTTON + " mt-5"}>
          See plans
        </Button>
      </Paper>
    )
  }

  const offer = PLAN_OFFERS[sub.tier]
  const yearly = sub.period === "yearly"
  const price = yearly ? offer.yearly : offer.monthly

  return (
    <Paper className="p-6">
      <Eyebrow>Subscription</Eyebrow>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-[22px] font-bold text-enc-ink">{offer.name}</h2>
        <span className="rounded-full bg-enc-console px-2 py-0.5 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">{offer.sub}</span>
      </div>
      <p className="mt-1 flex items-center gap-2 text-[14px] text-enc-ink-2">
        <CreditCard className="h-4 w-4 text-enc-ink-3" strokeWidth={1.8} />
        {rupees(price)} {yearly ? "a year" : "a month"}, paid through Razorpay
      </p>

      <div className="mt-5 rounded-xl border border-enc-line bg-enc-desk p-4">
        {sub.cancelAt ? (
          <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-enc-ink">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-enc-warn" strokeWidth={1.9} />
            <span>
              <span className="font-semibold">Cancelled.</span> You keep {offer.name} until {longDate(sub.cancelAt)}, then move to the free Student plan. You
              won&apos;t be charged again.
            </span>
          </p>
        ) : sub.status === "pending" ? (
          <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-enc-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-enc-warn" strokeWidth={1.9} />
            <span>
              Your last renewal payment didn&apos;t go through. Razorpay will try again; check the card or UPI account you pay with. Your plan stays
              meanwhile.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-enc-ink">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-enc-ink-3" strokeWidth={1.9} />
            <span>{sub.currentEnd ? <>Renews on <span className="font-semibold">{longDate(sub.currentEnd)}</span>.</> : "Renews automatically."} Cancel any time; you keep the plan to the end of the period you&apos;ve paid for.</span>
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => openUpgrade({ source: "billing" })} variant="outline" className={SECONDARY_BUTTON}>
          Compare plans
        </Button>
        {!sub.cancelAt && <CancelButton sub={sub} onCancelled={() => void reload()} />}
      </div>

      <p className="mt-5 border-t border-enc-line pt-4 text-[12.5px] leading-relaxed text-enc-ink-3">
        Razorpay emails a receipt for every payment. See our{" "}
        <Link href="/refund-policy" className="font-medium text-brand-700 underline-offset-2 hover:underline">
          refund & cancellation policy
        </Link>
        , or write to us from{" "}
        <Link href="/dashboard/support" className="font-medium text-brand-700 underline-offset-2 hover:underline">
          Support
        </Link>
        .
      </p>
    </Paper>
  )
}

export function Billing({ cases, preview }: { cases: LibraryCase[]; preview?: Subscription | null }) {
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Plan & billing" description="Your plan, what it includes, and how it's billed." />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SubscriptionPanel preview={preview} />
        <PlanCard cases={cases} />
      </div>
    </PageContainer>
  )
}
