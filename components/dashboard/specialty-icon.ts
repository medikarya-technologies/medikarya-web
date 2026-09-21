import { Activity, Baby, Bean, BookOpen, Brain, Bug, Droplets, Flower2, HeartPulse, Pill, Siren, Stethoscope, Wind, type LucideIcon } from "lucide-react"

// One glyph per specialty, for the library's filter list and rows. Anything unknown gets the stethoscope.
const ICONS: Record<string, LucideIcon> = {
  cardiology: HeartPulse,
  nephrology: Bean,
  haematology: Droplets,
  hematology: Droplets,
  "infectious disease": Bug,
  neurology: Brain,
  pediatrics: Baby,
  paediatrics: Baby,
  "obstetrics gynecology": Flower2,
  "obstetrics gynaecology": Flower2,
  "internal medicine": Stethoscope,
  gastroenterology: Pill,
  pulmonology: Wind,
  "emergency medicine": Siren,
  endocrinology: Activity,
}

export function specialtyIcon(name: string): LucideIcon {
  const key = name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return ICONS[key] ?? (key ? Stethoscope : BookOpen)
}
