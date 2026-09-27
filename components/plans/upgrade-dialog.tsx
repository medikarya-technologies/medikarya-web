"use client"

// The in-app way to buy a plan: Intern and Resident side by side, a Monthly/Yearly switch, and the checkout right
// there, so a student who meets a lock never has to go back to the landing page. Any component under the dashboard
// opens it with useUpgrade()({ highlight, reason }): the plan that would unlock what they tried, and why it did not
// open. The plan (use-plan.ts) refreshes on success, so every lock and counter on the page updates in place.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SubscribeButton } from "@/components/payments/subscribe-button"
import { usePlan } from "./use-plan"
import { PAID_PLANS, rupees, type PlanOffer } from "@/lib/plans/catalog"
import type { Plan } from "@/lib/plans/limits"

type Period = "monthly" | "yearly"

interface UpgradeRequest {
  /** The plan that unlocks what the student tried; drawn as the recommended one. */
  highlight?: Plan | null
  /** Why they are here, e.g. the lock's message. */
  reason?: string
}

const UpgradeContext = createContext<(request?: UpgradeRequest) => void>(() => {})

/** Opens the upgrade dialog. */
export function useUpgrade() {
  return useContext(UpgradeContext)
}

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<UpgradeRequest | null>(null)
  const open = useCallback((r: UpgradeRequest = {}) => setRequest(r), [])
  return (
    <UpgradeContext.Provider value={open}>
      {children}
      <UpgradeDialog request={request} onClose={() => setRequest(null)} />
    </UpgradeContext.Provider>
  )
}

function UpgradeDialog({ request, onClose }: { request: UpgradeRequest | null; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("monthly")
  const current = usePlan()?.plan ?? "student"
  const highlight = request?.highlight ?? (current === "intern" ? "resident" : "intern")

  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b border-enc-line px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-[18px] font-semibold text-enc-ink">Choose your plan</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-snug text-enc-ink-2">
            {request?.reason ?? "More cases every day, harder cases, and more live emergencies."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-5 sm:px-6">
          <PeriodSwitch period={period} onChange={setPeriod} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {PAID_PLANS.map((offer) => (
              <OfferCard key={offer.plan} offer={offer} period={period} current={current} recommended={offer.plan === highlight} onDone={onClose} />
            ))}
          </div>

          <p className="mt-4 text-center text-[12px] text-enc-ink-3">
            Paid securely through Razorpay. Renews automatically; cancel any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing" className="mx-auto flex w-fit items-center gap-1 rounded-full border border-enc-line bg-enc-console p-1">
      {(["monthly", "yearly"] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={period === p}
          onClick={() => onChange(p)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
            period === p ? "bg-enc-sheet text-enc-ink shadow-sm" : "text-enc-ink-2 hover:text-enc-ink"
          )}
        >
          {p === "monthly" ? "Monthly" : "Yearly"}
          {p === "yearly" && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Save ~16%</span>}
        </button>
      ))}
    </div>
  )
}

function OfferCard({ offer, period, current, recommended, onDone }: { offer: PlanOffer; period: Period; current: Plan; recommended: boolean; onDone: () => void }) {
  const yearly = period === "yearly"
  const price = yearly ? offer.yearly : offer.monthly
  const isCurrent = offer.plan === current
  // Changing between paid plans needs Razorpay's plan-change flow, which is not built yet.
  const isSwitch = current !== "student" && !isCurrent

  const action = useMemo(() => {
    if (isCurrent) return <Button disabled className="h-10 w-full rounded-lg text-[14px] font-semibold">Your current plan</Button>
    if (isSwitch) {
      return (
        <Button disabled variant="outline" className="h-10 w-full rounded-lg text-[13px] font-medium">
          Switching plans is coming soon
        </Button>
      )
    }
    return null
  }, [isCurrent, isSwitch])

  return (
    <div className={cn("relative flex flex-col rounded-xl border bg-enc-sheet p-5", recommended ? "border-brand-400 ring-1 ring-brand-300" : "border-enc-line")}>
      {recommended && !isCurrent && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10.5px] font-bold tracking-wide text-white uppercase">Unlocks this</span>
      )}
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-bold text-enc-ink">{offer.name}</h3>
        <span className="rounded-full bg-enc-console px-2 py-0.5 text-[10px] font-semibold tracking-wide text-enc-ink-3 uppercase">{offer.sub}</span>
      </div>
      <p className="mt-1 text-[13px] text-enc-ink-2">{offer.tagline}</p>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-[28px] font-extrabold tracking-tight text-enc-ink">{rupees(price)}</span>
        <span className="text-[13px] text-enc-ink-3">{yearly ? "/yr" : "/mo"}</span>
      </p>
      <p className="text-[12px] text-enc-ink-3">{yearly ? `about ${rupees(Math.round(price / 12))} a month, billed yearly` : "billed monthly"}</p>

      <ul className="mt-4 flex-1 space-y-2">
        {offer.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-enc-ink-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-enc-ok" strokeWidth={2.4} />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {action ?? (
          <SubscribeButton
            tier={offer.plan as "intern" | "resident"}
            period={period}
            onCheckoutOpen={onDone}
            onSubscribed={() => undefined}
            className={cn(
              "h-10 w-full rounded-lg text-[14px] font-semibold shadow-none",
              recommended ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-enc-line-strong bg-enc-sheet text-enc-ink hover:bg-enc-console"
            )}
          >
            Get {offer.name} · {rupees(price)}
            {yearly ? "/yr" : "/mo"}
          </SubscribeButton>
        )}
      </div>
    </div>
  )
}
