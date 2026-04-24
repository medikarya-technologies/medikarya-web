# MediKarya — Clinical Evaluation Engine
### A Technical & Pedagogical Reference for Medical Educators

> **Purpose of this document:** To explain, in plain language, how MediKarya grades a medical student's performance during a simulated clinical case. This document is intended for faculty, curriculum designers, and clinical supervisors who want to understand the scoring logic, its pedagogical intent, and how to interpret student results.
>
> **Implementation version:** MediKarya v2.0 (April 2026). Reflects the refactored multi-module engine under `engine/evaluation/`.

---

## Table of Contents

1. [Overview — What Is Being Evaluated?](#1-overview)
2. [Module Architecture](#2-architecture)
3. [How a Session Works — Inputs to the Engine](#3-inputs)
4. [The Scoring Rubric — Total 100 Marks](#4-rubric)
5. [Layer 1 — Understanding the Consultation (Intent Extraction)](#5-layer1)
6. [Layer 2 — Deterministic Scores (Testing + 70% History)](#6-layer2)
7. [Layer 3 — Clinical Reasoning Score (LLM-Assisted)](#7-layer3)
8. [Layer 4 — Safety Penalties (Red Flag System)](#8-layer4)
9. [Penalty Mechanics](#9-penalties)
10. [Diagnosis Correctness — How isCorrect Is Determined](#10-diagnosis)
11. [What the System Rewards and Punishes](#11-rewards)
12. [Post-Evaluation Persistence — XP and Streak Tracking](#12-persistence)
13. [Case Configuration — How Cases Define Marking Criteria](#13-config)
14. [LLM Fallback Behaviour](#14-fallback)
15. [Limitations and Design Philosophy](#15-philosophy)

---

## 1. Overview — What Is Being Evaluated? {#1-overview}

MediKarya simulates a doctor-patient consultation. The student plays the role of the doctor, typing questions to a virtual patient whose responses are scripted from a real clinical case.

At the end of the consultation, the student submits:
- A **primary diagnosis**
- A **management plan**
- The **investigations (tests) they ordered**

The evaluation engine then grades the **entire interaction** — not just the final answers. It reads every question the student asked, how early they asked it, how specific it was, and whether they covered clinically important ground.

---

## 2. Module Architecture {#2-architecture}

The engine is implemented as a set of focused modules under `engine/evaluation/`:

| File | Role |
|---|---|
| `EvaluationEngine.ts` | Orchestrator — coordinates all 4 layers and aggregates the final score |
| `IntentExtractor.ts` | Layer 1 — analyses each doctor question for clinical intent, specificity, and redundancy |
| `DeterministicScorer.ts` | Layer 2 — algorithmic scoring for test ordering (0–20) and history coverage (0–17.5) |
| `ReasoningPromptBuilder.ts` | Builds the structured system prompt sent to the LLM for Layer 3 |
| `types.ts` | Shared TypeScript interfaces for all inputs, outputs, and intermediate results |

Additionally:
- `cases/lib/red-flag-detector.ts` — Layer 4 red flag resolution (tiered penalty logic)
- `engine/evaluationEngine.ts` — thin re-export shim for backward compatibility
- `app/actions/evaluate.ts` — Next.js server action: calls the engine, saves results to Supabase, updates user XP and streak

---

## 3. How a Session Works — Inputs to the Engine {#3-inputs}

The engine receives four inputs when evaluation begins:

| Input | What it contains |
|---|---|
| **Chat History** | Every message exchanged — all doctor questions and all patient responses, in chronological order |
| **Diagnosis** | The student's submitted primary diagnosis (text) and management plan |
| **Investigations ordered** | List of test objects `{ id, name }` the student chose to order |
| **Case Data** | The structured case file: patient details, correct diagnoses, evaluation config, red flags |

> **Important:** The engine reads the **complete transcript** — the very first question asked is as important as the last. Nothing is cut off or ignored.

---

## 4. The Scoring Rubric — Total 100 Marks {#4-rubric}

The total score is out of **100 marks**, divided across five clinical competency domains:

| Domain | Max Marks | Who Scores It |
|---|---|---|
| **Clinical Reasoning** | 30 | LLM (Groq / Llama-3.3-70b-versatile) |
| **History Taking** | 25 | Hybrid: 17.5 algorithmic + up to 7.5 LLM (conditional) |
| **Diagnostic Accuracy** | 15 | LLM |
| **Test Ordering** | 20 | Algorithmic (rule-based) |
| **Management Plan** | 10 | LLM |
| **Safety Penalties** | −2 to −10+ per flag/test | Hybrid (see Sections 8–9) |

**Final Score = (Reasoning + History + Diagnosis + Testing + Management) − Safety Penalties, clamped to [0, 100]**

The final score is rounded to an integer before being stored in the database.

---

## 5. Layer 1 — Understanding the Consultation (Intent Extraction) {#5-layer1}

Before any scoring begins, `IntentExtractor` reads every doctor question and analyses it across three dimensions.

### 5a. Clinical Intent Mapping
The engine identifies *what the student was trying to ask*, not just the words used. It has a catalogue of over 50 clinical intents organised by specialty:

- **GI:** vomiting character, diarrhoea, blood in stool, bilious vomiting, dehydration
- **Neurology:** headache character, visual aura, neck stiffness, seizure, consciousness
- **Cardiology:** chest pain, palpitation, radiation of pain, syncope, oedema
- **Respiratory:** dyspnoea, cough character, haemoptysis
- **Psychiatry:** mood, sleep, psychosis
- **Musculoskeletal:** joint pain, back pain
- **Universal:** past medical history, family history, medication history, immunisation, social history, and more

This means a student who asks *"Has there been any redness or unusual colour in his stool?"* is correctly credited for asking about **blood in stool** — even though the exact term "blood" was not used.

Each mapped intent has a confidence score (0.0–1.0). An intent is considered "seen" if any mapped intent has confidence > 0.5.

### 5b. Specificity Scoring (0–10 per question)
Each question receives a composite specificity score:

| Component | What it measures | Max contribution |
|---|---|---|
| **Keyword Depth** | Does the question name a body system, organ, or clinical domain? ("chest", "headache", "urine output") | 4 points |
| **Medical Term Presence** | Does it use clinical terminology? ("bilious", "aura", "haematuria") | 3 points |
| **Question Structure** | Is it an open, focused clinical question vs. a vague catch-all? | 3 points |

**Examples of how questions score:**

| Question asked | Approx. specificity score | Reason |
|---|---|---|
| "Anything else?" | 0 | Recognised catch-all phrase |
| "Any other symptoms?" | 0 | Recognised catch-all phrase |
| "Any fever?" | 1.3 | Names a clinical domain, short |
| "Any hygiene issues at home?" | 2.8 | Names a domain + structured |
| "How long has the vomiting been going on?" | 4.6 | Open question + clinical domain + timing |
| "Any bilious or projectile vomiting?" | 6.0+ | Clinical term + focused |

Questions scoring below **1.0** are treated as clinically non-contributory and do not count towards the history score.

### 5c. Redundancy Detection
If a student asks about the same topic multiple times (e.g., "Any vomiting?" followed later by "Are they vomiting?" again), the repeated questions are flagged as **redundant** and receive a **0.5× penalty multiplier** on their score contribution. This discourages circular or unfocused questioning.

### 5d. Additional Extracted Signals
The IntentExtractor also produces:
- **`patientRevealedFacts`** — key clinical facts from patient responses (passed to LLM for context)
- **`suspectedIgnoredFlags`** — intents the student raised but did not follow up on
- **`tokenCount`** — estimated token cost of the transcript (used for budget decisions)

---

## 6. Layer 2 — Deterministic Scores {#6-layer2}

`DeterministicScorer` handles two independent sub-scores: test ordering and history coverage.

### 6a. Test Ordering Score (0–20 pts)

Tests are matched by exact ID (no fuzzy logic). The scoring formula:

| Event | Score change |
|---|---|
| Core test ordered | **+8** |
| Core test missed | **−5** |
| Optional test ordered | **+3** |
| Distractor test ordered | **−4** |
| Dangerous test ordered | **−10** (also added to `safetyPenalty`) |

The raw score is clamped to **[0, 20]**.

**Special case — `testing_required: false`:**
- If the case doesn't require tests and the student ordered nothing → **20 pts** (correct clinical restraint)
- If the case doesn't require tests but the student ordered anyway → `max(0, 20 − count × 3)`

### 6b. History Coverage Score (Deterministic 70%, 0–17.5 pts)

This layer produces a structured score out of **17.5 marks**, representing the algorithmic portion of the history-taking domain.

**Coverage Matrix:** Each case defines a list of required questions. The engine checks whether each required topic was covered. A question "covers" a topic if the intent mapping or the question text overlaps with that topic's keywords.

**Timing Weights — Why *when* you ask matters:**

| When the question was asked | Timing weight |
|---|---|
| First 35% of consultation turns | **1.0×** (full credit) |
| Middle 35–65% | **0.7×** |
| Last 35–100% | **0.4×** |

> **Example:** "Any hygiene issues at home?" in turn 2 of 10 → full credit (1.0×). Same question in turn 9 of 10 → 40% credit (0.4×).

**Specificity Multiplier:**

```
specificityMultiplier = min(1.3, specificityScore / 7.5)
```

A vague question that technically covers the topic gets less credit than a precise, well-framed clinical question. A score of 7.5+ out of 10 gives the maximum 1.3× boost.

**Per-Question Cap:** No single question can earn more than `17.5 ÷ number_of_required_questions` marks.

**Redundancy Multiplier:** If the same intent was already credited earlier in the session, the score is multiplied by **0.5**.

**Final per-question score:**
```
score = min(perQuestionMax, perQuestionMax × timingWeight × specificityMultiplier) × redundancyMultiplier
```

### 6c. When Does the LLM Also Score History?

The algorithmic score covers 70% of the History domain. The remaining **7.5 marks** are scored by the LLM only when the algorithmic score is in a borderline range:

| Algorithmic history score | LLM history call |
|---|---|
| Below 8 → clear fail | **Skipped** — LLM score zeroed |
| 8–14 → borderline | **Called** — LLM provides 0–7.5 additional marks |
| Above 14 → clear pass | **Skipped** — LLM score zeroed |

This avoids AI noise on clear cases and controls API cost.

---

## 7. Layer 3 — Clinical Reasoning Score (LLM-Assisted) {#7-layer3}

**Model:** Groq API, `llama-3.3-70b-versatile`, temperature 0.1 (near-deterministic), `response_format: json_object`.

The LLM evaluates the qualitative dimensions of the student's performance:

| LLM-scored domain | Max marks | What the LLM evaluates |
|---|---|---|
| **Clinical Reasoning** | 30 | Did the student ask follow-up questions based on patient responses? Did they demonstrate a working differential? Systematic or reactive? |
| **Diagnostic Accuracy** | 15 | Is the submitted diagnosis correct, partially correct, or wrong? |
| **Management Plan** | 10 | Does the management reflect safe, evidence-based practice? Any dangerous/contraindicated steps? |
| **History Quality** (conditional) | 7.5 | When borderline deterministic score: did the student explore history meaningfully, even if exact keywords were missed? |

All LLM scores are hard-clamped to their respective ceilings regardless of the raw value returned.

### Anti-Gaming Design
The LLM is explicitly instructed **not** to see the student's algorithmic history score before giving its own assessment. It receives:
- The full consultation transcript
- The student's diagnosis and management plan
- A list of red flags defined in the case
- A structured rubric with hard score ceilings

This prevents anchoring: the AI cannot simply agree with the algorithmic result.

---

## 8. Layer 4 — Safety Penalties (Red Flag System) {#8-layer4}

Every clinical case can define **safety-critical red flags** — signs or symptoms that, if present in the patient, must be actively screened for.

### How Red Flags Are Defined
Each red flag has:
- **`intent`** — unique slug (e.g., `blood_in_stool`)
- **`intent_patterns`** — rich semantic patterns for the rule engine
- **`keywords`** — legacy exact-phrase matching (kept for backward compatibility)
- **`present_in_case`** — whether this flag is present in the patient (if false, only non-critical screening is expected)
- **`critical`** — whether missing this flag warrants a penalty
- **`justifies_tests`** (optional) — list of test IDs that this red flag justifies ordering

### The Hybrid Decision Process

| System | Method |
|---|---|
| **Rule Engine** | Checks if the student's questions matched the semantic patterns for this red flag |
| **LLM Semantic Check** | Independently assesses whether the student screened for this concern |

The two systems vote, and the penalty is determined by a **Tiered Decision Matrix:**

| Rule Engine | LLM Assessment | Penalty Applied |
|---|---|---|
| **Missed** | **Missed** | **Full penalty (−5 pts)** — both systems agree it was not asked |
| **Missed** | **Covered** | **Partial penalty (−2 pts)** — ambiguous; student may have asked in an unusual way |
| **Covered** | **Missed** | **Partial penalty (−2 pts)** — guards against LLM hallucination or misreading |
| **Covered** | **Covered** | **No penalty (0 pts)** — student successfully screened |

> **Why not just use keywords?** A keyword system would fail students who ask "any redness in the potty?" instead of "any blood in stool?" — clinically identical, linguistically different. The semantic pattern system ensures lay language, regional phrasing, and indirect questioning is treated fairly.

> **Why not just use LLM?** LLMs can hallucinate — they sometimes report that a student asked about something when they didn't. The rule engine acts as a factual anchor, and the tiered system ensures ambiguity incurs a *partial* penalty rather than being silently dismissed.

---

## 9. Penalty Mechanics {#9-penalties}

There are two sources of safety penalties, combined into a single `safetyPenalty` field in the result:

### Dangerous Test Penalty (Test Domain)
If a student orders a test marked **dangerous** in the case config:
- **−10 points** deducted from the testing score
- **+10 added to `safetyPenalty`** (accumulated separately for reporting)
- Multiple dangerous tests stack independently

### Red Flag Safety Penalties
Applied after the base score is calculated:
- Full penalty: **−5 points** per flag
- Partial penalty: **−2 points** per flag
- No cap on stacking — three missed critical flags = −15 points

**Final Score = Base Score − safetyPenalty (minimum 0, maximum 100), rounded to integer**

---

## 10. Diagnosis Correctness — How `isCorrect` Is Determined {#10-diagnosis}

The `isCorrect` boolean (shown in the UI as a "correct" or "incorrect" badge) is calculated as:

```typescript
const isExactMatch  = acceptedDx.some(dx => normalise(dx) === normalise(studentDx))
const isKeywordMatch = keywords.every(kw => normalise(studentDx).includes(kw))
const isCorrect = isExactMatch || isKeywordMatch
```

Where:
- `acceptedDx` = `evaluation_config.diagnosis.accepted_primary` (list of accepted diagnosis strings)
- `keywords` = `evaluation_config.diagnosis.must_include_keywords` (all keywords must be present)
- `normalise` = `.toLowerCase().trim()`

**This is separate from the LLM `diagnosisScore`** (0–15). A student can score partial diagnosis marks from the LLM even with `isCorrect = false` (partial credit for a close but not exact diagnosis), and vice versa.

---

## 11. What the System Rewards and Punishes {#11-rewards}

### Rewarded behaviours
| Behaviour | Why it's rewarded |
|---|---|
| Asking history questions **early** in the consultation | Reflects structured clinical reasoning, not reactive thinking |
| Asking **specific, focused questions** | Reflects clinical knowledge and precision |
| **Covering all required history areas** | Reflects completeness of clinical assessment |
| Screening for **red flags** (even if negative) | Reflects patient safety awareness |
| Correct **diagnosis** matching accepted criteria | Core clinical competency |
| Safe, evidence-based **management plan** | Core clinical competency |
| Ordering the **right investigations** | Reflects diagnostic reasoning |
| **Clinical restraint** (not ordering tests when not needed) | Reflects appropriate resource use |

### Penalised behaviours
| Behaviour | Why it's penalised |
|---|---|
| Asking generic catch-alls ("Anything else?", "Other symptoms?") | Demonstrates non-specific, passive questioning |
| Asking the **same question repeatedly** | Indicates disorganised history-taking |
| Asking important questions **very late** in the consultation | Suggests reactive rather than structured reasoning |
| **Not screening for red flags** when present | Patient safety risk |
| Ordering **dangerous or contraindicated tests** | Patient safety risk |
| Ordering **unnecessary tests** (distractors) | Poor clinical economy |
| Incorrect or unsafe **management steps** | Clinical knowledge gap |

---

## 12. Post-Evaluation Persistence — XP and Streak Tracking {#12-persistence}

After the engine returns a result, `app/actions/evaluate.ts` handles persistence:

### XP Calculation
```
xpEarned = round((finalScore / 100) × caseData.xpReward)
```
The base XP per case is configured in the case file (`xpReward`). A student who scores 80/100 on a 50-XP case earns 40 XP.

### Database Write
Results are inserted into the `case_attempts` table:
- `user_id`, `case_id`, `score`, `xp_earned`, `time_taken`
- `feedback_json` — full structured result including per-domain breakdown, strengths, improvements, and testing efficiency
- `completed_at` — ISO timestamp

### Streak Tracking
After each case completion, the user's `user_profiles` row is updated:

| Condition | Effect |
|---|---|
| First ever completion | `current_streak = 1` |
| Last active was yesterday | `current_streak += 1` |
| Last active was 2+ days ago | `current_streak = 1` (reset) |
| Last active was today | No change (already counted today) |

`longest_streak` is updated whenever `current_streak` exceeds it. All streak comparisons are done on UTC calendar dates (`YYYY-MM-DD`), ignoring time-of-day.

---

## 13. Case Configuration — How Cases Define Marking Criteria {#13-config}

Each clinical case is stored as a structured JSON data file. A case editor (faculty member) defines:

```json
"evaluation_config": {
  "history": {
    "required_questions":   ["list of history areas that must be covered"],
    "important_questions":  ["additional topics worth exploring"],
    "red_flag_questions":   ["history items that are safety-critical"]
  },

  "testing": {
    "testing_required": true,
    "core_tests":       ["tests that should be ordered — +8 pts each"],
    "optional_tests":   ["useful but not essential — +3 pts each"],
    "distractor_tests": ["should NOT be ordered — −4 pts each"],
    "dangerous_tests":  ["contraindicated — −10 pts each + safety penalty"]
  },

  "diagnosis": {
    "accepted_primary":        ["list of acceptable diagnosis strings — exact match"],
    "must_include_keywords":   ["all of these words must appear in the student's diagnosis"]
  },

  "management": {
    "core_steps":      ["essential management steps — used by LLM for marking"],
    "dangerous_steps": ["contraindicated interventions — LLM penalises if included"]
  },

  "red_flags": [
    {
      "intent":          "blood_in_stool",
      "intent_patterns": ["blood", "redness in stool", "black stool", "haematochezia", "melaena"],
      "keywords":        ["blood", "stool"],
      "present_in_case": true,
      "critical":        true,
      "justifies_tests": ["fbc", "stool_culture"]
    }
  ]
}
```

This configuration-driven design means:
- **Any specialty** can be supported — the engine is not hard-coded for any clinical domain
- **Faculty control** the rubric completely
- **New cases can be added** without changing any engine code — only the case data file is written

---

## 14. LLM Fallback Behaviour {#14-fallback}

If the Groq API call fails (timeout, network error, quota exceeded), the engine logs the error and returns conservative fallback scores rather than failing the evaluation entirely:

| Domain | Fallback score |
|---|---|
| Clinical Reasoning | 10 / 30 |
| History Quality | 3 / 7.5 (if LLM was needed) or 0 |
| Diagnostic Accuracy | 5 / 15 |
| Management Plan | 0 / 10 |
| Missed Red Flags | None assumed |

The feedback messages inform the student that evaluation was incomplete due to a connection error and ask them to retry. The deterministic scores (testing, history coverage) are unaffected by LLM failures.

---

## 15. Limitations and Design Philosophy {#15-philosophy}

### What this engine is NOT
- It is **not a replacement** for faculty assessment. It is a formative tool for self-directed learning and practice.
- It does **not assess communication style**, empathy, or bedside manner — only clinical content.
- LLM scoring (30+15+10 = 55 marks) introduces **some variability** — the same answers may score slightly differently on repeat runs. Temperature is set to 0.1 to minimise this, but it cannot be eliminated entirely.

### Why timing weights exist
Medicine is not a checklist. A student who asks "any family history?" only because they ran out of other questions has not demonstrated the same clinical reasoning as one who opens the consultation with a systematic history. Timing pressure forces students to develop and demonstrate a **mental framework** before they begin — not after.

### Why the LLM doesn't score everything
Pure LLM scoring is inconsistent and expensive. Pure rule-based scoring is rigid and punishes phrasing. The hybrid approach — algorithmic for measurable, objective criteria; LLM for qualitative, contextual assessment — is designed to be:
- **Consistent** on objective criteria (coverage, timing, redundancy, test matching)
- **Flexible** on subjective criteria (reasoning quality, management appropriateness)
- **Safe** by design: red flag penalties require agreement from two independent systems

### On fairness and language
Students in Indian medical education often communicate in mixed Hindi-English, regional terminology, or lay patient language. The semantic pattern system is specifically designed to accommodate this. A student who asks *"koi pet mein dard toh nahi?"* or *"any stomach pain?"* should receive the same clinical credit as one who asks *"any abdominal pain?"*.

### The borderline LLM history check
Calling the LLM on every history evaluation would add cost and noise. Calling it only in the 8–14 range means it acts as a "second opinion" precisely where the algorithmic score is most uncertain — not to override clear results, but to add nuance where the rule-based system cannot.

---

*This document reflects the evaluation engine as implemented in MediKarya v2.0 (April 2026).*  
*Engine source: `engine/evaluation/` — `EvaluationEngine.ts`, `DeterministicScorer.ts`, `IntentExtractor.ts`, `ReasoningPromptBuilder.ts`.*  
*For technical queries, contact the MediKarya development team.*  
*For curriculum or marking rubric queries, contact the faculty co-ordinator.*
