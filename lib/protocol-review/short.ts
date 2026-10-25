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
    "Man, 29, about 65 kg. Day 5 of dengue: the fever is settling, but he now has belly pain and feels faint.",
    "Pulse 122, BP 100/86 (pulse pressure 14), hands cold and mottled, capillary refill 4 seconds, passing little urine.",
    "Haematocrit 52% (41% on day 2). Platelets 18,000. INR 1.3, aPTT 41 s. AST 214, ALT 146. A little gum oozing when brushing.",
    "So: compensated shock (BP still above 90, but a narrow pulse pressure and poor perfusion).",
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
    question: "Hypotensive shock: after the FIRST bolus works, what next?",
    hint: "The guideline's text and its Figure 13 say different things (pages 40 and 41).",
    options: [
      { id: "A", label: "10 mL/kg/h for 1 hour, then the step-down (text, page 40)" },
      { id: "B", label: "Straight into the step-down (Figure 13, page 41)" },
      DISCUSS,
    ],
  },
  {
    id: "S2",
    question: "Hypotensive shock: after a SECOND or THIRD bolus works, the first step is:",
    options: [
      { id: "A", label: "10 mL/kg/h for 1 to 2 hours, then the step-down (Figure 13)" },
      { id: "B", label: "7 to 10 mL/kg/h, then the step-down (text)" },
      DISCUSS,
    ],
  },
  {
    id: "S3",
    question: "After a bolus, which signs must get better before you call him improved? Tick all that must.",
    multi: true,
    options: [
      { id: "A", label: "Pulse slowing" },
      { id: "B", label: "BP up, pulse pressure wider" },
      { id: "C", label: "Warm hands, capillary refill under 2 seconds" },
      { id: "D", label: "Passing urine again" },
      { id: "E", label: "Calmer, more alert" },
      { id: "F", label: "Haematocrit falling" },
    ],
  },
  {
    id: "S4",
    question: "When do you start cutting down, then stop, the IV fluid?",
    hint: "Box 7 (page 42) lists: normal BP, pulse and perfusion; haematocrit falling; no fever for 24 to 48 h without paracetamol; belly symptoms settling; urine output improving.",
    options: [
      { id: "A", label: "When all of Box 7 holds" },
      { id: "B", label: "When most of it holds: BP, pulse, perfusion and urine are enough" },
      DISCUSS,
    ],
  },
  {
    id: "S5",
    question: "Which signs mean he is getting too much fluid? Tick all.",
    hint: "From the guideline's section on fluid overload (pages 43 and 44), plus two common bedside signs.",
    multi: true,
    options: [
      { id: "A", label: "Puffy eyelids" },
      { id: "B", label: "Distended abdomen" },
      { id: "C", label: "Breathless, breathing fast" },
      { id: "D", label: "Restless or confused" },
      { id: "E", label: "Crackles in the chest" },
      { id: "F", label: "Oxygen saturation falling" },
    ],
  },
  {
    id: "S6",
    question: "Platelets 18,000 with mild gum oozing, in shock. A student who gives platelets:",
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
