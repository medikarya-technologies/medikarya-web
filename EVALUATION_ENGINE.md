# MediKarya — Clinical Evaluation Engine
### A Technical & Pedagogical Reference for Medical Educators

> **Purpose of this document:** To explain, in plain language, how MediKarya grades a medical student's performance during a simulated clinical case. This document is intended for faculty, curriculum designers, and clinical supervisors who want to understand the scoring logic, its pedagogical intent, and how to interpret student results.

---

## Table of Contents

1. [Overview — What Is Being Evaluated?](#1-overview)
2. [How a Session Works — Inputs to the Engine](#2-inputs)
3. [The Scoring Rubric — Total 100 Marks](#3-rubric)
4. [Layer 1 — Understanding the Consultation (Intent Extraction)](#4-layer1)
5. [Layer 2 — History Taking Score (Deterministic, 70%)](#5-layer2)
6. [Layer 3 — Clinical Reasoning Score (AI-Assisted)](#6-layer3)
7. [Layer 4 — Safety Penalties (Red Flag System)](#7-layer4)
8. [How Penalisation Works](#8-penalties)
9. [What the System Rewards and Punishes](#9-rewards)
10. [Case Configuration — How Cases Define Marking Criteria](#10-config)
11. [Limitations and Design Philosophy](#11-philosophy)

---

## 1. Overview — What Is Being Evaluated? {#1-overview}

MediKarya simulates a doctor-patient consultation. The student plays the role of the doctor, typing questions to a virtual patient whose responses are scripted from a real clinical case.

At the end of the consultation, the student submits:
- A **primary diagnosis**
- A **management plan**
- The **investigations (tests) they ordered**

The evaluation engine then grades the **entire interaction** — not just the final answers. It reads every question the student asked, how early they asked it, how specific it was, and whether they covered clinically important ground.

---

## 2. How a Session Works — Inputs to the Engine {#2-inputs}

The engine receives four inputs when evaluation begins:

| Input | What it contains |
|---|---|
| **Chat History** | Every message exchanged — all doctor questions and all patient responses, in chronological order |
| **Diagnosis** | The student's submitted primary diagnosis (text) |
| **Investigations ordered** | List of tests the student chose to order |
| **Case Data** | The structured case file: correct diagnoses, required questions, red flags, scoring rubrics |

> **Important:** The engine reads the **complete transcript** — the very first question asked is as important as the last. Nothing is cut off or ignored.

---

## 3. The Scoring Rubric — Total 100 Marks {#3-rubric}

The total score is out of **100 marks**, divided across five clinical competency domains:

| Domain | Max Marks | Who Scores It |
|---|---|---|
| **Clinical Reasoning** | 30 | AI (LLM) |
| **History Taking** | 25 | Hybrid (algorithmic + AI) |
| **Diagnostic Accuracy** | 15 | AI (LLM) |
| **Test Ordering** | 20 | Algorithmic (rule-based) |
| **Management Plan** | 10 | AI (LLM) |
| **Safety Penalties** | −5 to −15 | Hybrid (see Section 7) |

**Final Score = Sum of all domains − Penalties (minimum 0)**

---

## 4. Layer 1 — Understanding the Consultation (Intent Extraction) {#4-layer1}

Before any scoring begins, the engine reads every question the student asked and analyses it across three dimensions:

### 4a. Clinical Intent Mapping
The engine identifies *what the student was trying to ask*, not just the words used. It has a catalogue of over 50 clinical intents organised by specialty:

- **GI:** vomiting character, diarrhoea, blood in stool, bilious vomiting, dehydration
- **Neurology:** headache character, visual aura, neck stiffness, seizure, consciousness
- **Cardiology:** chest pain, palpitation, radiation of pain, syncope, oedema
- **Respiratory:** dyspnoea, cough character, haemoptysis
- **Psychiatry:** mood, sleep, psychosis
- **Musculoskeletal:** joint pain, back pain
- **Universal:** past medical history, family history, medication history, immunisation, social history, and more

This means a student who asks *"Has there been any redness or unusual colour in his stool?"* is correctly credited for asking about **blood in stool** — even though the exact term "blood" was not used.

### 4b. Specificity Scoring (0–10 per question)
Each question receives a specificity score based on:

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

### 4c. Redundancy Detection
If a student asks about the same topic multiple times (e.g., "Any vomiting?" followed later by "Are they vomiting?" again), the repeated questions are flagged as **redundant** and receive a **0.5× penalty multiplier** on their score contribution. This discourages circular or unfocused questioning.

---

## 5. Layer 2 — History Taking Score (Algorithmic, 70% of History) {#5-layer2}

This layer produces a structured score out of **17.5 marks**, representing the deterministic (non-AI) portion of the history-taking domain.

### 5a. Coverage Matrix
Each case defines a list of **required questions** — the minimum set of history areas a competent clinician should explore. For example, in a paediatric gastroenteritis case:

1. Duration of vomiting
2. Duration of diarrhoea
3. Blood in stool
4. Fever
5. Signs of dehydration
6. Immunisation status
7. Hygiene and water source

The engine checks whether the student's questions covered each of these areas. A question "covers" a required area if the language overlaps meaningfully — either through direct word matching or through intent mapping.

### 5b. Timing Weights — Why *When* You Ask Matters
A core pedagogical principle in clinical medicine is that history-taking follows a logical sequence. A student who asks about past medical history in the **first two minutes** of a consultation demonstrates structured clinical thinking. One who asks the same question only at the very end — after diagnosis is already clear — demonstrates reactive, not proactive, reasoning.

The engine penalises late questioning using a **timing weight**:

| When the question was asked | Timing weight applied |
|---|---|
| First 33% of the consultation | **1.0×** (full credit) |
| Middle 34–66% | **0.7×** |
| Final 34–100% | **0.4×** |

> **Example:** A student asks "Any hygiene issues at home?" in turn 2 of 10 → gets full credit (1.0×). Another asks the exact same question in turn 9 of 10 → gets 40% credit (0.4×). Same question, different timing, different score.

### 5c. Specificity Multiplier
Even when a required question is covered, the quality of how it was asked matters. The specificity score (from Layer 1) determines a **continuous multiplier** applied to that question's mark:

```
specificityMultiplier = min(1.3, specificityScore / max_possible_score)
```

A vague question that technically covers the topic gets less credit than a precise, well-framed clinical question.

### 5d. Per-Question Cap
No single question can earn more than `17.5 ÷ number_of_required_questions` marks. This prevents a student from "gaming" the system by asking one extremely specific question and neglecting all others.

### 5e. When Does the AI Also Score History?
The algorithmic score covers 70% of the History domain (17.5/25). The remaining **7.5 marks** are scored by the AI — but **only** if the algorithmic score falls in a borderline range (8–14 out of 17.5), where automated scoring alone may be insufficient. If the student clearly passed (≥14) or clearly failed (<8) the history component, the AI sub-score for history is skipped to save cost and avoid noise.

---

## 6. Layer 3 — Clinical Reasoning Score (AI-Assisted) {#6-layer3}

An AI language model (Large Language Model) evaluates the qualitative dimensions of the student's performance that cannot be captured by rules alone:

| AI-scored domain | Max marks | What the AI evaluates |
|---|---|---|
| **Clinical Reasoning** | 30 | Did the student ask follow-up questions based on patient responses? Did they demonstrate a working differential? Did they reason through the case systematically? |
| **Diagnostic Accuracy** | 15 | Is the submitted diagnosis correct, partially correct, or wrong? Does it match accepted diagnoses for this case? |
| **Management Plan** | 10 | Does the management plan reflect safe, evidence-based practice? Are dangerous or contraindicated steps included? |
| **History Quality** (conditional) | 7.5 | When borderline deterministic history score: did the student explore history in a clinically meaningful way, even if exact keywords were missed? |

### Anti-Gaming Design
The AI is explicitly instructed **not** to see the student's algorithmic history score before giving its own assessment. This prevents the AI from "anchoring" to the algorithmic result and simply agreeing with it.

The AI is given:
- The full consultation transcript
- The student's diagnosis and management plan
- A list of red flags defined in the case
- A structured rubric with hard score ceilings

---

## 7. Layer 4 — Safety Penalties (Red Flag System) {#7-layer4}

Every clinical case can define **safety-critical red flags** — signs or symptoms that, if present in the patient, would fundamentally change the diagnosis and management and must be actively enquired about.

### How Red Flags Are Defined
Each red flag has:
- **An intent** (e.g., `blood_in_stool`)
- **Semantic patterns** — a list of ways a student might ask about this, in any language or phrasing (e.g., "blood", "redness in stool", "black stool", "red colour in potty", "haematochezia")
- **`present_in_case`** — whether this flag is actually present in the current patient (if not present, there is no obligation to find it, only to screen for it)
- **`critical`** — whether missing this flag warrants a penalty

### The Hybrid Decision Process
Whether a penalty is applied is determined by combining two independent detection systems:

| System | Method |
|---|---|
| **Rule Engine** | Checks if the student's questions matched the semantic patterns for this red flag |
| **AI Semantic Check** | Independently assesses whether the student screened for this concern during the consultation |

The two systems vote, and the penalty is determined by a **Tiered Decision Matrix**:

| Rule Engine | AI Assessment | Penalty Applied |
|---|---|---|
| **Missed** | **Missed** | **Full penalty (−5 pts)** — both systems agree it was not asked |
| **Missed** | **Covered** | **Partial penalty (−2 pts)** — ambiguous; student may have asked in an unusual way |
| **Covered** | **Missed** | **Partial penalty (−2 pts)** — guards against AI hallucination or misreading |
| **Covered** | **Covered** | **No penalty (0 pts)** — student successfully screened |

> **Why not just use keywords?** A keyword system would fail students who ask "any redness in the potty?" instead of "any blood in stool?" — clinically identical, linguistically different. The semantic pattern system ensures lay language, regional phrasing, and indirect questioning is treated fairly.

> **Why not just use AI?** AI language models can hallucinate — they sometimes report that a student asked about something when they didn't. The rule engine acts as a factual anchor, and the tiered system ensures that ambiguity incurs a *partial* penalty rather than being silently dismissed.

---

## 8. How Penalties Work {#8-penalties}

There are two types of penalty:

### Test Ordering Penalties (Test Domain)
If a student orders a test that is explicitly marked **dangerous** in the case configuration (e.g., an invasive procedure that is contraindicated), the test ordering score is reduced accordingly. This is handled in the Test Ordering domain (20 marks), not as a separate deduction.

### Red Flag Safety Penalties (Separate Deduction)
Applied after the base score is calculated. Each active penalty reduces the final score:
- Full penalty: **−5 points**
- Partial penalty: **−2 points**

Multiple red flags can each independently incur penalties. There is no cap on penalty stacking — a student who misses three critical safety items in a high-stakes case can lose up to 15 points.

**Final Score = Base Score − Test Penalties − Red Flag Penalties (minimum 0)**

---

## 9. What the System Rewards and Punishes {#9-rewards}

### Rewarded behaviours
| Behaviour | Why it's rewarded |
|---|---|
| Asking history questions **early** in the consultation | Reflects structured clinical reasoning, not reactive thinking |
| Asking **specific, focused questions** (naming body systems, using clinical terms) | Reflects clinical knowledge and precision |
| **Covering all required history areas** of the case | Reflects completeness of clinical assessment |
| Screening for **red flags** (even if negative) | Reflects patient safety awareness |
| Correct **diagnosis** matching accepted criteria | Core clinical competency |
| Safe, evidence-based **management plan** | Core clinical competency |
| Ordering the **right investigations** | Reflects diagnostic reasoning |

### Penalised behaviours
| Behaviour | Why it's penalised |
|---|---|
| Asking generic catch-alls ("Anything else?", "Other symptoms?") | Demonstrates non-specific, passive questioning |
| Asking the **same question repeatedly** | Indicates disorganised history-taking |
| Asking important questions **very late** in the consultation | Suggests reactive rather than structured reasoning |
| **Not screening for red flags** when they're present in the case | Patient safety risk |
| Ordering **dangerous or contraindicated tests** | Patient safety risk |
| Incorrect or unsafe **management steps** | Clinical knowledge gap |

---

## 10. Case Configuration — How Cases Define Marking Criteria {#10-config}

Each clinical case is stored as a structured data file (JSON) and contains all the information needed to grade that specific case. A case editor (faculty member) can define:

```
evaluation_config:
  history:
    required_questions: [list of history areas that must be covered]

  testing:
    core_tests:      [tests that should be ordered — full marks for these]
    optional_tests:  [tests that can be ordered — partial marks]
    distractor_tests:[tests that should NOT be ordered — reduce score]
    dangerous_tests: [contraindicated tests — significant penalty]

  diagnosis:
    accepted_primary:         [list of acceptable primary diagnosis strings]
    must_include_keywords:    [words the student's diagnosis must contain]

  management:
    core_steps:     [essential management steps — full marks]
    dangerous_steps:[contraindicated interventions — penalty]

  red_flags:
    - intent: [unique identifier]
      intent_patterns: [list of phrases/words the student might use]
      present_in_case: true/false
      critical: true/false
```

This configuration-driven design means:
- **Any specialty** can be supported — the engine is not hard-coded for any single clinical domain
- **Faculty control** the rubric completely — what counts as "required", what is a "red flag", what counts as a correct diagnosis
- **New cases can be added** without changing any engine code — only the case data file needs to be written

---

## 11. Limitations and Design Philosophy {#11-philosophy}

### What this engine is NOT
- It is **not a replacement** for faculty assessment. It is a formative tool for self-directed learning and practice.
- It does **not assess communication style**, empathy, or bedside manner — only clinical content.
- AI scoring (30+15+10 = 55 marks) introduces **some variability** — the same answers may score slightly differently on repeat runs. This is expected and acceptable for a formative tool.

### Why timing weights exist
Medicine is not a checklist. A student who asks "any family history?" only because they ran out of other questions has not demonstrated the same clinical reasoning as one who opens the consultation with a systematic history. Timing pressure forces students to develop and demonstrate a **mental framework** before they begin examining a patient.

### Why the AI doesn't score everything
Pure AI scoring is inconsistent and expensive. Pure rule-based scoring is rigid and punishes phrasing. The hybrid approach — algorithmic for measurable, objective criteria; AI for qualitative, contextual assessment — is designed to be:
- **Consistent** on objective criteria (coverage, timing, redundancy)
- **Flexible** on subjective criteria (reasoning quality, management appropriateness)
- **Safe** by design: penalties require agreement from two independent systems

### On fairness and language
Students in Indian medical education often communicate in mixed Hindi-English, regional terminology, or lay patient language. The semantic pattern system is specifically designed to accommodate this. A student who asks *"koi pet mein dard toh nahi?"* or *"any stomach pain?"* should receive the same clinical credit as one who asks *"any abdominal pain?"*.

---

*This document reflects the evaluation engine as implemented in MediKarya v2.0 (April 2026).*  
*For technical queries, contact the MediKarya development team.*  
*For curriculum or marking rubric queries, contact the faculty co-ordinator.*
