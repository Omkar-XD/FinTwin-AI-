# FinTwin AI

An AI-powered personal finance platform that turns uploaded bank/loan/salary statements into a verified financial profile, risk score, personalized recommendations, and scenario projections — with a conversational assistant grounded in that data. Every AI-generated output is passed through a multi-stage Enkrypt validation layer before it reaches the client.

Monorepo containing a Hono/Mastra **backend** and a Next.js **frontend**.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Validation Architecture](#validation-architecture)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
Frontend (Next.js)
        │
        ▼
REST API Routes (Hono)
        │
        ▼
Mastra AI Agents  ──►  Financial Intake Workflow
        │
        ▼
Groq / Gemini + Qdrant + Supabase + Redis
        │
        ▼
Enkrypt Validation Layer (mode-aware: FACTUAL / RECOMMENDATION /
                           SIMULATION / ASSISTANT / RISK_ANALYSIS)
        │
        ▼
Validated Financial Advice → Client
```

Each AI output is classified into a **validation mode** so the validation layer applies the right rules for the right kind of content — a scenario projection is never diffed against today's balance, and advisory sentences in an assistant reply aren't held to the same factual bar as a stated fact. See [Validation Architecture](#validation-architecture).

## Tech Stack

**Backend**
| Layer | Technology |
|---|---|
| Server framework | [Hono](https://hono.dev/) on Node.js (`@hono/node-server`) |
| Agent orchestration | [Mastra](https://mastra.ai/) |
| LLM inference | Groq (`llama-3.3-70b-versatile`), rate-limited via a request limiter |
| Document understanding | Gemini (PDF extraction + embeddings), with rule-based fallback extractors |
| Database / Auth / Storage | Supabase (Postgres, Auth, Storage) |
| Vector memory | Qdrant |
| Caching / Queue | Redis |
| Output validation / guardrails | Enkrypt AI |
| Schema validation | Zod |
| Language / package manager | TypeScript / pnpm |

**Frontend**
| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS + PostCSS |

## Project Structure

```
fintwin-ai-agent/
│
├── backend/
│   ├── src/
│   │   ├── agents/                 # Mastra agents (profile, risk, recommendation, simulation, assistant)
│   │   ├── workflows/              # financial-intake-workflow — orchestrates post-upload processing
│   │   ├── routes/                 # Hono REST routes (assistant, dashboard, documents, profile, etc.)
│   │   ├── types/                  # Shared TypeScript types
│   │   └── lib/
│   │       ├── validation/         # Enkrypt validation framework (see below)
│   │       ├── auth.ts, cors.ts, env.ts, http-error.ts
│   │       ├── supabase.ts, redis.ts, qdrant.ts, dashboard-cache.ts, queue.ts
│   │       ├── llm.ts, models.ts, groq-limiter.ts
│   │       ├── gemini-document.ts, gemini-embeddings.ts
│   │       ├── rule-based-extractor.ts, rule-based-debt-extractor.ts
│   │       ├── financial-ai.ts, scenarios.ts, currency.ts
│   │       ├── enkrypt.ts, enkrypt-status.ts, database.types.ts
│   │       └── scenarios.test.ts
│   ├── scripts/
│   │   └── check-redis.ts          # Standalone Redis connectivity check
│   ├── supabase/
│   │   └── migrations/             # SQL migrations
│   ├── package.json / tsconfig.json / .env / .env.example
│
├── frontend/
│   ├── app/                        # Next.js App Router pages/layouts
│   ├── components/                 # Reusable React UI components
│   ├── lib/                        # Shared frontend utilities
│   ├── public/                     # Static assets
│   ├── next.config.mjs / postcss.config.mjs / components.json
│   ├── package.json / tsconfig.json / .env.local / .env.example
│
├── supabase/                       # Root-level Supabase project config
├── .agents/                        # AI agent configuration files
├── package.json                    # Root workspace scripts
├── LICENSE
└── README.md
```

### `backend/src/lib/validation/` — Enkrypt validation framework

```
validation/
├── ValidationMode.ts               # FACTUAL / RECOMMENDATION / SIMULATION / ASSISTANT / RISK_ANALYSIS
├── ValidationStrategy.ts           # Strategy interface
├── ValidationResult.ts             # Structured result type
├── ValidationEngine.ts             # Orchestrator — dispatches to the right strategy
├── DecisionEngine.ts               # Safety-first pass/replace/warn logic
├── ContextAdherenceValidator.ts    # Shared adherence-scoring logic
├── SafetyFallback.ts               # Safe fallback response handling
├── ValidationLogger.ts             # Structured VALIDATION_* event logging + persistence
├── validation-regression.test.ts   # Regression tests
├── strategies/
│   ├── FactualValidator.ts
│   ├── RecommendationValidator.ts
│   ├── SimulationValidator.ts
│   ├── AssistantValidator.ts
│   └── RiskValidator.ts
└── assistant/
    ├── ClaimParser.ts               # Splits assistant text into semantic claims
    └── ClaimType.ts                 # FACT / RECOMMENDATION / EXPLANATION / PREDICTION
```

## Setup Instructions

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A [Supabase](https://supabase.com/) project (Postgres + Storage + Auth)
- A [Qdrant](https://qdrant.tech/) instance (cloud or self-hosted)
- A [Redis](https://redis.io/) instance
- A [Groq](https://groq.com/) API key
- A [Google Gemini](https://ai.google.dev/) API key (document extraction + embeddings)
- An [Enkrypt AI](https://www.enkryptai.com/) API key

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd fintwin-ai-agent
```

### 2. Install dependencies

```bash
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend
pnpm install
```

### 3. Configure environment variables

```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env.local
```

Fill in the values described in [Environment Variables](#environment-variables).

### 4. Set up the database

Apply the SQL migrations in `backend/supabase/migrations/` to your Supabase project:

```bash
cd backend
supabase db push
```

### 5. Verify Redis connectivity (optional)

```bash
cd backend
pnpm tsx scripts/check-redis.ts
```

Expected output: `Redis PING result: PONG`.

## Environment Variables

**`backend/.env`**

```env
# Server
PORT=3000

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Groq (LLM inference)
GROQ_API_KEY=

# Gemini (document extraction + embeddings)
GEMINI_API_KEY=

# Qdrant (vector memory)
QDRANT_URL=
QDRANT_API_KEY=

# Redis (caching / queue)
REDIS_URL=

# Enkrypt AI (output validation)
ENKRYPT_API_KEY=
```

**`frontend/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

> Check `backend/.env.example` and `frontend/.env.example` for the authoritative variable names — copy from those rather than this list if they differ.

## Running the App

**Backend** (from `backend/`):

| Command | Description |
|---|---|
| `pnpm dev` | Start the API server in development mode |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled server |
| `pnpm test` | Run tests (e.g. `scenarios.test.ts`, `validation-regression.test.ts`) |
| `pnpm tsx scripts/check-redis.ts` | Verify Redis connectivity |

**Frontend** (from `frontend/`):

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |

> Adjust script names to match whatever is actually defined in each `package.json`.

Verify the backend is up:

```bash
curl http://localhost:3000/health
```

## API Reference

All routes except `/health` require a valid Supabase-authenticated request.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/documents/upload` | Upload a PDF (`bank_statement`, `salary_slip`, `credit_card`, `loan_statement`) |
| `POST` | `/documents/:documentId/analyze` | Extract + run the financial intake workflow |
| `GET` | `/documents` | List uploaded documents |
| `GET` | `/documents/:id/status` | Document processing status |
| `GET` | `/dashboard/:userId` | Aggregated profile + risk + recommendations (Redis-cached) |
| `GET` | `/profile/:userId` | Verified financial profile |
| `GET` | `/recommendations/pending/:userId` | Recommendations awaiting review |
| `POST` | `/recommendations/:id/approve` | Approve a recommendation |
| `POST` | `/recommendations/:id/reject` | Reject a recommendation (recorded as feedback memory) |
| `POST` | `/simulation/run` | Run a scenario simulation |
| `POST` | `/assistant/chat` | Chat with the financial assistant |

## Validation Architecture

| Mode | Applies to | Behavior |
|---|---|---|
| `FACTUAL` | Extracted financial profile | Strict — every fact/number must trace to verified source data |
| `RECOMMENDATION` | Recommendation Agent output | Checks recommendations are *supported by* the data, not verbatim-matched |
| `SIMULATION` | Scenario projections | Validates internal consistency and assumptions — never diffs projected vs. current values |
| `ASSISTANT` | Chat responses | `ClaimParser` splits the response into claims; only `FACT` claims are adherence-checked |
| `RISK_ANALYSIS` | Risk Detection Agent output | Validates only risk-relevant fields |

Safety validation (toxicity, policy violations, prompt injection, unsafe financial advice) always runs first via `SafetyFallback` and is the only stage allowed to replace a response outright. `DecisionEngine` ensures context/adherence issues are logged (`ValidationLogger`) and surfaced as metadata rather than discarding a useful response.

## Troubleshooting

- **`Could not find the table 'public.validation_logs'`** — the validation logging migration hasn't been applied; run the migrations in `backend/supabase/migrations/`. Validation itself still succeeds; only persistence is affected.
- **Tool call schema validation failures on `runScenarioSimulation`** — ensure the tool's declared `params` schema in `assistant-agent.ts` matches what the model is instructed to produce per `scenarioType`.
- **Redis connection issues** — run `pnpm tsx scripts/check-redis.ts` from `backend/` to isolate connectivity vs. application logic.
