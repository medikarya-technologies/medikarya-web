"use client"

// The briefing before the bedside: who is waiting, how they look, what they came with, and the
// numbers taken on arrival. It is drawn from the same surfaces as the encounter that follows
// (the dark monitor for the vitals, the white sheet for the record, the desk behind them), and the
// portrait is the one the bedside rail will show, resolved from the same appearance, so the student
// meets the same person before and after pressing Start.

import { useMemo } from "react"
import { cn, formatPatientAge } from "@/lib/utils"
import { appearanceAtArrival } from "@/lib/simulation/arrival"
import { formatClock } from "@/lib/simulation/clock-format"
import { relativeDay } from "@/lib/library/relative-day"
import { Button } from "@/components/ui/button"
import { Eye, FileText, Loader2, Play } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Eyebrow, Paper, StatusPill } from "./encounter-ui"
import { PatientPortrait } from "./patient-portrait"

interface Reading {
  value?: number | null
  note?: string
  unit?: string
}

interface PatientCardProps {
  patient: {
    name: string
    age: number
    gender: string
    mrn?: string | null
    admissionDate?: string | null
    chiefComplaint: string
    vitalSigns?: {
      bloodPressure?: { systolic?: number | null; diastolic?: number | null; unit?: string; note?: string }
      heartRate?: Reading
      temperature?: Reading
      respiratoryRate?: Reading
      oxygenSaturation?: Reading
    }
    allergies?: string[]
    currentMedications?: string[]
  }
  caseTitle: string
  onStartCase: () => void
  /** The whole case. The card reads how the patient looks, and where they are seen, from it. */
  caseData?: any
  /** True while the encounter is being prepared: the card locks and says so. */
  starting?: boolean
  /** The student has already started this case on this device: the button resumes it, and can offer to start over. */
  resume?: { elapsedSeconds: number; savedAt?: number }
  onStartOver?: () => void
}

interface Cell {
  key: string
  label: string
  unit: string
  text: string
  value: string | null
  note?: string
  className: string
}

const has = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n)

function arrivalCells(v: NonNullable<PatientCardProps["patient"]["vitalSigns"]>): Cell[] {
  const bp = v.bloodPressure
  return [
    { key: "hr", label: "HR", unit: "bpm", text: "text-enc-ecg", value: has(v.heartRate?.value) ? String(v.heartRate!.value) : null, note: v.heartRate?.note, className: "" },
    { key: "spo2", label: "SpO₂", unit: "%", text: "text-enc-spo2", value: has(v.oxygenSaturation?.value) ? String(v.oxygenSaturation!.value) : null, note: v.oxygenSaturation?.note, className: "border-l border-enc-scope-line" },
    {
      key: "bp",
      label: "NIBP",
      unit: "mmHg",
      text: "text-enc-nibp",
      value: has(bp?.systolic) && has(bp?.diastolic) ? `${bp!.systolic}/${bp!.diastolic}` : null,
      note: bp?.note,
      className: "col-span-2 border-t border-enc-scope-line sm:col-span-1 sm:border-t-0 sm:border-l",
    },
    { key: "rr", label: "RR", unit: "/min", text: "text-enc-rr", value: has(v.respiratoryRate?.value) ? String(v.respiratoryRate!.value) : null, note: v.respiratoryRate?.note, className: "border-t border-enc-scope-line sm:border-t-0 sm:border-l" },
    { key: "temp", label: "Temp", unit: v.temperature?.unit === "°F" ? "°F" : "°C", text: "text-enc-nibp", value: has(v.temperature?.value) ? String(v.temperature!.value) : null, note: v.temperature?.note, className: "border-t border-l border-enc-scope-line sm:border-t-0" },
  ]
}

// The time is the one the case was written with, not the viewer's local time: a simulated patient
// does not arrive at a different hour for a student in another time zone.
function arrivedAt(admissionDate: string | null | undefined): string | null {
  if (!admissionDate) return null
  const d = new Date(admissionDate)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
}

// "MRN-2024-003" already says what it is; "ED-0417-58" does not.
const mrnLabel = (mrn: string): string => (/^mrn/i.test(mrn.trim()) ? mrn.trim() : `MRN ${mrn.trim()}`)

export function PatientCard({ patient, caseTitle, onStartCase, caseData, starting = false, resume, onStartOver }: PatientCardProps) {
  // Stable between renders (the portrait is memoised on its look), and the card's own `patient`
  // wins over the case's, so what is printed and what is drawn come from the same record.
  const arrival = useMemo(() => appearanceAtArrival({ ...(caseData ?? {}), patient: { ...(caseData?.patient ?? {}), ...patient } }), [caseData, patient])
  const cells = patient.vitalSigns ? arrivalCells(patient.vitalSigns) : []
  const allergies = patient.allergies ?? []
  const medications = patient.currentMedications ?? []
  const setting: string | undefined = caseData?.setting
  const arrived = arrivedAt(patient.admissionDate)
  const age = formatPatientAge(patient.age).replace(/ old/g, "")

  return (
    <div className="relative animate-in space-y-6 fade-in duration-500">
      <header className="space-y-1.5">
        <Eyebrow>Case briefing</Eyebrow>
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] text-enc-ink sm:text-[30px]">{caseTitle}</h1>
        <p className="text-[15px] leading-snug text-enc-ink-2">Take a first look at the patient, then start the case when you are ready.</p>
      </header>

      <Paper className="overflow-hidden">
        {/* ── Who ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 p-4 sm:grid-cols-[176px_1fr] sm:gap-x-6 sm:p-5">
          <PatientPortrait
            persona={arrival.persona}
            look={arrival.look}
            rr={arrival.rr}
            label={arrival.observation || patient.name}
            className="h-[104px] w-[104px] overflow-hidden rounded-xl ring-1 ring-enc-line sm:row-span-2 sm:h-[176px] sm:w-[176px]"
          />

          <div className="min-w-0 self-center sm:self-start">
            <h2 className="text-[20px] leading-tight font-semibold text-enc-ink sm:text-[24px]">{patient.name}</h2>
            <p className="mt-1 text-[14px] text-enc-ink-2">
              {age} · {patient.gender}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-enc-ink-3">
              {patient.mrn && <span className="font-mono">{mrnLabel(patient.mrn)}</span>}
              {setting && <span>{setting}</span>}
              {arrived && <span>Arrived {arrived}</span>}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Eyebrow>Presenting complaint</Eyebrow>
            <p className="mt-1.5 border-l-2 border-enc-line-strong pl-3 text-[16px] leading-relaxed text-enc-ink">{patient.chiefComplaint}</p>
          </div>
        </div>

        {/* ── First look ──────────────────────────────────────────────── */}
        {arrival.observation && (
          <div className="flex gap-2.5 border-t border-enc-line bg-enc-desk px-4 py-3 sm:px-5">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-enc-ink-3" aria-hidden />
            <p className="text-[14px] leading-snug text-enc-ink-2 italic">
              <span className="mr-1.5 text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase not-italic">First look</span>{" "}
              {arrival.observation}
            </p>
          </div>
        )}

        {/* ── Vitals on arrival: the monitor's surface, not live yet ──── */}
        {cells.length > 0 && (
          <section aria-label="Vital signs on arrival" className="bg-enc-scope text-enc-nibp">
            <p className="px-4 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.12em] text-enc-scope-dim uppercase sm:px-5">Vitals on arrival</p>
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {cells.map((c) => (
                <div key={c.key} className={cn("px-4 py-2.5 sm:px-5", c.className)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10.5px] font-semibold tracking-[0.1em] text-enc-scope-dim uppercase">{c.label}</span>
                    <span className="text-[10.5px] text-enc-scope-dim">{c.unit}</span>
                  </div>
                  <p className={cn("font-mono text-[28px] leading-[1.15] font-medium tabular-nums", c.value ? c.text : "text-enc-scope-dim")}>
                    {c.value ?? "—"}
                    {!c.value && <span className="sr-only">not recorded</span>}
                  </p>
                  {c.note && <p className="text-[10.5px] leading-snug text-enc-scope-dim">{c.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── The record ──────────────────────────────────────────────── */}
        <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-5">
          <section aria-label="Allergies">
            <Eyebrow>Allergies</Eyebrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allergies.length > 0 ? (
                allergies.map((a) => (
                  <StatusPill key={a} tone="crit" className="px-2 py-1 text-[12px]">
                    {a}
                  </StatusPill>
                ))
              ) : (
                <p className="text-[14px] text-enc-ink-2">No known allergies</p>
              )}
            </div>
          </section>

          <section aria-label="Current medications">
            <Eyebrow>Current medications</Eyebrow>
            {medications.length > 0 ? (
              <ul className="mt-2 divide-y divide-enc-line">
                {medications.map((m) => (
                  <li key={m} className="py-1.5 text-[14px] leading-snug text-enc-ink first:pt-0 last:pb-0">
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-enc-ink-2">No current medications</p>
            )}
          </section>
        </div>
      </Paper>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" className="h-11 w-full gap-2 rounded-lg border-enc-line-strong bg-enc-sheet text-[14px] font-medium text-enc-ink-2 hover:bg-enc-console hover:text-enc-ink sm:w-auto">
              <FileText className="h-4 w-4" />
              View guidelines
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Clinical guidelines</DialogTitle>
              <DialogDescription>Standard evaluation and management protocols.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-[14px] text-enc-ink-2">
              {GUIDELINES.map((g) => (
                <div key={g.title} className="rounded-lg border border-enc-line bg-enc-desk p-4">
                  <h4 className="mb-2 font-semibold text-enc-ink">{g.title}</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {g.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <Button
            size="lg"
            onClick={onStartCase}
            disabled={starting}
            className="h-11 w-full gap-2 rounded-lg bg-brand-600 px-6 text-[14px] font-semibold text-white shadow-none hover:bg-brand-700 sm:w-auto sm:min-w-[180px]"
          >
            <Play className="h-4 w-4" />
            {resume ? "Resume case" : "Start case"}
          </Button>
          {resume && (
            <p className="text-center text-[12.5px] text-enc-ink-3 sm:text-right" suppressHydrationWarning>
              You left off at <span className="font-mono tabular-nums">{formatClock(resume.elapsedSeconds)}</span>
              {resume.savedAt ? `, ${relativeDay(new Date(resume.savedAt).toISOString())}` : ""}.{" "}
              {onStartOver && (
                <button
                  type="button"
                  onClick={onStartOver}
                  disabled={starting}
                  className="rounded font-medium text-brand-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-50"
                >
                  Start over
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      {starting && (
        <div className="absolute inset-0 z-20 flex animate-in items-center justify-center rounded-xl bg-enc-desk/75 backdrop-blur-[2px] fade-in duration-300" role="status">
          <div className="flex items-center gap-3 rounded-lg border border-enc-line bg-enc-sheet px-4 py-3 shadow-enc-sheet">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            <div>
              <p className="text-[13px] leading-tight font-semibold text-enc-ink">Preparing simulation</p>
              <p className="text-[12px] leading-tight text-enc-ink-3">Going to the bedside…</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const GUIDELINES: Array<{ title: string; points: string[] }> = [
  {
    title: "General assessment",
    points: [
      "Assess airway, breathing, and circulation immediately upon presentation.",
      "Obtain a detailed history including onset, duration, and progression of symptoms.",
      "Perform a comprehensive physical examination with focus on the affected systems.",
    ],
  },
  {
    title: "Diagnostic approach",
    points: [
      "Order investigations based on clinical suspicion and pre-test probability.",
      "Avoid unnecessary testing to reduce cost and patient discomfort.",
      "Review vital signs and red flags before ruling out serious pathology.",
    ],
  },
  {
    title: "Management principles",
    points: [
      "Prioritize stabilization of unstable patients.",
      "Provide symptomatic relief while awaiting confirmatory diagnosis.",
      "Involve specialists early for complex or rapidly deteriorating cases.",
    ],
  },
]
