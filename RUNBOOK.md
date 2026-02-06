# Trustable Runbook

## What Trustable Is

Trustable is a B2B SaaS platform that monitors how AI systems (ChatGPT, Claude, Perplexity, Gemini, etc.) perceive, describe, and recommend brands. It provides visibility scoring, trust analysis, competitive intelligence, and actionable optimization plans.

## What Trustable Does

1. **Ingestion** — Accepts brand profiles, competitors, and prompt sets via API
2. **Scanning** — Queries AI platforms with configured prompts, stores responses
3. **Scoring** — Computes trust, visibility, recommendation, sentiment, and alignment scores
4. **Analysis** — Detects why brands win or lose AI recommendations
5. **Simulation** — Runs "would AI recommend me?" buyer query simulations
6. **Reporting** — Generates action plans, weekly digests, executive reports
7. **Alerting** — Notifies on score drift, competitor moves, brand safety issues

## What Trustable Does NOT Do

- No telephony or calling
- No lead dialing
- No CRM sync (beyond webhooks)
- No web scraping
- No social media posting
- No payment processing (handled by frontend)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                  (Lovable Frontend / API Consumers)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│                      (Supabase Edge Functions)                           │
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   brands    │ │    scans    │ │   agent     │ │  reports    │        │
│  │   API       │ │    API      │ │   API       │ │   API       │        │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────┐
│   SCORING ENGINE    │ │   ANALYSIS ENGINE   │ │   SIMULATION ENGINE     │
│                     │ │                     │ │                         │
│ - Trust score       │ │ - Why you lost      │ │ - Buyer query sim       │
│ - Visibility score  │ │ - Trust drift       │ │ - Before/after preview  │
│ - Recommendation    │ │ - Language align    │ │ - Brand safety check    │
│ - Sentiment         │ │ - Content gaps      │ │                         │
└─────────────────────┘ └─────────────────────┘ └─────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND WORKERS                               │
│                        (Scheduled Jobs)                                  │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ scan-runner  │ │ score-calc   │ │ digest-gen   │ │ alert-check  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           POSTGRES DATABASE                              │
│                            (Supabase)                                    │
│                                                                          │
│  brands | competitors | scans | scores | audits | alerts | reports      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   OpenAI    │ │  Anthropic  │ │  Perplexity │ │   Resend    │        │
│  │   (GPT)     │ │  (Claude)   │ │   API       │ │   (Email)   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Brand Onboarding
```
Client → POST /api/brands → Database (brands table)
      → POST /api/competitors → Database (competitors table)
      → POST /api/prompt-sets → Database (prompt_sets table)
```

### 2. Scan Execution
```
Scheduler → scan-runner worker
         → Fetch prompt sets for brand
         → Query each AI platform (OpenAI, Anthropic, Perplexity, etc.)
         → Store responses in scan_results table
         → Trigger score-calc worker
```

### 3. Score Calculation
```
score-calc worker → Read scan_results
                 → Compute trust, visibility, recommendation, sentiment scores
                 → Store in brand_scores table
                 → Check for drift alerts
                 → Trigger alert-check if thresholds exceeded
```

### 4. Analysis Request
```
Client → POST /api/agent/message → Agent processes with context
      → Executes tools (explain_score, why_you_lost, etc.)
      → Returns structured response with citations
```

### 5. Report Generation
```
Scheduler → digest-gen worker
         → Fetch brand scores, alerts, competitor data
         → Generate weekly digest
         → Queue email via Resend
```

---

## Service Responsibilities

| Service | Owns | Does Not Own |
|---------|------|--------------|
| `api/brands` | Brand CRUD, workspace membership | Scoring, analysis |
| `api/scans` | Scan triggering, result storage | AI platform calls (delegated to workers) |
| `api/agent` | Copilot chat, tool execution | Background processing |
| `api/reports` | Report generation, export | Email delivery (delegated to queue) |
| `workers/scan-runner` | AI platform queries, response parsing | Score calculation |
| `workers/score-calc` | Score computation, drift detection | Alerting logic |
| `workers/alert-check` | Alert creation, notification dispatch | Score computation |
| `workers/digest-gen` | Digest compilation, email queuing | Email sending |

---

## Database Ownership

| Table | Owner Service | Readers |
|-------|---------------|---------|
| `brands` | api/brands | All |
| `competitors` | api/brands | scoring, analysis |
| `prompt_sets` | api/brands | scan-runner |
| `scan_results` | workers/scan-runner | scoring, analysis, reporting |
| `brand_scores` | workers/score-calc | All |
| `competitor_scores` | workers/score-calc | analysis, reporting |
| `agent_threads` | api/agent | api/agent only |
| `agent_messages` | api/agent | api/agent only |
| `alerts` | workers/alert-check | api, reporting |
| `weekly_digests` | workers/digest-gen | api/reports |
| `action_plans` | api/agent | reporting |

---

## Boundaries (Read This Before Editing)

### DO NOT Without Backend Review

| Action | Why |
|--------|-----|
| Rename folders or move modules | Breaks imports across the codebase |
| Edit `supabase/migrations/*` | Schema changes cascade to all tables and services |
| Modify `src/scoring/index.ts` | Scoring must remain deterministic; tests depend on it |
| Change `src/agent/system-prompt.ts` | Contains safety rules |
| Edit `supabase/functions/_shared/*` | Used by all Edge Functions |
| Modify `contracts/api/*.yaml` | Contracts are source of truth; changes need implementation sync |

### Adding New Endpoints

1. **First:** Add to OpenAPI spec in `contracts/api/functions.openapi.yaml`
2. **Then:** Implement in `supabase/functions/`
3. **Finally:** Add tests

### Adding New Feature Modules

1. Create `src/features/my-feature.ts`
2. Follow pattern: `interface`, `Engine class`, `createEngine()` factory
3. Export from `src/features/index.ts`

### Changing Database Schema

1. **Never** edit existing migration files
2. Create new migration: `npx supabase migration new my_change`
3. Write idempotent SQL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
4. Test on local Supabase first
5. Update `src/models/index.ts` with new types

### Changing Scoring Outputs

1. Update logic in `src/scoring/index.ts`
2. **Immediately** update `tests/scoring.test.ts`
3. Run tests to verify determinism: `deno test tests/scoring.test.ts`

---

## Running Locally

### Prerequisites
- Node.js 20+
- Deno (for tests)
- Docker + Docker Compose
- Supabase CLI

### Steps

```bash
# 1. Clone and enter directory
git clone <repo>
cd trustable

# 2. Start local Supabase
npx supabase start

# 3. Run migrations
npx supabase db push

# 4. Copy environment
cp .env.example .env
# Edit .env with your API keys

# 5. Generate TypeScript types
npx supabase gen types typescript --local > src/types/database.ts

# 6. Start edge functions locally
npx supabase functions serve

# 7. Run tests
deno test tests/
```

### Local URLs
- Supabase Studio: http://localhost:54323
- Edge Functions: http://localhost:54321/functions/v1/
- Database: postgresql://postgres:postgres@localhost:54322/postgres

---

## How to Run Smoke Test

The smoke test validates the golden path end-to-end in under 2 minutes using mocked AI responses.

### Prerequisites
- Deno installed (`brew install deno` or https://deno.land)
- `.env` file configured with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Supabase running (local or hosted)

### Run

```bash
# Make executable (first time only)
chmod +x scripts/smoke-test.sh

# Run the test
./scripts/smoke-test.sh

# Or directly with Deno
deno run --allow-all scripts/smoke-test.ts
```

### What It Tests

1. **Creates a test brand** — Verifies brand insertion works
2. **Runs a scan with mocked AI responses** — No external API calls
3. **Computes and stores scores** — Validates scoring pipeline
4. **Generates a report payload** — Confirms data aggregation
5. **Creates an agent chat with citation** — End-to-end copilot flow
6. **Cleans up test data** — Leaves no residue

### Expected Output

```
✅ Step 1: Create/verify test user (45ms)
✅ Step 2: Create brand (32ms)
✅ Step 3: Run scan (mocked) (89ms)
✅ Step 4: Compute scores (56ms)
✅ Step 5: Generate report (28ms)
✅ Step 6: Agent chat with citation (67ms)
✅ Step 7: Cleanup test data (41ms)

✅ SMOKE TEST PASSED
```

### If It Fails

1. Check `.env` has correct Supabase credentials
2. Ensure Supabase is running: `npx supabase status`
3. Run migrations: `npx supabase db push`
4. Check function logs: Supabase Dashboard → Edge Functions → Logs

---

## Deployment

### Supabase Hosted

```bash
# Link to project
npx supabase link --project-ref <your-project-ref>

# Deploy migrations
npx supabase db push

# Deploy edge functions
npx supabase functions deploy

# Set secrets
npx supabase secrets set OPENAI_API_KEY=sk-xxx
npx supabase secrets set ANTHROPIC_API_KEY=sk-xxx
npx supabase secrets set RESEND_API_KEY=re_xxx
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT queries |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude queries |
| `PERPLEXITY_API_KEY` | No | Perplexity API key |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auto | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Supabase service role key |

---

## Monitoring

### Logs
- Edge function logs: Supabase Dashboard → Edge Functions → Logs
- Database logs: Supabase Dashboard → Database → Logs

### Metrics to Watch
- Scan success rate (should be >95%)
- Score calculation latency (<5s)
- Agent response latency (<3s)
- Email delivery rate (>99%)

### Alerts to Configure
- Scan failures > 5 in 1 hour
- Score calculation queue depth > 100
- API error rate > 1%

---

## Troubleshooting

### Scans not running
1. Check `scheduled-monitor` function is deployed
2. Verify API keys are set in secrets
3. Check AI platform rate limits

### Scores not updating
1. Check `scan_results` table has new data
2. Verify `score-calc` worker is triggered
3. Check for errors in function logs

### Agent not responding
1. Verify `ANTHROPIC_API_KEY` is set
2. Check user has copilot access (plan tier)
3. Check `agent_messages` table for errors

---

## Security Notes

- All API endpoints require Supabase Auth JWT
- Row Level Security (RLS) enforced on all tables
- Service role key never exposed to client
- API keys stored in Supabase secrets, never in code
- Audit log tracks all sensitive operations
