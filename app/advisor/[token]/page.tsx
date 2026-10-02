import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getCaseById } from "@/data/cases"
import { supabaseServer } from "@/lib/supabase/server"
import { INVITE_COOKIE, inviteForToken, inviteOpen } from "@/lib/advisors/invites"
import { isDraft } from "@/lib/plans/access"
import { caseKindOf } from "@/lib/plans/limits"
import { AdvisorDetailsForm } from "./details-form"
import { AdvisorCases, type InvitedCase } from "./advisor-cases"

// An advisor's private page: a professor or senior doctor opens the link we sent, says who they are, and plays the
// cases chosen for them, with no account. The link is the permission (lib/advisors/invites.ts). Never indexed.

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "MediKarya for advisors", robots: { index: false, follow: false } }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <img src="/medikarya.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-slate-900">MediKarya</span>
          <span className="text-slate-400">·</span>
          <span className="text-[14px] text-slate-600">For advisors</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">{children}</div>
    </main>
  )
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-[20px] font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-[15px] text-slate-600">{text}</p>
    </div>
  )
}

export default async function AdvisorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await inviteForToken(token)

  if (!invite) return <Shell><Notice title="This link is not valid" text="Please check you opened the full link you were sent, or ask the MediKarya team for a new one." /></Shell>
  if (!inviteOpen(invite)) return <Shell><Notice title="This link has expired" text="Thank you for your time. Please ask the MediKarya team for a new link if you would like to continue." /></Shell>

  // The cases open only in a browser that holds this link's token (set when they say who they are).
  const entered = !!invite.details_at && (await cookies()).get(INVITE_COOKIE)?.value === token

  if (!entered) {
    return (
      <Shell>
        <div>
          <p className="text-[12px] font-semibold tracking-wider text-sky-700 uppercase">An invitation</p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold text-slate-900 sm:text-[34px]">
            {invite.details_at ? `Welcome back${invite.name ? `, ${invite.name}` : ""}` : "See how our students learn"}
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-slate-600">
            MediKarya is a patient simulator for medical students: they interview an AI patient, examine them, order investigations and commit to a
            diagnosis and plan, then see where their reasoning held up. We would value your eye on{" "}
            {invite.case_ids.length === 1 ? "one of our cases" : `${invite.case_ids.length} of our cases`}. No account is needed, and each case takes
            10 to 15 minutes.
          </p>
        </div>
        <AdvisorDetailsForm
          token={token}
          initial={{
            name: invite.name ?? "",
            designation: invite.designation ?? "",
            department: invite.department ?? "",
            institution: invite.institution ?? "",
            listName: invite.list_name,
          }}
          returning={!!invite.details_at}
        />
      </Shell>
    )
  }

  // Only what a briefing shows: the title a student sees before starting, never the diagnosis.
  const cases: InvitedCase[] = []
  for (const id of invite.case_ids) {
    const c = (await getCaseById(id)) as Record<string, any> | null
    if (!c || isDraft(c)) continue
    cases.push({
      id: c.id,
      title: c.displayTitle ?? "Patient case",
      category: c.category ?? "",
      difficulty: c.difficulty ?? "",
      minutes: c.estimatedTime ?? null,
      live: caseKindOf(c).live,
    })
  }
  const { data: attempts } = await supabaseServer.from("case_attempts").select("case_id, score").eq("guest_id", invite.id)
  const played: Record<string, number | null> = {}
  for (const a of attempts ?? []) played[a.case_id] = Math.max(played[a.case_id] ?? 0, a.score ?? 0)

  return (
    <AdvisorCases
      token={token}
      inviteId={invite.id}
      name={invite.name ?? ""}
      cases={cases}
      played={played}
      feedback={invite.feedback ?? ""}
      expires={invite.expires_at}
    />
  )
}
