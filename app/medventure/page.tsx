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
    description: "Three clinical decision pathways. One clinical reasoning case. One combined leaderboard.",
    url: "https://medventure.medikarya.in",
    siteName: "MediKarya",
    type: "website",
  },
}

const challengeSteps = [
  {
    number: "01",
    title: "Decision pathways",
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

const scoring = [
  { mark: "10", label: "Round 1 points", text: "The three decision pathways keep their original positive and negative points, then their combined raw score is normalised to 10 for the event leaderboard." },
  { mark: "10", label: "Round 2 points", text: "Your MediKarya clinical-case score is scaled to a maximum of 10 points, giving both rounds equal weight." },
  { mark: "20", label: "Total points", text: "The highest combined score ranks first. Equal totals are decided by the lower combined completion time, then the earlier completed attempt." },
]

export default function MedventurePage() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f5f8f5] text-[#16261d]">
      <header className="border-b border-[#dce8df] bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8" aria-label="Event navigation">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MediKarya home">
            <img src="/medikarya.svg" alt="" className="h-8 w-8" />
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[#173c2d]">MediKarya</span>
          </Link>
          <a href="#challenge" className="rounded-full border border-[#c9ddd0] px-3.5 py-1.5 text-[12px] font-semibold text-[#376c55] transition-colors hover:border-[#4b8f74] hover:bg-[#eff6f1] sm:text-[13px]">
            Challenge details
          </a>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-[#153a2a] text-white">
        <div aria-hidden className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(190,232,203,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(190,232,203,.2)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/15" />
        <div aria-hidden className="absolute -right-24 top-0 h-[32rem] w-[32rem] rounded-full bg-[#78c79a]/15 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 left-[12%] h-px w-2/3 bg-[#9ce1b6]/20" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,.68fr)] lg:gap-14 xl:gap-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#bde8cb] uppercase">
              <Stethoscope className="h-3.5 w-3.5" /> Medventure x MediKarya
            </p>
            <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.75rem,6vw,5.75rem)] font-semibold leading-[0.94] tracking-[-0.06em]">
              Clinical decisions,<br /><span className="text-[#9ce1b6]">under pressure.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[15px] leading-7 text-white/75 sm:text-[17px] sm:leading-8">
              A clinical decision challenge for the MAMC community. Three decision pathways, one reasoning case and one final ranking, all on the MediKarya platform.
            </p>
            <div className="mt-8 flex flex-col gap-2 text-sm font-semibold text-white/80 min-[460px]:flex-row min-[460px]:items-center min-[460px]:gap-5">
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#9ce1b6]" /> 18 November 2026</span>
              <span className="hidden h-1 w-1 rounded-full bg-[#9ce1b6]/60 min-[460px]:block" />
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#9ce1b6]" /> MAMC, New Delhi</span>
            </div>
            <div className="mt-8 flex flex-col gap-3 min-[460px]:flex-row">
              <Link href="/medventure/join" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9ce1b6] px-5 py-3 text-[14px] font-bold text-[#173c2d] transition-transform hover:-translate-y-0.5 hover:bg-[#dffff0]">
                Sign in to join <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#challenge" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/10">
                See the challenge <ArrowDown className="h-4 w-4" />
              </a>
            </div>
          </div>
          <aside className="relative border-l border-[#9ce1b6]/45 pl-5 sm:pl-7 lg:justify-self-end" aria-label="Challenge route">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#bde8cb]">The brief</p>
            <p className="mt-4 max-w-sm text-2xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[1.8rem]">A room full of decisions. One score that carries through.</p>
            <ol className="mt-7 space-y-5">{[["01", "Three decision pathways", "Round 1 · 10 points"], ["02", "One MediKarya patient", "Round 2 · 10 points"], ["03", "The final board", "Score first, time second"]].map(([number, title, detail]) => <li key={title} className="grid grid-cols-[2.1rem_1fr] gap-3"><span className="font-mono text-xs font-semibold text-[#9ce1b6]">{number}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-[12px] text-white/60">{detail}</p></div></li>)}</ol>
            <p className="mt-8 max-w-xs border-t border-white/15 pt-4 text-[12px] leading-relaxed text-white/65">Equal totals are separated by the lower combined completion time.</p>
          </aside>
          </div>
          <div className="mt-12 flex max-w-2xl flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5 sm:mt-14">
            {[["2", "rounds"], ["20", "points in total"], ["3", "places on the podium"]].map(([number, label]) => (
              <div key={label} className="flex items-baseline gap-2"><p className="font-mono text-xl font-semibold text-[#9ce1b6]">{number}</p><p className="text-[12px] text-white/65">{label}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#ded9c7] bg-[#f4f1e7]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="max-w-2xl"><p className="text-[11px] font-bold tracking-[0.16em] text-[#668672] uppercase">How scoring works</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">A clear score out of 20.</h2><p className="mt-4 text-[15px] leading-relaxed text-[#52675b]">Each round carries the same weight. Both scores and their completion times are recorded on the event platform.</p></div>
          <ol className="mt-9 divide-y divide-[#d6d0bb] border-y border-[#d6d0bb]">{scoring.map(({ mark, label, text }, index) => <li key={label} className="grid gap-3 py-5 sm:grid-cols-[3.5rem_11rem_1fr] sm:items-baseline sm:gap-5"><p className="font-mono text-3xl font-semibold tracking-[-.06em] text-[#376c55]">{mark}</p><h3 className="text-[16px] font-semibold text-[#173c2d]"><span className="mr-2 text-[11px] font-bold tracking-[0.14em] text-[#718477]">0{index + 1}</span>{label}</h3><p className="max-w-2xl text-[14px] leading-relaxed text-[#52675b]">{text}</p></li>)}</ol>
        </div>
      </section>

      <section id="challenge" className="scroll-mt-8 bg-[#10291d] py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#a8ddbb] uppercase">The format</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">Think through both rounds. Let the combined score decide it.</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">Both parts of the challenge happen here. Every decision contributes to the same final leaderboard.</p>
          </div>
          <ol className="space-y-4">
            {challengeSteps.map(({ number, title, text, Icon }) => (
              <li key={number} className="group relative border-t border-white/15 py-5 last:border-b sm:py-6">
                <div className="absolute right-0 top-3 font-mono text-5xl font-semibold tracking-[-.08em] text-white/[.07] transition-colors group-hover:text-white/[.14]" aria-hidden>{number}</div>
                <div className="relative flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#a8ddbb]/30 bg-[#a8ddbb]/10 text-[#a8ddbb]"><Icon className="h-5 w-5" strokeWidth={2} /></span><div><h3 className="text-[17px] font-semibold text-white">{title}</h3><p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-white/65">{text}</p></div></div>
              </li>
            ))}
          </ol>
        </div></div>
      </section>

      <section className="border-y border-[#dbe8df] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center"><p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">The event day</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">One room. One challenge route.</h2><p className="mt-4 text-[15px] leading-relaxed text-[#5a6c61]">Medventure runs the event on site. MediKarya keeps the competition journey in one place.</p></div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {eventDay.map(({ title, text, Icon }, index) => <li key={title} className="relative rounded-2xl border border-[#dbe8df] bg-[#f7faf8] p-5 sm:p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4b8f74] shadow-sm"><Icon className="h-5 w-5" /></span><p className="mt-6 text-[11px] font-bold tracking-[0.14em] text-[#789084] uppercase">Step {index + 1}</p><h3 className="mt-2 text-[17px] font-semibold text-[#173c2d]">{title}</h3><p className="mt-2 text-[14px] leading-relaxed text-[#5a6c61]">{text}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="bg-[#dceee1] py-16 sm:py-24"><div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div><p className="text-[11px] font-bold tracking-[0.16em] text-[#4b8f74] uppercase">After the challenge</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#173c2d] sm:text-4xl">A result you can carry forward.</h2><p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#5a6c61]">Test your clinical thinking in a room full of peers, then keep practising after the event with MediKarya.</p><div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#eff6f1] px-3.5 py-2 text-[13px] font-semibold text-[#376c55]"><Medal className="h-4 w-4" /> Recognition for the top three</div></div>
          <ul className="space-y-3">{benefits.map((benefit) => <li key={benefit} className="flex gap-3 border-b border-[#b8d5c0] py-3 text-[14px] font-medium text-[#264a37]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#376c55]" strokeWidth={2.5} />{benefit}</li>)}</ul>
        </div>
      </div></section>

      <section id="event-day" className="border-y border-[#dbe8df] bg-white">
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
