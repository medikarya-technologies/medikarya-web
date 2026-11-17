"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react"
import { finalizeMedventureResultsAction } from "../actions"

export function FinalizeResults({ canFinalize }: { canFinalize: boolean }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  if (!canFinalize) return null

  const finalise = () => {
    if (!window.confirm("Finalise these results and grant the three prizes? This cannot be undone.")) return
    start(async () => {
      const result = await finalizeMedventureResultsAction()
      setMessage(result.ok ? `${result.awarded} prize${result.awarded === 1 ? "" : "s"} granted and the room is finalised.` : result.error)
    })
  }

  return <div className="mt-5 rounded-2xl border border-[#c9ddd0] bg-[#eff6f1] p-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="inline-flex items-center gap-2 text-sm font-semibold text-[#173c2d]"><LockKeyhole className="h-4 w-4 text-[#376c55]" /> Finalise prizes</p><p className="mt-1 max-w-xl text-sm leading-relaxed text-[#5a6c61]">This locks the room and grants one month of Resident to first place, and one month of Intern to second and third place.</p></div><button type="button" disabled={pending} onClick={finalise} className="inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#285640] disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Finalise</button></div>
    {message && <p className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-[#264a37]">{message}</p>}
  </div>
}
