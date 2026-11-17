import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { canManageMedventure, medventureParticipant } from "@/lib/events/medventure"
import { myMedventureFeedback } from "@/lib/events/medventure-feedback"
import { FeedbackForm } from "./feedback-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "MedVenture × MediKarya feedback" }

// medventure.medikarya.in/feedback: a short form for participants after the challenge. Signed in, one per student.
export default async function MedventureFeedbackPage() {
  const { userId } = await auth()
  if (!userId) redirect("/medventure/join")
  const participant = await medventureParticipant(userId)
  if (!participant) {
    // An organiser checking the feedback QR is not on the event pass: show them the answers, not a join page
    if ((await canManageMedventure(userId)).allowed) redirect("/medventure/admin/feedback")
    redirect("/medventure/join")
  }
  const { available, feedback } = await myMedventureFeedback(participant.userId)

  return (
    <main className="min-h-screen bg-[#f5f8f5] px-4 py-10 text-[#16261d] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Link href="/medventure/results" className="text-sm font-semibold text-[#376c55] hover:underline">← My event result</Link>
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">MedVenture × MediKarya 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d]">How did it go?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5a6c61]">Two minutes. Only the first question is needed; the rest helps us make the next one better.</p>
        {available ? (
          <FeedbackForm initial={feedback} />
        ) : (
          <p className="mt-8 rounded-xl border border-[#dbe8df] bg-white p-5 text-sm text-[#5a6c61]">The feedback form is not open yet. Please let your organisers know.</p>
        )}
      </div>
    </main>
  )
}
