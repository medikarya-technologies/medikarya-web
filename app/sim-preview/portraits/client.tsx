"use client"

// Dev gallery for the patient portraits. Two sets:
//   ?set=cases   (default) the ten real cases, drawn exactly as the app draws them (same persona logic, seeded by the case id)
//   ?set=ladder  one man and one woman at every age, to see the age cues come in
//   ?set=extras  particular people: a saree over the head, children, authored accessories
// ?only=<n> shows one portrait large; ?size=<px> resizes the grid; ?seed=<text> re-rolls the clothes of the ladder;
// ?page=<n> shows eight at a time (two rows), so one screenshot holds a whole page.

import { useEffect, useMemo, useState } from "react"
import { PatientPortrait } from "@/components/cases/patient-portrait"
import { describeLook, type AppearanceSpec, type ResolvedLook } from "@/lib/simulation/appearance"
import { personaFor } from "@/lib/simulation/persona"

const base: ResolvedLook = { pallor: 0, jaundice: 0, cyanosis: 0, flushed: 0, sweating: 0, sunken_eyes: 0, expression: "calm" }

interface Row {
  title: string
  seed: string
  age: number
  gender: string
  rr: number
  look: Partial<ResolvedLook>
  spec?: AppearanceSpec
}

const CASES: Row[] = [
  { title: "Neonatal jaundice · 4 weeks, M", seed: "neonatal-jaundice-breastmilk", age: 0.08, gender: "Male", rr: 38, look: { jaundice: 2 } },
  { title: "Viral gastroenteritis · 2 y, M", seed: "viral-gastroenteritis", age: 2, gender: "Male", rr: 30, look: { expression: "tired", sunken_eyes: 1 } },
  { title: "Migraine · 21 y, F", seed: "severe-migraine-with-aura", age: 21, gender: "Female", rr: 18, look: { expression: "photophobic" } },
  { title: "Iron deficiency · 24 y, F", seed: "iron-deficiency-anemia-in-pregnancy", age: 24, gender: "Female", rr: 20, look: { pallor: 2, expression: "tired" } },
  { title: "Malaria · 24 y, M", seed: "malaria-returning-traveller-fever", age: 24, gender: "Male", rr: 19, look: { expression: "tired" } },
  { title: "ADPKD · 49 y, F", seed: "autosomal-dominant-polycystic-kidney-disease", age: 49, gender: "Female", rr: 17, look: {} },
  { title: "Goitre · 54 y, F", seed: "non-toxic-nodular-goitre-neck-swelling", age: 54, gender: "Female", rr: 20, look: { swelling: "neck_right" } },
  { title: "STEMI · 58 y, M", seed: "acute-anterior-stemi", age: 58, gender: "Male", rr: 24, look: { pallor: 2, sweating: 3, expression: "anxious" } },
  { title: "B12 deficiency · 63 y, F", seed: "vitamin-b12-deficiency-pernicious-anaemia", age: 63, gender: "Female", rr: 17, look: { pallor: 2, jaundice: 1, expression: "tired" } },
  { title: "Complete heart block · 72 y, M", seed: "complete-heart-block-syncope", age: 72, gender: "Male", rr: 18, look: { pallor: 1, expression: "tired" } },
]

// Particular people: an older woman with her saree drawn over her head, children, and the looks a case can put on them.
const EXTRAS: Row[] = [
  { title: "Elder woman · saree over the head", seed: "ladder:Female:72x2", age: 72, gender: "Female", rr: 18, look: {} },
  { title: "Elder woman · saree over the head, glasses", seed: "ladder:Female:72x3", age: 72, gender: "Female", rr: 18, look: { pallor: 2, expression: "tired" } },
  { title: "Elder woman · saree over the head (teal)", seed: "ladder:Female:72x5", age: 78, gender: "Female", rr: 18, look: { jaundice: 2 } },
  { title: "Elder woman · saree over the head (maroon)", seed: "ladder:Female:72x8", age: 84, gender: "Female", rr: 18, look: { expression: "breathless" } },
  { title: "Toddler girl · calm", seed: "toddler-girl", age: 2, gender: "Female", rr: 26, look: {} },
  { title: "Toddler boy · calm", seed: "toddler-boy", age: 2, gender: "Male", rr: 26, look: {} },
  { title: "Toddler girl · pale, sunken eyes, irritable", seed: "toddler-girl", age: 2, gender: "Female", rr: 34, look: { pallor: 1, sunken_eyes: 2, expression: "irritable" } },
  { title: "Girl 8 y · calm", seed: "girl-8", age: 8, gender: "Female", rr: 20, look: {} },
  { title: "Boy 8 y · in pain", seed: "boy-8", age: 8, gender: "Male", rr: 22, look: { expression: "pain", sweating: 1 } },
  { title: "Teen girl 15 y · calm", seed: "teen-15", age: 15, gender: "Female", rr: 16, look: {} },
  { title: "Infant girl · calm", seed: "infant-girl", age: 0.3, gender: "Female", rr: 34, look: {} },
  { title: "Infant boy · cyanosed", seed: "infant-boy", age: 0.3, gender: "Male", rr: 44, look: { cyanosis: 2, expression: "distress" } },
  { title: "Old man · pain, pale, sweating", seed: "old-man", age: 74, gender: "Male", rr: 26, look: { pallor: 2, sweating: 3, expression: "pain" } },
  { title: "Woman · with a bindi and nose stud (authored)", seed: "authored", age: 40, gender: "Female", rr: 16, look: {}, spec: { accessories: ["earrings", "bindi", "nose_stud"] } },
  { title: "Man · hospital gown (authored)", seed: "gown", age: 50, gender: "Male", rr: 16, look: {}, spec: { attire: "gown" } },
  { title: "Woman · salwar kameez, jaundiced", seed: "salwar-w", age: 28, gender: "Female", rr: 16, look: { jaundice: 3 }, spec: { attire: "salwar" } },
]

const AGES = [0.08, 0.5, 2, 4, 7, 11, 16, 24, 35, 45, 55, 63, 72, 85]

function ladder(seed: string): Row[] {
  return (["Female", "Male"] as const).flatMap((gender) =>
    AGES.map((age) => ({ title: `${gender === "Female" ? "F" : "M"} · ${age < 1 ? `${Math.round(age * 12)} mo` : `${age} y`}`, seed: `${seed}:${gender}:${age}`, age, gender, rr: age < 2 ? 34 : age < 12 ? 24 : 16, look: {} as Partial<ResolvedLook> }))
  )
}

export default function PortraitGallery() {
  const [only, setOnly] = useState<number | null>(null)
  const [size, setSize] = useState(160)
  const [set, setSet] = useState<"cases" | "ladder" | "extras">("cases")
  const [seed, setSeed] = useState("ladder")
  const [page, setPage] = useState<number | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get("only")) setOnly(Number(q.get("only")))
    if (q.get("size")) setSize(Number(q.get("size")))
    if (q.get("set") === "ladder") setSet("ladder")
    if (q.get("set") === "extras") setSet("extras")
    if (q.get("seed")) setSeed(q.get("seed")!)
    if (q.get("page")) setPage(Number(q.get("page")))
  }, [])

  const all = useMemo(() => (set === "ladder" ? ladder(seed) : set === "extras" ? EXTRAS : CASES), [set, seed])
  const rows = only !== null ? all.filter((_, i) => i === only) : page !== null ? all.slice(page * 8, page * 8 + 8) : all

  return (
    <div className="min-h-screen bg-enc-desk p-6 text-enc-ink">
      <h1 className="mb-1 text-lg font-semibold">Patient portraits · {set === "ladder" ? "every age" : set === "extras" ? "particular people" : "the ten cases"}</h1>
      <p className="mb-6 text-sm text-enc-ink-2">The chest breathes at the RR shown; eyes blink. Clothes are chosen from the age, the sex and the seed (the case id).</p>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-5">
        {rows.map((r) => {
          const look = { ...base, ...r.look } as ResolvedLook
          const persona = personaFor({ age: r.age, gender: r.gender, seed: r.seed, spec: r.spec })
          return (
            <figure key={r.title + r.seed} className="rounded-xl border border-enc-line bg-enc-sheet p-3 shadow-enc-sheet">
              <div className="flex items-start gap-3">
                <PatientPortrait persona={persona} look={look} rr={r.rr} style={{ width: only === null ? size : 620, height: only === null ? size : 620 }} className="shrink-0 overflow-hidden rounded-lg" label={r.title} />
                <PatientPortrait persona={persona} look={look} rr={r.rr} variant="face" className="h-10 w-10 shrink-0 overflow-hidden rounded-full" label={r.title} />
              </div>
              <figcaption className="mt-2 text-xs font-medium">{r.title}</figcaption>
              <p className="mt-0.5 text-[11px] text-enc-ink-3">
                {persona.attire.garment}
                {persona.attire.head ? ` + ${persona.attire.head}` : ""} · {persona.hair} · grey {persona.grey.toFixed(2)} · lines {persona.lines.toFixed(2)}
                {persona.glasses ? " · glasses" : ""}
                {persona.moustache !== "none" ? ` · ${persona.moustache} moustache` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-enc-ink-2 italic">{describeLook(look) || "(nothing to remark on)"}</p>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
