# MediKarya — AI Integration Reference

> **Status:** AI is **fully integrated and live** — Groq's Llama-3.3-70b-versatile model powers both the patient chat and the evaluation engine. This document describes the actual implemented architecture.

---

## Table of Contents

1. [Provider & Model](#1-provider)
2. [Environment Setup](#2-env)
3. [Integration Point 1 — Patient Chat Engine](#3-chat)
4. [Integration Point 2 — Evaluation Engine](#4-eval)
5. [Session History Management](#5-history)
6. [Temperature Strategy](#6-temperature)
7. [Cost Profile](#7-cost)
8. [Error Handling & Fallbacks](#8-fallback)
9. [Adding a New AI Integration Point](#9-adding)

---

## 1. Provider & Model {#1-provider}

| Attribute | Value |
|---|---|
| **Provider** | [Groq](https://groq.com) |
| **Model** | `llama-3.3-70b-versatile` |
| **SDK** | `groq-sdk` (installed) |
| **API Key env var** | `GROQ_API_KEY` |

Groq was chosen over OpenAI/Anthropic for three reasons:
- **Inference speed**: Groq's LPU hardware produces ~10× faster token generation than GPU-based APIs, which matters for real-time patient chat
- **Cost**: Significantly cheaper per token than GPT-4-class models
- **Quality**: Llama-3.3-70b provides sufficient reasoning for clinical evaluation and patient roleplay at this scale

---

## 2. Environment Setup {#2-env}

Only one key is required:

```bash
# .env.local
GROQ_API_KEY=gsk_...
```

No OpenAI, Anthropic, or Google AI keys are used. The system does **not** require any additional AI provider setup.

---

## 3. Integration Point 1 — Patient Chat Engine {#3-chat}

**File:** `engine/chatEngine.ts`  
**Used by:** `app/api/chat/patient/route.ts`, `app/api/chat/patient/opening/route.ts`

### How it works

The `ChatEngine` class handles all patient-side conversation. It:
1. Builds a system prompt from the case's `patient_text_brief`, `patient_facts`, `ai_role`, and `ai_examples` fields
2. Maintains an in-memory session history per `userId:caseId` key (last 12 messages / ~6 exchanges)
3. Sends the history + new message to Groq and returns the response

### Opening Generation

When a case starts, `GET /api/chat/patient/opening` calls `ChatEngine.generateOpening()` which generates a single emotional opening sentence — the first thing the patient says when the student enters the room.

```typescript
// engine/chatEngine.ts

static async generateOpening(caseData: CaseData): Promise<string>
// Returns: "Doctor, please help — my chest hasn't stopped hurting since last night."
```

The opening is generated at temperature **0.7** (more expressive, human-sounding).

### Per-message Responses

```typescript
static async processRequest(
    message: string,    // doctor's question
    caseData: CaseData, // full case object
    userId: string      // Clerk user ID (used as session key)
): Promise<CaseResponse | { error: string, status: number }>
```

Generated at temperature **0.4** (balanced: natural but consistent).

Max tokens per response: **120** — enforced to keep responses short, realistic patient answers.

### Patient Memory Construction

The system prompt is built from the case data, not hardcoded:

```
You are roleplaying as a patient in a medical consultation.

CRITICAL INSTRUCTIONS:
- ONLY answer what is asked. NEVER provide a summary of your whole condition.
- If asked "What happened?", mention only the MOST important symptom.
- Keep answers VERY SHORT (1 sentence).
- Act like a worried parent/patient, not a medical case report.

PATIENT CONTEXT:
[role] [patient_text_brief] [patient_facts] [ai_examples]
```

This means no case data is hardcoded into the engine — only the case JSON controls the patient's responses.

### API Route Contract

**POST `/api/chat/patient`**

```typescript
// Request body
{
  message: string,      // doctor's question text
  caseData: CaseData,   // full case object (fetched by client from /api/cases/[id])
  userId: string        // passed by API route from auth()
}

// Response
{
  response: string,     // patient's reply (1 sentence)
  timestamp: string,    // ISO timestamp
  source: "ai"
}
```

**GET `/api/chat/patient/opening?caseId=[id]`**

```typescript
// Response
{
  opening: string   // patient's first sentence
}
```

---

## 4. Integration Point 2 — Evaluation Engine {#4-eval}

**File:** `engine/evaluation/EvaluationEngine.ts`  
**Called via:** `app/actions/evaluate.ts` (Next.js server action, not an API route)

The evaluation engine makes **one Groq API call** per case submission. It is called with the full chat transcript, diagnosis, management plan, and the case configuration.

### LLM Call Details

```typescript
const completion = await groq.chat.completions.create({
    messages: [
        { role: "system", content: systemPrompt },  // built by ReasoningPromptBuilder
        { role: "user", content: "Evaluate this student's performance." }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,              // near-deterministic for consistent grading
    response_format: { type: "json_object" }
})
```

Temperature **0.1** — maximally consistent grading. The LLM must return structured JSON matching this schema:

```json
{
  "reasoningScore": 0-30,
  "historyQualityScore": 0-7.5,
  "diagnosisScore": 0-15,
  "managementScore": 0-10,
  "missedRedFlags": ["intent_slug", ...],
  "feedback": {
    "strengths": ["...", "..."],
    "improvements": ["...", "..."]
  }
}
```

All values are hard-clamped to their ceilings in code regardless of what the LLM returns.

### LLM call is conditional for history scoring

The `historyQualityScore` is only requested when the deterministic history score is in the borderline range (8–14 out of 17.5). If the student clearly passed or failed the history section algorithmically, the LLM's history score is zeroed out to avoid noise. See `EVALUATION_ENGINE.md` for full details.

### System Prompt Construction

Built by `engine/evaluation/ReasoningPromptBuilder.ts`. The prompt includes:
- Full consultation transcript (doctor questions + patient responses)
- Student's submitted diagnosis and management plan
- Coverage gaps (required questions the student missed — passed for context, NOT as a score anchor)
- List of critical red flags from the case
- Explicit score ceiling instructions to prevent score inflation
- Case-specific correct diagnosis and core management steps

---

## 5. Session History Management {#5-history}

The `ChatEngine` uses an **in-memory `Map`** keyed by `userId:caseId` to maintain conversation context across HTTP requests (Next.js server actions run in the same Node.js process during a session).

```typescript
private static sessionHistories: Map<string, Array<{role, content}>> = new Map()
private static readonly MAX_HISTORY_MESSAGES = 12  // last 6 doctor-patient exchanges
```

**Implications:**
- History is **not persisted to the database** — it lives only for the duration of the Node.js process
- History is **scoped per user per case** — concurrent users don't interfere
- History is **trimmed to the last 12 messages** to control token usage
- A server restart (or Vercel cold start) clears all histories — this is acceptable since the patient transcript is re-sent from the client when submitting

---

## 6. Temperature Strategy {#6-temperature}

| Use case | Temperature | Reason |
|---|---|---|
| Patient opening sentence | 0.7 | More expressive, emotional, varied |
| Patient conversation | 0.4 | Natural but consistent across similar questions |
| Evaluation grading | 0.1 | Maximally consistent — same performance should get same score |

---

## 7. Cost Profile {#7-cost}

Based on Groq pricing (substantially cheaper than OpenAI GPT-4):

| Use | Tokens (approx.) | Cost per case |
|---|---|---|
| Opening generation | ~300 in / ~40 out | ~$0.0001 |
| Patient chat (10 exchanges) | ~800 in / ~200 out | ~$0.001 |
| Evaluation LLM call | ~2000 in / ~400 out | ~$0.003 |
| **Total per case** | | **~$0.004** |

At 1,000 cases/month: **~$4/month** in AI costs.

> Groq pricing updates frequently — verify at [groq.com/pricing](https://groq.com/pricing).

---

## 8. Error Handling & Fallbacks {#8-fallback}

### Chat Engine
If Groq fails, the route returns a 500 error to the client. The UI shows an error state with a retry option.

### Evaluation Engine
If the Groq call fails during evaluation, `EvaluationEngine.ts` catches the error and uses conservative fallback scores:

| Domain | Fallback |
|---|---|
| Clinical Reasoning | 10 / 30 |
| Diagnosis | 5 / 15 |
| Management | 0 / 10 |
| History Quality | 3 / 7.5 (if needed) or 0 |

The student is shown a message explaining that AI evaluation was incomplete. The deterministic scores (test ordering, history coverage) are unaffected.

---

## 9. Adding a New AI Integration Point {#9-adding}

If you need to add a new Groq-powered feature:

```typescript
import { Groq } from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const result = await groq.chat.completions.create({
    messages: [
        { role: "system", content: yourSystemPrompt },
        { role: "user", content: userInput }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,   // lower = more consistent
    max_completion_tokens: 200,
    // Use json_object mode if you need structured output:
    response_format: { type: "json_object" }
})

const content = result.choices[0]?.message?.content
```

Always:
1. Wrap in try/catch with a defined fallback
2. Clamp/validate any numeric scores returned by the LLM before using them
3. Use `temperature: 0.1` for grading/scoring; `0.4–0.7` for generative/creative tasks

---

*This document reflects MediKarya v2.0 (April 2026).*  
*AI provider: Groq. Model: llama-3.3-70b-versatile.*
