import { notFound } from "next/navigation"
import { StudioRow } from "@/app/admin/studio/studio-row"
import type { StudioCaseSummary } from "@/lib/studio/source"

// Dev-only: the rows of /admin/studio in each state (no permission, not converted, added by hand, draft not reviewed,
// with reviewer, changes requested, approved, live),
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
    authorEmail: null,
    sentBackAt: null,
  }
  const now = new Date().toISOString()
  const later = new Date(Date.now() + 10 * 86_400_000).toISOString()
  const draft = {
    id: "44-year-old-man-with-a-swelling-in-the-left-groin",
    status: "draft",
    updatedAt: now,
    reviewNotes: ["SpO2 of 98% on room air proposed: not recorded in the case sheet.", "Ultrasound groin findings proposed: not in the case sheet."],
    warnings: [],
    live: false,
  }
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-10">
        <StudioRow studioCase={{ ...base, id: "a", publishConsent: false, consentNote: null }} converted={null} />
        <StudioRow studioCase={{ ...base, id: "b" }} converted={null} />
        <StudioRow studioCase={{ ...base, id: "c", title: "Non-toxic nodular goitre", status: "approved", addedToPlatform: true }} converted={null} />
        <StudioRow studioCase={{ ...base, id: "d" }} converted={{ ...draft, review: null, inQueue: true }} />
        <StudioRow studioCase={{ ...base, id: "d2" }} converted={{ ...draft, review: { sentAt: now, expiresAt: later, decision: null, reviewer: "", showName: false, comments: null, decidedAt: null, via: "queue" as const }, inQueue: true }} />
        <StudioRow
          studioCase={{ ...base, id: "d3" }}
          converted={{ ...draft, review: { sentAt: now, expiresAt: later, decision: "changes_requested", reviewer: "Dr. A. Reviewer, Professor, General Surgery, Sample Medical College", showName: false, comments: "Hb should be about 11 g/dL; the case documents no pallor. Add USG of the scrotum to the core tests.", decidedAt: now, via: "queue" as const }, inQueue: true }}
        />
        <StudioRow
          studioCase={{ ...base, id: "d4", authorEmail: "author@example.com" }}
          converted={{ ...draft, review: { sentAt: now, expiresAt: later, decision: "approved", reviewer: "Dr. A. Reviewer, Professor, General Surgery, Sample Medical College", showName: true, comments: null, decidedAt: now, via: "queue" as const }, inQueue: true }}
        />
        <StudioRow studioCase={{ ...base, id: "e", title: "Chronic lower limb ulcer with varicose veins" }} converted={{ id: "56-year-old-man-with-a-leg-ulcer", status: "published", updatedAt: now, reviewNotes: [], warnings: [], review: null, inQueue: true, live: false }} />
      </div>
    </main>
  )
}
