// The review report: a converted case (lib/studio/convert.ts) laid out on one page for a clinical reviewer, who reads
// it instead of playing the case. What came from the student's case sheet and what the AI added is marked on every
// result and vital, and everything the AI added is also collected at the top. Server-safe (no hooks), readable on a
// phone and printable. Used by the private review link (/review/[token]) and the admin preview.

import type { ReactNode } from "react"
import { getCatalogTest } from "@/lib/clinical-catalog"

type Json = Record<string, any>
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v)

function human(key: string): string {
  const s = key.replace(/_/g, " ").replace(/\b(hpi|jvp|cvs|cns|gpe|bp|spo2)\b/gi, (m) => m.toUpperCase())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Facts as label/value lines, nested objects flattened ("Palpation — swelling: ..."). */
function lines(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string" || typeof value === "number") return [[prefix || "", String(value)]]
  if (Array.isArray(value)) return value.length ? [[prefix, value.map(String).join("; ")]] : []
  if (!isObj(value)) return []
  return Object.entries(value).flatMap(([k, v]) => lines(v, prefix ? `${prefix} — ${human(k).toLowerCase()}` : human(k)))
}

function Origin({ origin }: { origin?: string }) {
  if (origin === "ai") return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900 uppercase">Added by AI</span>
  if (origin === "reviewer") return <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-900 uppercase">From reviewer</span>
  if (origin === "case_sheet") return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900 uppercase">Case sheet</span>
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase">Source not marked</span>
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-slate-200 pt-5">
      <h2 className="text-[17px] font-bold text-slate-900">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-800">{children}</div>
    </section>
  )
}

function FactList({ facts }: { facts: Array<[string, string]> }) {
  return (
    <dl className="space-y-1.5">
      {facts.map(([k, v], i) => (
        <div key={i} className="grid gap-x-3 sm:grid-cols-[200px_1fr]">
          {k && <dt className="font-medium text-slate-500">{k}</dt>}
          <dd className={k ? "" : "sm:col-span-2"}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function testName(id: string, tests: Json[]): string {
  return tests.find((t) => t.id === id)?.name ?? getCatalogTest(id)?.name ?? id
}

function Pills({ ids, tests, tone }: { ids: string[]; tests: Json[]; tone: string }) {
  if (!ids?.length) return <span className="text-slate-400">none</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <span key={id} className={`rounded-md px-2 py-0.5 text-[13px] ${tone}`}>
          {testName(id, tests)}
        </span>
      ))}
    </span>
  )
}

const VITAL_LABEL: Record<string, string> = {
  bloodPressure: "Blood pressure",
  heartRate: "Pulse",
  respiratoryRate: "Respiratory rate",
  temperature: "Temperature",
  oxygenSaturation: "SpO₂",
}

function vitalValue(v: Json): string {
  if (typeof v.systolic === "number") return `${v.systolic}/${v.diastolic} ${v.unit ?? "mmHg"}`
  if (v.value === null || v.value === undefined) return v.note ?? "not recorded"
  return `${v.value} ${v.unit ?? ""}`.trim()
}

export function CaseReport({ caseJson: c, reviewNotes }: { caseJson: Json; reviewNotes: string[] }) {
  const p: Json = c.patient ?? {}
  const facts: Json = c.patient_facts ?? {}
  const examKeys = Object.keys(facts).filter((k) => k.endsWith("_examination"))
  const historyFacts = Object.fromEntries(Object.entries(facts).filter(([k]) => !k.endsWith("_examination")))
  const tests: Json[] = Array.isArray(c.tests) ? c.tests : []
  const ev: Json = c.evaluation_config ?? {}
  const aiTests = tests.filter((t) => t.result?.origin === "ai")

  return (
    <article className="space-y-6">
      <header>
        <p className="text-[12px] font-semibold tracking-wider text-slate-500 uppercase">Case for clinical review</p>
        <h1 className="mt-1 text-[24px] leading-tight font-bold text-slate-900 sm:text-[28px]">{c.title}</h1>
        <p className="mt-1 text-[14px] text-slate-600">
          {c.category} · {c.difficulty}
          {c.credit?.author ? ` · written by ${c.credit.author}` : ""}
        </p>
        <p className="mt-3 rounded-lg bg-slate-100 p-3 text-[14px] text-slate-700">
          <strong>Please check:</strong> that the history, examination and diagnosis match the condition; that every value marked{" "}
          <Origin origin="ai" /> is realistic for this patient; and that the scoring in section 6 rewards the right decisions. Values marked{" "}
          <Origin origin="case_sheet" /> are the student&apos;s own.
        </p>
      </header>

      {(reviewNotes.length > 0 || aiTests.length > 0) && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="text-[16px] font-bold text-amber-950">Everything the AI added ({reviewNotes.length})</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-amber-950">
            {reviewNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <Section n={1} title="The patient on arrival">
        <p>
          <strong>{p.name}</strong>, {p.age} years, {String(p.gender ?? "").toLowerCase()}. <em>{p.chiefComplaint}</em>
        </p>
        <table className="w-full text-left text-[14px]">
          <tbody>
            {Object.entries(p.vitalSigns ?? {}).map(([k, v]) =>
              isObj(v) ? (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-500">{VITAL_LABEL[k] ?? human(k)}</td>
                  <td className="py-1.5 pr-3 font-medium">{vitalValue(v)}</td>
                  <td className="py-1.5 text-right">
                    <Origin origin={v.origin} />
                  </td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
        {c.appearance?.note && <p className="text-slate-600">How they look: {c.appearance.note}</p>}
      </Section>

      <Section n={2} title="History (what the patient will say when asked)">
        {c.patient_text_brief && <p className="rounded-lg bg-slate-50 p-3 italic">&ldquo;{c.patient_text_brief}&rdquo;</p>}
        <FactList facts={lines(historyFacts)} />
      </Section>

      <Section n={3} title="Examination">
        {examKeys.length === 0 && <p className="text-slate-500">No examination in this case.</p>}
        {examKeys.map((k) => (
          <div key={k}>
            <h3 className="font-semibold text-slate-900">{human(k)}</h3>
            <FactList facts={lines(facts[k])} />
          </div>
        ))}
      </Section>

      <Section n={4} title="Investigations and results">
        {tests.map((t) => (
          <div key={t.id} className={`rounded-lg border p-3 ${t.result?.origin === "ai" ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{t.name}</h3>
              <Origin origin={t.result?.origin} />
            </div>
            {t.result?.basis && <p className="mt-1 text-[13px] text-amber-900">Why these values: {t.result.basis}</p>}
            {Array.isArray(t.result?.values) && t.result.values.length > 0 && (
              <table className="mt-2 w-full text-left text-[13.5px]">
                <tbody>
                  {t.result.values.map((v: Json, i: number) => (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-3 text-slate-500">{v.parameter}</td>
                      <td className="py-1 pr-3 font-medium">
                        {v.value} {v.unit}
                      </td>
                      <td className="py-1 text-slate-500">{v.referenceRange && v.referenceRange !== "N/A" ? `ref ${v.referenceRange}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[13.5px]">
              <span className="text-slate-500">Summary:</span> {t.result?.summary} <span className="text-slate-500">Interpretation:</span>{" "}
              {t.result?.interpretation}
            </p>
          </div>
        ))}
      </Section>

      <Section n={5} title="Diagnosis and management">
        <p>
          <span className="text-slate-500">Accepted diagnoses:</span> {(ev.diagnosis?.accepted_primary ?? []).join(" · ")}
        </p>
        <div>
          <p className="text-slate-500">Management a student should propose:</p>
          <ul className="list-disc pl-5">{(ev.management?.core_steps ?? []).map((s: string) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <p className="text-slate-500">Management that is marked as dangerous:</p>
          <ul className="list-disc pl-5 text-red-800">{(ev.management?.dangerous_steps ?? []).map((s: string) => <li key={s}>{s}</li>)}</ul>
        </div>
      </Section>

      <Section n={6} title="How students are scored">
        <div>
          <p className="text-slate-500">Questions a student must ask:</p>
          <ul className="list-disc pl-5">{(ev.history?.required_questions ?? []).map((q: string) => <li key={q}>{q}</li>)}</ul>
        </div>
        <p>
          <span className="text-slate-500">Red flags (missing these costs most):</span> {(ev.history?.red_flag_questions ?? []).join(" · ")}
        </p>
        <div className="space-y-2">
          <p><span className="text-slate-500">Tests that confirm the diagnosis:</span> <Pills ids={ev.testing?.core_tests} tests={tests} tone="bg-emerald-100 text-emerald-900" /></p>
          <p><span className="text-slate-500">Reasonable extras:</span> <Pills ids={ev.testing?.optional_tests} tests={tests} tone="bg-slate-100 text-slate-800" /></p>
          <p><span className="text-slate-500">Low-value here (lose marks):</span> <Pills ids={ev.testing?.distractor_tests} tests={tests} tone="bg-amber-100 text-amber-900" /></p>
          <p><span className="text-slate-500">Unsafe here (lose most):</span> <Pills ids={ev.testing?.dangerous_tests} tests={tests} tone="bg-red-100 text-red-900" /></p>
        </div>
      </Section>

      <Section n={7} title="What students see in the library">
        <p><strong>{c.displayTitle}</strong></p>
        <p>{c.displayDescription}</p>
        <p className="text-slate-500">This must not give the diagnosis away.</p>
      </Section>

      <Section n={8} title="Teaching points (shown after the case)">
        <ul className="list-disc pl-5">{(c.discussion?.keyPoints ?? []).map((k: string) => <li key={k}>{k}</li>)}</ul>
      </Section>
    </article>
  )
}
