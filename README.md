# MediKarya

**AI-Powered Clinical Simulation Platform for Medical Students**

> Practice patient consultations, order diagnostics, and develop clinical reasoning — before your first real patient.

🌐 **Live at [medikarya.in](https://www.medikarya.in)**

---

## What is MediKarya?

MediKarya is a clinical education platform built for MBBS and medical students in India. It places students in the role of a doctor, facing a structured virtual patient case. Students conduct a simulated consultation via an AI-powered patient, order investigations from a real test library, submit a diagnosis and management plan, and receive detailed, scored feedback.

The platform is designed to reinforce structured clinical reasoning, patient safety awareness, and diagnostic discipline — with formative feedback that mimics the rigour of faculty assessment.

---

## Key Features

- 🩺 **AI Patient Chat** — Powered by Groq (Llama-3.3-70b), patients respond in character based on pre-scripted clinical facts
- 🧪 **Investigation Ordering** — A categorised test library (Lab, Imaging, Special) with pre-scripted results tied to each case
- 🧠 **4-Layer Evaluation Engine** — Hybrid algorithmic + LLM scoring across 5 clinical domains (100 marks total)
- 🚨 **Red Flag Safety System** — Two-system (rule + LLM) penalty detection for clinically critical missed questions
- 📊 **Attempt History & Replay** — Every completed case is saved; students can review full feedback from any past attempt
- 🏆 **XP & Streaks** — Gamified progress tracking stored per user
- 🔐 **Role-based Access** — Admin panel for faculty to view user progress and manage roles (via Clerk + Supabase)
- 📱 **Mobile-first** — Responsive layout with `100dvh` simulation UI and safe-area padding

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + Radix UI primitives |
| **Authentication** | [Clerk](https://clerk.dev/) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) |
| **AI — Patient Chat** | [Groq](https://groq.com/) (`llama-3.3-70b-versatile`) |
| **AI — Evaluation** | [Google Gemini](https://ai.google.dev/) + Groq |
| **Animations** | Framer Motion + CSS |
| **Smooth Scroll** | Lenis |
| **PWA** | Serwist (`@serwist/next`) |
| **Analytics** | Vercel Speed Insights + Microsoft Clarity |
| **Deployment** | Self-hosted VPS / Vercel-compatible |

---

## Project Structure

```
medikarya/
├── app/                        # Next.js App Router pages & API routes
│   ├── page.tsx                # Landing page (/)
│   ├── layout.tsx              # Root layout (Clerk, fonts, analytics, JSON-LD)
│   ├── dashboard/              # Authenticated student area
│   │   └── cases/             # Case library + individual case pages
│   ├── admin/                  # Admin panel (role-restricted)
│   ├── login/ & signup/        # Clerk authentication pages
│   ├── contact/ contribute/    # Marketing & community pages
│   ├── blog/ tutorials/        # Content pages
│   ├── early-contributors/     # Founding contributor recognition page
│   └── api/                    # API routes
│       ├── cases/              # GET /api/cases, GET /api/cases/[id]
│       ├── chat/patient/       # POST patient chat + GET opening line
│       ├── tests/              # POST generate test result
│       └── clerk-webhook/      # POST Clerk user creation webhook
│
├── components/                 # Shared React components
│   ├── cases/                  # Simulation UI (chat, test ordering, feedback)
│   └── ui/                     # Radix UI-based design system components
│
├── engine/                     # Evaluation & chat engine
│   ├── chatEngine.ts           # Patient chat orchestrator
│   └── evaluation/
│       ├── EvaluationEngine.ts       # 4-layer evaluation orchestrator
│       ├── DeterministicScorer.ts    # Algorithmic test + history scoring
│       ├── IntentExtractor.ts        # Clinical intent mapping & specificity
│       ├── ReasoningPromptBuilder.ts # LLM prompt construction
│       └── types.ts                  # Shared TypeScript interfaces
│
├── cases/
│   └── lib/red-flag-detector.ts      # Tiered red flag penalty resolution
│
├── data/
│   └── cases/index.ts          # All case data + CaseData type definition
│
├── app/actions/
│   └── evaluate.ts             # Server action: run evaluation + persist to Supabase
│
├── hooks/                      # Custom React hooks
├── lib/                        # Utility functions (Supabase client, etc.)
├── types/                      # Global TypeScript type definitions
├── styles/                     # Global CSS
└── public/                     # Static assets
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Clerk](https://clerk.dev/) account and application
- A [Supabase](https://supabase.com/) project
- A [Groq](https://console.groq.com/) API key

### 1. Clone the repository

```bash
git clone https://github.com/your-org/medikarya.git
cd medikarya
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Clerk (Authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk redirect paths
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Groq (AI patient + evaluation)
GROQ_API_KEY=gsk_...

# Google Gemini (evaluation fallback)
GOOGLE_AI_API_KEY=AIza...
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supabase Schema

The platform uses two primary tables:

**`user_profiles`**
Stores user metadata synced from Clerk via webhook: `user_id`, `email`, `name`, `role` (`student` | `admin`), `total_xp`, `current_streak`, `longest_streak`, `last_active_date`.

**`case_attempts`**
Stores every completed evaluation: `user_id`, `case_id`, `score`, `xp_earned`, `time_taken`, `feedback_json` (full structured result), `completed_at`.

---

## Adding a New Case

All cases live in `data/cases/index.ts` as a TypeScript array. To add a new case:

1. Add a new entry to the `cases` array conforming to the `CaseData` type
2. Define the patient demographics, AI persona, pre-scripted test results, and `evaluation_config` (required history, test classifications, accepted diagnoses, red flags)
3. The case is automatically available in the case library — no route or component changes needed

For full field-by-field documentation, see [`CASE_SYSTEM_README.md`](./CASE_SYSTEM_README.md).

---

## Evaluation Engine

The scoring pipeline runs across 4 layers:

| Layer | Mechanism | Domains Scored |
|---|---|---|
| **1 — Intent Extraction** | Rule-based NLP | Maps questions to clinical intents; scores specificity & redundancy |
| **2 — Deterministic Scoring** | Algorithmic | Test ordering (0–20 pts) + 70% of History (0–17.5 pts) |
| **3 — LLM Scoring** | Groq / Llama | Clinical Reasoning (30), Diagnosis (15), Management (10), History Q (0–7.5) |
| **4 — Safety Penalties** | Hybrid rule + LLM | Red flag missed penalty (−2 to −5 per flag) |

**Total: 100 marks** across Clinical Reasoning (30), History (25), Diagnosis (15), Testing (20), Management (10), minus safety penalties.

For the full technical and pedagogical reference, see [`EVALUATION_ENGINE.md`](./EVALUATION_ENGINE.md).

---

## Internal Documentation

| Document | Contents |
|---|---|
| [`CASE_SYSTEM_README.md`](./CASE_SYSTEM_README.md) | Complete case flow, data architecture, API routes, components, and guide to adding new cases |
| [`EVALUATION_ENGINE.md`](./EVALUATION_ENGINE.md) | Detailed scoring rubric, intent extraction, deterministic + LLM layers, red flag system, and design philosophy |
| [`AI_INTEGRATION_GUIDE.md`](./AI_INTEGRATION_GUIDE.md) | Guide to the AI integrations (Groq, Gemini) and how to extend or replace the LLM layer |

---

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## License

This project is private and proprietary. All rights reserved by the MediKarya team.

---

*MediKarya v2.0 — April 2026*  
*Built for medical students in India. Made with ❤️ and clinical rigour.*
