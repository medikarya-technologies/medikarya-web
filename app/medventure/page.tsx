import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  Award,
  BadgeCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  MapPin,
  Medal,
  Stethoscope,
  Target,
  Trophy,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Medventure Clinical Decision Challenge",
  description: "A two-round clinical decision challenge at MAMC, powered by MediKarya.",
  alternates: { canonical: "https://medventure.medikarya.in" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Medventure Clinical Decision Challenge",
    description: "General clinical MCQs. One clinical reasoning case. One combined leaderboard.",
    url: "https://medventure.medikarya.in",
    siteName: "MediKarya",
    type: "website",
  },
}

const challengeSteps = [
  {
    number: "01",
    title: "Clinical MCQs",
    text: "Start with general clinical questions that test how you think across the ward, the OPD and the emergency room.",
    Icon: ClipboardList,
  },
  {
    number: "02",
    title: "Clinical reasoning case",
    text: "Then meet a patient on MediKarya. Take in the clues, decide what matters and work through the case yourself.",
    Icon: BrainCircuit,
  },
  {
    number: "03",
    title: "Final ranking",
    text: "Both scores are combined on the same platform. The three highest totals take the podium.",
    Icon: Trophy,
  },
]

const eventDay = [
  { title: "Join the room", text: "Your Medventure organisers will share the participation and access instructions at MAMC.", Icon: MapPin },
  { title: "Take both rounds", text: "Move from the general MCQs into the clinical reasoning case on the same event platform.", Icon: Stethoscope },
  { title: "See the final ranking", text: "The two scores are combined to produce one final result for the room.", Icon: Target },
]

const benefits = [
  "QR-verifiable participation certificate",
  "Five-day MediKarya access pass for eligible attendees",
  "Resident Plan for first place",
  "Intern Plan for second and third place",
]

export default function MedventurePage() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7faf8] text-[#18231e]">
      <header className="border-b border-[#dbe8df] bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6" aria-label="Event navigation">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MediKarya home">
            <img src="/medikarya.svg" alt="" className="h-8 w-8" />
            <span className="text-[15px] font-semibold tracking-tight text-[#18231e]">MediKarya</span>
          </Link>
          <a href="#challenge" className="rounded-full border border-[#c9ddd0] px-3.5 py-1.5 text-[12px] font-semibold text-[#376c55] transition-colors hover:border-[#4b8f74] hover:bg-[#eff6f1] sm:text-[13px]">
            Challenge details
          </a>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-[#173c2d] text-white">
        <div aria-hidden className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div aria-hidden className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-[#7ac89d]/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-36 left-[18%] h-80 w-80 rounded-full bg-[#4b8f74]/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#d9f2e2] uppercase">
              <Stethoscope className="h-3.5 w-3.5" /> Medventure x MediKarya
            </p>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Clinical decisions,<br /><span className="text-[#9ce1b6]">under pressure.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-[16px] leading-relaxed text-white/75 sm:text-lg">
              A clinical decision challenge for the MAMC community. General clinical MCQs, one reasoning case and one final ranking, all on the MediKarya platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium"><CalendarDays className="h-4 w-4 text-[#9ce1b6]" /> 18 November 2026</div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium"><MapPin className="h-4 w-4 text-[#9ce1b6]" /> MAMC, New Delhi</div>
            </div>
            <a href="#challenge" className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#9ce1b6] px-5 py-3 text-[14px] font-semibold text-[#173c2d] transition-transform hover:-translate-y-0.5 hover:bg-white">
              See the challenge <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-14 grid max-w-4xl gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-3">
            {[["2", "rounds"], ["1", "combined score"], ["3", "places on the podium"]].map(([number, label]) => (
              <div key={label} className="bg-[#173c2d]/75 px-5 py-4 backdrop-blur-sm"><p className="font-mono text-2xl font-semibold text-[#9ce1b6]">{number}</p><p className="mt-1 text-[13px] text-white/65">{label}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="challenge" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">The format</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">Think through both rounds. Let the combined score decide it.</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#5a6c61]">Both parts of the challenge happen here. Every decision contributes to the same final leaderboard.</p>
          </div>
          <ol className="space-y-4">
            {challengeSteps.map(({ number, title, text, Icon }) => (
              <li key={number} className="group relative overflow-hidden rounded-2xl border border-[#dbe8df] bg-white p-5 shadow-[0_8px_26px_rgba(30,73,51,.05)] sm:p-6">
                <div className="absolute right-5 top-3 font-mono text-5xl font-semibold tracking-[-.08em] text-[#eff6f1] transition-colors group-hover:text-[#dcefe2]" aria-hidden>{number}</div>
                <div className="relative flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eff6f1] text-[#4b8f74]"><Icon className="h-5 w-5" strokeWidth={2} /></span><div><h3 className="text-[17px] font-semibold text-[#173c2d]">{title}</h3><p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[#5a6c61]">{text}</p></div></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-[#dbe8df] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center"><p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">The event day</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">One room. One challenge route.</h2><p className="mt-4 text-[15px] leading-relaxed text-[#5a6c61]">Medventure runs the event on site. MediKarya keeps the competition journey in one place.</p></div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {eventDay.map(({ title, text, Icon }, index) => <li key={title} className="relative rounded-2xl border border-[#dbe8df] bg-[#f7faf8] p-5 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4b8f74] shadow-sm"><Icon className="h-5 w-5" /></span><p className="mt-6 text-[11px] font-bold tracking-[0.14em] text-[#789084] uppercase">Step {index + 1}</p><h3 className="mt-2 text-[17px] font-semibold text-[#173c2d]">{title}</h3><p className="mt-2 text-[14px] leading-relaxed text-[#5a6c61]">{text}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div><p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">After the challenge</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">A result you can carry forward.</h2><p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#5a6c61]">Test your clinical thinking in a room full of peers, then keep practising after the event with MediKarya.</p><div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#eff6f1] px-3.5 py-2 text-[13px] font-semibold text-[#376c55]"><Medal className="h-4 w-4" /> Recognition for the top three</div></div>
          <ul className="space-y-3">{benefits.map((benefit) => <li key={benefit} className="flex gap-3 rounded-xl border border-[#dbe8df] bg-white px-4 py-3 text-[14px] font-medium text-[#264a37]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4b8f74]" strokeWidth={2.5} />{benefit}</li>)}</ul>
        </div>
      </section>

      <section id="event-day" className="border-y border-[#dbe8df] bg-[#eff6f1]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">Your event reference</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#173c2d] sm:text-3xl">Everything you need to know, in one place.</h2><p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#5a6c61]">Your Medventure organisers will share access instructions at the venue on the day.</p></div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{[[CalendarDays, "18 Nov", "2026"], [MapPin, "MAMC", "New Delhi"], [Clock3, "Event", "on site"]].map(([Icon, first, second]) => { const FactIcon = Icon as typeof CalendarDays; return <div key={String(first)} className="rounded-xl border border-[#cfe0d4] bg-white px-3 py-3 text-center sm:px-4"><FactIcon className="mx-auto h-4 w-4 text-[#4b8f74]" /><p className="mt-2 text-[12px] font-bold text-[#264a37]">{String(first)}</p><p className="text-[10px] text-[#6d8376]">{String(second)}</p></div> })}</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"><div className="relative overflow-hidden rounded-3xl bg-[#4b8f74] px-6 py-10 text-white sm:px-10 sm:py-12"><div aria-hidden className="absolute inset-y-0 right-0 w-[48%] opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" /><div className="relative max-w-2xl"><BadgeCheck className="h-7 w-7 text-[#d9f2e2]" /><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Ready when the room is.</h2><p className="mt-3 text-[15px] leading-relaxed text-white/80">Your organisers will share the competition instructions and access details on the day.</p><p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">Powered by MediKarya <ArrowRight className="h-4 w-4" /></p></div></div></section>

      <footer className="border-t border-[#dbe8df] bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 text-[12px] text-[#697a70] sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="flex items-center gap-2"><Award className="h-3.5 w-3.5 text-[#4b8f74]" /> Medventure Clinical Decision Challenge</p><Link href="/" className="font-medium text-[#376c55] hover:underline">MediKarya</Link></div></footer>
    </main>
  )
}
