// The LIVE PLAN of a case (lib/simulation/live-plan.ts) laid out for the clinician who signs it off: the untreated
// course as a table of what the monitor shows at each minute, every treatment on the tray with what it does, what
// stops the deterioration, where the patient settles, and what the numbers rest on. It is what runs: the engine's
// rules are made from this plan by code, so nothing happens in the case that is not on this page.
// Server-safe and printable. The Case Studio keeps a copy (components/review/LivePlanReport.tsx): keep the two alike.

type Json = Record<string, any>

export interface Vitals {
  hr?: number
  sbp?: number
  dbp?: number
  spo2?: number
  rr?: number
  temp?: number
}

const WORD: Record<string, string> = {
  sinus_normal: "sinus rhythm",
  sinus_tachycardia: "sinus tachycardia",
  sinus_bradycardia: "sinus bradycardia",
  afib: "atrial fibrillation",
  flutter: "atrial flutter",
  complete_heart_block: "complete heart block",
  pvc_occasional: "occasional ectopics",
  pvc_frequent: "frequent ectopics",
  pvc_bigeminy: "bigeminy",
  vt_sustained: "ventricular tachycardia",
  vf: "ventricular fibrillation",
}
const word = (s?: string) => (s ? (WORD[s] ?? s.replace(/_/g, " ")) : "")

/** The vitals the case itself records on arrival, with the plan's own for any it does not. */
function arrivalOf(c: Json, plan: Json): Vitals {
  const v = c.patient?.vitalSigns ?? {}
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined)
  const own: Vitals = plan.arrival?.vitals ?? {}
  return {
    hr: num(v.heartRate?.value) ?? own.hr,
    sbp: num(v.bloodPressure?.systolic) ?? own.sbp,
    dbp: num(v.bloodPressure?.diastolic) ?? own.dbp,
    spo2: num(v.oxygenSaturation?.value) ?? own.spo2,
    rr: num(v.respiratoryRate?.value) ?? own.rr,
    temp: num(v.temperature?.value) ?? own.temp,
  }
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

function effectText(e?: Vitals): string {
  if (!e) return "No change on the monitor"
  const parts: string[] = []
  if (e.hr) parts.push(`HR ${signed(e.hr)}`)
  if (e.sbp || e.dbp) parts.push(`BP ${signed(e.sbp ?? 0)}/${signed(e.dbp ?? 0)}`)
  if (e.spo2) parts.push(`SpO₂ ${signed(e.spo2)}`)
  if (e.rr) parts.push(`RR ${signed(e.rr)}`)
  if (e.temp) parts.push(`Temp ${signed(e.temp)}`)
  return parts.length ? parts.join(", ") : "No change on the monitor"
}

const ROLE: Record<string, { title: string; note: string; tone: string }> = {
  essential: { title: "Essential", note: "Must be given, in time. Scored.", tone: "bg-emerald-100 text-emerald-900" },
  supportive: { title: "Reasonable, not required", note: "Not scored either way.", tone: "bg-slate-100 text-slate-700" },
  harmful: { title: "Harmful to this patient", note: "Marks are taken off if it is given.", tone: "bg-rose-100 text-rose-900" },
}

const th = "border-b border-slate-300 px-2 py-1.5 text-left text-[11.5px] font-bold tracking-wide text-slate-600 uppercase"
const td = "border-b border-slate-200 px-2 py-1.5 align-top"

/** `arrival`: the vitals on arrival when the case is a case sheet (whose vitals are written as text), not a converted case. */
export function LivePlanReport({ caseJson, arrival: given }: { caseJson: Json; arrival?: Vitals }) {
  const plan: Json | undefined = caseJson.live_plan
  if (!plan || !Array.isArray(plan.stages) || !Array.isArray(plan.treatments)) return null

  const arrival = given ?? arrivalOf(caseJson, plan)
  // the untreated course: each step's monitor is the step before it with this step's changes
  let running: Vitals = arrival
  const rows = [
    { time: "Arrival", name: "As the patient arrives", v: arrival, state: [word(plan.arrival?.consciousness), word(plan.arrival?.stability)], says: "" },
    ...plan.stages.map((s: Json) => {
      running = { ...running, ...(s.vitals ?? {}) }
      return { time: `${s.at_minutes} min`, name: s.name, v: running, state: [word(s.consciousness), word(s.stability), word(s.rhythm)], says: s.nurse_says }
    }),
  ]
  const label = (id: string) => plan.treatments.find((t: Json) => t.id === id)?.label ?? id
  const byRole = (role: string) => plan.treatments.filter((t: Json) => t.role === role)
  const signOff: Json | undefined = plan.sign_off
  const ai = plan.origin === "ai"

  return (
    <section className="break-inside-avoid rounded-xl border-2 border-rose-300 bg-rose-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[19px] font-bold text-slate-900">Live course: how this patient changes with time</h2>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${ai ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
          {ai ? "Drafted by AI" : "Written by the author"}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${plan.status === "approved" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
          {plan.status === "approved" ? "Live for students" : "Proposed: not yet live"}
        </span>
      </div>
      <p className="mt-2 text-[14.5px] leading-relaxed text-slate-800">{plan.summary}</p>
      <p className="mt-2 rounded-lg bg-white p-3 text-[14px] text-slate-700">
        <strong>Please check every number on this page.</strong> In this version of the case a clock runs, the patient gets worse on the schedule below until the
        right treatments are given, and the student is scored on what they give and when.
        {ai && " It was drafted by AI from the case and has not been seen by a clinician before you."} Nothing happens in the case that is not written here.
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-3">
        <div>
          <dt className="text-[11.5px] font-bold tracking-wide text-slate-500 uppercase">Where</dt>
          <dd className="text-slate-900">{plan.setting ?? caseJson.setting ?? "Bedside"}</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-bold tracking-wide text-slate-500 uppercase">Decisive treatment due by</dt>
          <dd className="text-slate-900">{plan.critical_window_minutes} minutes</dd>
        </div>
        <div>
          <dt className="text-[11.5px] font-bold tracking-wide text-slate-500 uppercase">Encounter ends at</dt>
          <dd className="text-slate-900">{plan.time_limit_minutes} minutes</dd>
        </div>
      </dl>

      <h3 className="mt-5 text-[15.5px] font-bold text-slate-900">A. If nothing is done</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-300 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px] text-slate-800">
          <thead>
            <tr className="bg-slate-50">
              <th className={th}>When</th>
              <th className={th}>Stage</th>
              <th className={th}>HR</th>
              <th className={th}>BP</th>
              <th className={th}>SpO₂</th>
              <th className={th}>RR</th>
              <th className={th}>Temp</th>
              <th className={th}>Patient</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={`${td} font-semibold whitespace-nowrap`}>{r.time}</td>
                <td className={td}>
                  <span className="font-semibold">{r.name}</span>
                  {r.says && <span className="mt-0.5 block text-[12.5px] text-slate-600">Nurse: “{r.says}”</span>}
                </td>
                <td className={`${td} tabular-nums`}>{r.v.hr ?? "—"}</td>
                <td className={`${td} tabular-nums whitespace-nowrap`}>{r.v.sbp !== undefined ? `${r.v.sbp}/${r.v.dbp}` : "—"}</td>
                <td className={`${td} tabular-nums`}>{r.v.spo2 !== undefined ? `${r.v.spo2}%` : "—"}</td>
                <td className={`${td} tabular-nums`}>{r.v.rr ?? "—"}</td>
                <td className={`${td} tabular-nums`}>{r.v.temp ?? "—"}</td>
                <td className={td}>{r.state.filter(Boolean).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[12.5px] text-slate-600">
        Words in braces in what the nurse says, like {"{hr}"} or {"{bp}"}, are replaced by the monitor&apos;s own numbers at that moment.
      </p>

      <h3 className="mt-5 text-[15.5px] font-bold text-slate-900">B. What the student can give, and what each does</h3>
      <p className="text-[13px] text-slate-600">Only these are offered. A treatment acts once: giving it again changes nothing.</p>
      {(["essential", "supportive", "harmful"] as const).map((role) => {
        const list = byRole(role)
        if (list.length === 0) return null
        return (
          <div key={role} className="mt-3">
            <p className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold uppercase ${ROLE[role].tone}`}>{ROLE[role].title}</span>
              <span className="text-slate-600">{ROLE[role].note}</span>
            </p>
            <ul className="mt-1.5 space-y-2">
              {list.map((t: Json) => (
                <li key={t.id} className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-3 text-[14px]">
                  <p className="font-semibold text-slate-900">
                    {t.label}
                    {t.detail && <span className="font-normal text-slate-600"> · {t.detail}</span>}
                    {role === "essential" && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[12px] font-semibold text-emerald-800">within {t.within_minutes} min</span>}
                  </p>
                  <p className="mt-1 text-slate-800">
                    <span className="font-medium text-slate-500">On the monitor: </span>
                    {effectText(t.effect)}
                    {(t.consciousness || t.rhythm) && `; becomes ${[word(t.consciousness), word(t.rhythm)].filter(Boolean).join(", ")}`}
                  </p>
                  <p className="mt-0.5 text-slate-800">
                    <span className="font-medium text-slate-500">The student sees: </span>“{t.says}”
                  </p>
                  {t.why && (
                    <p className="mt-0.5 text-slate-800">
                      <span className="font-medium text-slate-500">Why: </span>
                      {t.why}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <h3 className="mt-5 text-[15.5px] font-bold text-slate-900">C. What stops it, and where the patient settles</h3>
      <p className="mt-1 text-[14.5px] text-slate-800">
        The patient stops getting worse once <strong>all</strong> of these have been given: <strong>{(plan.stabilised_by ?? []).map(label).join(", ")}</strong>.{" "}
        {plan.recovery?.after_minutes} minutes later they settle at HR {plan.recovery?.vitals?.hr}, BP {plan.recovery?.vitals?.sbp}/{plan.recovery?.vitals?.dbp}, SpO₂{" "}
        {plan.recovery?.vitals?.spo2}%, RR {plan.recovery?.vitals?.rr}
        {plan.recovery?.vitals?.temp !== undefined ? `, temperature ${plan.recovery.vitals.temp}` : ""}
        {plan.recovery?.consciousness ? `, ${word(plan.recovery.consciousness)}` : ""}
        {plan.recovery?.rhythm ? `, ${word(plan.recovery.rhythm)}` : ""}.
      </p>
      {plan.recovery?.nurse_says && <p className="mt-1 text-[13.5px] text-slate-600">Nurse: “{plan.recovery.nurse_says}”</p>}
      <p className="mt-2 text-[13.5px] text-slate-700">
        Scoring: 60% is the ordinary scoring in section 6 (history, investigations, diagnosis, written plan); 40% is the bedside: each essential treatment
        counts in full if given in time, half if late, nothing if never given, and 15 points come off for each harmful treatment given.
      </p>

      {Array.isArray(plan.basis) && plan.basis.length > 0 && (
        <>
          <h3 className="mt-5 text-[15.5px] font-bold text-slate-900">D. What these numbers rest on</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] text-slate-800">
            {plan.basis.map((b: string, i: number) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </>
      )}

      {signOff?.decision && (
        <p className={`mt-4 rounded-lg p-3 text-[14px] ${signOff.decision === "approved" ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950"}`}>
          {signOff.decision === "approved" ? "Signed off" : "Changes asked for"}
          {signOff.reviewer_name ? ` by ${signOff.reviewer_name}` : " by a clinician"}
          {signOff.decided_at ? ` on ${new Date(signOff.decided_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
          {signOff.comments && <span className="mt-1 block whitespace-pre-wrap">{signOff.comments}</span>}
        </p>
      )}
    </section>
  )
}
