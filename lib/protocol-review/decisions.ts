// The decisions a clinician is asked to make, from docs/fluid-protocol-decision-package.md.
// Generated text: edit the package and regenerate rather than editing here.

export interface ProtocolOption { id: string; label: string; other?: boolean }
export interface ProtocolCard {
  id: string
  title: string
  question: string
  why: string
  sources: Array<{ where: string; says: string }>
  notes?: string[]
  /** A card with no options is answered in words. */
  prompt?: string
  options?: ProtocolOption[]
}

export const PROTOCOL_PACKAGE = "fluid-protocol-2026-10"

export const PROTOCOL_CARDS: ProtocolCard[] = [
  {
    "id": "C1",
    "title": "First rapid bolus in hypotensive shock: size, speed and cap",
    "question": "For an adult with shock and systolic BP under 90, which first-bolus instruction applies: the text's, the Figure 13 box's, or another?",
    "why": "Sets the first bolus's volume and duration and whether a fixed millilitre cap overrides the per-kg dose. It decides how much circulating volume the first bolus can restore and how many boluses a patient needs, so it also decides what 'three boluses did not work' means.",
    "sources": [
      {
        "where": "Text, p.40 (Decompensated shock, first bullet)",
        "says": "Crystalloid or colloid (if available) at 20 mL/kg as a bolus given over 15 minutes."
      },
      {
        "where": "Figure 13, p.41 (first box, read on the rendered page)",
        "says": "Rapid bolus 10-20 mL/kg over 15-30 minutes, with '(500 mL maximum)'. Heading: systolic BP under 90 mmHg."
      },
      {
        "where": "Arithmetic only (not from the guideline)",
        "says": "At 65 kg: 10 mL/kg = 650 mL, 20 mL/kg = 1,300 mL. Both are above 500 mL."
      }
    ],
    "notes": [
      "The saved dengue draft currently shows the Figure 13 wording and marks the dose 'under review'."
    ],
    "options": [
      {
        "id": "A",
        "label": "Follow the text: 20 mL/kg over 15 minutes, no cap."
      },
      {
        "id": "B",
        "label": "Follow Figure 13: 10 to 20 mL/kg over 15 to 30 minutes, capped at 500 mL per bolus."
      },
      {
        "id": "C",
        "label": "Other (state, and say whether the cap applies to adults):",
        "other": true
      }
    ]
  },
  {
    "id": "C2",
    "title": "Second and third boluses in hypotensive shock",
    "question": "How many boluses in total, how big, how far apart, and what must be checked before each repeat?",
    "why": "Decides the repeat-dose rules: how many are allowed, whether a refused extra bolus is 'not indicated' or 'too soon', and what a reassessment must contain before a repeat. These become the allowed and scored actions.",
    "sources": [
      {
        "where": "Text, p.40 (third bullet)",
        "says": "If shock persists, review the haematocrit. If it has risen or is still high (above 45%), give a second crystalloid bolus of 10-20 mL/kg over 15-30 minutes. Up to three rapid boluses may be given."
      },
      {
        "where": "Figure 13, p.41",
        "says": "Second rapid bolus 10-20 mL/kg over 15-30 minutes with '(500 mL maximum)'; check the haematocrit and, if there is no improvement, give a third rapid bolus."
      },
      {
        "where": "Not stated anywhere (checked)",
        "says": "The minimum time between boluses. Only each bolus's own duration (15 to 30 minutes) is given."
      }
    ],
    "notes": [
      "'Up to three' is ambiguous: three in total, or three after the first? Please state which."
    ],
    "options": [
      {
        "id": "A",
        "label": "Up to three boluses in total including the first; each 10-20 mL/kg; cap per bolus as decided in C1."
      },
      {
        "id": "B",
        "label": "First plus up to three more."
      },
      {
        "id": "C",
        "label": "Other (state the count, the interval, and the check required before each repeat):",
        "other": true
      }
    ]
  },
  {
    "id": "C3",
    "title": "Compensated shock: first fluid",
    "question": "Within 10 to 20 mL/kg over one hour, which volume does the simulation use for this patient?",
    "why": "Sets the first treatment for the compensated phase and the hourly rate that is then reduced. The case author used 10 mL/kg (650 mL at 65 kg).",
    "sources": [
      {
        "where": "Text, p.39",
        "says": "Start isotonic crystalloid at 10-20 mL/kg per hour over one hour, then reassess vital signs, capillary refill, haematocrit and urine output."
      },
      {
        "where": "Figure 12, p.40",
        "says": "Start isotonic crystalloid, 10-20 mL/kg for 1 hour."
      }
    ],
    "notes": [
      "The text and the figure agree; the choice within the range is a clinical judgement, not a conflict."
    ],
    "options": [
      {
        "id": "A",
        "label": "10 mL/kg over 1 hour."
      },
      {
        "id": "B",
        "label": "20 mL/kg over 1 hour."
      },
      {
        "id": "C",
        "label": "Other (state, with a reason tied to this patient):",
        "other": true
      }
    ]
  },
  {
    "id": "C4",
    "title": "Compensated shock: the second bolus",
    "question": "If shock persists with haematocrit still high, is the second bolus 10 mL/kg or 10-20 mL/kg, and what happens if there is no improvement after it?",
    "why": "Defines the compensated-shock repeat dose and the escalation point that leads into hypotensive-shock care.",
    "sources": [
      {
        "where": "Text, p.39 (fourth bullet)",
        "says": "Check the haematocrit after the first bolus. If it has risen or is still above 45%, give a second crystalloid bolus at 10 mL/kg per hour for one hour. After it, if improving, reduce to 7-10 mL/kg/h for 1-2 hours and continue to reduce."
      },
      {
        "where": "Figure 12, p.40",
        "says": "Second bolus 10-20 mL/kg over 1 hour. If improving: reduce to 7-10 mL/kg/h for 1-2 hours. If not: refractory hypotension, consider inotropes, and 'manage as severe dengue with de-compensated shock (Group C)'."
      }
    ],
    "notes": [
      "Figure 12 sends a non-responder to 'decompensated shock (Group C)' although the patient is already in the severe group. Please say what the simulation should do at this branch."
    ],
    "options": [
      {
        "id": "A",
        "label": "10 mL/kg over 1 hour."
      },
      {
        "id": "B",
        "label": "10-20 mL/kg over 1 hour (choose the value)."
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C5",
    "title": "Compensated shock: step-down ladder after improvement",
    "question": "Which sequence of rates and durations should the simulation use, and which end of each duration range?",
    "why": "This is the ladder a student must follow to avoid overload; the case will compare their rate changes with it. A different first step or duration changes what is scored as correct reduction.",
    "sources": [
      {
        "where": "Text, p.39 (third bullet)",
        "says": "Reduce to 7-10 mL/kg/h for 1-2 h, then 5-7 mL/kg/h for 1-2 h, then 3-5 mL/kg/h for 2-4 h, then 2-3 mL/kg/h for 2-3 h, then according to haemodynamic status, up to 24-48 h."
      },
      {
        "where": "Figure 12, p.40",
        "says": "Reduce gradually: 5-7 mL/kg/h for 1-2 h, 3-5 mL/kg/h for 2-4 h, 2-3 mL/kg/h for 2-4 h; stop IV fluids at 24-48 hours. The 7-10 mL/kg/h step appears only after a second bolus."
      },
      {
        "where": "Context, a different group (moderate dengue with warning signs), p.36",
        "says": "Text: 5-7, 3-5 and 2-4 mL/kg/h, each for 2-4 hours. Its own Figure 11 (p.36): 5-7 for 1-2 h, 3-5 for 2-4 h, 2-3 for 2-4 h. So even that group's text and figure differ."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "Follow the text ladder (starts at 7-10)."
      },
      {
        "id": "B",
        "label": "Follow Figure 12 (starts at 5-7; 7-10 only after a second bolus)."
      },
      {
        "id": "C",
        "label": "Other (give the ladder and which end of each duration range):",
        "other": true
      }
    ]
  },
  {
    "id": "C6",
    "title": "Hypotensive shock: step-down after improvement",
    "question": "After a successful first bolus, is there a 10 mL/kg/h hour before the ladder? After a second or third bolus, is the first step 10 or 7-10 mL/kg/h?",
    "why": "Same role as C5 for the hypotensive pathway, with two differing first steps.",
    "sources": [
      {
        "where": "Text, p.40 (second bullet)",
        "says": "If improving after the first bolus: crystalloid or colloid infusion at 10 mL/kg/h for one hour, then reduce to 5-7 mL/kg/h for 1-2 h, 3-5 for 2-4 h, then 2-3 or less, up to 24-48 h."
      },
      {
        "where": "Text, p.40 (third bullet)",
        "says": "After the second bolus, if improving: 7-10 mL/kg/h for 1-2 hours, then gradual reduction as above."
      },
      {
        "where": "Figure 13, p.41",
        "says": "Improving after the first bolus: reduce gradually 5-7 for 1-2 h, 3-5 for 2-4 h, 2-3 for 2-4 h; stop at 24-48 h (no separate 10 mL/kg/h hour shown). Improving after the 2nd or 3rd bolus: 'reduce IV crystalloids 10 mL/kg/h for 1-2 hours'."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "Follow the text (10 mL/kg/h for one hour after the first bolus; 7-10 after the second)."
      },
      {
        "id": "B",
        "label": "Follow Figure 13 (straight to the ladder after the first; 10 mL/kg/h for 1-2 h after the second or third)."
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C7",
    "title": "Haematocrit: what is 'high', what is the reference, what is a fall",
    "question": "Which cut-off decides 'leakage continues' versus 'suspect bleeding', and is the reference this patient's own earlier value or the guideline's population value?",
    "why": "This is the branch that sends a student to more crystalloid or to blood. A wrong reference sends a leaking patient to transfusion or a bleeding patient to more fluid. It also decides what the simulation shows as a falling haematocrit.",
    "sources": [
      {
        "where": "Text, p.39 and p.40",
        "says": "Haematocrit risen or still above 45%: repeat the crystalloid bolus. Haematocrit has decreased compared with the initial reference haematocrit, with the reference given as below 40% in children and adult females and below 45% in adult males: suspect bleeding, cross-match and transfuse."
      },
      {
        "where": "Figures 12 and 13, pp.40 and 41",
        "says": "Hct above 45%: suspect persistent capillary leakage. Hct below 45%: suspect severe overt bleed, check Hb."
      },
      {
        "where": "Case sheet (not the guideline)",
        "says": "His own day-2 value was 41%; on arrival it is 52%."
      }
    ],
    "notes": [
      "A fall from 52% to 44% is 'below 45%' but still above his own 41%. Please say which reading governs."
    ],
    "options": [
      {
        "id": "A",
        "label": "Use the population cut-off: above 45% means leakage, below 45% means bleeding."
      },
      {
        "id": "B",
        "label": "Use his own baseline (41%) as the reference for 'fallen'."
      },
      {
        "id": "C",
        "label": "Other (define 'a fall': from what value, by how much, over how long):",
        "other": true
      }
    ]
  },
  {
    "id": "C8",
    "title": "Colloid: whether it is offered, when, and what",
    "question": "Is colloid on the tray for this case? If so, when is it indicated and what dose?",
    "why": "Decides whether a colloid action exists, whether giving it is credit, neutral or harmful, and what the case models for oncotic effect.",
    "sources": [
      {
        "where": "Text, p.39 (critical-period fluid rules)",
        "says": "Hyper-oncotic colloids (such as dextran 40 or starch) may be used in patients with massive plasma leakage and those not responding to the maximum volume of crystalloid. Iso-oncotic colloids (plasma, haemaccel) may be less effective."
      },
      {
        "where": "Text, p.40 (first bullet)",
        "says": "The first hypotensive bolus may be crystalloid or colloid, if available."
      },
      {
        "where": "Figure 13, p.41",
        "says": "The first box names isotonic crystalloid only."
      },
      {
        "where": "Text, p.44 (fluid overload)",
        "says": "In early overload switch bolus fluid from crystalloid to colloid. Dextran 40: 10 mL/kg bolus, limit 30 mL/kg/day. If in shock with overload: colloid (dextran) 10 mL/kg/h, then furosemide 1 mg/kg/dose once BP is stable."
      },
      {
        "where": "The earlier plan wording (not in this guideline)",
        "says": "'Colloid after 2 to 3 saline boluses if the haematocrit is rising'. The guideline's rule for a rising haematocrit is another crystalloid bolus."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "No colloid action in this case."
      },
      {
        "id": "B",
        "label": "Colloid available only for massive leakage or non-response to crystalloid (define when)."
      },
      {
        "id": "C",
        "label": "Colloid for fluid overload only."
      },
      {
        "id": "D",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C9",
    "title": "Blood: when and how much (adult)",
    "question": "What triggers blood in the simulation, which product, and what dose per kg?",
    "why": "Defines the bleeding branch's correct action and the harm of giving blood when the haematocrit is high. Also what the debrief tells a student who does not transfuse.",
    "sources": [
      {
        "where": "Text, p.39",
        "says": "Blood transfusion is given for established severe bleeding, or suspected severe bleeding (a fall in haematocrit) with unexplained hypotension."
      },
      {
        "where": "Text and figures, pp.39 to 41",
        "says": "Whole blood 10 mL/kg or packed red cells 5 mL/kg when the haematocrit has fallen."
      },
      {
        "where": "Text, p.42 (7.4 severe haemorrhage)",
        "says": "If blood loss cannot be quantified: aliquots of 10 mL/kg fresh whole blood or 5 mL/kg freshly packed red cells."
      },
      {
        "where": "Children's chapter, p.28 (5.7)",
        "says": "Blood 20 mL/kg when shock persists despite a declining haematocrit. This is the children's chapter and is not used for an adult unless you say so."
      }
    ],
    "notes": [
      "Please also say whether a fall in haematocrit alone is enough, or whether instability is also required."
    ],
    "options": [
      {
        "id": "A",
        "label": "Whole blood 10 mL/kg or packed cells 5 mL/kg (adult text and figures)."
      },
      {
        "id": "B",
        "label": "Other (state product and dose):",
        "other": true
      }
    ]
  },
  {
    "id": "C10",
    "title": "'Improvement' and 'persisting shock': what the student must see",
    "question": "Which findings, with what thresholds, define improvement after a bolus, persisting shock, and recovering?",
    "why": "This replaces the fixed blood-pressure end point and the fixed recovery. Every decision (step down, repeat a bolus, investigate bleeding, escalate) rests on it. It is the largest single input to the case's decision table.",
    "sources": [
      {
        "where": "Text, p.36 (moderate dengue, Group B)",
        "says": "Improvement means BP improved, pulse pressure improved, haematocrit decreased, urine output improved, capillary refill improved. Adequate fluid should maintain perfusion and urine output of about 0.5 mL/kg/hour."
      },
      {
        "where": "Text and figures, pp.39 to 41",
        "says": "Reassess vital signs, capillary refill time, haematocrit and urine output; the figures list BP, pulse pressure, Hct, urine output, capillary refill time and pulse rate."
      },
      {
        "where": "Table 2, p.16",
        "says": "Compensated shock: narrowed pulse pressure (below 20 mmHg), capillary refill over 2 seconds, cold extremities, weak thready pulses, tachycardia, reduced urine. Decompensated: change of mental state, mottled skin, cold clammy extremities, feeble or absent pulses."
      },
      {
        "where": "Not given anywhere",
        "says": "Numeric thresholds for 'improved' (how much wider, how fast, how many of the six findings)."
      }
    ],
    "notes": [
      "Guideline interpretation (which findings) is G; the numbers are decided together with the physiology adviser in CQ15."
    ],
    "options": [
      {
        "id": "A",
        "label": "Improved when ALL listed findings have moved in the right direction (state thresholds).",
        "other": true
      },
      {
        "id": "B",
        "label": "Improved when the major findings have (state which, and the thresholds).",
        "other": true
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C11",
    "title": "Reducing and stopping fluids; defining overload",
    "question": "Which criteria mean fluids must be reduced or stopped, and which findings define overload for the simulation?",
    "why": "Defines the harm of continued fluids and the correct stopping point. The case needs a clear list because overload will be modelled as a consequence, not a flag.",
    "sources": [
      {
        "where": "Text, p.39",
        "says": "IV fluid should not exceed 24-48 hours in those with shock; without shock, not more than 60-72 hours. Always check for signs of fluid overload."
      },
      {
        "where": "Box 7, p.42",
        "says": "Reduce or stop IV fluids when: normal BP, pulse and peripheral perfusion; haematocrit decrease; apyrexia over 24-48 hours without antipyretics; resolving abdominal symptoms; improving urine output. Continuing beyond 48 hours of the critical phase risks pulmonary oedema and other complications."
      },
      {
        "where": "Text, pp.43 to 44 (7.6.1)",
        "says": "Early overload: puffy eyelids, distended abdomen, mild dyspnoea. Late: moderate to severe respiratory distress, restlessness, confusion. Management includes stopping hypotonic fluids, colloid in early overload, furosemide when vital signs are stable, and reducing IV fluid to as low as 1 mL/kg/h until stopped once the haematocrit is at or below baseline."
      },
      {
        "where": "Text, p.42 (7.5)",
        "says": "In convalescence the haematocrit falls to baseline or below with diuresis; IV fluid is discontinued; diuretics may be needed where there are effusions or ascites."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "Use Box 7's five criteria; stop when all hold."
      },
      {
        "id": "B",
        "label": "Use Box 7 with a different count (state how many must hold).",
        "other": true
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C12",
    "title": "Refractory shock: what the student should do",
    "question": "When fluid does not restore the circulation, which actions are expected and scored, and are any drugs named?",
    "why": "Defines the end of the fluid pathway: after the allowed boluses fail the simulation currently has no next step. The case needs the expected actions.",
    "sources": [
      {
        "where": "Text, p.39",
        "says": "Restoring the blood pressure is critical for survival; inotropes may be used to support it."
      },
      {
        "where": "Text, pp.40 to 41 (refractory bullets)",
        "says": "Consider inotropes; determine cardiogenic or septic shock; evaluate metabolic cause and organ dysfunction, concomitant conditions, persistent acidosis and the risk of hidden haemorrhage; give additional boluses of crystalloid or colloid over the next 24 hours as the response guides; manage in ICU."
      },
      {
        "where": "Figures 12 and 13, pp.40 and 41",
        "says": "Refractory hypotension: consider inotropes; manage as decompensated shock. No drug or dose is named in the adult text."
      },
      {
        "where": "Children's chapter, p.28",
        "says": "Dopamine, epinephrine and dobutamine through a central line, in ICU. Children only."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "Escalation to ICU and evaluation for other causes is credited; no drug is offered."
      },
      {
        "id": "B",
        "label": "A named inotrope is offered (state which, dose and route, with your source):",
        "other": true
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "C13",
    "title": "Definitions found to differ on verification: narrow pulse pressure and hypotension",
    "question": "What are the cut-offs for 'narrow pulse pressure' and 'hypotension', and is the boundary value inside or outside?",
    "why": "The case's condition on pulse pressure is already built (S1). It needs the cut-off and whether 20 itself counts. The case plan currently reads 'pulse pressure 20 or less' and 'systolic under 90'.",
    "sources": [
      {
        "where": "Table 2, p.16 and p.17",
        "says": "Narrowing pulse pressure in compensated shock is written 'below 20 mmHg'."
      },
      {
        "where": "Figure 12, p.40 (top box, read on the rendered page)",
        "says": "Reads 'pulse pressure 20 mmHg' with a greater-than-or-equal sign, and 'hypotension (SBP above 90)'. These may be printing errors in the figure."
      },
      {
        "where": "Figure 13, p.41",
        "says": "Decompensated shock heading: systolic BP below 90 mmHg."
      }
    ],
    "notes": [
      "Added during verification; not in the earlier list. It touches code already merged (S1), so the answer may change a boundary in one existing condition."
    ],
    "options": [
      {
        "id": "A",
        "label": "Narrow means pulse pressure below 20; hypotension means systolic below 90."
      },
      {
        "id": "B",
        "label": "Narrow means 20 or less (the WHO convention); hypotension means systolic below 90."
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "CQ13",
    "title": "How much infused fluid stays in the circulation",
    "question": "During plasma leak, what fraction of an infused crystalloid (and of colloid) remains intravascular, how does that change over time, and how does a rapid bolus differ from a slow infusion?",
    "why": "Retention decides how far a bolus restores circulating volume and how fast the extravascular load grows. It therefore decides how many boluses a patient needs and when overload begins. The guideline gives no retention figure.",
    "sources": [
      {
        "where": "Guideline",
        "says": "No retention figure is given in NCVBDC 2023 (checked)."
      }
    ],
    "prompt": "fractions with their units and time course, the evidence or the reasoning behind them, and the range of uncertainty."
  },
  {
    "id": "CQ14",
    "title": "The leak course over clinical time",
    "question": "For a patient who reaches the clinic on day 5 with shock: how quickly does leakage start to matter, when does it peak, when does it end, and when does leaked fluid return to the circulation?",
    "why": "This is the case's untreated course and the timing of reabsorption (after which continued fluid causes overload).",
    "sources": [
      {
        "where": "Text, p.15",
        "says": "The critical phase begins after the 3rd or 4th day of fever and lasts about 24 to 48 hours."
      },
      {
        "where": "Text, p.16",
        "says": "In recovery, extracellular fluid lost by leakage returns to the circulation over 2 to 3 days; excess fluid can then cause pulmonary oedema."
      }
    ],
    "prompt": "leak intensity by clinical hour (shape and relative size), the hour it ends, and the reabsorption time course. Say how a compensated presentation differs from a hypotensive one."
  },
  {
    "id": "CQ15",
    "title": "Numeric thresholds for 'improving'",
    "question": "For each finding chosen in C10, what number counts as improved and persisting, and for how long must it hold before the patient counts as recovering?",
    "why": "The guideline lists the findings but gives few numbers. The case cannot score 'step down' or 'repeat' without them.",
    "sources": [
      {
        "where": "Guideline",
        "says": "Printed numbers only for: narrow pulse pressure below 20 mmHg and capillary refill over 2 seconds (Table 2, p.16); urine output about 0.5 mL/kg/hour (p.36); haematocrit 45% reference (pp.39 to 41)."
      }
    ],
    "prompt": "threshold per finding, how many must hold, and the persistence time in clinical minutes. Mark each as guideline-based or as your judgement."
  },
  {
    "id": "CQ16",
    "title": "Overload: findings and thresholds",
    "question": "At what degree of extravascular fluid load does overload show, with which findings, and how fast does continued fluid worsen it?",
    "why": "Overload is to be modelled as a consequence of running fluids too long or too fast, with effects on saturation, respiratory rate and lung findings, and with a nurse alert. The case needs bands, not a single flag.",
    "sources": [
      {
        "where": "Text, pp.43 to 44",
        "says": "Early and late clinical signs are listed (see C11). No quantity of fluid or time is given that produces them."
      }
    ],
    "prompt": "bands (none, early, late), the finding and monitor change at each, and any accelerating factor (for example during reabsorption)."
  },
  {
    "id": "CQ17",
    "title": "Whether and how to include occult bleeding",
    "question": "Should some attempts present with bleeding on top of leakage? If so, what are the rate and course, how do haematocrit and perfusion behave, how long does the student have, and how often does it occur?",
    "why": "Needed to teach the falling-haematocrit branch (C7, C9). It requires a case variant chosen by a recorded seed, which is new case work, so the decision must be clear first.",
    "sources": [
      {
        "where": "Text, pp.39 to 42",
        "says": "Suspected severe bleeding is a fall in haematocrit with unexplained hypotension; blood doses in C9. No bleeding rates are given."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "No bleeding variant (teach only the leak pathway)."
      },
      {
        "id": "B",
        "label": "Include a bleeding variant (give the details above).",
        "other": true
      },
      {
        "id": "C",
        "label": "Make it a separate case."
      }
    ]
  },
  {
    "id": "CQ18",
    "title": "Weight on which doses are calculated",
    "question": "Which weight should fluid doses use for this patient?",
    "why": "Every mL/kg dose, every step-down rate and the 500 mL cap interact with weight. The case records about 65 kg as the author's own estimate and no height.",
    "sources": [
      {
        "where": "Text, p.36",
        "says": "For obese and overweight patients, use ideal body weight for fluid calculations."
      },
      {
        "where": "Table 5, p.37",
        "says": "Estimated ideal body weight for overweight or obese adults by height (males: 50 kg at 150 cm, 57 at 160, 66 at 170, 75 at 180). Needs a height."
      },
      {
        "where": "Case sheet (not the guideline)",
        "says": "About 65 kg by his own estimate. No height. Not described as overweight."
      }
    ],
    "options": [
      {
        "id": "A",
        "label": "Use 65 kg as written."
      },
      {
        "id": "B",
        "label": "Add a height to the case and state whether ideal body weight applies."
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "CQ19",
    "title": "Platelet transfusion for this patient",
    "question": "Is platelet transfusion harmful (a 15-point deduction), neutral, or acceptable here? Does minor gum oozing count as 'bleeding present'?",
    "why": "This is a scored action already in the saved plan. The guideline's adult statements and the patient's coagulation results point in different directions, so the scoring needs a decision.",
    "sources": [
      {
        "where": "Box 8, p.42 (adult chapter)",
        "says": "Transfuse platelets only if bleeding is present. Prophylactic platelet transfusion may be considered for counts below 10,000 per cumm without bleeding, and for those who may need emergency surgery."
      },
      {
        "where": "Note under Figure 13, p.41 (adult chapter)",
        "says": "Platelet transfusion is not recommended for thrombocytopenia (no prophylaxis). It may be considered in adults with underlying hypertension and thrombocytopenia below 10,000."
      },
      {
        "where": "Text, p.26 (children's chapter 5.5)",
        "says": "In a trial of adults with platelets of 20,000 or less without persistent mild or severe bleeding, prophylactic platelets were not superior to supportive care and had adverse events."
      },
      {
        "where": "Text, p.27 (children's chapter 5.5(b))",
        "says": "In severe bleeding or haemodynamic instability, platelets and FFP may be given when the count is below 50,000 with deranged PT, APTT, low fibrinogen and raised D-dimer. This is the children's chapter."
      },
      {
        "where": "Case sheet (not the guideline)",
        "says": "Platelets 18,000; minor gum oozing on brushing; INR 1.3; aPTT 41 seconds; in shock."
      }
    ],
    "notes": [
      "Correction to earlier work: the saved plan's review note cites 'NCVBDC 5.5' for the 50,000 statement. That section is the children's chapter. The adult statements are Box 8 and the note on p.41. The plan's note needs correcting at its next edit; nothing was changed for this package."
    ],
    "options": [
      {
        "id": "A",
        "label": "Harmful (keep the deduction): count above 10,000 and the bleeding is minor."
      },
      {
        "id": "B",
        "label": "Neutral (no deduction, no credit)."
      },
      {
        "id": "C",
        "label": "Acceptable in this patient (state why).",
        "other": true
      },
      {
        "id": "D",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "CQ20",
    "title": "Paracetamol dose for this patient",
    "question": "Which paracetamol dose and daily ceiling should the tray show for a shocked patient with raised liver enzymes?",
    "why": "The tray shows a dose; it must be a dose a clinician accepts for this patient. The earlier plan said 500 mg to 1 g; the guideline gives a per-kg dose.",
    "sources": [
      {
        "where": "Text, p.34 (instructions for mild dengue, Group A)",
        "says": "Paracetamol 10 mg/kg per dose, not more often than every six hours; maximum for adults 4 g per day; avoid aspirin and NSAIDs."
      },
      {
        "where": "Case sheet (not the guideline)",
        "says": "AST 214 and ALT 146 U/L; about 65 kg (10 mg/kg = 650 mg by arithmetic)."
      }
    ],
    "notes": [
      "The guideline sentence sits in the outpatient instructions for mild dengue. Please say whether it governs a shocked inpatient."
    ],
    "options": [
      {
        "id": "A",
        "label": "10 mg/kg per dose, at most 6-hourly, ceiling 4 g per day."
      },
      {
        "id": "B",
        "label": "A lower ceiling because of the liver enzymes (state it).",
        "other": true
      },
      {
        "id": "C",
        "label": "Other:",
        "other": true
      }
    ]
  },
  {
    "id": "CQ21",
    "title": "Game-time compression: what an encounter minute stands for",
    "question": "How is an hour-long infusion and a multi-hour step-down shown in a short encounter, and what may never be skipped?",
    "why": "Decides the length of a ward-mode step, which events interrupt a wait, how often a reassessment is required, and which durations are kept real (for example a bolus's 15 to 30 minutes) versus compressed. No fixed game-time number is chosen until this is answered.",
    "sources": [
      {
        "where": "Text, p.36 (moderate dengue, Group B)",
        "says": "Improvement is evaluated hourly. Urine output is checked 6-hourly and haematocrit 8-hourly. (For another group; context only.)"
      },
      {
        "where": "Text, p.40 and p.41",
        "says": "A bolus lasts 15 to 30 minutes; ladder steps last 1 to 4 hours; fluids run 24 to 48 hours."
      }
    ],
    "notes": [
      "The 2-minute bolus gap, the 8-minute deadline and the fixed per-bolus BP change in the saved dengue draft are estimates chosen by the caseer. They are to be replaced by this decision; they are not clinical values."
    ],
    "prompt": "how many clinical minutes one ward step may cover, the longest allowed single wait, events that must always interrupt (alerts, bolus completion, reassessment due), the required reassessment interval, and whether bolus durations are kept real."
  }
]
