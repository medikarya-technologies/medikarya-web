import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeft } from "lucide-react"
import { getCases } from "@/data/cases"
import { isAdmin } from "@/lib/plans/access"
import { listAdvisors, listInvites } from "@/lib/advisors/invites"
import { studioConfigured } from "@/lib/studio/source"
import { CASE_STUDIO_URL } from "@/lib/site-links"
import { AdvisorsAdmin } from "./advisors-admin"

// Admin → Advisors. Two things: private links that let a professor or senior doctor play chosen cases with no
// account (they give their name, designation and institution, and can leave feedback), and the Clinical Advisory
// Board shown on /contributors, each member with a certificate anyone can verify.

export const dynamic = "force-dynamic"
export const metadata = { title: "Advisors" }

export default async function AdvisorsAdminPage() {
  const { userId } = await auth()
  if (!(await isAdmin(userId))) redirect("/")

  const [{ invites, available }, advisors, cases] = await Promise.all([listInvites(), listAdvisors(), getCases()])
  const options = cases
    .map((c) => ({ id: c.id, title: c.displayTitle, category: c.category, difficulty: c.difficulty, live: !!c.live }))
    .sort((a, b) => Number(b.live) - Number(a.live) || b.difficulty.localeCompare(a.difficulty) || a.title.localeCompare(b.title))

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Advisors</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          Show MediKarya to a professor: a private link to play cases students already play, without signing up, so they can tell you what
          they think of the product. Then add them to the Clinical Advisory Board: they get a certificate with a QR code, and their name
          appears on the{" "}
          <Link href="/contributors" className="font-medium text-sky-700 hover:underline">
            contributors page
          </Link>
          .
        </p>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-slate-500">
          This is not for reviewing new cases. To have a professor review a converted case before it is published, use{" "}
          <Link href="/admin/studio" className="font-medium text-sky-700 hover:underline">
            Studio cases
          </Link>{" "}
          → Send a private link.
        </p>

        {!available ? (
          <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
            One step first: run <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px]">scripts/create_advisors.sql</code> in the Supabase SQL editor of the{" "}
            <strong>main site&apos;s</strong> project. This page works once its two tables exist.
          </p>
        ) : (
          <AdvisorsAdmin invites={invites} advisors={advisors} cases={options} studioUrl={CASE_STUDIO_URL} canCertify={studioConfigured()} />
        )}
      </div>
    </main>
  )
}
