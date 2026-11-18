"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Loader2, Stethoscope } from "lucide-react"
import type { EventPathway, PathwayNode, RoundOneState } from "@/lib/events/pathways"
import { answerMedventurePathwayAction, beginMedventureRoundTwoAction } from "./actions"

export function ChallengePlayer({ pathways, initialState, roundOneComplete, roundTwoCaseId }: { pathways: EventPathway[]; initialState: RoundOneState; roundOneComplete: boolean; roundTwoCaseId: string | null }) {
  const [state, setState] = useState(initialState)
  const [complete, setComplete] = useState(roundOneComplete)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const current = pathways.find((pathway) => pathway.id === state.currentPathwayId)
  const node = current?.nodes.find((item) => item.id === state.currentNodeId)
  const choose = (answerId: string) => start(async () => {
    setError(null)
    const result = await answerMedventurePathwayAction(answerId)
    if (!result.ok) { setError(result.error); return }
    setState(result.state); setComplete(result.complete)
  })
  const startRoundTwo = () => start(async () => {
    setError(null)
    const result = await beginMedventureRoundTwoAction()
    if (!result.ok) { setError(result.error); return }
    // Cases live under /dashboard/cases (there is no /case route). ?event=medventure makes the case end on the event
    // result instead of its debrief (components/cases/simulation-interaction.tsx).
    window.location.assign(`/dashboard/cases/${encodeURIComponent(result.caseId)}?event=medventure`)
  })

  // Scores stay hidden until both rounds are done; the result page shows them together.
  return <main className="min-h-screen bg-[#f5f8f5] text-[#16261d]"><header className="border-b border-[#dce8df] bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2"><img src="/medikarya.svg" alt="" className="h-7 w-7" /><span className="font-bold text-[#173c2d]">MedVenture × MediKarya</span></Link><span className="text-xs font-bold uppercase tracking-[.14em] text-[#4b8f74]">MedVenture × MediKarya 2026</span></div></header><div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#4b8f74]">Your challenge</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-[#173c2d] sm:text-4xl">Two rounds. Twenty points.</h1><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className={`rounded-xl border p-4 ${complete ? "border-[#8bc8a1] bg-[#eaf6ed]" : "border-[#c9ddd0] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4b8f74]">Round 1</p><p className="mt-1 font-semibold text-[#173c2d]">Decision pathways</p><p className="mt-2 text-sm text-[#5a6c61]">{complete ? "Done" : `${state.completedPathwayIds.length} of ${pathways.length} pathways finished`}</p></div><div className="rounded-xl border border-[#c9ddd0] bg-white p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4b8f74]">Round 2</p><p className="mt-1 font-semibold text-[#173c2d]">MediKarya patient</p><p className="mt-2 text-sm text-[#5a6c61]">One live patient, worth 10 points.</p></div></div>{error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {!complete && current && node ? <section className="mt-8 rounded-2xl border border-[#dbe8df] bg-white p-5 shadow-sm sm:p-8"><div className="flex items-center justify-between gap-4"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#4b8f74]">Round 1 · {current.title}</p><span className="text-xs text-[#74877b]">Pathway {state.completedPathwayIds.length + 1} of {pathways.length}</span></div>{/* Keyed by the step, so every new decision starts with nothing highlighted, even when it is the same decision again */}<Decision key={`${current.id}:${node.id}:${state.steps.length}`} node={node} pending={pending} revisit={state.steps.some((step) => step.pathwayId === current.id && step.nodeId === node.id)} onChoose={choose} /></section> : <section className="mt-8 rounded-2xl border border-[#9fc9ae] bg-[#eaf6ed] p-6 sm:p-8"><CheckCircle2 className="h-8 w-8 text-[#376c55]" /><h2 className="mt-4 text-2xl font-semibold tracking-[-.035em] text-[#173c2d]">Round 1 complete.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#466657]">Your answers are saved. Now meet the MediKarya patient. You will see your scores, time and rank for both rounds as soon as you finish Round 2.</p><button type="button" disabled={pending || !roundTwoCaseId} onClick={startRoundTwo} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#285640] disabled:cursor-not-allowed disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Start Round 2 <ArrowRight className="h-4 w-4" /></button>{!roundTwoCaseId && <p className="mt-3 text-sm text-[#6b5b32]">Round 2 is being prepared by your organiser.</p>}</section>}</div></main>
}

/**
 * One decision. After a tap the next decision's answers sit under the same finger or mouse, so a hover highlight would
 * look like an answer was already chosen there: highlights only switch on once the pointer moves over this question.
 */
function Decision({ node, pending, revisit, onChoose }: { node: PathwayNode; pending: boolean; revisit: boolean; onChoose: (answerId: string) => void }) {
  const [armed, setArmed] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const top = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    // A long scenario pushes the answers down, so each new decision starts from its question
    const rect = top.current?.getBoundingClientRect()
    if (rect && rect.top < 0) top.current?.scrollIntoView({ block: "start" })
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])
  return <><h2 ref={top} className="mt-5 scroll-mt-4 whitespace-pre-line text-[15px] font-medium leading-relaxed text-[#173c2d] sm:text-base">{node.prompt}</h2>{revisit && <p className="mt-2 text-sm text-[#6b5b32]">You have answered this question before. Choose again to go on; your first answer is the one that counts.</p>}<div className="mt-6 space-y-3" onPointerMove={() => { if (!armed) setArmed(true) }}>{node.answers.map((answer, index) => <button key={answer.id} type="button" disabled={pending} onClick={() => { setChosen(answer.id); onChoose(answer.id) }} className={`group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition disabled:opacity-50 ${chosen === answer.id ? "border-[#4b8f74] bg-[#f2f9f4]" : "border-[#dbe8df]"} ${armed ? "hover:border-[#4b8f74] hover:bg-[#f2f9f4]" : ""}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#9fc9ae] text-xs font-bold text-[#376c55]">{String.fromCharCode(65 + index)}</span><span className="flex-1 text-sm font-medium leading-relaxed text-[#264a37]">{answer.text}</span>{pending && chosen === answer.id && <Loader2 className="h-4 w-4 animate-spin text-[#4b8f74]" />}</button>)}</div></>
}
