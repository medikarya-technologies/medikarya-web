# MediKarya — Case System Reference

> **Status:** Fully implemented and live at [medikarya.in](https://www.medikarya.in). This document describes the complete, production case flow — not a future plan.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Complete User Flow](#2-flow)
3. [Case Data Architecture](#3-case-data)
4. [File Structure](#4-files)
5. [API Routes](#5-api)
6. [Key Components](#6-components)
7. [Attempt History & Replay](#7-history)
8. [Admin — Case Management](#8-admin)
9. [Adding a New Case](#9-adding)

---

## 1. Overview {#1-overview}

The case system is the core of MediKarya. A "case" is a structured clinical scenario where a student:
1. Reviews a patient's presenting information
2. Conducts a simulated consultation (AI-powered patient chat)
3. Orders investigations from a real test library
4. Submits a diagnosis and management plan
5. Receives a scored evaluation with structured feedback

Everything — the patient's responses, the scoring, the feedback — is driven by the case's JSON configuration. No case logic is hardcoded in the engine.

---

## 2. Complete User Flow {#2-flow}

### Step 1 — Case Library (`/dashboard/cases`)
- Students browse available cases by specialty and difficulty
- Each card shows: case title, difficulty badge, speciality, estimated time, and whether it's been attempted before

### Step 2 — Case Detail (`/dashboard/cases/[id]`)
- A **patient card** displays an anonymised view: demographics, chief complaint, vitals, allergies, medications
- If the student has previous attempts, stats and a "Review Last Feedback" / "View All Attempts" section are shown
- Click "Start Case" → loads the active simulation

### Step 3 — Active Simulation (`CaseInteraction`)

Three-tab interface, navigable via a pill-style bottom navigation bar:

#### Tab 1 — Patient Interview
- AI patient (powered by `ChatEngine` + Groq) responds in character
- Patient generates a natural opening sentence when the case starts (via `GET /api/chat/patient/opening`)
- Student types questions; AI responds in 1–2 sentences, in character
- A real-time **history coverage indicator** shows the student's progress and nudges them toward investigation when sufficient history has been taken
- The "Ready to Investigate" CTA only appears after a minimum score threshold **AND** minimum message count to prevent premature prompting

#### Tab 2 — Tests & Imaging
- Full categorised test library (Laboratory, Imaging, Special)
- Student selects tests to order — each displays a result card with values, normal ranges, status flags
- Test results are **pre-scripted in the case JSON**, not dynamically generated — ensuring consistent, medically accurate results tied to the case's actual diagnosis
- Test count badge visible on the navigation tab

#### Tab 3 — Diagnosis
- Single primary diagnosis field
- Management plan (multi-line)
- "Submit Diagnosis" triggers the evaluation pipeline

### Step 4 — Evaluation & Feedback (`CaseFeedback`)
- The 4-layer evaluation engine runs (see `EVALUATION_ENGINE.md` for full detail)
- Score breakdown shown across 5 domains: Clinical Reasoning (30), History (25), Diagnosis (15), Testing (20), Management (10)
- Correct diagnosis revealed
- Strengths and improvements from the LLM
- Testing efficiency: appropriate vs. unnecessary vs. missed tests
- XP earned displayed
- Options: "Try Again" or "Back to Cases"

---

## 3. Case Data Architecture {#3-case-data}

Each case is a TypeScript object conforming to the `CaseData` type (`data/cases/index.ts`). Key fields:

```typescript
{
  id: string                      // unique slug, e.g. "riya-sharma-gastroenteritis"
  title: string                   // internal title
  displayTitle: string            // shown to student before start
  category: string                // specialty, e.g. "Paediatrics"
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  xpReward: number                // base XP (scaled by score on completion)

  patient: {
    name: string                  // patient's full name
    age: number
    gender: string
    chiefComplaint: string
    vitalSigns: { bp, hr, temp, rr, spo2 }
    allergies: string[]
    medications: string[]
    final_diagnosis: string       // shown in feedback after submission
  }

  patient_text_brief: string      // narrative paragraph for AI patient memory
  patient_facts: Record<string, string>  // structured facts for AI responses
  ai_role: {
    speaker: string               // e.g. "Mother of patient", "Patient"
    first_person_description: string
  }
  ai_examples: Array<{ doctor: string, patient: string }>  // few-shot conversation examples

  tests: Array<{
    id: string
    name: string
    category: string
    result: { summary, values, interpretation, criticalFindings }
  }>

  evaluation_config: {
    history: { required_questions, important_questions, red_flag_questions }
    testing: { testing_required, core_tests, optional_tests, distractor_tests, dangerous_tests }
    diagnosis: { accepted_primary, must_include_keywords }
    management: { core_steps, dangerous_steps }
    red_flags: Array<{ intent, intent_patterns, keywords, present_in_case, critical }>
  }
}
```

---

## 4. File Structure {#4-files}

```
app/
├── dashboard/
│   └── cases/
│       ├── page.tsx                    # Case library (browse all cases)
│       └── [id]/
│           └── page.tsx               # Pre-start screen + attempt history
│
app/api/
├── cases/
│   ├── route.ts                        # GET /api/cases — list all cases
│   └── [id]/
│       ├── route.ts                    # GET /api/cases/[id] — single case data
│       └── start/
│           └── route.ts               # POST /api/cases/[id]/start — mark started
├── chat/
│   └── patient/
│       ├── route.ts                    # POST /api/chat/patient — patient reply
│       └── opening/
│           └── route.ts               # GET /api/chat/patient/opening — opening line
├── tests/
│   └── generate-result/
│       └── route.ts                   # POST /api/tests/generate-result — test result
└── clerk-webhook/
    └── route.ts                        # POST — handles user creation webhook from Clerk

app/actions/
└── evaluate.ts                         # Server action: runs evaluation + saves to Supabase

components/cases/
├── patient-card.tsx                    # Anonymised patient info card (pre-start)
├── case-interaction.tsx               # Main 3-tab simulation interface (orchestrator)
├── ai-patient-chat.tsx                # Chat UI and message rendering
├── patient-presentation.tsx           # Sidebar: vitals, demographics during simulation
├── test-ordering.tsx                  # Test library + result cards
├── diagnosis-submission.tsx           # Diagnosis + management submission form
└── case-feedback.tsx                  # Post-submission feedback display

engine/
├── chatEngine.ts                       # ChatEngine class: patient chat + opening
└── evaluation/
    ├── EvaluationEngine.ts            # 4-layer evaluation orchestrator
    ├── DeterministicScorer.ts         # Algorithmic: testing + history coverage
    ├── IntentExtractor.ts             # Intent mapping, specificity, redundancy
    ├── ReasoningPromptBuilder.ts      # Builds LLM system prompt for evaluation
    └── types.ts                        # Shared TypeScript interfaces

data/
└── cases/
    └── index.ts                        # All case data + CaseData type definition

cases/
├── types.ts                            # CaseResponse and shared case types
└── lib/
    └── red-flag-detector.ts           # Tiered red flag penalty resolution (Layer 4)
```

---

## 5. API Routes {#5-api}

### `GET /api/cases`
Returns the array of all available cases (summary view — patient info anonymised).

### `GET /api/cases/[id]`
Returns full case data including test library and evaluation config (used by the client).

### `POST /api/cases/[id]/start`
Marks the case as started (timestamps for analytics). Returns updated case data.

### `POST /api/chat/patient`
Sends the doctor's message to `ChatEngine.processRequest()` and returns the patient's response.

```typescript
// Request
{ message: string, caseData: CaseData }

// Response
{ response: string, timestamp: string, source: "ai" }
```

### `GET /api/chat/patient/opening?caseId=[id]`
Returns the AI-generated opening sentence for the patient.

```typescript
// Response
{ opening: string }
```

### `POST /api/tests/generate-result`
Returns the pre-scripted result for an ordered test (looked up from `caseData.tests` by test ID — no live generation).

```typescript
// Request
{ testId: string, caseData: CaseData }

// Response
{ result: { summary, values, interpretation, criticalFindings } }
```

### `POST (server action) evaluateCase`
Called from the client after diagnosis submission. Runs the full 4-layer evaluation, saves the attempt to `case_attempts`, and updates the user's streak in `user_profiles`.

---

## 6. Key Components {#6-components}

### `CaseInteraction` (orchestrator)
Manages all simulation state: active tab, chat messages, ordered tests, diagnosis form, and the submission flow. Handles:
- Timer logic (cumulative elapsed seconds, persisted to localStorage — survives back-navigation)
- Adaptive nudge CTA (minimum score ≥ 3 + minimum 4 user messages before "Proceed" banner appears)
- Mobile navigation with safe-area padding (`env(safe-area-inset-bottom)`)
- 100dvh height to avoid browser chrome overlap

### `AIPatientChat`
Renders the conversation thread. Calls `/api/chat/patient/opening` on mount, then `/api/chat/patient` on each student message. Handles typing indicators, timestamps, and scroll-to-bottom.

### `TestOrdering`
Displays the case's test library grouped by category. Each ordered test is added to the cart; results are fetched via `/api/tests/generate-result`. Results display values with normal range comparison and status colour-coding.

### `DiagnosisSubmission`
Collects primary diagnosis (required) and management plan (optional). Validates non-empty before allowing submission. The "Submit Diagnosis" button triggers `evaluateCase`.

### `CaseFeedback`
Receives the `FinalEvaluationResult` and renders the full debrief: domain score bars, correct vs. submitted diagnosis, strengths/improvements, testing efficiency, XP earned. Supports a `mode="history"` for replaying past attempts.

### `PatientCard`
Pre-start screen. Shows anonymised patient data (name, age, vitals). The `isStarting` overlay plays a loading animation while the case loads. On return visits, shows attempt history stats and action buttons.

---

## 7. Attempt History & Replay {#7-history}

Every completed case is saved to the `case_attempts` Supabase table with:
- Score, XP earned, time taken
- `feedback_json` — the full `FinalEvaluationResult` object

On the case detail page (`/dashboard/cases/[id]`), if previous attempts exist:
- Last score and total attempt count are shown
- "Review Last Feedback" opens the most recent attempt in `CaseFeedback` replay mode
- "View All Attempts" expands a grid of all past attempts, each clickable to replay

Replay uses `CaseFeedback` with `mode="history"` — same component, same UI, fed historical data.

---

## 8. Admin — Case Management {#8-admin}

Admins (role set in `user_profiles.role`) can access `/admin` which includes:
- View all registered users and their scores
- Promote/demote user roles (with confirmation dialog to prevent accidental self-demotion)
- View aggregate attempt statistics

Cases themselves are currently edited directly in `data/cases/index.ts`. A case editor UI is a planned future feature.

---

## 9. Adding a New Case {#9-adding}

1. Open `data/cases/index.ts`
2. Add a new entry to the `cases` array conforming to the `CaseData` type
3. Define:
   - `patient` demographics and vitals
   - `patient_text_brief` — a narrative the AI uses to answer questions in character
   - `patient_facts` — key-value pairs for specific clinical details (e.g. `{ "duration_of_vomiting": "2 days" }`)
   - `ai_role` — who is speaking (patient, mother, father, etc.)
   - `ai_examples` — 3–5 example doctor/patient exchanges for tone calibration
   - `tests` — pre-scripted results for every test in the case's test library
   - `evaluation_config` — required history questions, test classifications, accepted diagnoses, red flags

4. The case is automatically available in the case library — no route or component changes needed.

**Key principles:**
- `testing_required: false` gives full test marks for ordering nothing (correct restraint)
- `red_flags` with `present_in_case: false` are non-penalised (student should screen but not penalised for missing an absent finding)
- `accepted_primary` strings are normalised for case-insensitive matching

---

*This document reflects MediKarya v2.0 (April 2026).*  
*All features described are fully implemented and live in production.*
