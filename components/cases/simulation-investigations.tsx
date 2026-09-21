"use client"

// Order entry with results that arrive after their turnaround. A case either opens the
// whole master catalog (150+ tests; ordering restraint is something the scorer can
// measure, and a troponin genuinely takes minutes) or offers only its own tests.
//
// Two sheets, two different jobs:
//   Order entry   a searchable list of what CAN be ordered (a menu, on white)
//   Worklist      what HAS been ordered and where each result stands (a queue)

import { memo, useMemo, useState } from "react"
import { Activity, Check, FlaskConical, Inbox, Loader2, ScanLine, Search, Stethoscope } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { CatalogTest, TestCategory } from "@/lib/clinical-catalog"
import { listOrderableTests, orderableCategories } from "@/lib/simulation/test-catalog"
import { formatClock } from "@/lib/simulation/encounter-events"
import {
  interpretationFor,
  isResultReady,
  isRevealed,
  listOrders,
  readyAt,
  turnaroundMinutes,
  type InvestigationOrder,
} from "@/lib/simulation/case-resolvers"
import { useClinicalEvents } from "./clinical-event-manager"
import { TestResultModal } from "./test-result-modal"
import { Paper, PaperHeader, StatusPill, Timestamp } from "./encounter-ui"

const KIND_ICON = {
  ecg: Activity,
  imaging: ScanLine,
  lab: FlaskConical,
  bedside: Stethoscope,
  procedure: Stethoscope,
} as const

function formatTurnaround(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} d`
  if (minutes >= 60) return `${Math.round((minutes / 60) * 10) / 10} h`
  return `${Math.round(minutes)} min`
}

// ── The menu (memoised: it must not re-render on every clock tick) ──────────

interface CatalogListProps {
  tests: CatalogTest[]
  orderedIds: ReadonlySet<string>
  disabled: boolean
  turnaround: (testId: string) => number
  onOrder: (test: CatalogTest) => void
}

const CatalogList = memo(function CatalogList({ tests, orderedIds, disabled, turnaround, onOrder }: CatalogListProps) {
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <Search className="h-7 w-7 text-enc-line-strong" />
        <p className="mt-3 text-[14px] font-medium text-enc-ink">No tests match your search</p>
        <p className="mt-1 text-[13px] text-enc-ink-2">Try a shorter name, or clear the category.</p>
      </div>
    )
  }
  return (
    <ul>
      {tests.map((test) => {
        const Icon = KIND_ICON[test.kind] ?? FlaskConical
        const ordered = orderedIds.has(test.id)
        const blocked = disabled || (ordered && !test.repeatable)
        return (
          <li key={test.id} className="flex items-center gap-3 border-b border-enc-line px-4 py-3 last:border-b-0">
            <Icon className={cn("h-4 w-4 shrink-0", ordered ? "text-enc-line-strong" : "text-enc-ink-3")} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[14px] leading-tight font-medium", ordered ? "text-enc-ink-3" : "text-enc-ink")}>{test.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-enc-ink-3">
                <span className="capitalize">{test.category.replace("_", " ")}</span>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">~{formatTurnaround(turnaround(test.id))}</span>
              </p>
            </div>
            {ordered && !test.repeatable ? (
              <span className="inline-flex h-8 items-center gap-1 px-2 text-[12px] font-medium text-enc-ink-3">
                <Check className="h-3.5 w-3.5" /> Ordered
              </span>
            ) : (
              <button
                type="button"
                disabled={blocked}
                onClick={() => onOrder(test)}
                className="h-8 shrink-0 rounded-lg border border-brand-600 px-3.5 text-[12px] font-semibold text-brand-700 transition-colors outline-none hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:border-enc-line-strong disabled:text-enc-ink-3 disabled:hover:bg-transparent"
              >
                {ordered ? "Repeat" : "Order"}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
})

// ── Panel ───────────────────────────────────────────────────────────────────

export function SimulationInvestigations() {
  const { config, events, now, actions, isExpired } = useClinicalEvents()
  const { toast } = useToast()

  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<TestCategory | "all">("all")
  const [viewing, setViewing] = useState<InvestigationOrder | null>(null)

  const orders = useMemo(() => listOrders(events), [events])
  const orderedIds = useMemo(() => new Set(orders.map((o) => o.testId)), [orders])
  const tests = useMemo(() => listOrderableTests(config, query, category), [config, query, category])
  const totalTests = useMemo(() => listOrderableTests(config).length, [config])
  const categories = useMemo(() => orderableCategories(config), [config])
  const turnaround = useMemo(() => (testId: string) => turnaroundMinutes(config, testId), [config])

  const handleOrder = useMemo(
    () => (test: CatalogTest) => {
      const order = actions.orderTest(test.id)
      if (order) {
        toast({
          title: `${test.name} ordered`,
          description: `Result in about ${formatTurnaround(turnaroundMinutes(config, test.id))}.`,
          duration: 2500,
        })
      }
    },
    [actions, config, toast]
  )

  const pending = orders.filter((o) => !isResultReady(config, o, now)).length

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-5 bg-enc-desk p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1">
      {/* ── Order entry ─────────────────────────────────────────────── */}
      <Paper className="flex min-h-0 flex-col overflow-hidden">
        <PaperHeader title="Order investigations" description={`${totalTests} ${totalTests === 1 ? "test" : "tests"} available. Order what will change your next decision.`} />
        <div className="shrink-0 space-y-3 border-b border-enc-line p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-enc-ink-3" />
            <input
              placeholder={`Search ${totalTests} tests…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search investigations"
              className="h-10 w-full rounded-lg border border-enc-line-strong bg-enc-sheet pr-3 pl-9 text-[14px] text-enc-ink transition outline-none placeholder:text-enc-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <div className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto px-1">
            {[{ id: "all" as const, label: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
                  category === c.id ? "bg-enc-fill text-white" : "text-enc-ink-2 hover:bg-enc-console"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
          <CatalogList tests={tests} orderedIds={orderedIds} disabled={isExpired} turnaround={turnaround} onOrder={handleOrder} />
        </div>
      </Paper>

      {/* ── Worklist ────────────────────────────────────────────────── */}
      <Paper className="flex max-h-[42vh] min-h-0 flex-col overflow-hidden lg:max-h-none">
        <PaperHeader
          title="Worklist"
          description={pending > 0 ? `${pending} pending` : orders.length > 0 ? "All results are back" : undefined}
          actions={<span className="rounded-md bg-enc-console px-1.5 py-0.5 text-[11px] font-semibold text-enc-ink-2 tabular-nums">{orders.length}</span>}
        />
        <div className="min-h-0 flex-1 overflow-y-auto bg-enc-desk/60 p-3" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <Inbox className="h-7 w-7 text-enc-line-strong" />
              <p className="mt-3 text-[14px] font-medium text-enc-ink">Nothing ordered yet</p>
              <p className="mt-1 text-[13px] leading-snug text-enc-ink-2">Orders appear here with a countdown, then as ready results.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {[...orders].reverse().map((order) => {
                const ready = isResultReady(config, order, now)
                const interpreted = interpretationFor(events, order) !== undefined
                const revealed = isRevealed(events, order)
                const left = Math.max(0, readyAt(config, order) - now)
                return (
                  <li key={order.key} className={cn("rounded-lg border bg-enc-sheet p-3 shadow-enc-sheet", ready ? "border-enc-ok/30" : "border-enc-line")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14px] leading-tight font-medium text-enc-ink">{order.testName}</p>
                      {ready ? (
                        <StatusPill tone="ok" icon={<Check className="h-3 w-3" />}>
                          Ready
                        </StatusPill>
                      ) : (
                        <StatusPill tone="warn" icon={<Loader2 className="h-3 w-3 animate-spin" />}>
                          {formatClock(left)}
                        </StatusPill>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-enc-ink-3">
                      Ordered <Timestamp>{formatClock(order.orderedAt)}</Timestamp>
                    </p>
                    {ready && (
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setViewing(order)}
                          className="h-8 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white transition-colors outline-none hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
                        >
                          View result
                        </button>
                        <span className="text-[11px] text-enc-ink-3">{revealed ? "Expert read revealed" : interpreted ? "Interpreted" : "Not yet interpreted"}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Paper>

      <TestResultModal isOpen={viewing !== null} onClose={() => setViewing(null)} test={null} result={null} simulationOrder={viewing} />
    </div>
  )
}
