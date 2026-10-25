// The short follow-up for the dengue fluid protocol (October 2026). The first package (decisions.ts) asked 22
// questions written for the engine; the professor answered the 11 clinical ones and found the rest hard to follow.
// This one shows the case and the treatment flowchart with his answers already in, and asks only what is still open,
// in plain words, each option a whole answer he can tick. The physiology and game-time numbers are ours to set; he
// judges them by playing the case.
//
// Every number here is from the NCVBDC 2023 dengue guideline (page in brackets), his own answers, or the case sheet.

export const SHORT_PACKAGE = "fluid-protocol-short-2026-10"

export interface ShortOption { id: string; label: string }
export interface ShortCard {
  id: string
  question: string
  /** One line of context under the question, when the question alone is not enough. */
  hint?: string
  options: ShortOption[]
  /** Tick all that apply. */
  multi?: boolean
}

// Offered on every single-choice question, so nothing forces a guess.
export const DISCUSS = { id: "Z", label: "Not sure, let's discuss when we meet" }

export const SHORT_CASE = {
  title: "In short",
  lines: [
    "29-year-old man, about 65 kg. Day 5 of dengue fever: defervescence on day 4, now right upper quadrant abdominal pain, persistent vomiting and dizziness.",
    "Tachycardia 122/min, BP 100/86 mmHg (pulse pressure 14 mmHg), cold peripheries, capillary refill time 4 seconds, oliguria.",
    "Haematocrit 52% (41% on day 2). Platelets 18,000/µL. INR 1.3, aPTT 41 s. AST 214, ALT 146 U/L. Mild gum bleeding.",
    "So: compensated shock (systolic BP above 90 mmHg, but narrow pulse pressure and poor peripheral perfusion).",
  ],
}

/** The case this review is about (its full text is shown on the page, read live from the case). */
export const SHORT_CASE_ID = "29-year-old-man-with-belly-pain-as-his-fever-settles"

// The flowchart itself is drawn in app/protocol-review/[token]/flowchart.tsx.

export const SHORT_CARDS: ShortCard[] = [
  {
    id: "S0",
    question: "Is the flowchart above right for this patient?",
    options: [
      { id: "A", label: "Yes" },
      { id: "B", label: "Yes, with small changes (write them in the box at the end)" },
      { id: "C", label: "No, let's go through it when we meet" },
    ],
  },
  {
    id: "S1",
    question: "Hypotensive shock: after improvement with the FIRST bolus, what next?",
    hint: "The guideline's text and its Figure 13 say different things (pages 40 and 41).",
    options: [
      { id: "A", label: "10 mL/kg/h for 1 hour, then the taper (text, page 40)" },
      { id: "B", label: "Straight into the taper (Figure 13, page 41)" },
      DISCUSS,
    ],
  },
  {
    id: "S2",
    question: "Hypotensive shock: after improvement with a SECOND or THIRD bolus, the first taper step is:",
    options: [
      { id: "A", label: "10 mL/kg/h for 1 to 2 hours, then the taper (Figure 13)" },
      { id: "B", label: "7 to 10 mL/kg/h, then the taper (text)" },
      DISCUSS,
    ],
  },
  {
    id: "S3",
    question: "After a bolus, which parameters must improve before you call him improved? Tick all that must.",
    multi: true,
    options: [
      { id: "A", label: "Heart rate falling" },
      { id: "B", label: "BP rising, pulse pressure widening" },
      { id: "C", label: "Warm peripheries, capillary refill time under 2 seconds" },
      { id: "D", label: "Urine output improving (oliguria resolving)" },
      { id: "E", label: "Sensorium improving" },
      { id: "F", label: "Haematocrit falling" },
    ],
  },
  {
    id: "S4",
    question: "When do you start tapering, then stop, IV fluids?",
    hint: "Box 7 (page 42) lists: normal BP, pulse and perfusion; haematocrit falling; no fever for 24 to 48 h without paracetamol; abdominal symptoms settling; urine output improving.",
    options: [
      { id: "A", label: "When all of Box 7 holds" },
      { id: "B", label: "When most of it holds: BP, pulse, perfusion and urine are enough" },
      DISCUSS,
    ],
  },
  {
    id: "S5",
    question: "Which signs indicate fluid overload? Tick all.",
    hint: "From the guideline's section on fluid overload (pages 43 and 44), plus two common bedside signs (crepitations, SpO2).",
    multi: true,
    options: [
      { id: "A", label: "Periorbital puffiness" },
      { id: "B", label: "Abdominal distension" },
      { id: "C", label: "Dyspnoea, tachypnoea" },
      { id: "D", label: "Restlessness or altered sensorium" },
      { id: "E", label: "Basal crepitations" },
      { id: "F", label: "Falling SpO2" },
    ],
  },
  {
    id: "S6",
    question: "Platelets 18,000/µL with mild gum bleeding, in compensated shock. A student who transfuses platelets:",
    hint: "Box 8 (page 42): platelets only if bleeding is present; prophylaxis may be considered below 10,000.",
    options: [
      { id: "A", label: "Has made a mistake: loses marks" },
      { id: "B", label: "Did not need to, but loses no marks" },
      { id: "C", label: "Was right to give them" },
      DISCUSS,
    ],
  },
  {
    id: "S7",
    question: "Paracetamol for him (AST 214, ALT 146, about 65 kg):",
    hint: "The guideline gives 10 mg/kg a dose, no more than 6-hourly, at most 4 g a day (page 34), for mild dengue.",
    options: [
      { id: "A", label: "650 mg up to 6-hourly, at most 4 g a day, as usual" },
      { id: "B", label: "Same dose, but a lower daily maximum because of his liver" },
      DISCUSS,
    ],
  },
  {
    id: "S8",
    question: "Which weight do we calculate the fluids on?",
    hint: "The guideline uses ideal body weight only for overweight patients (page 36). He is not described as overweight.",
    options: [
      { id: "A", label: "His weight, about 65 kg" },
      { id: "B", label: "Ideal body weight (we will add his height to the case)" },
      DISCUSS,
    ],
  },
  {
    id: "S9",
    question: "A 'narrow' pulse pressure is:",
    hint: "The guideline writes it both ways (page 16 and Figure 12). His is 14, so this case works either way.",
    options: [
      { id: "A", label: "Less than 20 mmHg" },
      { id: "B", label: "20 mmHg or less" },
      DISCUSS,
    ],
  },
]
