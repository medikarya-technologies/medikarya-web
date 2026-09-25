"use client"

// Replaces how-it-works-section.tsx's four identical solid-blue cards — the user's own brief called that section
// out by name for removal ("the repetitive four-blue-card section"). This is the same four real steps, but as a
// vertical sequence the visitor moves THROUGH (a connecting line, alternating sides), each with one small real UI
// fragment instead of a uniform card grid: the same byte-identical chat-bubble and test-row classes this session
// already verified are safe (ai-patient-chat.tsx / simulation-investigations.tsx patterns), plus the real
// encounter-diagnose-nosidebar.png screenshot for the final step, captured this session from an actual run.

import { FlaskConical, Hand, MessageSquare, Stethoscope, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { useScrollAnimation } from "@/lib/scroll-animation"

function AskFragment() {
  return (
    <div className="space-y-2 rounded-xl border border-enc-line-strong bg-enc-sheet p-3 shadow-enc-sheet">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12.5px] text-enc-ink">Any blood in the stool?</p>
      </div>
      <div className="flex justify-start">
        <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-enc-line bg-enc-desk px-3 py-1.5 text-[12.5px] text-enc-ink">No blood — just watery, since yesterday.</p>
      </div>
    </div>
  )
}

function ExamineFragment() {
  return (
    <div className="space-y-1.5 rounded-xl border border-enc-line-strong bg-enc-sheet p-3 shadow-enc-sheet">
      {["Abdominal examination", "Hydration status", "General examination"].map((f, i) => (
        <div key={f} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2", i === 1 ? "bg-brand-50" : "")}>
          <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", i === 1 ? "border-brand-600 bg-brand-600" : "border-enc-line-strong")} />
          <span className="text-[12.5px] text-enc-ink">{f}</span>
        </div>
      ))}
    </div>
  )
}

function InvestigateFragment() {
  return (
    <div className="space-y-1.5 rounded-xl border border-enc-line-strong bg-enc-sheet p-3 shadow-enc-sheet">
      {[
        { name: "Stool Routine & Microscopy", ready: true },
        { name: "Serum Electrolytes", ready: false },
      ].map((t) => (
        <div key={t.name} className={cn("flex items-center gap-2.5 rounded-lg border p-2", t.ready ? "border-enc-ok/30" : "border-enc-line")}>
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold", t.ready ? "bg-enc-ok-soft text-enc-ok" : "bg-enc-console text-enc-ink-3")}>{t.ready ? "✓" : "…"}</span>
          <span className="truncate text-[12px] font-medium text-enc-ink">{t.name}</span>
        </div>
      ))}
    </div>
  )
}

function DecideFragment() {
  return (
    <div className="overflow-hidden rounded-xl border border-enc-line-strong shadow-enc-sheet">
      <img src="/screens/encounter-diagnose-nosidebar.png" alt="The real ranked-differential form: most likely, an important alternative, and what can't be missed" loading="lazy" decoding="async" className="block w-full" />
    </div>
  )
}

const STEPS: Array<{ n: string; title: string; icon: LucideIcon; text: string; fragment: React.ComponentType }> = [
  { n: "01", title: "Ask", icon: MessageSquare, text: "The patient answers what you actually asked — in their own words, never a menu of choices.", fragment: AskFragment },
  { n: "02", title: "Examine", icon: Hand, text: "Choose what to examine. Findings reflect the patient as they are right now, not a canned result.", fragment: ExamineFragment },
  { n: "03", title: "Investigate", icon: FlaskConical, text: "Order tests. Results return on a running clock, exactly as they would on the ward.", fragment: InvestigateFragment },
  { n: "04", title: "Decide", icon: Stethoscope, text: "Commit to a ranked differential — most likely, an important alternative, and what can't be missed.", fragment: DecideFragment },
]

export default function WorkflowSection() {
  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section id="how-it-works" className="bg-accent-50 py-20 sm:py-28" ref={ref}>
      <div className="mx-auto max-w-4xl px-4">
        <div className={cn("mx-auto max-w-2xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <Eyebrow className="text-accent-700">How it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink sm:text-4xl">You don't answer the case. You work through it.</h2>
        </div>

        <div className="relative mt-16">
          <div aria-hidden className="absolute top-2 bottom-2 left-1/2 hidden w-px -translate-x-1/2 bg-accent-200 sm:block" />
          <div className="space-y-10 sm:space-y-14">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const Fragment = s.fragment
              const reverse = i % 2 === 1
              return (
                <div
                  key={s.n}
                  className={cn(
                    "relative grid items-center gap-5 transition-all duration-500 ease-out sm:grid-cols-2 sm:gap-10",
                    isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                  )}
                  style={{ transitionDelay: isVisible ? `${i * 100}ms` : "0ms" }}
                >
                  <div aria-hidden className="absolute top-1 left-1/2 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-accent-500 bg-enc-sheet sm:block" />
                  <div className={cn(reverse ? "sm:order-2 sm:pl-10" : "sm:pr-10 sm:text-right")}>
                    <div className={cn("flex items-center gap-2.5", reverse ? "" : "sm:flex-row-reverse")}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                      </span>
                      <span className="font-mono text-xs text-enc-ink-3 tabular-nums">{s.n}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-enc-ink">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-enc-ink-2">{s.text}</p>
                  </div>
                  <div className={cn("mx-auto w-full max-w-xs", reverse ? "sm:order-1 sm:pr-10" : "sm:pl-10")}>
                    <Fragment />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
