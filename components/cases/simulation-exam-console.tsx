"use client"

// The bedside examination. Two sheets on the desk:
//
//   Manoeuvres   what you can examine, grouped by region, ticked once done
//   Findings     what you saw, as clinical notes: newest first, labelled findings in a
//                two-column list so a long examination reads at a glance
//
// Each manoeuvre returns findings authored by the case and resolved against the
// patient RIGHT NOW: examine the chest again after the patient deteriorates and the
// findings have changed. Every manoeuvre is an EXAM_PERFORMED event carrying what
// the student actually saw.

import { useEffect, useMemo, useRef, useState } from "react"
import { Brain, Check, ClipboardList, Eye, Footprints, Hand, Heart, Wind } from "lucide-react"
import { cn } from "@/lib/utils"
import { figureFor, isFemale } from "@/lib/simulation/appearance"
import { formatClock, type EventOf } from "@/lib/simulation/encounter-events"
import type { ExamRegion } from "@/lib/simulation/case-schema"
import { useLiveVitals } from "./bedside-patient-rail"
import { BodyPointCloud, type BodyFlash } from "./body-point-cloud"
import { useClinicalEvents } from "./clinical-event-manager"
import { Eyebrow, Paper, PaperHeader, Timestamp } from "./encounter-ui"

const REGIONS: Array<{ id: ExamRegion; label: string; icon: typeof Heart }> = [
  { id: "general", label: "General", icon: Eye },
  { id: "cardiovascular", label: "Cardiovascular", icon: Heart },
  { id: "respiratory", label: "Respiratory", icon: Wind },
  { id: "abdomen", label: "Abdomen", icon: Hand },
  { id: "extremities", label: "Limbs and perfusion", icon: Footprints },
  { id: "neuro", label: "Neurological", icon: Brain },
]

/** "Pallor: Mild pallor present" → a labelled finding; anything else stays a sentence. */
function parseFindings(text: string): Array<{ label: string; value: string } | { text: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:.]{1,42}):\s+(.+)$/)
      return m ? { label: m[1], value: m[2] } : { text: line }
    })
}

function FindingsBody({ text }: { text: string }) {
  const lines = parseFindings(text)
  const labelled = lines.filter((l): l is { label: string; value: string } => "label" in l)
  // A few labelled lines among sentences would read oddly as a table: use the list only when it is mostly labelled.
  if (labelled.length >= 2 && labelled.length >= lines.length * 0.6) {
    return (
      <dl className="mt-2.5 grid grid-cols-[minmax(96px,132px)_1fr] gap-x-4 gap-y-1.5 text-[14px] leading-snug">
        {lines.map((l, i) =>
          "label" in l ? (
            <div key={i} className="contents">
              <dt className="text-enc-ink-3">{l.label}</dt>
              <dd className="text-enc-ink">{l.value}</dd>
            </div>
          ) : (
            <dd key={i} className="col-span-2 text-enc-ink">
              {l.text}
            </dd>
          )
        )}
      </dl>
    )
  }
  return <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line text-enc-ink">{text}</p>
}

export function SimulationExamConsole() {
  const { config, caseData, events, actions, isExpired } = useClinicalEvents()
  const [latest, setLatest] = useState<number | null>(null)

  const manoeuvres = config.examination ?? []
  const labels = useMemo(() => new Map(manoeuvres.map((m) => [m.id, m.label])), [manoeuvres])
  const log = useMemo(
    () => events.map((e, index) => ({ e, index })).filter((x): x is { e: EventOf<"EXAM_PERFORMED">; index: number } => x.e.type === "EXAM_PERFORMED").reverse(),
    [events]
  )
  const doneAt = useMemo(() => {
    const m = new Map<string, number>()
    for (const { e } of log) if (!m.has(e.manoeuvre)) m.set(e.manoeuvre, e.timestamp)
    return m
  }, [log])

  const perform = (id: string) => {
    const findings = actions.performExam(id)
    if (findings !== null) setLatest(events.length)
  }

  // ── The body beside the list ──────────────────────────────────────────
  const figure = figureFor(caseData.patient?.age, caseData.patient?.gender)
  const vitals = useLiveVitals()
  const unmeasured = new Set<string>(config.initial_state?.unmeasured ?? [])
  const regionOf = useMemo(() => new Map(manoeuvres.map((m) => [m.id, m.region])), [manoeuvres])
  const offered = useMemo(() => new Set(manoeuvres.map((m) => m.region)), [manoeuvres])
  const examinedRegions = useMemo(() => new Set([...doneAt.keys()].map((id) => regionOf.get(id)).filter((r): r is ExamRegion => !!r)), [doneAt, regionOf])
  const newest = log[0]
  const flash = useMemo<BodyFlash | null>(() => {
    const region = newest && regionOf.get(newest.e.manoeuvre)
    return region ? { region, key: newest.index } : null
  }, [newest, regionOf])

  const [bodyHover, setBodyHover] = useState<ExamRegion | null>(null)
  const [listHover, setListHover] = useState<ExamRegion | null>(null)
  const [focused, setFocused] = useState<ExamRegion | null>(null)
  const sectionRefs = useRef(new Map<ExamRegion, HTMLElement>())
  useEffect(() => {
    if (!focused) return
    const timer = setTimeout(() => setFocused(null), 1600)
    return () => clearTimeout(timer)
  }, [focused])
  const select = (region: ExamRegion) => {
    sectionRefs.current.get(region)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setFocused(region)
  }
  const countIn = (region: ExamRegion) => manoeuvres.filter((m) => m.region === region).length
  const labelOf = (region: ExamRegion) => REGIONS.find((r) => r.id === region)?.label ?? region

  if (manoeuvres.length === 0) {
    return <div className="flex h-full items-center justify-center bg-enc-desk p-8 text-center text-[14px] text-enc-ink-2">This case has no bedside examination.</div>
  }

  return (
    <div className="@container h-full overflow-y-auto bg-enc-desk" style={{ scrollbarWidth: "thin" }} data-lenis-prevent>
      {/* One column on a phone; list and findings side by side with the body across the top; and,
          when the workspace itself is wide enough, the body standing on its own column at the left. */}
      <div className="mx-auto grid max-w-[1080px] gap-5 p-5 lg:items-start lg:@max-5xl:grid-cols-[minmax(300px,380px)_1fr] @5xl:max-w-[1360px] @5xl:grid-cols-[minmax(240px,290px)_minmax(280px,360px)_1fr]">
        {/* ── The body ────────────────────────────────────────────── */}
        <Paper className="overflow-hidden lg:@max-5xl:col-span-2 @5xl:sticky @5xl:top-5">
          <PaperHeader title="Patient" description="Point at a region to find it in the list. Drag to turn." />
          <div className="relative bg-[radial-gradient(ellipse_at_center,var(--color-enc-console)_0%,transparent_70%)]">
            <BodyPointCloud
              className="h-[300px] @5xl:h-[480px]"
              regions={offered}
              examined={examinedRegions}
              active={listHover}
              flash={flash}
              heartRate={unmeasured.has("hr") ? null : vitals.hr}
              respiratoryRate={unmeasured.has("rr") ? null : vitals.rr}
              female={figure === "adult_f"}
              child={figure === "infant" || figure === "toddler" || figure === "child"}
              labelFor={labelOf}
              countFor={countIn}
              onHover={setBodyHover}
              onSelect={select}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-enc-line px-3 py-2.5">
            {REGIONS.filter((r) => offered.has(r.id)).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => select(id)}
                onMouseEnter={() => setListHover(id)}
                onMouseLeave={() => setListHover(null)}
                onFocus={() => setListHover(id)}
                onBlur={() => setListHover(null)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors outline-none",
                  bodyHover === id || listHover === id ? "border-brand-400 bg-brand-50 text-brand-700" : "border-enc-line text-enc-ink-2 hover:border-brand-300",
                  examinedRegions.has(id) && "text-enc-ok"
                )}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </Paper>

        {/* ── Manoeuvres ──────────────────────────────────────────── */}
        <Paper className="overflow-hidden">
          <PaperHeader title="Examine" description="Choose what to examine. Findings reflect the patient as they are right now." />
          <div>
            {REGIONS.map(({ id, label, icon: Icon }) => {
              const inRegion = manoeuvres.filter((m) => m.region === id)
              if (inRegion.length === 0) return null
              return (
                <section
                  key={id}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(id, el)
                    else sectionRefs.current.delete(id)
                  }}
                  className="scroll-mt-5"
                  onMouseEnter={() => setListHover(id)}
                  onMouseLeave={() => setListHover(null)}
                >
                  <Eyebrow
                    className={cn(
                      "flex items-center gap-1.5 border-b border-enc-line bg-enc-desk px-4 py-2 transition-colors duration-500",
                      (focused === id || bodyHover === id) && "bg-brand-50 text-brand-700"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </Eyebrow>
                  <ul>
                    {inRegion.map((m) => {
                      const at = doneAt.get(m.id)
                      const done = at !== undefined
                      return (
                        <li key={m.id} className="border-b border-enc-line last:border-b-0">
                          <button
                            type="button"
                            disabled={isExpired}
                            onClick={() => perform(m.id)}
                            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-brand-50/50 focus-visible:bg-brand-50/50 disabled:opacity-50"
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                done ? "border-enc-ok bg-enc-ok text-white" : "border-enc-line-strong text-transparent group-hover:border-brand-400"
                              )}
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <span className="flex-1 text-[14px] font-medium text-enc-ink">{m.label}</span>
                            {done ? (
                              <span className="flex items-center gap-2 text-[12px] text-enc-ink-3">
                                <Timestamp>{formatClock(at)}</Timestamp>
                                <span className="font-medium text-brand-700">Repeat</span>
                              </span>
                            ) : (
                              <span className="text-[12px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Examine</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </Paper>

        {/* ── Findings ────────────────────────────────────────────── */}
        <Paper className="overflow-hidden">
          <PaperHeader
            title="Findings"
            description="Your examination notes, newest first."
            actions={<span className="rounded-md bg-enc-console px-1.5 py-0.5 text-[11px] font-semibold text-enc-ink-2 tabular-nums">{log.length}</span>}
          />
          {log.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <ClipboardList className="h-8 w-8 text-enc-line-strong" />
              <p className="mt-3 text-[14px] font-medium text-enc-ink">Nothing examined yet</p>
              <p className="mt-1 max-w-[260px] text-[13px] leading-snug text-enc-ink-2">What you examine is recorded here, with the time you did it.</p>
            </div>
          ) : (
            <ol className="divide-y divide-enc-line">
              {log.map(({ e, index }, i) => (
                <li key={index} className={cn("px-4 py-4", i === 0 && latest !== null && "border-l-2 border-brand-600 bg-brand-50/30 pl-[14px]")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-enc-ink">{labels.get(e.manoeuvre) ?? e.manoeuvre}</h3>
                    <Timestamp>{formatClock(e.timestamp)}</Timestamp>
                  </div>
                  <FindingsBody text={e.findings} />
                </li>
              ))}
            </ol>
          )}
        </Paper>
      </div>
    </div>
  )
}
