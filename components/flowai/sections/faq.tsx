"use client"

// Every answer here has to be true of the product as it exists, the same rule the dashboard's Support page
// follows (components/dashboard/support.tsx). The old FAQ claimed HIPAA compliance (a US law, not relevant to an
// Indian platform, and never verified), "institutional plans" with no page behind them, monthly case updates
// (no evidence of a fixed schedule), and a feedback system scoring "patient communication skills" — the app has
// never scored that; the real six are history, investigations, clinical reasoning, diagnosis, management and
// efficiency (lib/library/skills.ts). Fixed to only what's actually true, and `specialties` comes from the
// server so this can't go stale the way that copy did.

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Eyebrow } from "@/components/cases/encounter-ui"
import { cn } from "@/lib/utils"
import { useScrollAnimation } from "@/lib/scroll-animation"

export default function FAQSection({ specialties }: { specialties: readonly string[] }) {
  const list = specialties.length > 0 ? specialties.join(", ") : "cardiology, pediatrics, nephrology and more"

  const faqs = [
    {
      question: "How realistic is the patient?",
      answer:
        "Each case is built as a full chart — a history, an examination, vitals, a set of investigations, and the red flags that matter — so the patient's answers stay consistent with the record, whatever order you ask things in. You never see the diagnosis named anywhere before you commit to one.",
    },
    {
      question: "What can I practice?",
      answer: `Real clinical cases across ${list}. The library is growing; what's live today is what you'll find when you open it, not a roadmap.`,
    },
    {
      question: "How does the feedback work?",
      answer:
        "After a case, you get a score broken down by part — history taking, investigations, clinical reasoning, diagnosis and management — so you can see exactly where marks were lost, not just a single number at the end.",
    },
    {
      question: "Is it free?",
      answer: (
        <>
          The case on this page is free, and needs no account. Sign in as an Intern or Resident to unlock the rest of the library — see{" "}
          <a href="#pricing" className="font-medium text-brand-700 hover:text-brand-800">
            pricing
          </a>
          .
        </>
      ),
    },
    {
      question: "What's included in Resident?",
      answer: "Everything in Intern, plus unlimited normal-case attempts, more live emergency cases a day, and Advanced-difficulty cases with patients whose condition can deteriorate on its own — real-time vitals and telemetry, not just a static chart.",
    },
    {
      question: "Can my medical school use this?",
      answer: "Yes — see the API and institutional page for integrating the case library and analytics into a curriculum.",
    },
    {
      question: "Does it work on my phone?",
      answer: "Yes. It runs in your phone's browser, and can be installed like an app for quick access.",
    },
  ]

  const { ref, isVisible } = useScrollAnimation(0.15)

  return (
    <section id="faq" className="py-20 sm:py-24" ref={ref}>
      <div className="mx-auto max-w-3xl px-4">
        <div className={cn("mx-auto max-w-2xl text-center transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
          <Eyebrow className="text-brand-600">Questions</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-enc-ink">A few real questions</h2>
          <p className="mt-2 text-enc-ink-2">If something else is unclear, just ask — see Support once you're in.</p>
        </div>

        <div className={cn("mt-8 transition-all duration-700 ease-out", isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")} style={{ transitionDelay: isVisible ? "120ms" : "0ms" }}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`} className="rounded-xl border border-enc-line bg-enc-sheet px-6 shadow-enc-sheet">
                <AccordionTrigger className="text-left text-base font-medium text-enc-ink hover:no-underline">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-enc-ink-2">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
