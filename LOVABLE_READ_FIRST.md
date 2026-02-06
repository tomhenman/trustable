# LOVABLE READ FIRST

> **Read this file completely before making any changes.**

## What is Trustable?

Trustable is an AI visibility and trust monitoring platform. It answers one question: **"When someone asks ChatGPT, Claude, or Perplexity about your business, what do they say?"** The platform scans AI systems with targeted prompts, analyzes responses for mentions/sentiment/recommendations, calculates trust scores, and provides actionable recommendations to improve visibility. It includes an AI Copilot for conversational strategy assistance.

---

## Repository Map

```
trustable/
├── supabase/
│   ├── functions/          # Edge Functions (serverless API endpoints)
│   │   ├── ai-query/       # Query single AI platform
│   │   ├── run-scan/       # Execute full visibility scan
│   │   ├── agent-chat/     # AI Copilot conversations
│   │   ├── site-audit/     # Website audit
│   │   ├── generate-content/
│   │   ├── generate-recommendations/
│   │   ├── competitor-scan/
│   │   ├── export-report/
│   │   ├── scheduled-monitor/
│   │   ├── email-reports/
│   │   ├── integrations-ingest/
│   │   └── _shared/        # Shared utilities (planGating.ts)
│   └── migrations/         # Database schema (001-004)
│
├── src/
│   ├── features/           # Feature modules (19 engines)
│   ├── agent/              # AI Copilot system
│   ├── scoring/            # Score calculation (pure functions)
│   ├── models/             # TypeScript type definitions
│   └── tests/              # Unit tests
│
├── contracts/
│   └── api/
│       ├── functions.openapi.yaml  # Edge Function endpoints (SOURCE OF TRUTH)
│       ├── brands.openapi.yaml     # Brand CRUD (Supabase client)
│       └── agent.openapi.yaml      # Agent API details
│
├── tests/                  # Integration tests
├── scripts/                # Utility scripts
├── docs/                   # Extended documentation
└── *.md                    # Root documentation
```

---

## Source of Truth Rules

| What | Source of Truth | Location |
|------|-----------------|----------|
| **Edge Function API** | OpenAPI spec | `contracts/api/functions.openapi.yaml` |
| **Database schema** | SQL migrations | `supabase/migrations/*.sql` |
| **Type definitions** | TypeScript models | `src/models/index.ts` |
| **Plan limits** | planGating.ts | `supabase/functions/_shared/planGating.ts` |
| **Scoring logic** | Scoring module | `src/scoring/index.ts` |

**Before adding an endpoint:** Update the OpenAPI spec first.  
**Before changing the DB:** Create a new migration file.  
**Before changing types:** Update `src/models/index.ts`.

---

## DO NOT TOUCH (Requires Backend Review)

These files have downstream dependencies. Do not modify without backend approval:

| File/Folder | Reason |
|-------------|--------|
| `supabase/migrations/*` | Schema changes cascade to all tables |
| `supabase/functions/_shared/*` | Used by all Edge Functions |
| `src/scoring/index.ts` | Scoring must remain deterministic |
| `src/agent/system-prompt.ts` | Contains safety rules |
| `src/agent/confidence.ts` | Trust decay algorithm |
| `contracts/api/*.yaml` | Contract changes need implementation sync |

---

## SAFE TO EXTEND

You can freely add/modify:

| Location | What You Can Do |
|----------|-----------------|
| `src/features/` | Add new feature modules (follow existing pattern) |
| `src/models/index.ts` | Add new type definitions |
| `docs/` | Add/update documentation |
| `tests/` | Add test files |
| Individual Edge Function logic | Modify function internals (not signatures) |

**When adding a new feature module:**
1. Create `src/features/my-feature.ts`
2. Export: interface, Engine class, factory function
3. Add exports to `src/features/index.ts`

---

## Local Development Commands

### Prerequisites
```bash
npm install -g supabase
```

### Setup
```bash
# Clone and enter repo
cd trustable

# Copy environment file
cp .env.example .env
# Fill in required values (see .env.example)

# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > src/types/database.ts
```

### Run Edge Functions Locally
```bash
supabase functions serve
```

### Deploy to Supabase
```bash
# Deploy all functions
supabase functions deploy

# Deploy single function
supabase functions deploy run-scan
```

---

## Test Commands

### Unit Tests
```bash
# Scoring tests
deno test tests/scoring.test.ts

# QA validation suite
deno test tests/qa-validation.test.ts --allow-all

# Agent tests
deno test src/tests/agent.test.ts
```

### Smoke Test (End-to-End)
```bash
# Run the golden-path smoke test
./scripts/smoke-test.sh
```

---

## Key Integration Points for Frontend

### 1. Authentication
Use Supabase Auth. All Edge Functions receive the JWT automatically.

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
await supabase.auth.signInWithPassword({ email, password });
```

### 2. Brand CRUD
Use Supabase client directly (not Edge Functions):

```typescript
// Create
const { data } = await supabase.from('businesses').insert({ name: 'Acme' }).select().single();

// Read
const { data } = await supabase.from('businesses').select('*').eq('user_id', userId);

// Update
await supabase.from('businesses').update({ name: 'New' }).eq('id', brandId);

// Delete
await supabase.from('businesses').delete().eq('id', brandId);
```

### 3. Running Scans
```typescript
const { data, error } = await supabase.functions.invoke('run-scan', {
  body: { businessId, scanType: 'FULL', platforms: ['chatgpt'] }
});
```

### 4. Agent Chat
```typescript
// Create thread
const { data: thread } = await supabase.functions.invoke('agent-chat', {
  body: { action: 'create_thread', userId, businessId }
});

// Send message
const { data: response } = await supabase.functions.invoke('agent-chat', {
  body: { action: 'send_message', threadId: thread.id, userId, businessId, message: 'Hello' }
});
```

### 5. Plan Limits
Check before operations:
```typescript
const { data: profile } = await supabase.from('user_profiles').select('plan').eq('id', userId).single();
// Plan tiers: FREE, STARTER, PROFESSIONAL, SCALE, CUSTOM
```

---

## Error Handling

All Edge Functions return:
```typescript
// Success
{ success: true, ...data }

// Error
{ error: "Message", code: "ERROR_CODE" }
```

Handle 403 (plan limit) specially - show upgrade prompt.

---

## Questions?

1. Read `RUNBOOK.md` for operations guide
2. Read `QA_REPORT.md` for test coverage
3. Check `docs/` for detailed specs
