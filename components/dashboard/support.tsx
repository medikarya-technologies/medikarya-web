"use client"

// Help. Answers to what students actually ask, each one true of how the app works today, and the two
// ways to reach a person. (This page used to carry a contact form that went nowhere and resource cards
// for videos and live sessions that did not exist; nothing here promises what the app does not do.)

import { ChevronDown, Mail, Phone } from "lucide-react"
import { Paper, PaperHeader } from "@/components/cases/encounter-ui"
import { PageContainer, PageHeader } from "./dashboard-ui"

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How do I start a case?",
    a: "Open the case library, choose a patient and press Start case. You get a short briefing first: who the patient is, how they look and the vitals taken on arrival. The case, and its clock, begin when you press Start.",
  },
  {
    q: "What happens during a case?",
    a: "You take the history by asking the patient questions, examine them, order investigations (results come back on a running clock, as they would on a ward) and finally commit to a diagnosis. Everything you do is recorded, and your feedback walks back through it.",
  },
  {
    q: "How are my score and XP worked out?",
    a: "Your score reflects how well your history, investigations, diagnosis and reasoning match what an expert would do. XP is that score as a percentage of the case's own XP: up to 50 for most cases and 100 for live simulations.",
  },
  {
    q: "What do hints and highlights cost?",
    a: "Optional help, such as highlighting abnormal vitals or asking for a hint, is recorded against your Independent score, so you can see how much of your result was your own. The cost is shown on each button before you use it.",
  },
  {
    q: "Can I retake a case?",
    a: "Yes. Every attempt is saved. Open the case to review your last feedback or see all attempts, and the library shows your best score on each case.",
  },
  {
    q: "The page reloaded or froze in the middle of a case.",
    a: "Reload it. Your progress in the current case is saved on this device and resumes where you left off. The case clock pauses while the tab is in the background, so switching tabs does not cost you time.",
  },
]

export function Support() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Help" title="Support" description="Answers to common questions, and how to reach us." />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Paper className="overflow-hidden">
          <PaperHeader title="Common questions" />
          <div>
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b border-enc-line last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-[14.5px] font-medium text-enc-ink outline-none select-none hover:bg-enc-desk focus-visible:bg-enc-desk focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset sm:px-5 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-enc-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-[14px] leading-relaxed text-enc-ink-2 sm:px-5">{a}</p>
              </details>
            ))}
          </div>
        </Paper>

        <Paper className="h-fit">
          <PaperHeader title="Talk to us" description="If something is wrong, tell us the case and what you were doing." />
          <ul className="divide-y divide-enc-line">
            <li>
              <a href="mailto:support@medikarya.in" className="flex items-center gap-3.5 px-4 py-3.5 outline-none transition-colors hover:bg-enc-desk focus-visible:bg-enc-desk focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-enc-console text-enc-ink-2">
                  <Mail className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">Email</span>
                  <span className="block truncate text-[14px] font-medium text-brand-700">support@medikarya.in</span>
                </span>
              </a>
            </li>
            <li>
              <a href="tel:+918796502901" className="flex items-center gap-3.5 px-4 py-3.5 outline-none transition-colors hover:bg-enc-desk focus-visible:bg-enc-desk focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-enc-console text-enc-ink-2">
                  <Phone className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold tracking-[0.09em] text-enc-ink-3 uppercase">Phone</span>
                  <span className="block font-mono text-[14px] font-medium text-brand-700 tabular-nums">+91 87965 02901</span>
                </span>
              </a>
            </li>
          </ul>
        </Paper>
      </div>
    </PageContainer>
  )
}
