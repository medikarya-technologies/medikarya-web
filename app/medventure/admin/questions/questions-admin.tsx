"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, FilePlus2, Plus, Save, Trash2 } from "lucide-react"
import type { EventPathway, PathwayAnswer, PathwayNode } from "@/lib/events/pathways"
import { deleteMedventurePathwayAction, saveMedventurePathwayAction } from "../actions"

type Draft = EventPathway

const input = "w-full rounded-lg border border-[#c9ddd0] bg-white px-3 py-2 text-sm outline-none focus:border-[#4b8f74] focus:ring-2 focus:ring-[#d9f2e2]"
const id = () => Math.random().toString(36).slice(2, 8)

function fresh(position: number): Draft {
  const first = `node-${id()}`
  return { id: `pathway-${id()}`, title: "", position, startNodeId: first, published: false, nodes: [{ id: first, prompt: "", answers: [{ id: `answer-${id()}`, text: "", points: 0, nextNodeId: null }, { id: `answer-${id()}`, text: "", points: 0, nextNodeId: null }] }] }
}

const clone = (pathway: EventPathway): Draft => JSON.parse(JSON.stringify(pathway)) as Draft

/**
 * A whole number that may be negative. A number box reads a lone "-" as empty, so typing "-2" into it snapped back
 * to 0 and saved 2. This keeps what is typed as text, takes digits and one leading minus, and passes on the number
 * (0 while only "-" or nothing is there).
 */
function PointsInput({ value, onChange }: { value: number; onChange: (points: number) => void }) {
  const [text, setText] = useState(String(value))
  // a different pathway or a reset puts a new value in; keep the text in step unless it already means that number
  if (text !== "-" && text !== "" && Number(text) !== value) setText(String(value))
  return (
    <input
      className={input}
      type="text"
      inputMode="text"
      autoComplete="off"
      value={text}
      aria-label="Points"
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "").slice(0, 6)
        setText(next)
        onChange(next === "" || next === "-" ? 0 : Number(next))
      }}
      onBlur={() => { if (text === "" || text === "-") setText("0") }}
    />
  )
}

export function MedventureQuestionsAdmin({ pathways }: { pathways: EventPathway[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | "new">(pathways[0]?.id ?? "new")
  const [draft, setDraft] = useState<Draft>(() => pathways[0] ? clone(pathways[0]) : fresh(1))
  const [pending, start] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nextPosition = useMemo(() => Math.max(0, ...pathways.map((pathway) => pathway.position)) + 1, [pathways])

  const choose = (value: string | "new") => {
    setSelected(value); setNotice(null); setError(null)
    const found = pathways.find((pathway) => pathway.id === value)
    setDraft(found ? clone(found) : fresh(nextPosition))
  }
  const updateNode = (nodeId: string, patch: Partial<PathwayNode>) => setDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node) }))
  const updateAnswer = (nodeId: string, answerId: string, patch: Partial<PathwayAnswer>) => setDraft((current) => ({ ...current, nodes: current.nodes.map((node) => node.id !== nodeId ? node : { ...node, answers: node.answers.map((answer) => answer.id === answerId ? { ...answer, ...patch } : answer) }) }))
  const save = () => start(async () => {
    setError(null); setNotice(null)
    const result = await saveMedventurePathwayAction(draft)
    if (!result.ok) { setError(result.error); return }
    setSelected(result.id)
    setNotice(draft.published ? "Published and ready for the room." : "Draft saved. Publish it when it is ready.")
    router.refresh()
  })
  const remove = () => start(async () => {
    if (selected === "new" || !window.confirm("Delete this pathway? This cannot be undone.")) return
    const result = await deleteMedventurePathwayAction(draft.id)
    if (!result.ok) { setError(result.error); return }
    setNotice("Pathway deleted."); choose("new")
  })

  return <div className="mt-8 grid gap-6 lg:grid-cols-[13rem_1fr]">
    <aside className="space-y-2"><button type="button" onClick={() => choose("new")} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#9fc9ae] bg-[#eff6f1] px-3 py-3 text-left text-sm font-semibold text-[#285640]"><FilePlus2 className="h-4 w-4" /> New pathway</button>{pathways.map((pathway) => <button key={pathway.id} type="button" onClick={() => choose(pathway.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm ${selected === pathway.id ? "bg-[#173c2d] font-semibold text-white" : "border border-[#dbe8df] bg-white text-[#264a37] hover:border-[#9fc9ae]"}`}><span className="truncate">{pathway.title || "Untitled pathway"}</span><span className={`text-[10px] ${selected === pathway.id ? "text-[#a8ddbb]" : pathway.published ? "text-[#376c55]" : "text-[#74877b]"}`}>{pathway.published ? "LIVE" : "DRAFT"}</span></button>)}</aside>
    <section className="rounded-2xl border border-[#dbe8df] bg-white p-5 sm:p-7">
      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}{notice && <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]"><label className="text-sm font-semibold text-[#264a37]">Pathway title<input className={`${input} mt-1.5`} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Severe hyponatremia" /></label><label className="text-sm font-semibold text-[#264a37]">Starts at<select className={`${input} mt-1.5`} value={draft.startNodeId} onChange={(event) => setDraft({ ...draft, startNodeId: event.target.value })}>{draft.nodes.map((node, index) => <option key={node.id} value={node.id}>Decision {index + 1}</option>)}</select></label><label className="flex items-end gap-2 pb-2 text-sm font-semibold text-[#264a37]"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-4 w-4 accent-[#376c55]" /> Publish</label></div>
      <div className="mt-7 space-y-5">{draft.nodes.map((node, nodeIndex) => <article key={node.id} className="rounded-xl border border-[#dbe8df] bg-[#f8fbf8] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4b8f74]">Decision {nodeIndex + 1}</p>{draft.nodes.length > 1 && <button type="button" onClick={() => setDraft((current) => ({ ...current, nodes: current.nodes.filter((item) => item.id !== node.id), startNodeId: current.startNodeId === node.id ? current.nodes.find((item) => item.id !== node.id)?.id ?? "" : current.startNodeId }))} className="text-xs font-semibold text-red-700 hover:underline">Remove decision</button>}</div><label className="mt-3 block text-sm font-semibold text-[#264a37]">Question<textarea className={`${input} mt-1.5 min-h-20 resize-y`} value={node.prompt} onChange={(event) => updateNode(node.id, { prompt: event.target.value })} placeholder="What does the student do next?" /></label><div className="mt-4 space-y-3">{node.answers.map((answer, answerIndex) => <div key={answer.id} className="rounded-lg border border-[#dbe8df] bg-white p-3"><div className="grid gap-2 sm:grid-cols-[1fr_5rem_10rem_auto]"><input className={input} value={answer.text} onChange={(event) => updateAnswer(node.id, answer.id, { text: event.target.value })} placeholder={`Option ${String.fromCharCode(65 + answerIndex)}`} /><PointsInput value={answer.points} onChange={(points) => updateAnswer(node.id, answer.id, { points })} /><select className={input} value={answer.nextNodeId ?? ""} onChange={(event) => updateAnswer(node.id, answer.id, { nextNodeId: event.target.value || null })}><option value="">Finish pathway</option>{/* numbered as the decisions are on the page, so skipping this one must not renumber the rest */}{draft.nodes.map((item, index) => ({ item, number: index + 1 })).filter(({ item }) => item.id !== node.id).map(({ item, number }) => <option key={item.id} value={item.id}>Go to decision {number}</option>)}</select>{node.answers.length > 2 && <button type="button" onClick={() => updateNode(node.id, { answers: node.answers.filter((item) => item.id !== answer.id) })} className="px-2 text-[#8d3027] hover:text-red-700" aria-label="Remove answer"><Trash2 className="h-4 w-4" /></button>}</div><p className="mt-1 text-[11px] text-[#74877b]">Points · then what happens next</p></div>)}<button type="button" onClick={() => updateNode(node.id, { answers: [...node.answers, { id: `answer-${id()}`, text: "", points: 0, nextNodeId: null }] })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#376c55] hover:underline"><Plus className="h-3.5 w-3.5" /> Add answer</button></div></article>)}</div>
      <button type="button" onClick={() => setDraft((current) => ({ ...current, nodes: [...current.nodes, { id: `node-${id()}`, prompt: "", answers: [{ id: `answer-${id()}`, text: "", points: 0, nextNodeId: null }, { id: `answer-${id()}`, text: "", points: 0, nextNodeId: null }] }] }))} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#9fc9ae] bg-[#eff6f1] px-3 py-2 text-sm font-semibold text-[#285640]"><Plus className="h-4 w-4" /> Add decision</button>
      <div className="mt-7 flex flex-wrap gap-3 border-t border-[#dbe8df] pt-5"><button type="button" disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[#376c55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#285640] disabled:opacity-50">{draft.published ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{pending ? "Saving…" : draft.published ? "Save & publish" : "Save draft"}</button>{selected !== "new" && <button type="button" disabled={pending} onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>}<p className="self-center text-xs text-[#74877b]">Students only see published pathways. An answer may go back to an earlier decision; only a student's first answer at each decision scores, and every decision needs a way to finish.</p></div>
    </section>
  </div>
}
