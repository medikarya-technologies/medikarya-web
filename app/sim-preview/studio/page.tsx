import { notFound } from "next/navigation"
import { StudioRow } from "@/app/admin/studio/studio-row"
import type { StudioCaseSummary } from "@/lib/studio/source"

// Dev-only: the rows of /admin/studio in each state (no permission, not converted, added by hand, draft, live),
// with made-up cases, to check the layout without an admin login. The buttons call the real admin actions, which
// refuse without an admin session. Returns 404 in production builds.
export default function StudioPreview() {
  if (process.env.NODE_ENV === "production") notFound()
  const base: StudioCaseSummary = {
    id: "preview",
    title: "Left-sided uncomplicated direct inguinal hernia",
    status: "submitted",
    specialty: "General Surgery",
    difficulty: "intermediate",
    author: "Dr. A. Sample",
    createdAt: new Date().toISOString(),
    addedToPlatform: false,
    publishConsent: true,
    consentNote: "Given by the author to MediKarya with their PDF submission",
  }
  const now = new Date().toISOString()
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-10">
        <StudioRow studioCase={{ ...base, id: "a", publishConsent: false, consentNote: null }} converted={null} />
        <StudioRow studioCase={{ ...base, id: "b" }} converted={null} />
        <StudioRow studioCase={{ ...base, id: "c", title: "Non-toxic nodular goitre", status: "approved", addedToPlatform: true }} converted={null} />
        <StudioRow
          studioCase={{ ...base, id: "d" }}
          converted={{
            id: "44-year-old-man-with-a-swelling-in-the-left-groin",
            status: "draft",
            updatedAt: now,
            reviewNotes: ["SpO2 of 98% on room air proposed: not recorded in the case sheet.", "Ultrasound groin findings proposed: not in the case sheet."],
            warnings: ["Only 2 examination sections (general_physical_examination, local_examination): check the case sheet's systemic examination made it in."],
          }}
        />
        <StudioRow studioCase={{ ...base, id: "e", title: "Chronic lower limb ulcer with varicose veins" }} converted={{ id: "56-year-old-man-with-a-leg-ulcer", status: "published", updatedAt: now, reviewNotes: [], warnings: [] }} />
      </div>
    </main>
  )
}
