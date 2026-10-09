import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { CalendarClock, Check, SearchX } from "lucide-react"
import { accountEmail } from "@/lib/plans/account-email"
import { PLAN_OFFERS } from "@/lib/plans/catalog"
import { getJoinLink, hasJoined, type JoinLink } from "@/lib/plans/join-links"
import { cleanJoinCode, passDays } from "@/lib/plans/passes"
import { JoinPanel } from "./join-panel"

// medikarya.in/join/<code>: where a workshop's QR code leads. It says what the workshop gives, asks the student to sign
// in (or sign up), and one tap puts the pass on their account, whatever email they use. Made in Admin → Workshop passes.

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Join the workshop", robots: { index: false, follow: false } }

type Props = { params: Promise<{ code: string }> }

const longDate = (iso: string | Date) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
const lastDay = (endsAt: string) => new Date(Date.parse(endsAt) - 1)

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2">
          <img src="/medikarya.svg" alt="" className="h-8 w-8" />
          <span className="text-[19px] font-bold text-slate-900">MediKarya</span>
        </Link>
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
      </div>
    </main>
  )
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="p-7 text-center">
        <SearchX className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-3 text-[20px] font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{children}</p>
      </div>
    </Shell>
  )
}

const CLOSED: Record<Exclude<JoinLink["state"], "open">, (l: JoinLink) => string> = {
  off: () => "This link has been switched off. If you are at the workshop, ask the organisers.",
  not_yet: (l) => `This link opens on ${longDate(l.opensAt)}.`,
  closed: () => "This link has closed.",
  full: () => "Everyone this workshop was made for has joined, so the link is full. If you are at the workshop, ask the organisers.",
}

export default async function JoinPage({ params }: Props) {
  const code = cleanJoinCode((await params).code)
  if (!code) return <Problem title="This link does not work">Check the link, or scan the code again.</Problem>

  let link: JoinLink | null
  try {
    link = await getJoinLink(code)
  } catch (error) {
    console.error("Could not read a join link:", error)
    return <Problem title="We could not open this link">Please try again in a minute.</Problem>
  }
  if (!link) return <Problem title="This link does not work">Check the link, or scan the code again.</Problem>

  const { userId } = await auth()
  const [joined, email] = userId ? await Promise.all([hasJoined(code, userId), accountEmail(userId)]) : [false, null]
  const offer = PLAN_OFFERS[link.plan]
  const days = passDays(new Date(link.startsAt), new Date(link.endsAt))
  const startsLater = Date.parse(link.startsAt) > Date.now()

  return (
    <Shell>
      <div className="border-b border-slate-100 bg-sky-50/60 px-6 py-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-sky-700">Workshop pass</p>
        <h1 className="mt-1.5 text-[24px] font-bold leading-tight text-slate-900">Join {link.event}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
          <strong>{offer.name}</strong> free for {days} days, until {longDate(lastDay(link.endsAt))}. Nothing to pay, and it does not renew.
        </p>
      </div>

      <div className="px-6 py-6">
        <ul className="space-y-2">
          {offer.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.4} />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {joined ? (
            <JoinPanel code={code} joined email={email} plan={offer.name} until={longDate(lastDay(link.endsAt))} startsOn={startsLater ? longDate(link.startsAt) : null} />
          ) : link.state !== "open" ? (
            <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14.5px] leading-relaxed text-amber-950">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              {CLOSED[link.state](link)}
            </p>
          ) : (
            <JoinPanel code={code} joined={false} email={email} signedIn={!!userId} plan={offer.name} until={longDate(lastDay(link.endsAt))} startsOn={startsLater ? longDate(link.startsAt) : null} />
          )}
        </div>
      </div>
    </Shell>
  )
}
