import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, MessageSquareText } from "lucide-react"
import { QrCode } from "@/components/qr-code"
import { canManageMedventure } from "@/lib/events/medventure"
import { RATINGS, summariseFeedback } from "@/lib/events/feedback"
import { allMedventureFeedback } from "@/lib/events/medventure-feedback"
import { siteOrigin } from "@/lib/site-origin"

export const dynamic = "force-dynamic"
export const metadata = { title: "MedVenture × MediKarya feedback" }

const when = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })

export default async function MedventureFeedbackAdminPage() {
  const { userId } = await auth()
  const access = await canManageMedventure(userId)
  if (!access.allowed) redirect("/")
  const [{ available, rows, names }, origin] = await Promise.all([allMedventureFeedback(), siteOrigin()])
  const summary = summariseFeedback(rows)
  // On the event's own address the short path is rewritten (middleware.ts); anywhere else the full one is used.
  const formUrl = origin.includes("medventure.") ? `${origin}/feedback` : `${origin}/medventure/feedback`

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#18231e]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/medventure/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5a6c61] hover:text-[#173c2d]"><ArrowLeft className="h-4 w-4" /> Organiser desk</Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">After the challenge</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">Student feedback</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5a6c61]">Project this QR at the end. Students scan it, rate the challenge and say what to improve. Refresh this page to see new answers.</p>

        <section className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-[#dbe8df] bg-white p-5">
          <QrCode value={formUrl} label="QR code for the Medventure feedback form" className="h-40 w-40 rounded-lg border border-[#dbe8df] p-1" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#4b8f74]">Feedback form</p>
            <code className="mt-1 block break-all text-base font-semibold text-[#264a37]">{formUrl}</code>
            <p className="mt-2 text-sm text-[#5a6c61]">Students must be signed in with the account they joined with. Each student has one form; sending it again replaces their answers.</p>
          </div>
        </section>

        {!available ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">The feedback form is not set up yet. Ask MediKarya to switch it on.</p>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat value={String(summary.count)} label="answers" />
              {RATINGS.map((r) => <Stat key={r.key} value={summary.averages[r.key] === null ? "—" : `${summary.averages[r.key]} / 5`} label={r.label.replace(/\?$/, "")} />)}
              <Stat value={summary.recommendScore === null ? "—" : String(summary.recommendScore)} label={`would recommend (score from ${summary.recommendCount}, −100 to 100)`} />
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-[#dbe8df] bg-white">
              <header className="flex items-center gap-2 border-b border-[#dbe8df] bg-[#eff6f1] px-5 py-4"><MessageSquareText className="h-5 w-5 text-[#4b8f74]" /><h2 className="font-semibold text-[#173c2d]">What students wrote</h2></header>
              {rows.length === 0 ? <p className="p-8 text-center text-sm text-[#5a6c61]">No feedback yet.</p> : (
                <ul className="divide-y divide-[#edf3ef]">
                  {rows.map((r) => (
                    <li key={r.userId} className="grid gap-2 px-5 py-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-[#264a37]">{names.get(r.userId) ?? "Participant"}{r.studyYear ? <span className="font-normal text-[#74877b]"> · {r.studyYear}</span> : null}</p>
                        <p className="text-xs tabular-nums text-[#74877b]">Overall {r.overall}/5{r.roundOne ? ` · R1 ${r.roundOne}` : ""}{r.roundTwo ? ` · R2 ${r.roundTwo}` : ""}{r.realism ? ` · real ${r.realism}` : ""}{r.recommend !== null ? ` · recommend ${r.recommend}/10` : ""} · {when(r.updatedAt)}</p>
                      </div>
                      {r.liked && <p className="text-[#466657]"><span className="font-semibold text-[#264a37]">Liked: </span>{r.liked}</p>}
                      {r.improve && <p className="text-[#466657]"><span className="font-semibold text-[#264a37]">Improve: </span>{r.improve}</p>}
                      {access.owner && r.contactOk && <p className="text-xs text-[#376c55]">Happy to hear from MediKarya: {r.email}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-[#dbe8df] bg-white p-4"><p className="text-2xl font-semibold tracking-[-.03em] text-[#173c2d] tabular-nums">{value}</p><p className="mt-1 text-xs leading-snug text-[#74877b]">{label}</p></div>
}
