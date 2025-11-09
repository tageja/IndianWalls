# IndianWalls

AI-powered property due diligence reports for Indian real estate.

## Project Structure

This is a **monorepo** managed with **pnpm workspaces**. It follows strict repository hygiene rules to maintain code quality and organisation.

```
/apps
  /web                  # Next.js frontend
  /worker               # Node.js background worker
/packages
  /schemas              # JSON Schemas (single source of truth)
  /shared               # Shared TypeScript utilities
/docs
  /rules                # Development rules (IMPORTANT!)
  /product              # Product documentation
  /architecture         # Architecture Decision Records (ADRs)
  /ops                  # Operational runbooks
  /security             # Security policies
  /qa                   # Test plans
/config                 # Shared configuration files
/scripts                # Developer scripts (repo-check, schema-validate)
/.github/workflows      # CI/CD pipelines
```

## Getting Started

### Prerequisites

- **Node.js** 20+ (LTS)
- **pnpm** 8+
- **Redis** 6+ (for queue)
- **PostgreSQL** 14+ (for database)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp config/.env.example .env.local

# Run development servers
pnpm dev:web      # Next.js frontend (http://localhost:3000)
pnpm dev:worker   # Worker consumer
```

## Development Rules

**⚠️ IMPORTANT:** Before contributing, read the rules files in `/docs/rules/`:

- **[rules.fullstack.md](/docs/rules/rules.fullstack.md)** – Architecture, module boundaries, quality gates
- **[rules.frontend.md](/docs/rules/rules.frontend.md)** – Next.js frontend guidelines
- **[rules.backend.md](/docs/rules/rules.backend.md)** – Worker, APIs, LLM integration

These rules enforce:
- **Repository hygiene** (file placement, import boundaries)
- **Security** (CSP, sanitisation, secret handling)
- **Quality gates** (lint, typecheck, tests, repo-check)
- **Performance** (caching, concurrency, idempotency)

## Quality Gates

Run before every commit:

```bash
pnpm lint           # ESLint (zero warnings)
pnpm typecheck      # TypeScript strict mode
pnpm schema:validate # Validate JSON Schemas
pnpm repo:check     # Repository hygiene check
```

All checks are enforced via **Husky pre-commit hook**.

## Testing

```bash
pnpm test           # Run all tests
pnpm test:unit      # Unit tests only
pnpm test:integration # Integration tests
```

## Architecture

### Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Chart.js
- **Backend:** Node.js 20, TypeScript, BullMQ (Redis queue)
- **LLM:** OpenAI Responses API (Structured Outputs)
- **Database:** PostgreSQL (via Prisma)
- **Storage:** S3-compatible object storage
- **Charts:** Chart.js (server-side rendering with canvas)

### Data Flow

1. User submits report request via `/reports/new`
2. API enqueues job to BullMQ (`report-generator` queue)
3. Worker executes 6-step pipeline:
   - **Normalise** → validate input
   - **Fetchers** → fetch RERA/Infra/Market data (cached 24–72h)
   - **Synthesise** → LLM generates structured output
   - **Render Charts** → Chart.js → PNG images → S3
   - **Compose HTML** → Assemble + sanitise HTML slots
   - **Finalise** → Update DB, mark complete
4. User polls `/api/reports/[id]` until status = `completed`
5. Frontend renders HTML slots + charts

### Import Boundaries

- `@web/*` → Frontend code (can import `@shared/*`, `@schemas/*`)
- `@worker/*` → Backend code (can import `@shared/*`, `@schemas/*`)
- `@shared/*` → Pure utilities (framework-agnostic)
- `@schemas/*` → JSON Schemas

**Cross-layer imports are forbidden** (enforced by linter + repo-check).

## Security

- **CSP headers** enforced (no `unsafe-inline` scripts)
- **DOMPurify** sanitises all HTML before storage/display
- **Secrets** loaded from environment variables (never committed)
- **No PII in logs** (emails/addresses redacted)
- **Input validation** via JSON Schema (AJV)

## Contributing

1. Read `/docs/rules/*.md` thoroughly
2. Create feature branch from `main`
3. Make changes (respect file placement rules)
4. Run quality gates: `pnpm lint && pnpm typecheck && pnpm repo:check`
5. Write tests (>80% coverage for new code)
6. Create PR with descriptive title

## Licence

Proprietary. All rights reserved.

---

**Questions?** Open an issue or contact the team.
