import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck, CircleSlash, SearchX } from "lucide-react"
import { studioCertificate, type StudioCertificate } from "@/lib/studio/source"

// Public proof that a MediKarya certificate is real: medikarya.in/verify/<credential id> is the link printed on the
// certificate and the "credential URL" people put on LinkedIn. Certificates are issued in the Case Studio to case
// contributors and clinical reviewers (studio: lib/rewards/); this page only reads them.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ credentialId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { credentialId } = await params
  return { title: `Verify certificate ${decodeURIComponent(credentialId).slice(0, 20)}`, robots: { index: false, follow: false } }
}

const KIND: Record<StudioCertificate["kind"], string> = {
  contributor: "Case contributor",
  reviewer: "Clinical reviewer",
  advisory_board: "Clinical Advisory Board",
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/medikarya.svg" alt="" className="h-7 w-7" />
            <span className="font-bold text-slate-900">MediKarya</span>
          </Link>
          <span className="text-slate-400">·</span>
          <span className="text-[14px] text-slate-600">Certificate verification</span>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-10">{children}</div>
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-[14px] text-slate-500">{label}</dt>
      <dd className="text-[15px] font-medium text-slate-900">{children}</dd>
    </div>
  )
}

export default async function VerifyPage({ params }: Props) {
  const { credentialId } = await params
  const id = decodeURIComponent(credentialId).trim().toUpperCase()

  let certificate: StudioCertificate | null = null
  let unavailable = false
  try {
    certificate = await studioCertificate(id)
  } catch (error) {
    console.error("Could not read certificate:", error)
    unavailable = true
  }

  if (unavailable) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-[20px] font-bold text-slate-900">We could not check this certificate right now</h1>
          <p className="mt-2 text-[15px] text-slate-600">Please try again in a few minutes.</p>
        </div>
      </Shell>
    )
  }

  if (!certificate) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <SearchX className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-3 text-[20px] font-bold text-slate-900">No certificate with this ID</h1>
          <p className="mt-2 text-[15px] text-slate-600">
            MediKarya has not issued a certificate with the credential ID <span className="font-mono">{id.slice(0, 24)}</span>. Check the ID printed on the
            certificate (it looks like MK-2026-00017).
          </p>
        </div>
      </Shell>
    )
  }

  if (certificate.revoked) {
    return (
      <Shell>
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <CircleSlash className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-3 text-[20px] font-bold text-slate-900">This certificate has been withdrawn</h1>
          <p className="mt-2 text-[15px] text-slate-600">
            Credential <span className="font-mono">{certificate.credentialId}</span> is no longer valid.
          </p>
        </div>
      </Shell>
    )
  }

  const issued = new Date(certificate.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
          <BadgeCheck className="h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <h1 className="text-[18px] font-bold text-emerald-900">Verified certificate</h1>
            <p className="text-[14px] text-emerald-800">Issued by MediKarya and valid.</p>
          </div>
        </div>
        <dl className="divide-y divide-slate-100 px-6">
          <Row label="Awarded to">{certificate.recipientName}</Row>
          <Row label="Title">{certificate.title}</Row>
          <Row label="Awarded">{certificate.detail.replace(/^for /, "For ")}</Row>
          <Row label="Category">{KIND[certificate.kind]}</Row>
          <Row label="Issued on">{issued}</Row>
          <Row label="Credential ID">
            <span className="font-mono">{certificate.credentialId}</span>
          </Row>
        </dl>
      </div>
      <p className="mt-5 text-[14px] leading-relaxed text-slate-600">
        MediKarya is a clinical simulation platform for medical students. Its cases are written by medical students from patients they have seen, and
        each one is checked by a doctor before it is published. Contributors and reviewers earn titles for that work.{" "}
        <Link href="/" className="font-medium text-sky-700 hover:underline">
          About MediKarya
        </Link>
      </p>
    </Shell>
  )
}
