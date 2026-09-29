// One muted colour per specialty, so cases in the library tell themselves apart at a glance: a strip along the top
// of the card, a tint behind the patient, and the specialty label. A colour here means a specialty and nothing else
// (results keep green / amber / red). Class names are written out in full so Tailwind finds them.

export interface SpecialtyTone {
  /** The strip along the top of a card. */
  band: string
  /** A soft background: behind the portrait, and the label. */
  soft: string
  /** Text on the soft background. */
  text: string
}

const TONES: Record<string, SpecialtyTone> = {
  cardiology: { band: "bg-rose-500", soft: "bg-rose-50 dark:bg-rose-500/15", text: "text-rose-700 dark:text-rose-300" },
  neurology: { band: "bg-violet-500", soft: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300" },
  haematology: { band: "bg-orange-500", soft: "bg-orange-50 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  hematology: { band: "bg-orange-500", soft: "bg-orange-50 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  "infectious disease": { band: "bg-lime-600", soft: "bg-lime-50 dark:bg-lime-500/15", text: "text-lime-800 dark:text-lime-300" },
  "internal medicine": { band: "bg-sky-500", soft: "bg-sky-50 dark:bg-sky-500/15", text: "text-sky-700 dark:text-sky-300" },
  nephrology: { band: "bg-teal-500", soft: "bg-teal-50 dark:bg-teal-500/15", text: "text-teal-700 dark:text-teal-300" },
  "obstetrics gynecology": { band: "bg-fuchsia-500", soft: "bg-fuchsia-50 dark:bg-fuchsia-500/15", text: "text-fuchsia-700 dark:text-fuchsia-300" },
  "obstetrics gynaecology": { band: "bg-fuchsia-500", soft: "bg-fuchsia-50 dark:bg-fuchsia-500/15", text: "text-fuchsia-700 dark:text-fuchsia-300" },
  pediatrics: { band: "bg-amber-500", soft: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-800 dark:text-amber-300" },
  paediatrics: { band: "bg-amber-500", soft: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-800 dark:text-amber-300" },
  "general surgery": { band: "bg-indigo-500", soft: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  surgery: { band: "bg-indigo-500", soft: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300" },
  pulmonology: { band: "bg-cyan-500", soft: "bg-cyan-50 dark:bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300" },
  gastroenterology: { band: "bg-emerald-500", soft: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  endocrinology: { band: "bg-purple-500", soft: "bg-purple-50 dark:bg-purple-500/15", text: "text-purple-700 dark:text-purple-300" },
  "emergency medicine": { band: "bg-red-500", soft: "bg-red-50 dark:bg-red-500/15", text: "text-red-700 dark:text-red-300" },
  psychiatry: { band: "bg-blue-500", soft: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
}

const NEUTRAL: SpecialtyTone = { band: "bg-slate-400", soft: "bg-slate-100 dark:bg-slate-500/15", text: "text-slate-700 dark:text-slate-300" }

export function specialtyTone(name: string): SpecialtyTone {
  const key = name.toLowerCase().replace(/&/g, " ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim()
  return TONES[key] ?? NEUTRAL
}
