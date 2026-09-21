"use client"

// The case library: a worklist of patients. Filters on the left (specialty, difficulty, progress), a
// search and a sort above, one row per case. Everything it does to the list (what matches, what order,
// what the counts beside each filter say) is in lib/library/case-library.ts and is tested there.

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bookmark, ChevronDown, Search, SearchX, X } from "lucide-react"
import type { CaseMetadata } from "@/data/cases"
import { cn } from "@/lib/utils"
import {
  activeFilterCount,
  DIFFICULTY_LABEL,
  facetCounts,
  filterCases,
  isNewCase,
  pinFirst,
  NO_FILTERS,
  SORT_LABEL,
  sortCases,
  summarise,
  type DifficultyLevel,
  type Filters,
  type LibraryCase,
  type ProgressMap,
  type SortKey,
  type StatusFilter,
} from "@/lib/library/case-library"
import { Button } from "@/components/ui/button"
import { Eyebrow, Paper } from "@/components/cases/encounter-ui"
import { mergeQuery, queryFromView, viewFromParams } from "@/lib/library/library-url"
import { useInProgress } from "@/components/cases/use-in-progress"
import { useSavedCases } from "@/components/cases/use-saved-cases"
import { CaseRow } from "./case-row"
import { LibrarySkeleton } from "./skeletons"
import { PageContainer, PageHeader, SECONDARY_BUTTON } from "./dashboard-ui"
import { specialtyIcon } from "./specialty-icon"

const PAGE = 20

const STATUS_LABEL: Record<StatusFilter, string> = { all: "All cases", new: "Not started", attempted: "Attempted" }

// ── The filter list ─────────────────────────────────────────────────────────

function Option({ active, disabled, onClick, icon, label, count }: { active: boolean; disabled?: boolean; onClick: () => void; icon?: React.ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled && !active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-40",
        active ? "bg-enc-sheet font-medium text-enc-ink shadow-enc-sheet ring-1 ring-enc-line" : "text-enc-ink-2 hover:bg-enc-console disabled:hover:bg-transparent"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      <span className="font-mono text-[12px] text-enc-ink-3 tabular-nums">{count}</span>
    </button>
  )
}

function Dots({ level }: { level: number }) {
  return (
    <span aria-hidden className="inline-flex w-4 items-center gap-[2px]">
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn("h-1 w-1 rounded-full", n <= level ? "bg-enc-ink-2" : "bg-enc-line-strong")} />
      ))}
    </span>
  )
}

function FilterRail({ facets, filters, set, hasProgress, savedCount }: { facets: ReturnType<typeof facetCounts>; filters: Filters; set: (patch: Partial<Filters>) => void; hasProgress: boolean; savedCount: number }) {
  const total = facets.specialties.reduce((n, s) => n + s.count, 0)
  return (
    <div className="space-y-7">
      <section aria-label="Specialty">
        <Eyebrow className="px-2.5">Specialty</Eyebrow>
        <div className="mt-2 space-y-0.5">
          <Option active={filters.specialty === "all"} onClick={() => set({ specialty: "all" })} label="All specialties" count={total} />
          {facets.specialties.map((s) => {
            const Icon = specialtyIcon(s.name)
            return <Option key={s.name} active={filters.specialty === s.name} disabled={s.count === 0} onClick={() => set({ specialty: filters.specialty === s.name ? "all" : s.name })} icon={<Icon className="h-3.5 w-3.5 shrink-0 text-enc-ink-3" strokeWidth={1.8} />} label={s.name} count={s.count} />
          })}
        </div>
      </section>

      <section aria-label="Difficulty">
        <Eyebrow className="px-2.5">Difficulty</Eyebrow>
        <div className="mt-2 space-y-0.5">
          {([1, 2, 3] as DifficultyLevel[]).map((level) => (
            <Option key={level} active={filters.difficulty === level} disabled={facets.difficulty[level] === 0} onClick={() => set({ difficulty: filters.difficulty === level ? 0 : level })} icon={<Dots level={level} />} label={DIFFICULTY_LABEL[level]} count={facets.difficulty[level]} />
          ))}
        </div>
      </section>

      {(hasProgress || savedCount > 0 || filters.saved) && (
        <section aria-label="Progress">
          <Eyebrow className="px-2.5">Progress</Eyebrow>
          <div className="mt-2 space-y-0.5">
            {hasProgress &&
              (["all", "new", "attempted"] as StatusFilter[]).map((status) => (
                <Option key={status} active={filters.status === status} disabled={facets.status[status] === 0} onClick={() => set({ status })} label={STATUS_LABEL[status]} count={facets.status[status]} />
              ))}
            {(savedCount > 0 || filters.saved) && (
              <Option active={!!filters.saved} onClick={() => set({ saved: !filters.saved })} icon={<Bookmark className="h-3.5 w-3.5 shrink-0 text-enc-ink-3" strokeWidth={1.8} />} label="Saved" count={savedCount} />
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// Where there is no room for the side rail (under 1280 px) the same filters are two rows of chips under the search, one thumb-swipe each.
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-300",
        active ? "border-enc-ink bg-enc-sheet font-medium text-enc-ink" : "border-enc-line-strong bg-enc-sheet text-enc-ink-2"
      )}
    >
      {children}
    </button>
  )
}

function MobileFilters({ facets, filters, set, hasProgress, savedCount }: { facets: ReturnType<typeof facetCounts>; filters: Filters; set: (patch: Partial<Filters>) => void; hasProgress: boolean; savedCount: number }) {
  const scroller = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 [&::-webkit-scrollbar]:hidden"
  return (
    <div className="mt-4 space-y-2 xl:hidden">
      <div className={scroller}>
        <Chip active={filters.specialty === "all"} onClick={() => set({ specialty: "all" })}>
          All
        </Chip>
        {facets.specialties.map((s) => (
          <Chip key={s.name} active={filters.specialty === s.name} onClick={() => set({ specialty: filters.specialty === s.name ? "all" : s.name })}>
            {s.name}
            <span className="font-mono text-[11.5px] text-enc-ink-3">{s.count}</span>
          </Chip>
        ))}
      </div>
      <div className={scroller}>
        {([1, 2, 3] as DifficultyLevel[]).map((level) => (
          <Chip key={level} active={filters.difficulty === level} onClick={() => set({ difficulty: filters.difficulty === level ? 0 : level })}>
            <Dots level={level} />
            {DIFFICULTY_LABEL[level]}
          </Chip>
        ))}
        {hasProgress &&
          (["new", "attempted"] as StatusFilter[]).map((status) => (
            <Chip key={status} active={filters.status === status} onClick={() => set({ status: filters.status === status ? "all" : status })}>
              {STATUS_LABEL[status]}
            </Chip>
          ))}
        {(savedCount > 0 || filters.saved) && (
          <Chip active={!!filters.saved} onClick={() => set({ saved: !filters.saved })}>
            <Bookmark className="h-3.5 w-3.5" strokeWidth={1.9} />
            Saved
            <span className="font-mono text-[11.5px] text-enc-ink-3">{savedCount}</span>
          </Chip>
        )}
      </div>
    </div>
  )
}

// ── The screen ──────────────────────────────────────────────────────────────

export function PracticeCases({ initialCases, progress = {}, userId }: { initialCases?: CaseMetadata[]; progress?: ProgressMap; userId?: string }) {
  const [cases, setCases] = useState<LibraryCase[]>(initialCases ?? [])
  const [loading, setLoading] = useState(!initialCases)
  const [error, setError] = useState<string | null>(null)
  // The filters start from the address: a shared link, or Back from a case, opens the same list.
  const urlParams = useSearchParams()
  const [initialView] = useState(() => viewFromParams(urlParams, (initialCases ?? []).map((c) => c.category)))
  const [filters, setFilters] = useState<Filters>(initialView.filters)
  const [sort, setSort] = useState<SortKey>(initialView.sort)
  const [visible, setVisible] = useState(PAGE)
  const search = useRef<HTMLInputElement>(null)

  // The server normally hands the list over; if it did not, fetch it.
  useEffect(() => {
    if (initialCases && initialCases.length > 0) {
      setLoading(false)
      return
    }
    fetch("/api/cases")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to fetch cases"))))
      .then((data: LibraryCase[]) => setCases(data))
      .catch((err) => {
        console.error("Error fetching cases:", err)
        setError("Failed to load cases. Please try again later.")
      })
      .finally(() => setLoading(false))
  }, [initialCases])

  // "/" jumps to the search box, as in most tools built for people who use them all day.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setVisible(PAGE)
  }
  const clear = () => {
    setFilters(NO_FILTERS)
    setVisible(PAGE)
  }

  // ...and the address follows the filters. It is replaced, not added to, so the Back button still leaves the
  // library instead of stepping through every letter typed; anything else in the address is kept.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = mergeQuery(window.location.search, queryFromView({ filters, sort }))
      const url = window.location.pathname + (query ? `?${query}` : "")
      if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [filters, sort])

  const hasProgress = Object.values(progress).some((p) => p.attempts > 0)
  const { saved, toggle: toggleSaved } = useSavedCases(userId)
  const savedCount = useMemo(() => cases.filter((c) => saved.has(c.id)).length, [cases, saved])
  const [now] = useState(() => Date.now())
  const summary = useMemo(() => summarise(cases, progress), [cases, progress])
  const facets = useMemo(() => facetCounts(cases, filters, progress, saved), [cases, filters, progress, saved])
  const sorted = useMemo(() => sortCases(filterCases(cases, filters, progress, saved), sort, progress), [cases, filters, progress, saved, sort])
  // What the student has started on this device and not finished goes to the top of "recommended": it is the thing to do next.
  const inProgress = useInProgress(useMemo(() => cases.map((c) => c.id), [cases]))
  const results = useMemo(() => (sort === "recommended" ? pinFirst(sorted, new Set(inProgress.keys())) : sorted), [sorted, sort, inProgress])
  const active = activeFilterCount(filters)

  if (loading) return <LibrarySkeleton />

  if (error) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Case library" title="Practice cases" />
        <Paper className="mt-8 p-8 text-center">
          <p className="text-[15px] font-medium text-enc-ink">Cases could not be loaded</p>
          <p className="mt-1 text-[14px] text-enc-ink-2">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className={cn(SECONDARY_BUTTON, "mt-4")}>
            Try again
          </Button>
        </Paper>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Case library"
        title="Practice cases"
        description="Choose a patient. Every title describes the patient, not the diagnosis, so nothing is given away."
        actions={
          <p className="text-[12.5px] text-enc-ink-3">
            <span className="font-mono text-enc-ink-2 tabular-nums">{summary.total}</span> cases · <span className="font-mono text-enc-ink-2 tabular-nums">{summary.specialties}</span> specialties
            {hasProgress && (
              <>
                {" "}
                · <span className="font-mono text-enc-ink-2 tabular-nums">{summary.attempted}</span> tried
              </>
            )}
          </p>
        }
      />

      {/* Search and sort */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search cases</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-enc-ink-3" strokeWidth={1.9} />
          <input
            ref={search}
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search by symptom or specialty"
            className="h-11 w-full rounded-lg border border-enc-line-strong bg-enc-sheet pr-14 pl-10 text-[14px] text-enc-ink transition-colors outline-none placeholder:text-enc-ink-3 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query ? (
            <button type="button" onClick={() => set({ query: "" })} aria-label="Clear search" className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-enc-ink-3 hover:bg-enc-console hover:text-enc-ink">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded border border-enc-line-strong bg-enc-desk px-1 font-mono text-[11px] text-enc-ink-3 sm:flex">/</kbd>
          )}
        </label>

        <label className="relative block sm:w-[214px]">
          <span className="sr-only">Sort cases</span>
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[12.5px] text-enc-ink-3">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey)
              setVisible(PAGE)
            }}
            className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-enc-line-strong bg-enc-sheet pr-9 pl-12 text-[14px] text-enc-ink transition-colors outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-enc-ink-3" />
        </label>
      </div>

      <MobileFilters facets={facets} filters={filters} set={set} hasProgress={hasProgress} savedCount={savedCount} />

      <div className="mt-6 grid gap-7 lg:mt-8 xl:grid-cols-[204px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-8">
            <FilterRail facets={facets} filters={filters} set={set} hasProgress={hasProgress} savedCount={savedCount} />
          </div>
        </aside>

        <section aria-label="Cases" className="@container min-w-0">
          <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
            <Eyebrow>{results.length === cases.length ? `${cases.length} ${cases.length === 1 ? "case" : "cases"}` : `${results.length} of ${cases.length} cases`}</Eyebrow>
            {active > 0 && (
              <button type="button" onClick={clear} className="text-[13px] font-medium text-brand-700 hover:text-brand-800 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <Paper className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-enc-console text-enc-ink-3">
                <SearchX className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h2 className="mt-4 text-[16px] font-semibold text-enc-ink">No cases match</h2>
              <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-enc-ink-2">
                {filters.saved && savedCount === 0
                  ? "You have not saved any cases yet. Use the bookmark on a case to keep it here."
                  : filters.query.trim()
                    ? `Nothing matches "${filters.query.trim()}" with these filters. Try fewer words, or clear the filters.`
                    : "No case fits all of these filters. Try loosening one."}
              </p>
              <Button onClick={clear} variant="outline" className={cn(SECONDARY_BUTTON, "mt-5")}>
                Clear filters
              </Button>
            </Paper>
          ) : (
            <>
              <ul className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
                {results.slice(0, visible).map((c) => (
                  <CaseRow key={c.id} c={c} progress={progress[c.id]} inProgress={inProgress.get(c.id)} isNew={isNewCase(c, progress, now)} saved={saved.has(c.id)} onToggleSaved={toggleSaved} />
                ))}
              </ul>
              {results.length > visible && (
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => setVisible((v) => v + PAGE)} variant="outline" className={SECONDARY_BUTTON}>
                    Show more <span className="font-mono text-enc-ink-3 tabular-nums">({results.length - visible} more)</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageContainer>
  )
}
