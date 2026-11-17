"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Loader2, Stethoscope } from "lucide-react"
import type { EventPathway, RoundOneState } from "@/lib/events/pathways"
import { roundOneMaximum } from "@/lib/events/pathways"
import { roundOnePoints } from "@/lib/events/medventure-scoring"
import { answerMedventurePathwayAction, beginMedventureRoundTwoAction } from "./actions"

export function ChallengePlayer({ pathways, initialState, initialScore, roundOneComplete, roundTwoCaseId }: { pathways: EventPathway[]; initialState: RoundOneState; initialScore: number; roundOneComplete: boolean; roundTwoCaseId: string | null }) {
  const [state, setState] = useState(initialState)
  const [score, setScore] = useState(initialScore)
  const [complete, setComplete] = useState(roundOneComplete)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const current = pathways.find((pathway) => pathway.id === state.currentPathwayId)
  const node = current?.nodes.find((item) => item.id === state.currentNodeId)
  const rawMaximum = roundOneMaximum(pathways)
  const choose = (answerId: string) => start(async () => {
    setError(null)
    const result = await answerMedventurePathwayAction(answerId)
    if (!result.ok) { setError(result.error); return }
    setState(result.state); setScore(result.score); setComplete(result.complete)
  })
  const startRoundTwo = () => start(async () => {
    setError(null)
    const result = await beginMedventureRoundTwoAction()
    if (!result.ok) { setError(result.error); return }
    // Cases live under /dashboard/cases (there is no /case route)
    window.location.assign(`/dashboard/cases/${encodeURIComponent(result.caseId)}`)
  })

  return <main className="min-h-screen bg-[#f5f8f5] text-[#16261d]"><header className="border-b border-[#dce8df] bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2"><img src="/medikarya.svg" alt="" className="h-7 w-7" /><span className="font-bold text-[#173c2d]">MediKarya</span></Link><span className="text-xs font-bold uppercase tracking-[.14em] text-[#4b8f74]">Medventure 2026</span></div></header><div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">Your challenge</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d] sm:text-4xl">Two rounds. Twenty points.</h1><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className={`rounded-xl border p-4 ${complete ? "border-[#8bc8a1] bg-[#eaf6ed]" : "border-[#c9ddd0] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4b8f74]">Round 1</p><p className="mt-1 font-semibold text-[#173c2d]">Decision pathways</p><p className="mt-2 text-sm text-[#5a6c61]">{complete ? `${roundOnePoints(score, rawMaximum)} / 10 secured` : `${state.completedPathwayIds.length} of ${pathways.length} pathways finished`}</p></div><div className="rounded-xl border border-[#c9ddd0] bg-white p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4b8f74]">Round 2</p><p className="mt-1 font-semibold text-[#173c2d]">MediKarya patient</p><p className="mt-2 text-sm text-[#5a6c61]">Worth 10 points after your encounter is scored.</p></div></div>{error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {!complete && current && node ? <section className="mt-8 rounded-2xl border border-[#dbe8df] bg-white p-5 shadow-sm sm:p-8"><div className="flex items-center justify-between gap-4"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#4b8f74]">Round 1 · {current.title}</p><span className="text-xs text-[#74877b]">Pathway {state.completedPathwayIds.length + 1} of {pathways.length}</span></div><h2 className="mt-5 text-xl font-semibold leading-snug tracking-[-.025em] text-[#173c2d] sm:text-2xl">{node.prompt}</h2><div className="mt-6 space-y-3">{node.answers.map((answer, index) => <button key={answer.id} type="button" disabled={pending} onClick={() => choose(answer.id)} className="group flex w-full items-start gap-3 rounded-xl border border-[#dbe8df] p-4 text-left transition hover:border-[#4b8f74] hover:bg-[#f2f9f4] disabled:opacity-50"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#9fc9ae] text-xs font-bold text-[#376c55]">{String.fromCharCode(65 + index)}</span><span className="flex-1 text-sm font-medium leading-relaxed text-[#264a37]">{answer.text}</span>{pending && <Loader2 className="h-4 w-4 animate-spin text-[#4b8f74]" />}</button>)}</div></section> : <section className="mt-8 rounded-2xl border border-[#9fc9ae] bg-[#eaf6ed] p-6 sm:p-8"><CheckCircle2 className="h-8 w-8 text-[#376c55]" /><h2 className="mt-4 text-2xl font-semibold tracking-[-.035em] text-[#173c2d]">Round 1 complete.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#466657]">Your pathway score is locked at {roundOnePoints(score, rawMaximum)} / 10. Start the MediKarya patient when the room is ready. Your clinical score will be converted to the other 10 points.</p><button type="button" disabled={pending || !roundTwoCaseId} onClick={startRoundTwo} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#285640] disabled:cursor-not-allowed disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Start Round 2 <ArrowRight className="h-4 w-4" /></button>{!roundTwoCaseId && <p className="mt-3 text-sm text-[#6b5b32]">Round 2 is being prepared by your organiser.</p>}<Link href="/medventure/results" className="ml-4 text-sm font-semibold text-[#376c55] hover:underline">See my event result</Link></section>}</div></main>
}
