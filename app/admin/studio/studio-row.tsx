"use client"

// One studio case on /admin/studio: what it is, whether the author's permission to publish is recorded, and where it
// stands on MediKarya with the next step:
//   not converted → Convert
//   draft, not reviewed → Review report · Send for review (a private link for a professor)
//   draft, changes asked → the professor's comments · Rebuild with comments
//   draft, approved → Publish (with the author's reward)
//   live → View · Unpublish

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, FileText, Loader2, MessageSquareWarning, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StudioCaseSummary } from "@/lib/studio/source"
import { convertToDraft, deleteDraft, publishCase, rebuildWithComments, sendForReview, unpublishCase, type ActionResult } from "./actions"

export interface Converted {
  id: string
  status: string
  updatedAt: string
  reviewNotes: string[]
  warnings: string[]
  /** The latest review of this version of the case, if one was sent. */
  review: {
    sentAt: string
    expiresAt: string
    decision: "approved" | "changes_requested" | null
    reviewer: string
    showName: boolean
    comments: string | null
    decidedAt: string | null
    /** From the studio's reviewer queue, or a private link you sent. */
    via: "queue" | "link"
  } | null
  /** This version is in the studio's reviewer queue, for any verified reviewer of its specialty to claim. */
  inQueue: boolean
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export function StudioRow({ studioCase: c, converted }: { studioCase: StudioCaseSummary; converted: Converted | null }) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [email, setEmail] = useState(c.authorEmail ?? "")
  const [reward, setReward] = useState(true)

  const run = (label: string, action: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(label)
    setResult(null)
    start(async () => {
      const r = await action()
      setResult(r)
      if (r.ok && label === "publish") setPublishing(false)
      setBusy(null)
    })
  }

  const live = converted?.status === "published"
  const draft = converted && !live
  const review = converted?.review ?? null
  const approved = review?.decision === "approved"
  const changes = review?.decision === "changes_requested"
  const waiting = review && !review.decision && Date.parse(review.expiresAt) > Date.now()
  const expired = review && !review.decision && !waiting
  // Marked "added to platform" in the studio but not made by the converter: it was added by hand before.
  const addedByHand = c.addedToPlatform && !converted
  const spin = (label: string) => busy === label && <Loader2 className="mr-2 h-4 w-4 animate-spin" />

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-slate-900">{c.title}</h2>
            {live && <Badge tone="green">Live on MediKarya</Badge>}
            {draft && approved && <Badge tone="green">Approved, ready to publish</Badge>}
            {draft && changes && <Badge tone="red">Changes requested</Badge>}
            {draft && waiting && <Badge tone="amber">With reviewer</Badge>}
            {draft && !review && <Badge tone="amber">{converted.inQueue ? "In the reviewer queue" : "Draft, not reviewed"}</Badge>}
            {draft && expired && <Badge tone="amber">Review link expired</Badge>}
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

          {/* Where the review stands */}
          {draft && !review && converted.inQueue && (
            <p className="mt-2 text-[13.5px] text-slate-600">Waiting in the studio&apos;s reviewer queue for a verified reviewer of this specialty. Or send a private link to someone you know.</p>
          )}
          {draft && review && (
            <div className="mt-2 text-[13.5px]">
              {approved && (
                <p className="text-emerald-800">
                  ✓ Approved by <strong>{review.reviewer}</strong> on {day(review.decidedAt!)}
                  {review.via === "queue" ? " (reviewer queue)" : " (private link)"}.{" "}
                  <span className="text-slate-500">{review.showName ? "Their name will show on the case." : "They asked not to be named on the case."}</span>
                </p>
              )}
              {waiting &&
                (review.via === "queue" ? (
                  <p className="text-slate-600">
                    Claimed by <strong>{review.reviewer}</strong> on {day(review.sentAt)}; due by {day(review.expiresAt)}.
                  </p>
                ) : (
                  <p className="text-slate-600">Private link sent on {day(review.sentAt)}; waiting. It expires {day(review.expiresAt)}.</p>
                ))}
              {expired &&
                (review.via === "queue" ? (
                  <p className="text-amber-800">The reviewer who claimed it on {day(review.sentAt)} didn&apos;t finish; it is back in the queue.</p>
                ) : (
                  <p className="text-amber-800">The private link sent on {day(review.sentAt)} expired unused.</p>
                ))}
              {changes && (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-3 text-red-950">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <MessageSquareWarning className="h-4 w-4" /> {review.reviewer} asked for changes on {day(review.decidedAt!)}:
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{review.comments}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
          {!converted && (
            <Button
              disabled={pending || !c.publishConsent}
              onClick={() =>
                run("convert", () => convertToDraft(c.id), addedByHand ? "This case was already added to MediKarya by hand. Converting makes a second, separate draft. Continue?" : undefined)
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
                <Link href={`/admin/studio/report/${converted.id}`} target="_blank">
                  <FileText className="mr-1.5 h-4 w-4" /> Review report
                </Link>
              </Button>
              {approved ? (
                <Button disabled={pending} onClick={() => setPublishing((v) => !v)}>
                  Publish…
                </Button>
              ) : changes ? (
                <Button disabled={pending} onClick={() => run("rebuild", () => rebuildWithComments(c.id), "Rebuild the case with the reviewer's comments? About a minute.")}>
                  {busy === "rebuild" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rebuilding…</> : "Rebuild with comments"}
                </Button>
              ) : (
                <Button disabled={pending} variant={converted.inQueue ? "outline" : "default"} onClick={() => run("send", () => sendForReview(converted.id))}>
                  {spin("send") || <Send className="mr-1.5 h-4 w-4" />}
                  {waiting && review?.via === "link" ? "New private link" : "Send a private link"}
                </Button>
              )}
              {changes && (
                <Button disabled={pending} variant="outline" onClick={() => run("send", () => sendForReview(converted.id))}>
                  {spin("send")}Private link for it as it is
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link href={`/dashboard/cases/${converted.id}`} target="_blank">
                  Play-test <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                disabled={pending || !c.publishConsent}
                variant="ghost"
                onClick={() => run("convert", () => convertToDraft(c.id), "Convert again from the case sheet? This replaces the draft, and it will need a new review.")}
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
                {spin("unpublish")}Unpublish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Publish, with the author's reward */}
      {draft && approved && publishing && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-[14px] font-semibold text-emerald-950">Publish this case</p>
          <label className="mt-3 flex items-center gap-2 text-[14px] text-slate-800">
            <input type="checkbox" checked={reward} onChange={(e) => setReward(e.target.checked)} className="h-4 w-4" />
            Reward the author with 1 month of Resident (up to 6 months in all)
          </label>
          {reward && (
            <label className="mt-2 block text-[13.5px] text-slate-700">
              Author&apos;s email{c.authorEmail ? " (from their Case Studio account)" : " (they submitted by PDF, so type it)"}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="author@example.com"
                className="mt-1 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[14px] outline-none focus:border-sky-500"
              />
              <span className="mt-1 block text-[12px] text-slate-500">They get it when they sign in to MediKarya with this same email.</span>
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <Button disabled={pending || (reward && !email.trim())} onClick={() => run("publish", () => publishCase(converted.id, reward ? email : null))}>
              {spin("publish")}Publish now
            </Button>
            <Button variant="ghost" onClick={() => setPublishing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn("mt-4 rounded-lg p-3 text-[13.5px]", result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900")}>
          {result.ok ? result.message : result.error}
          {result.ok && result.link && <CopyLink link={result.link} />}
          {!result.ok && result.details && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {result.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {draft && !approved && (converted.reviewNotes.length > 0 || converted.warnings.length > 0) && (
        <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-amber-900">
            What the AI added ({converted.reviewNotes.length}){converted.warnings.length > 0 && ` and ${converted.warnings.length} warning${converted.warnings.length === 1 ? "" : "s"}`}
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

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={link} onFocus={(e) => e.target.select()} className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 font-mono text-[12.5px] text-slate-800" />
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => setCopied(true))
        }}
      >
        <Copy className="mr-1.5 h-4 w-4" /> {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  )
}

function Badge({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const tones = { green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800" }
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>
}
