# Project Context — IndianWalls (Property Intelligence Reports)

**Short name:** IndianWalls  
**Owner:** Tarun (product lead)  
**Mission:** Turn a user's property brief into a trustworthy, source-rich HTML report with charts, maps, and a clear verdict (GO / CAUTION / NO-GO).

---

## 1) What we are building
- **Web product** (desktop first) that generates and serves an **HTML report** per request.  
- **Pipeline**: intake brief → fetch evidence → LLM synthesis (OpenAI Structured Outputs) → charts → locked-template HTML → optional PDF.  
- **MVP focus:** accuracy, source transparency, uniform design, and fast end-to-end time.

**Non-goals (MVP):** community features, multi-project comparisons beyond one report, complex multi-tenant billing.

---

## 2) Primary users & jobs
- **Investor / Buyer (end user):** generates a report, views sources, downloads PDF.  
- **Operator (internal):** monitors job statuses, can re-run jobs, and checks source health.  
- **Future (optional):** editor can add manual overrides for specific fields.

---

## 3) Brand & UX tone
- Calm, editorial, trustworthy. British English.  
- Clean cards, modest colour use, generous whitespace, readable print.  
- **Design tokens** live in `report-theme.css`. Content must **never** define inline colours.

---

## 4) Architecture (high level)
- **Frontend:** Next.js (App Router). Pages: Home, Pricing, Dashboard, New Report, Report Detail.  
- **Backend:** Node/TypeScript worker (queue consumer) + Web APIs.  
- **Database:** **Supabase Postgres** (source of truth), **Row-Level Security (RLS)** from day one.  
- **Storage/CDN:** object storage for generated charts/HTML/PDF.  
- **LLM:** OpenAI **Responses API** with **Structured Outputs** (schema-enforced).  
- **Charts:** Chart.js (server render to PNG; client render fallback).  
- **HTML:** Locked React template with **content slots**; no inline styles in LLM output.  
- **PDF:** Headless Chromium print route (A4).

---

## 5) Repository hygiene (MANDATORY)
**Monorepo layout**


/apps/web # Next.js frontend (frontend ONLY)
/apps/worker # Node/TS worker (backend ONLY)
/packages/schemas # JSON Schemas (single source of truth)
/packages/shared # Cross-cutting TS utils (types, formatters)
/docs/... # All markdown (rules, product, ops, qa, security, architecture)
/config # ESLint/Prettier/TS/AJV/OpenAPI configs
/scripts # Developer CLIs (e.g., repo-check.js)
/infra # IaC / Docker / k8s (optional)
/.github/workflows # CI
/generated # NEVER committed

**Rules**
- All `.md` in `/docs/**` (allow `README.md`, `SECURITY.md`, and `/.github/**`).  
- Frontend code lives only under `/apps/web/**`. Backend only under `/apps/worker/**`.  
- Shared code under `/packages/shared/**`. Schemas under `/packages/schemas/**`.  
- No generated artefacts committed.  
- CI gates: `lint`, `typecheck`, `schema:validate`, `repo:check`.

---

## 6) Data model (initial MVP)
**Tables (Supabase / Postgres)**
- `reports`: `id uuid pk`, `user_id uuid`, `status text`, `title text`, `created_at timestamptz default now()`, `html_url text`, `pdf_url text`, `stats jsonb`.  
- `sources`: `id uuid pk`, `report_id uuid fk -> reports.id on delete cascade`, `publisher text`, `url text`, `pub_date date`, `sha1 text`, `created_at timestamptz default now()`.

**RLS (policy intent)**
- Authenticated users can **select/insert/update** reports **they own** (`user_id = auth.uid()`).
- `sources` readable only if the parent `report` is owned by the user.

---

## 7) LLM usage policy
- **OpenAI only** (no in-house model).  
- Use **Structured Outputs** with a strict JSON Schema. Reject invalid responses and retry with a short "repair" instruction (max 2 attempts). Temperature 0.2–0.3.  
- **Every non-obvious claim must include `sources[]`** with `publisher`, `date`, `url`.  
- If sources disagree, include both and mark the field `disputed:true` (renderer shows both).  
- Never allow LLM to dictate design; it fills **content slots** only.

---

## 8) HTML "slots" contract (branding locked)
The template exposes these DOM IDs; LLM returns **HTML fragments** for them (no `<html>`, no inline styles):
- `slot-hero`  
- `slot-key-metrics`  
- `slot-chart-1`  
- `slot-chart-2`  
- `slot-evidence`

**Allowed classes only:** `badge` (`go|caution|nogo`), `chip`, `card`, `kv`, plus standard `h1/h2/p/ul/li`.  
**Charts data** come as arrays under `charts.*` (the template draws them with Chart.js).

---

## 9) APIs (surface for frontend)
- `POST /api/reports` → creates a report row (`status:'queued'`), returns `{ id }`.  
- `GET /api/reports/:id` → returns `status`, `html_url`, `pdf_url`, `stats` (RLS-protected).  
- Internal (worker-facing):  
  - `POST /api/render-charts` → returns PNG URLs.  
  - `POST /api/compose-report` → builds final HTML, returns `html_url`.

**OpenAPI spec** at `/config/openapi.yaml`. Keep it in sync.

---

## 10) Worker pipeline (idempotent steps)
1. **NORMALISE**: brief → `{ city, sector, project, aliases[] }`.  
2. **FETCH_RERA / FETCH_INFRA / FETCH_MARKET / RISK** (parallel, domain caps).  
3. **SYNTHESISE**: OpenAI (Structured Output → schema `llm_output.json`).  
4. **RENDER_CHARTS**: Chart.js → PNGs → storage `/generated/{id}/charts/*.png`.  
5. **COMPOSE_HTML**: inject slots + chart URLs into locked template → `html_url`.  
6. **FINALISE**: write status, timings; trigger notify.

**Reliability:** checkpoints table, exponential backoff, 24–72h cache for immutable sources.

---

## 11) Charts & maps (MVP)
- **Charts:** (a) Price history (10y, nominal vs real), (b) Inventory months.  
- Size: 1280×720, DPR 2, currency `en-IN`.  
- **Maps (placeholder for MVP):** static images with simple legends; upgrade later.

---

## 12) Security & privacy
- **CSP**: no `eval`, restrict to self + Chart.js CDN.  
- **Sanitisation**: DOMPurify on all slot HTML before insertion.  
- No secrets or PII in client code. No raw briefs in logs beyond 120 chars.  
- Signed URLs for private assets; avoid PII in query strings.

---

## 13) Performance & cost
- Parallel fetchers with per-domain concurrency caps.  
- Cache RERA/press notes; coalesce identical briefs (hash).  
- LLM retries max 2; short contexts; prefer URLs over large text blobs.

---

## 14) Environments & CI/CD
- Envs: dev, staging, prod (separate keys for Supabase + OpenAI).  
- CI must run: `lint`, `typecheck`, `schema:validate`, `repo:check`, plus **migrations in CI** against a temp Postgres.  
- Conventional commits; release notes captured in `/docs/ops/release.md`.

---

## 15) Definition of Done (MVP report)
- A user can: create a report → see status in Dashboard → open Report Detail → view hero, key metrics, two charts, and evidence with visible sources → download PDF.  
- At least **three** credible sources attached.  
- Print looks clean (A4).  
- No inline styles in content.  
- All CI gates green.

---

## 16) Session Boot Routine (what Cursor must do before any task)
1. Read this file: `/docs/product/PROJECT_CONTEXT.md`.  
2. Read `/docs/rules/rules.fullstack.md`, `/docs/rules/rules.frontend.md`, `/docs/rules/rules.backend.md`.  
3. Confirm understanding; if a requested change conflicts with the rules or this context, ask before acting.

---

## 17) Glossary (quick)
- **RLS**: Row-Level Security — per-row access rules enforced by Postgres.  
- **Structured Outputs**: OpenAI feature to enforce JSON schema on responses.  
- **Slots**: Predefined DOM sections the model fills with HTML fragments (no styling).
