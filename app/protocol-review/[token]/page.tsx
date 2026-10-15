import type { Metadata } from "next"
import { isProtocolLinkOpen, protocolReviewForToken } from "@/lib/protocol-review/links"
import { ProtocolForm } from "./protocol-form"

// A professor's private page for the fluid protocol decisions. No account needed: the link is the permission
// (lib/protocol-review/links.ts). Never indexed.

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Clinical decisions", robots: { index: false, follow: false } }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <img src="/medikarya.svg" alt="" className="h-7 w-7" />
          <span className="font-bold text-slate-900">MediKarya</span>
          <span className="text-slate-400">·</span>
          <span className="text-[14px] text-slate-600">Clinical review</span>
        </div>
      </header>
      {children}
    </main>
  )
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-[20px] font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-[15px] text-slate-600">{text}</p>
      </div>
    </div>
  )
}

export default async function ProtocolReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const review = await protocolReviewForToken(token)
  if (!review) return <Shell><Notice title="This link is not valid" text="Please check you opened the full link you were sent, or ask the MediKarya team for a new one." /></Shell>
  if (!isProtocolLinkOpen(review)) return <Shell><Notice title="This link has expired" text="Please ask the MediKarya team for a new one." /></Shell>
  return (
    <Shell>
      <ProtocolForm
        token={token}
        initial={{
          answers: review.answers ?? {},
          name: review.reviewer_name ?? "",
          designation: review.reviewer_designation ?? "",
          institution: review.reviewer_institution ?? "",
          submittedAt: review.submitted_at,
        }}
      />
    </Shell>
  )
}
