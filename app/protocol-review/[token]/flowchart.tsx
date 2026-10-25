// The dengue shock fluid flowchart for the professor's review: boxes, arrows and yes/no branches, drawn from the
// NCVBDC 2023 guideline (Figures 12 and 13) with his first answers built in. Steps still open are amber and name the
// question below that asks about them. Pure layout, no state.

import type { ReactNode } from "react"

type Tone = "start" | "step" | "good" | "danger" | "open"

const tones: Record<Tone, string> = {
  start: "border-sky-600 bg-sky-600 text-white",
  step: "border-slate-300 bg-white text-slate-900",
  good: "border-emerald-500 bg-emerald-50 text-emerald-950",
  danger: "border-red-400 bg-red-50 text-red-950",
  open: "border-amber-400 bg-amber-50 text-amber-950 border-dashed",
}

function Box({ tone = "step", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-md rounded-xl border-2 px-4 py-3 text-center text-[14.5px] leading-snug ${tones[tone]}`}>{children}</div>
}

function Decision({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-fit max-w-md rounded-full border-2 border-slate-800 bg-slate-800 px-5 py-2 text-center text-[14.5px] font-bold text-white">
      {children}
    </div>
  )
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden>
      <div className="h-4 w-0.5 bg-slate-400" />
      {label && <span className="my-0.5 rounded-full bg-slate-200 px-2 py-0.5 text-[12.5px] font-bold text-slate-700">{label}</span>}
      {label && <div className="h-2 w-0.5 bg-slate-400" />}
      <div className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-slate-400" />
    </div>
  )
}

/** Two outcomes side by side (stacked on a phone), each with its own label. */
function Branches({ left, right }: { left: { label: string; body: ReactNode }; right: { label: string; body: ReactNode } }) {
  return (
    <div className="mt-1 grid gap-3 md:grid-cols-2">
      {[left, right].map((b) => (
        // On a phone the two paths stack, so each sits in its own outlined panel headed by its label.
        <div key={b.label} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-2 md:border-0 md:bg-transparent md:p-0">
          <Arrow label={b.label} />
          <div className="flex flex-col">{b.body}</div>
        </div>
      ))}
    </div>
  )
}

const Q = ({ n }: { n: string }) => <span className="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-[12px] font-bold text-amber-900">question {n}</span>

function Ladder() {
  return (
    <Box tone="good">
      <p className="font-bold">Taper the fluid rate</p>
      <ol className="mt-1.5 space-y-0.5 text-left text-[14px]">
        <li>1. 7 to 10 mL/kg/hour for 1 to 2 hours</li>
        <li>2. 5 to 7 mL/kg/hour for 1 to 2 hours</li>
        <li>3. 3 to 5 mL/kg/hour for 2 to 4 hours</li>
        <li>4. 2 to 3 mL/kg/hour for 2 to 3 hours</li>
        <li>5. Then titrate to haemodynamic status</li>
      </ol>
      <p className="mt-1.5 text-[13.5px]">Stop IV fluids within 24 to 48 hours. Watch for fluid overload.<Q n="4, 5" /></p>
    </Box>
  )
}

export function Flowchart() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-[16px] font-bold text-slate-900">A. Compensated shock: where this patient is now</h3>
        <Box tone="start">
          <p className="font-bold">Compensated shock</p>
          <p className="text-[13.5px] opacity-90">Systolic BP 90 mmHg or above, but narrow pulse pressure, tachycardia, cold peripheries, prolonged capillary refill time</p>
        </Box>
        <Arrow />
        <Box>
          <p className="font-bold">Crystalloid 10 to 20 mL/kg over 1 hour</p>
          <p className="text-[13.5px] text-slate-600">This case: 10 mL/kg = 650 mL. Haematocrit before and after.</p>
        </Box>
        <Arrow />
        <Decision>Improved?<Q n="3" /></Decision>
        <Branches
          left={{ label: "Yes", body: <Ladder /> }}
          right={{
            label: "No",
            body: (
              <>
                <Decision>Haematocrit?</Decision>
                <Branches
                  left={{
                    label: "Above 45%",
                    body: (
                      <>
                        <Box>
                          Ongoing plasma leakage: second bolus 10 mL/kg over 1 hour
                          <span className="mt-1 block text-[13.5px] text-emerald-800">Improved: taper as in the Yes path.</span>
                        </Box>
                        <Arrow label="Not improved" />
                        <Box tone="danger">Colloid (massive plasma leakage, or no response to crystalloid) and ICU referral. Refractory hypotension: consider inotropes.<Q n="10" /></Box>
                      </>
                    ),
                  }}
                  right={{
                    label: "Below 45%",
                    body: <Box tone="danger">Suspect occult bleeding: whole blood 10 mL/kg or packed red cells 5 mL/kg</Box>,
                  }}
                />
              </>
            ),
          }}
        />
        <p className="mt-3 text-center text-[13.5px] text-slate-600">If systolic BP falls below 90 mmHg at any point, go to chart B.</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-[16px] font-bold text-slate-900">B. Hypotensive shock (systolic BP below 90 mmHg)</h3>
        <Box tone="start">
          <p className="font-bold">Hypotensive shock</p>
          <p className="text-[13.5px] opacity-90">Systolic BP below 90 mmHg</p>
        </Box>
        <Arrow />
        <Box>
          <p className="font-bold">Crystalloid 20 mL/kg over 15 minutes</p>
          <p className="text-[13.5px] text-slate-600">No 500 mL cap. Haematocrit before each bolus.</p>
        </Box>
        <Arrow />
        <Decision>Improved?<Q n="3" /></Decision>
        <Branches
          left={{
            label: "Yes",
            body: (
              <>
                <Box tone="open">
                  <p className="font-bold">First taper step: still to decide</p>
                  <p className="text-[13.5px]">After the first bolus<Q n="1" /> and after a second or third bolus<Q n="2" /></p>
                </Box>
                <Arrow />
                <Box tone="good">Then the same taper as chart A</Box>
              </>
            ),
          }}
          right={{
            label: "No",
            body: (
              <>
                <Box>Haematocrit above 45%: repeat crystalloid bolus. Below 45%: blood transfusion, as in chart A. Maximum 3 boluses.</Box>
                <Arrow label="Shock persists" />
                <Box tone="danger">Refractory shock: consider inotropes<Q n="10" />, manage in ICU. Look for cardiogenic or septic shock, a metabolic cause, persistent acidosis and occult bleeding.</Box>
              </>
            ),
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-[13px] text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-50" /> settled</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-red-400 bg-red-50" /> escalate</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-amber-400 bg-amber-50" /> still to decide (the questions below)</span>
      </div>
    </div>
  )
}
