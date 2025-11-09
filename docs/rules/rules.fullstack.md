# Full-Stack Development Rules – IndianWalls

## Context Loader (CRITICAL)
**At session start, read `/docs/product/PROJECT_CONTEXT.md` and the three rules files before planning or proposing changes.**

## Scope & Responsibilities
This document governs architecture, module boundaries, cross-cutting concerns, and quality gates for the entire IndianWalls platform (Next.js frontend + Node.js worker backend).

**Version:** 1.0.0  
**Last Updated:** 2025-11-09

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Web (Frontend)                  │
│  - App Router pages (/, /pricing, /dashboard, /reports/*)  │
│  - API Routes (/api/reports, /api/render-charts, etc.)     │
│  - Server Components + Client Components                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────────┐
│                  Queue Service (BullMQ/Redis)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────────┐
│               Worker Process (report-generator)             │
│  Pipeline: normalise → fetchers → synthesise (OpenAI)       │
│            → renderCharts → composeHtml → finalise          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────────┐
│  Persistence: Database (metadata) + Object Storage (assets) │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository Layout & Hygiene (MANDATORY)

### Monorepo Structure

```
/apps
  /web                  # Next.js app (frontend only)
    /app                # App Router pages & API routes
    /components         # React components
    /lib                # FE-only helpers (api-client, hooks)
    /public             # Static assets
    /styles             # Global styles
  /worker               # Node/TS queue worker + background jobs
    /src
      /pipeline.ts      # Main orchestrator
      /steps            # Pipeline steps (normalise, fetchers, etc.)
      /consumer.ts      # BullMQ worker
    /tests

/packages
  /schemas              # JSON Schemas (single source of truth)
  /shared               # Cross-cutting TS utils (types, formatters, constants)
    /src

/docs
  /rules                # Cursor rules (frontend/backend/fullstack)
  /product              # PRDs, roadmaps, KPIs
  /architecture         # ADRs, diagrams, dataflow
  /ops                  # Runbooks, on-call, deployment guides
  /security             # Threat model, CSP, secrets handling
  /qa                   # Test plans, fixtures

/config                 # Centralised configs (eslint, prettier, jest, ajv)
/scripts                # Developer CLIs (repo-check.js, schema-validate.js)
/infra                  # Terraform, K8s, Dockerfiles (optional)
/.github/workflows      # CI pipelines
/.husky                 # Git hooks

# Generated/ephemeral (always gitignored)
/generated              # Charts, temporary exports, PDFs
```

### File Placement Rules (Zero Tolerance)

| File Type              | Allowed Location                          | Forbidden              |
|------------------------|-------------------------------------------|------------------------|
| Markdown (*.md)        | `/docs/**` (subdirs by domain)            | Root (except README)   |
| Backend code           | `/apps/worker/**`                         | Root, /apps/web        |
| Frontend code          | `/apps/web/**`                            | Root, /apps/worker     |
| Shared utilities       | `/packages/shared/**`                     | /apps/*                |
| JSON Schemas           | `/packages/schemas/**`                    | /apps/*                |
| Config files           | `/config/**` (or root for workspace)      | /apps/*, /docs         |
| Generated assets       | `/generated/**` (gitignored)              | Anywhere (never commit)|
| Secrets                | `.env*` (gitignored), `/config/.env.example` | Anywhere committed |

### Import Boundaries (Enforced)

**TypeScript Path Aliases:**
```json
{
  "compilerOptions": {
    "paths": {
      "@web/*": ["./apps/web/*"],
      "@worker/*": ["./apps/worker/src/*"],
      "@shared/*": ["./packages/shared/src/*"],
      "@schemas/*": ["./packages/schemas/*"]
    }
  }
}
```

**Layer Rules:**
- ✅ `@web/*` can import `@shared/*`, `@schemas/*`
- ✅ `@worker/*` can import `@shared/*`, `@schemas/*`
- ❌ `@web/*` CANNOT import `@worker/*`
- ❌ `@worker/*` CANNOT import `@web/*`
- ✅ `@shared/*` can only import other `@shared/*` (framework-agnostic, pure TypeScript)

### Hygiene Automation

**Required files at root:**

1. **`.editorconfig`** – Enforce consistent formatting (UTF-8, LF, 2 spaces)
2. **`.gitattributes`** – Force LF line endings, mark binaries
3. **`pnpm-workspace.yaml`** – Define workspace packages
4. **`package.json`** root scripts:
   ```json
   {
     "scripts": {
       "lint": "eslint . --ext .ts,.tsx --max-warnings=0",
       "format": "prettier --write .",
       "typecheck": "tsc -b",
       "schema:validate": "node scripts/schema-validate.js",
       "repo:check": "node scripts/repo-check.js",
       "precommit": "pnpm lint-staged"
     }
   }
   ```
5. **`scripts/repo-check.js`** – Fails CI if:
   - `.md` files outside `/docs/**` (except root README)
   - Backend files outside `/apps/worker/**`
   - Frontend files outside `/apps/web/**`
   - Files in `/generated/**` tracked in git

6. **Husky pre-commit hook** (`.husky/pre-commit`):
   ```bash
   pnpm precommit
   ```

### Quality Gates (Before Every Commit)

```bash
pnpm lint && pnpm typecheck && pnpm schema:validate && pnpm repo:check
```

**All four must pass.** No exceptions.

---

## Environments & Secrets Policy

### Environment Variables
- **`.env.local`** – Local development (Next.js)
- **`.env.worker.local`** – Local worker process
- **`config/.env.example`** – Committed template (no secrets)
- **`.env`** – NEVER committed (in `.gitignore`)

### Required Secrets
- `DATABASE_URL` – Postgres connection string
- `REDIS_URL` – Queue/cache connection
- `OPENAI_API_KEY` – OpenAI Responses API
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` – S3-compatible storage
- `STORAGE_BUCKET` – Bucket name for generated assets
- `NEXTAUTH_SECRET` – Session signing (if using NextAuth)

### Secret Handling
- Use `process.env.SECRET_NAME` (never hardcode)
- Validate all required secrets on boot; fail fast if missing
- Rotate API keys quarterly
- No secrets in logs, error messages, or client bundles
- Use least-privilege IAM roles for storage/queue access

---

## Module Boundaries

### `/apps/web` – Next.js Frontend
- Pages, layouts, API routes
- Server Components for data fetching
- Client Components for interactivity (charts, forms)
- Depends on: `@shared/*`, `@schemas/*`
- **Cannot import:** `@worker/*`

### `/apps/worker` – Background Job Processor
- Consumes queue messages
- Executes 6-step pipeline (idempotent)
- Depends on: `@shared/*`, `@schemas/*`
- **Cannot import:** `@web/*`

### `/packages/shared` – Cross-Cutting Logic
- Pure TypeScript utilities (no framework dependencies)
- Types, formatters, constants, validators
- Can be imported by both `@web/*` and `@worker/*`

### `/packages/schemas` – JSON Schema Definitions
- Single source of truth for data contracts
- `llm_output.json` – OpenAI structured output schema
- `report_data.json` – Report API response schema
- `job_message.json` – Queue message schema
- `fetcher_*.json` – Fetcher response schemas

---

## Cross-Cutting Concerns

### 1. Logging & Metrics
- **Library:** `pino` (structured JSON logs)
- **Format:** `{ level, timestamp, message, context, traceId }`
- **Levels:** `debug` (dev only), `info`, `warn`, `error`, `fatal`
- **Metrics:** Prometheus-compatible counters/histograms
  - `report_requests_total`
  - `report_generation_duration_seconds`
  - `llm_api_calls_total{status}`
  - `fetcher_cache_hit_ratio{source}`

### 2. Error Taxonomy
All errors must extend base `AppError` interface:

```typescript
interface AppError extends Error {
  code: string;           // e.g., "ERR_VALIDATION", "ERR_LLM_TIMEOUT"
  statusCode: number;     // HTTP status code
  isRetryable: boolean;   // Can this be retried?
  context?: Record<string, unknown>; // Extra context (no PII)
}
```

**Error Types:**
- `ValidationError` – Schema/input validation failures (400)
- `ExternalAPIError` – Fetcher failures (502/503)
- `LLMError` – OpenAI API failures (500/503)
- `StorageError` – S3/CDN upload failures (503)
- `QueueError` – Message queue failures (503)
- `RateLimitError` – Quota exceeded (429)

### 3. Idempotency
- All worker steps must be idempotent (safe to retry)
- Use `reportId` as idempotency key
- Check completion state before re-executing expensive operations
- Store intermediate checkpoints in DB (`step_completed` flags)

### 4. Rate Limits & Concurrency
- **OpenAI API:** Max 10 concurrent requests per worker instance
- **Fetchers:** Max 5 concurrent per source (RERA, Infra, Market)
- **Chart rendering:** Max 3 concurrent (CPU-bound)
- **Queue workers:** 2–4 concurrent jobs per instance
- Implement exponential backoff: 1s, 2s, 4s, 8s, 16s (max 3 retries)

---

## CI Quality Gates

All checks must pass before merge:

### 1. Lint (`pnpm lint`)
- ESLint with TypeScript plugin
- Prettier formatting check
- **Zero warnings allowed in main branch**

### 2. Type Safety (`pnpm typecheck`)
- `tsc -b` (strict mode)
- Zero type errors

### 3. Unit Tests (`pnpm test:unit`)
- Vitest or Jest
- Coverage: **>80%** for `/packages/shared`, `/apps/worker/src` logic
- Fast (<10s)

### 4. Contract Tests (`pnpm schema:validate`)
- Validate all `/packages/schemas/*.json` against JSON Schema spec
- AJV strict mode
- Ensure schemas are well-formed

### 5. Integration Tests (`pnpm test:integration`)
- Test API routes with mock queue
- Test worker pipeline with mock LLM/fetchers
- Database migrations applied to test DB

### 6. Repository Hygiene (`pnpm repo:check`)
- No `.md` files outside `/docs/**` (except root README)
- No backend code outside `/apps/worker/**`
- No frontend code outside `/apps/web/**`
- No tracked files in `/generated/**`

### 7. E2E Smoke Tests (`pnpm test:e2e`)
- Playwright: Create report → poll status → view result
- Run against staging environment
- <5 min execution time

---

## Definition of Done Checklist

Before merging any PR, verify:

- [ ] Code follows TypeScript strict mode (no `any`, no unsafe assertions)
- [ ] All functions <50 lines; files <300 lines
- [ ] Secrets handled via environment variables (never hardcoded)
- [ ] No PII in logs or error messages
- [ ] Input validated against JSON Schema (AJV)
- [ ] Errors include `code`, `statusCode`, `isRetryable`
- [ ] Worker steps are idempotent (safe to retry)
- [ ] All tests pass (unit, contract, integration, repo check)
- [ ] ESLint + Prettier pass (zero warnings)
- [ ] `tsc -b` passes (zero type errors)
- [ ] No `console.log` (use structured logger)
- [ ] CSP headers configured (no `unsafe-inline`, no `unsafe-eval`)
- [ ] HTML sanitised via DOMPurify before storage
- [ ] Performance: API routes <500ms p95, worker steps <30s each
- [ ] Observability: Key metrics instrumented
- [ ] Documentation: JSDoc for public functions, README updated if needed
- [ ] Files placed in correct directories (passed `pnpm repo:check`)

---

**Changelog:**
- v1.0.0 (2025-11-09) – Initial rules with monorepo structure and hygiene automation
