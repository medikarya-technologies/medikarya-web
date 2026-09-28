"use client"

// One studio case on /admin/studio: what it is, whether the author's permission to publish is recorded, and
// where it stands on MediKarya (not converted / draft / live) with the next step. A draft shows what the AI had to
// make up, which is what the play-test should check.

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StudioCaseSummary } from "@/lib/studio/source"
import { convertToDraft, deleteDraft, publishCase, unpublishCase, type ActionResult } from "./actions"

export interface Converted {
  id: string
  status: string
  updatedAt: string
  reviewNotes: string[]
  warnings: string[]
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export function StudioRow({ studioCase: c, converted }: { studioCase: StudioCaseSummary; converted: Converted | null }) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  const run = (label: string, action: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(label)
    setResult(null)
    start(async () => {
      setResult(await action())
      setBusy(null)
    })
  }

  const live = converted?.status === "published"
  const draft = converted && !live
  // Marked "added to platform" in the studio but not made by the converter: it was added by hand before.
  const addedByHand = c.addedToPlatform && !converted

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-slate-900">{c.title}</h2>
            {live && <Badge tone="green">Live on MediKarya</Badge>}
            {draft && <Badge tone="amber">Draft</Badge>}
          </div>
          <p className="mt-1 text-[13.5px] text-slate-600">
            {c.specialty} · {c.difficulty} · studio status <span className="font-medium">{c.status}</span>
            {c.author ? <> · by <span className="font-medium">{c.author}</span></> : <> · <span className="text-amber-700">no author name</span></>}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
            {c.publishConsent ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-slate-600">Permission to publish recorded{c.consentNote ? `: ${c.consentNote}` : ""}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-800">No permission to publish recorded, so it can&apos;t be converted.</span>
              </>
            )}
          </p>
          {addedByHand && <p className="mt-1.5 text-[13px] text-slate-500">Marked &quot;added to platform&quot; in the studio: it was added to MediKarya by hand before.</p>}
          {converted && <p className="mt-1.5 text-[12.5px] text-slate-500">MediKarya case <code>{converted.id}</code> · updated {when(converted.updatedAt)}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!converted && (
            <Button
              disabled={pending || !c.publishConsent}
              onClick={() =>
                run(
                  "convert",
                  () => convertToDraft(c.id),
                  addedByHand ? "This case was already added to MediKarya by hand. Converting makes a second, separate draft. Continue?" : undefined
                )
              }
              variant={addedByHand ? "outline" : "default"}
            >
              {busy === "convert" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {busy === "convert" ? "Converting… about a minute" : addedByHand ? "Convert anyway" : "Convert"}
            </Button>
          )}
          {draft && (
            <>
              <Button asChild variant="outline">
                <Link href={`/dashboard/cases/${converted.id}`} target="_blank">
                  Play-test <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button disabled={pending} onClick={() => run("publish", () => publishCase(converted.id), "Publish this case? Students will see it in the library within a minute.")}>
                {busy === "publish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish
              </Button>
              <Button
                disabled={pending || !c.publishConsent}
                variant="outline"
                onClick={() => run("convert", () => convertToDraft(c.id), "Convert again? This replaces the current draft.")}
              >
                {busy === "convert" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting…</> : "Re-convert"}
              </Button>
              <Button disabled={pending} variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => run("delete", () => deleteDraft(converted.id), "Delete this draft?")}>
                Delete draft
              </Button>
            </>
          )}
          {live && (
            <>
              <Button asChild variant="outline">
                <Link href={`/dashboard/cases/${converted.id}`} target="_blank">
                  View <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button disabled={pending} variant="outline" onClick={() => run("unpublish", () => unpublishCase(converted.id), "Take this case down? Students will stop seeing it.")}>
                {busy === "unpublish" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Unpublish
              </Button>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className={cn("mt-4 rounded-lg p-3 text-[13.5px]", result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900")}>
          {result.ok ? result.message : result.error}
          {!result.ok && result.details && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {result.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {draft && (converted.reviewNotes.length > 0 || converted.warnings.length > 0) && (
        <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3" open>
          <summary className="cursor-pointer text-[13.5px] font-semibold text-amber-900">
            Check before publishing: what the AI made up ({converted.reviewNotes.length}){converted.warnings.length > 0 && ` and ${converted.warnings.length} warning${converted.warnings.length === 1 ? "" : "s"}`}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-amber-950">
            {converted.reviewNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {converted.warnings.map((w) => (
              <li key={w} className="text-red-800">{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Badge({ tone, children }: { tone: "green" | "amber"; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone === "green" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
      {children}
    </span>
  )
}
