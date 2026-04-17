"use client"

import { cn } from "@/lib/utils"
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  AlertCircle,
  Pill,
  MessageSquare,
  FlaskConical,
  Clock,
  ChevronRight,
  ChevronLeft,
  User,
  CheckCircle2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ─── Types ───────────────────────────────────────────────────────────────────

interface VitalSigns {
  bloodPressure?: { systolic?: number; diastolic?: number; unit?: string }
  heartRate?: { value?: number; unit?: string }
  temperature?: { value?: number; unit?: string }
  respiratoryRate?: { value?: number; unit?: string }
  oxygenSaturation?: { value?: number; unit?: string }
}

interface PatientData {
  name: string
  age: number
  gender: string
  mrn?: string
  chiefComplaint: string
  vitalSigns?: VitalSigns
  allergies: string[]
  currentMedications: string[]
}

interface OrderedTest {
  id: string
  name: string
  duration?: string
  status?: string
}

export interface CaseSidebarProps {
  patient: PatientData
  activeTab: string
  historyGathered: string[]
  orderedTests: OrderedTest[]
  coverageScore: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  /** When true, renders in full-width mobile layout (larger text, 2-col vitals grid) */
  mobileLayout?: boolean
}

// ─── Vital dot logic ─────────────────────────────────────────────────────────

function getVitalDot(key: string, value: number): "green" | "amber" | "red" {
  switch (key) {
    case "hr":
      if (value > 120 || value < 60) return "red"
      return "green"
    case "temp":
      if (value > 39.0) return "red"
      if (value > 38.0 || value < 36.0) return "amber"
      return "green"
    case "spo2":
      if (value < 95) return "red"
      if (value < 97) return "amber"
      return "green"
    case "bp_sys":
      if (value > 160 || value < 80) return "red"
      if (value > 140 || value < 90) return "amber"
      return "green"
    case "rr":
      if (value > 40 || value < 10) return "red"
      if (value > 30 || value < 12) return "amber"
      return "green"
    default:
      return "green"
  }
}

const DOT_CLASSES = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-rose-500",
}

const DOT_TEXT_CLASSES = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-rose-700",
}

const DOT_BG_CLASSES = {
  green: "bg-emerald-50 border-emerald-200",
  amber: "bg-amber-50 border-amber-200",
  red: "bg-rose-50 border-rose-200",
}

function StatusDot({ color, size = "sm" }: { color: "green" | "amber" | "red"; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full flex-shrink-0",
        DOT_CLASSES[color],
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
      )}
    />
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionDivider() {
  return <div className="border-t border-slate-100" />
}

function SectionLabel({
  children,
  mobile,
}: {
  children: React.ReactNode
  mobile?: boolean
}) {
  return (
    <p
      className={cn(
        "font-semibold uppercase tracking-wider text-slate-400 px-4",
        mobile ? "text-xs pt-5 pb-2" : "text-[10px] pt-3 pb-1 px-3"
      )}
    >
      {children}
    </p>
  )
}

// ─── Vitals section — two different layouts ───────────────────────────────────

function VitalsDesktop({ vs }: { vs: VitalSigns | undefined }) {
  if (!vs) return <p className="text-[11px] text-slate-400 italic px-3 pb-2">No vitals recorded</p>

  const rows = [
    vs.bloodPressure?.systolic && {
      key: "bp_sys",
      value: vs.bloodPressure.systolic,
      icon: Heart,
      label: "BP",
      display: `${vs.bloodPressure.systolic}/${vs.bloodPressure.diastolic}`,
      unit: vs.bloodPressure.unit || "mmHg",
    },
    vs.heartRate?.value && {
      key: "hr",
      value: vs.heartRate.value,
      icon: Activity,
      label: "HR",
      display: String(vs.heartRate.value),
      unit: vs.heartRate.unit || "bpm",
    },
    vs.temperature?.value && {
      key: "temp",
      value: vs.temperature.value,
      icon: Thermometer,
      label: "Temp",
      display: String(vs.temperature.value),
      unit: vs.temperature.unit || "°C",
    },
    vs.respiratoryRate?.value && {
      key: "rr",
      value: vs.respiratoryRate.value,
      icon: Wind,
      label: "RR",
      display: String(vs.respiratoryRate.value),
      unit: "/min",
    },
    vs.oxygenSaturation?.value && {
      key: "spo2",
      value: vs.oxygenSaturation.value,
      icon: Droplets,
      label: "SpO₂",
      display: String(vs.oxygenSaturation.value),
      unit: "%",
    },
  ].filter(Boolean) as {
    key: string
    value: number
    icon: any
    label: string
    display: string
    unit: string
  }[]

  if (rows.length === 0)
    return <p className="text-[11px] text-slate-400 italic px-3 pb-2">No vitals recorded</p>

  return (
    <div className="px-3 pb-2 space-y-1.5">
      {rows.map((row) => {
        const color = getVitalDot(row.key, row.value)
        const Icon = row.icon
        return (
          <div key={row.key} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-500">
              <StatusDot color={color} />
              <Icon className="h-3 w-3" />
              <span>{row.label}</span>
            </div>
            <span className="font-medium text-slate-800">
              {row.display}{" "}
              <span className="text-slate-400 text-[10px]">{row.unit}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function VitalsMobile({ vs }: { vs: VitalSigns | undefined }) {
  if (!vs) return <p className="text-sm text-slate-400 italic px-4 pb-3">No vitals recorded</p>

  const cards = [
    vs.bloodPressure?.systolic && {
      key: "bp_sys",
      value: vs.bloodPressure.systolic,
      label: "BP",
      display: `${vs.bloodPressure.systolic}/${vs.bloodPressure.diastolic}`,
      unit: vs.bloodPressure.unit || "mmHg",
    },
    vs.heartRate?.value && {
      key: "hr",
      value: vs.heartRate.value,
      label: "Heart rate",
      display: String(vs.heartRate.value),
      unit: vs.heartRate.unit || "bpm",
    },
    vs.temperature?.value && {
      key: "temp",
      value: vs.temperature.value,
      label: "Temp",
      display: String(vs.temperature.value),
      unit: vs.temperature.unit || "°C",
    },
    vs.respiratoryRate?.value && {
      key: "rr",
      value: vs.respiratoryRate.value,
      label: "Resp. rate",
      display: String(vs.respiratoryRate.value),
      unit: "/min",
    },
    vs.oxygenSaturation?.value && {
      key: "spo2",
      value: vs.oxygenSaturation.value,
      label: "SpO₂",
      display: String(vs.oxygenSaturation.value),
      unit: "%",
    },
  ].filter(Boolean) as {
    key: string
    value: number
    label: string
    display: string
    unit: string
  }[]

  if (cards.length === 0)
    return <p className="text-sm text-slate-400 italic px-4 pb-3">No vitals recorded</p>

  return (
    <div className="px-4 pb-4 grid grid-cols-2 gap-2">
      {cards.map((card) => {
        const color = getVitalDot(card.key, card.value)
        return (
          <div
            key={card.key}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              DOT_BG_CLASSES[color]
            )}
          >
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-0.5", DOT_TEXT_CLASSES[color])}>
              {card.label}
            </p>
            <p className="text-lg font-bold text-slate-900 leading-none">
              {card.display}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{card.unit}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Content section — shared between both layouts ────────────────────────────

function SidebarContent({
  patient,
  historyGathered,
  orderedTests,
  mobile = false,
}: {
  patient: PatientData
  historyGathered: string[]
  orderedTests: OrderedTest[]
  mobile?: boolean
}) {
  const px = mobile ? "px-4" : "px-3"
  const textBase = mobile ? "text-sm" : "text-[11px]"
  const textSmall = mobile ? "text-xs" : "text-[10px]"

  return (
    <>
      {/* ── Chief Complaint ─────────────────────────────────────── */}
      <div className={cn(px, mobile ? "pt-4 pb-3" : "pt-3 pb-2")}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className={cn("text-amber-600 mt-0.5 flex-shrink-0", mobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
            <div className="min-w-0">
              <p className={cn("font-semibold text-amber-700 uppercase tracking-wider mb-0.5", textSmall)}>
                Presenting complaint
              </p>
              <p className={cn("text-amber-800 leading-relaxed", textBase)}>
                {patient.chiefComplaint}
              </p>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── Vitals ──────────────────────────────────────────────── */}
      <SectionLabel mobile={mobile}>Vital Signs</SectionLabel>
      {mobile ? (
        <VitalsMobile vs={patient.vitalSigns} />
      ) : (
        <VitalsDesktop vs={patient.vitalSigns} />
      )}

      <SectionDivider />

      {/* ── Allergies ───────────────────────────────────────────── */}
      <SectionLabel mobile={mobile}>Allergies</SectionLabel>
      <div className={cn(px, "pb-3")}>
        {patient.allergies && patient.allergies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {patient.allergies.map((a, i) => (
              <Badge
                key={i}
                className={cn(
                  "bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-medium",
                  mobile ? "text-xs px-2.5 py-0.5" : "text-[10px] px-1.5 py-0"
                )}
              >
                {a}
              </Badge>
            ))}
          </div>
        ) : (
          <p className={cn("text-slate-400 italic", textBase)}>None known</p>
        )}
      </div>

      <SectionDivider />

      {/* ── Medications ─────────────────────────────────────────── */}
      <SectionLabel mobile={mobile}>Medications</SectionLabel>
      <div className={cn(px, "pb-3")}>
        {patient.currentMedications && patient.currentMedications.length > 0 ? (
          <ul className="space-y-1.5">
            {patient.currentMedications.map((m, i) => (
              <li key={i} className={cn("flex items-start gap-2 text-slate-700", textBase)}>
                <Pill className={cn("text-slate-400 mt-0.5 flex-shrink-0", mobile ? "h-4 w-4" : "h-3 w-3")} />
                {m}
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("text-slate-400 italic", textBase)}>No current medications</p>
        )}
      </div>

      <SectionDivider />

      {/* ── History Gathered ────────────────────────────────────── */}
      <SectionLabel mobile={mobile}>History gathered</SectionLabel>
      <div className={cn(px, "pb-3")}>
        {historyGathered.length === 0 ? (
          <p className={cn("text-slate-400 italic", textBase)}>No history taken yet</p>
        ) : (
          <ul className="space-y-1.5">
            {historyGathered.map((fact, i) => (
              <li key={i} className={cn("flex items-start gap-2 text-slate-700", textBase)}>
                <CheckCircle2 className={cn("text-emerald-500 mt-0.5 flex-shrink-0", mobile ? "h-3.5 w-3.5" : "h-3 w-3")} />
                {fact}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SectionDivider />

      {/* ── Tests Ordered ───────────────────────────────────────── */}
      <SectionLabel mobile={mobile}>Tests ordered</SectionLabel>
      <div className={cn(px, "pb-3")}>
        {orderedTests.length === 0 ? (
          <p className={cn("text-slate-400 italic", textBase)}>No tests ordered</p>
        ) : (
          <ul className="space-y-2">
            {orderedTests.map((test, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <FlaskConical className={cn("text-brand-500 mt-0.5 flex-shrink-0", mobile ? "h-4 w-4" : "h-3 w-3")} />
                  <span className={cn("text-slate-700 leading-tight", textBase)}>{test.name}</span>
                </div>
                {test.duration && (
                  <span className={cn("flex items-center gap-0.5 text-slate-400 flex-shrink-0", textSmall)}>
                    <Clock className="h-2.5 w-2.5" />
                    {test.duration}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SectionDivider />

      {/* ── Case score ──────────────────────────────────────────── */}
      <div className={cn(px, "py-3 flex items-center justify-between")}>
        <p className={cn("font-semibold uppercase tracking-wider text-slate-400", textSmall)}>
          Case score
        </p>
        <span className={cn("font-bold text-slate-500", mobile ? "text-sm" : "text-[11px]")}>—</span>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CaseSidebar({
  patient,
  activeTab,
  historyGathered,
  orderedTests,
  coverageScore,
  isCollapsed,
  onToggleCollapse,
  mobileLayout = false,
}: CaseSidebarProps) {

  // ── Mobile layout — rendered inside a Sheet, full width ──────────────────
  if (mobileLayout) {
    return (
      <div className="flex flex-col bg-white w-full">
        {/* Patient header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-base font-bold">
              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-base leading-tight">{patient.name}</p>
            <p className="text-sm text-slate-500">
              {patient.age} yrs · {patient.gender}
              {patient.mrn && ` · ${patient.mrn}`}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <SidebarContent
          patient={patient}
          historyGathered={historyGathered}
          orderedTests={orderedTests}
          mobile={true}
        />
      </div>
    )
  }

  // ── Desktop layout — fixed 220px column ──────────────────────────────────
  return (
    <div
      className={cn(
        "h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-200 flex-shrink-0 relative",
        isCollapsed ? "w-[48px]" : "w-[220px]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-slate-500" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-slate-500" />
        )}
      </button>

      {/* Collapsed: icon rail */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-4 pt-4 px-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="h-4 w-4 text-slate-500" />
          </div>
          <Activity className="h-4 w-4 text-slate-400" />
          <AlertCircle className="h-4 w-4 text-slate-400" />
          <Pill className="h-4 w-4 text-slate-400" />
          <MessageSquare className="h-4 w-4 text-slate-400" />
          <FlaskConical className="h-4 w-4 text-slate-400" />
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
          data-lenis-prevent
        >
          <SidebarContent
            patient={patient}
            historyGathered={historyGathered}
            orderedTests={orderedTests}
            mobile={false}
          />
        </div>
      )}
    </div>
  )
}
