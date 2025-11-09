# Backend Development Rules – IndianWalls (Worker + APIs)

## Scope & Responsibilities
This document governs API routes (`/apps/web/app/api`), worker processes (`/apps/worker`), LLM integration, external fetchers, chart rendering, HTML composition, and storage.

**Version:** 1.0.0  
**Last Updated:** 2025-11-09

---

## Tech Stack & Versions

- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5+ (strict mode)
- **Queue:** BullMQ 5+ (Redis-backed)
- **LLM:** OpenAI API (Responses API with Structured Outputs)
- **Charts:** Chart.js 4+ (`chart.js` + `canvas` for server-side rendering)
- **HTML:** JSDOM + DOMPurify for composition/sanitisation
- **Validation:** AJV 8+ (JSON Schema)
- **Storage:** AWS SDK v3 (S3-compatible)
- **Database:** Prisma 5+ (Postgres)
- **Logging:** Pino 8+
- **Testing:** Vitest + Supertest

---

## Directory Conventions

```
/apps/worker
  /src
    /pipeline.ts                    # Main pipeline orchestrator
    /steps
      /normalise.ts                 # Step 1: Input normalisation
      /fetchers.ts                  # Step 2: External API calls
      /synthesise.ts                # Step 3: LLM structured output
      /render-charts.ts             # Step 4: Chart.js rendering
      /compose-html.ts              # Step 5: HTML slot assembly
      /finalise.ts                  # Step 6: Storage + DB update
    /consumer.ts                    # BullMQ worker consumer
    /lib
      /queue.ts                     # Queue producer/consumer wrappers
      /db.ts                        # Database client (Prisma)
      /storage.ts                   # S3 client (upload, presigned URLs)
      /llm.ts                       # OpenAI API client
      /logger.ts                    # Pino logger setup
      /errors.ts                    # Error taxonomy classes
      /fetchers
        /rera.ts                    # RERA API client
        /infra.ts                   # Infrastructure data API
        /market.ts                  # Market data API
        /cache.ts                   # Redis cache wrapper (TTL 24–72h)
  /tests
    /unit
    /integration

/apps/web/app/api
  /reports
    /route.ts                       # POST (create), GET (list)
    /[id]
      /route.ts                     # GET (detail)
      /pdf
        /route.ts                   # POST (PDF export)
  /render-charts
    /route.ts                       # POST (chart render)
  /compose-report
    /route.ts                       # POST (HTML composition)

/packages/shared/src
  /types                            # Shared TypeScript types
  /utils                            # Pure utility functions
  /validators                       # AJV validators (schema → validator)
  /constants                        # Shared constants

/packages/schemas
  /llm_output.json                  # OpenAI structured output schema
  /report_data.json                 # Report API response schema
  /job_message.json                 # Queue message schema
  /fetcher_rera.json
  /fetcher_infra.json
  /fetcher_market.json
```

---

## Services Overview

### 1. API Routes (Next.js)
**Location:** `/apps/web/app/api/**`

- **POST `/api/reports`** – Create report, enqueue job, return `reportId`
- **GET `/api/reports`** – List user's reports (paginated)
- **GET `/api/reports/[id]`** – Retrieve report data (status, slots, charts)
- **POST `/api/reports/[id]/pdf`** – Trigger PDF export (async)
- **POST `/api/render-charts`** – On-demand chart render (testing/preview)
- **POST `/api/compose-report`** – On-demand HTML composition (testing/preview)

### 2. Worker Process
**Location:** `/apps/worker/src`

- Consumes jobs from `report-generator` queue (BullMQ)
- Executes 6-step pipeline (idempotent)
- Updates DB at each checkpoint
- Retries on transient failures (max 3 attempts with exponential backoff)

### 3. Chart Renderer
**Location:** `/apps/worker/src/steps/render-charts.ts`

- Server-side Chart.js with `canvas` (node-canvas)
- Renders PNG images (300 DPI, optimised)
- Uploads to object storage (S3)
- Returns CDN URLs

### 4. HTML Composer
**Location:** `/apps/worker/src/steps/compose-html.ts`

- Assembles HTML slots from LLM output + chart URLs
- Sanitises all content (DOMPurify)
- Enforces allowed classes whitelist
- Returns slot dictionary

### 5. PDF Exporter
**Location:** `/apps/worker/src/lib/pdf-exporter.ts`

- Puppeteer headless Chrome
- Renders HTML slots + print stylesheet
- Generates PDF, uploads to storage
- Returns CDN URL

---

## OpenAI Responses API Usage

### Structured Outputs with JSON Schema

**Model:** `gpt-4o-2024-08-06` (or later with Structured Outputs support)  
**Temperature:** `0.2–0.3` (deterministic)  
**Timeout:** 60 seconds

### Schema Definition

**File:** `/packages/schemas/llm_output.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["hero", "keyMetrics", "chartSpecs", "evidence"],
  "properties": {
    "hero": {
      "type": "object",
      "required": ["title", "subtitle", "summary"],
      "properties": {
        "title": { "type": "string", "maxLength": 100 },
        "subtitle": { "type": "string", "maxLength": 200 },
        "summary": { "type": "string", "maxLength": 500 }
      },
      "additionalProperties": false
    },
    "keyMetrics": {
      "type": "array",
      "minItems": 3,
      "maxItems": 6,
      "items": {
        "type": "object",
        "required": ["label", "value"],
        "properties": {
          "label": { "type": "string", "maxLength": 50 },
          "value": { "type": "string", "maxLength": 100 },
          "trend": { "enum": ["up", "down", "neutral"] }
        },
        "additionalProperties": false
      }
    },
    "chartSpecs": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "type": "object",
        "required": ["type", "title", "data"],
        "properties": {
          "type": { "enum": ["bar", "line", "pie", "doughnut"] },
          "title": { "type": "string", "maxLength": 100 },
          "data": {
            "type": "object",
            "required": ["labels", "datasets"],
            "properties": {
              "labels": { "type": "array", "items": { "type": "string" } },
              "datasets": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["label", "data"],
                  "properties": {
                    "label": { "type": "string" },
                    "data": { "type": "array", "items": { "type": "number" } }
                  }
                }
              }
            }
          }
        },
        "additionalProperties": false
      }
    },
    "evidence": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["claim", "sources"],
        "properties": {
          "claim": { "type": "string", "maxLength": 500 },
          "sources": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["url", "publisher", "date", "sha1"],
              "properties": {
                "url": { "type": "string", "format": "uri" },
                "publisher": { "type": "string", "maxLength": 100 },
                "date": { "type": "string", "format": "date" },
                "sha1": { "type": "string", "pattern": "^[a-f0-9]{40}$" }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### Validation + Repair Loop

```typescript
// /apps/worker/src/steps/synthesise.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { openai } from '@worker/lib/llm';
import { logger } from '@worker/lib/logger';
import { LLMError } from '@worker/lib/errors';
import llmOutputSchema from '@schemas/llm_output.json';

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
const validateOutput = ajv.compile(llmOutputSchema);

export async function synthesise(data: FetchedData): Promise<LLMReportOutput> {
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        temperature: 0.25,
        timeout: 60000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(data) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'report_output',
            schema: llmOutputSchema,
            strict: true,
          },
        },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new LLMError('Empty response from OpenAI', {
          code: 'ERR_LLM_EMPTY_RESPONSE',
          statusCode: 500,
          isRetryable: true,
        });
      }

      const parsed = JSON.parse(content);

      if (validateOutput(parsed)) {
        logger.info({ attempt }, 'LLM output validated successfully');
        return parsed as LLMReportOutput;
      }

      // Repair loop: provide validation errors back to LLM
      attempt++;
      logger.warn(
        { errors: validateOutput.errors, attempt },
        'Schema validation failed, retrying with repair prompt'
      );

      // Optionally: send repair prompt with validation errors
      // For now, just retry with same prompt

    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw new LLMError('Failed to generate valid output after retries', {
          code: 'ERR_LLM_INVALID_SCHEMA',
          statusCode: 500,
          isRetryable: true,
          context: { originalError: error },
        });
      }
      attempt++;
    }
  }

  throw new LLMError('Failed to generate valid output after retries', {
    code: 'ERR_LLM_MAX_ATTEMPTS',
    statusCode: 500,
    isRetryable: false,
  });
}
```

---

## Worker Steps & Checkpoints

### Pipeline Execution

**File:** `/apps/worker/src/pipeline.ts`

```typescript
import { Job } from 'bullmq';
import { logger } from './lib/logger';
import { normalise } from './steps/normalise';
import { fetchers } from './steps/fetchers';
import { synthesise } from './steps/synthesise';
import { renderCharts } from './steps/render-charts';
import { composeHtml } from './steps/compose-html';
import { finalise } from './steps/finalise';
import { isStepCompleted, saveCheckpoint, loadCheckpoint, updateReportStatus } from './lib/db';

export async function executePipeline(job: Job<JobMessage>) {
  const { reportId, userId, input } = job.data;

  logger.info({ reportId, userId }, 'Starting report generation pipeline');

  try {
    // Step 1: Normalise
    if (!(await isStepCompleted(reportId, 'normalise'))) {
      const normalised = await normalise(input);
      await saveCheckpoint(reportId, 'normalise', normalised);
      await job.updateProgress(16); // 1/6 complete
    }

    // Step 2: Fetchers
    if (!(await isStepCompleted(reportId, 'fetchers'))) {
      const fetched = await fetchers(await loadCheckpoint(reportId, 'normalise'));
      await saveCheckpoint(reportId, 'fetchers', fetched);
      await job.updateProgress(33); // 2/6 complete
    }

    // Step 3: Synthesise (LLM)
    if (!(await isStepCompleted(reportId, 'synthesise'))) {
      const llmOutput = await synthesise(await loadCheckpoint(reportId, 'fetchers'));
      await saveCheckpoint(reportId, 'synthesise', llmOutput);
      await job.updateProgress(50); // 3/6 complete
    }

    // Step 4: Render Charts
    if (!(await isStepCompleted(reportId, 'renderCharts'))) {
      const charts = await renderCharts(
        (await loadCheckpoint(reportId, 'synthesise')).chartSpecs
      );
      await saveCheckpoint(reportId, 'renderCharts', charts);
      await job.updateProgress(66); // 4/6 complete
    }

    // Step 5: Compose HTML
    if (!(await isStepCompleted(reportId, 'composeHtml'))) {
      const htmlSlots = await composeHtml(
        await loadCheckpoint(reportId, 'synthesise'),
        await loadCheckpoint(reportId, 'renderCharts')
      );
      await saveCheckpoint(reportId, 'composeHtml', htmlSlots);
      await job.updateProgress(83); // 5/6 complete
    }

    // Step 6: Finalise
    await finalise(reportId, await loadCheckpoint(reportId, 'composeHtml'));
    await updateReportStatus(reportId, 'completed');
    await job.updateProgress(100);

    logger.info({ reportId }, 'Pipeline completed successfully');

  } catch (error) {
    logger.error({ reportId, error }, 'Pipeline failed');
    await updateReportStatus(reportId, 'failed');
    throw error; // BullMQ will retry based on job config
  }
}
```

### Step Inputs/Outputs

| Step            | Input                     | Output                      | Checkpoint Key    |
|-----------------|---------------------------|-----------------------------|-------------------|
| `normalise`     | Raw `JobMessage`          | `NormalisedInput`           | `normalise`       |
| `fetchers`      | `NormalisedInput`         | `FetchedData`               | `fetchers`        |
| `synthesise`    | `FetchedData`             | `LLMReportOutput`           | `synthesise`      |
| `renderCharts`  | `ChartSpec[]`             | `ChartAsset[]`              | `renderCharts`    |
| `composeHtml`   | `LLMReportOutput`, charts | `HtmlSlots`                 | `composeHtml`     |
| `finalise`      | `HtmlSlots`, charts       | `void` (DB update, storage) | N/A               |

---

## Fetchers: RERA / Infra / Market

### Interfaces

```typescript
// /packages/shared/src/types/fetchers.ts
export interface FetcherResult<T> {
  data: T;
  source: SourceCitation;
  cachedUntil: Date;
}

export interface SourceCitation {
  url: string;
  publisher: string;
  date: string; // ISO8601
  sha1: string; // SHA-1 hash of response body
}
```

### Caching Strategy
- **TTL:** 24–72 hours (configurable per source via env vars)
- **Cache Key:** SHA-256 hash of request params
- **Storage:** Redis (in-memory) + DB (persistent ledger)
- **Stale-while-revalidate:** Serve cached data, refresh in background if stale

### Source Ledger (Database)

**Table:** `fetcher_sources`

```typescript
// Prisma schema excerpt
model FetcherSource {
  id          String   @id @default(cuid())
  source      String   // 'rera', 'infra', 'market'
  url         String
  publisher   String
  fetchedAt   DateTime @default(now())
  sha1        String   // Content hash
  cachedUntil DateTime
  metadata    Json?    // API version, etc.
  createdAt   DateTime @default(now())

  @@index([source, sha1])
}
```

### Implementation Example

**File:** `/apps/worker/src/lib/fetchers/rera.ts`

```typescript
import crypto from 'crypto';
import { logger } from '@worker/lib/logger';
import { redis } from '@worker/lib/cache';
import { prisma } from '@worker/lib/db';
import { ExternalAPIError } from '@worker/lib/errors';
import type { FetcherResult, SourceCitation } from '@shared/types/fetchers';

const RERA_API_URL = process.env.RERA_API_URL!;
const RERA_API_KEY = process.env.RERA_API_KEY!;
const CACHE_TTL_HOURS = parseInt(process.env.CACHE_TTL_RERA || '48', 10);

function getCacheKey(params: RERAParams): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(params));
  return `rera:${hash.digest('hex')}`;
}

export async function fetchRERAData(params: RERAParams): Promise<FetcherResult<RERAData>> {
  const cacheKey = getCacheKey(params);
  const cached = await redis.get(cacheKey);

  if (cached) {
    logger.debug({ cacheKey }, 'RERA cache hit');
    return JSON.parse(cached) as FetcherResult<RERAData>;
  }

  logger.info({ params }, 'Fetching RERA data');

  try {
    const response = await fetch(`${RERA_API_URL}?projectId=${params.projectId}`, {
      headers: {
        'X-API-Key': RERA_API_KEY,
        'User-Agent': 'IndianWalls/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      throw new ExternalAPIError(`RERA API returned ${response.status}`, {
        code: 'ERR_RERA_API',
        statusCode: response.status,
        isRetryable: response.status >= 500,
        context: { params, status: response.status },
      });
    }

    const body = await response.text();
    const sha1 = crypto.createHash('sha1').update(body).digest('hex');
    const data: RERAData = JSON.parse(body);

    const source: SourceCitation = {
      url: response.url,
      publisher: 'Maharashtra RERA',
      date: new Date().toISOString(),
      sha1,
    };

    const cachedUntil = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);

    const result: FetcherResult<RERAData> = {
      data,
      source,
      cachedUntil,
    };

    // Cache in Redis
    await redis.setex(cacheKey, CACHE_TTL_HOURS * 60 * 60, JSON.stringify(result));

    // Store in DB ledger
    await prisma.fetcherSource.create({
      data: {
        source: 'rera',
        url: source.url,
        publisher: source.publisher,
        fetchedAt: new Date(source.date),
        sha1: source.sha1,
        cachedUntil,
      },
    });

    logger.info({ sha1, cachedUntil }, 'RERA data fetched and cached');

    return result;

  } catch (error) {
    logger.error({ error, params }, 'RERA fetch failed');
    throw error;
  }
}
```

---

## Storage Layout for Generated Assets

### Directory Structure

```
/generated                          # Object storage bucket
  /{reportId}
    /charts
      /chart-1.png                  # Bar chart
      /chart-2.png                  # Line chart
    /report.pdf                     # Generated PDF
    /metadata.json                  # Report metadata
```

### Upload Function

**File:** `/apps/worker/src/lib/storage.ts`

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger';

const s3Client = new S3Client({
  region: process.env.STORAGE_REGION!,
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
});

const BUCKET = process.env.STORAGE_BUCKET!;
const CDN_BASE_URL = process.env.CDN_BASE_URL!;

export async function uploadChartToStorage(
  reportId: string,
  chartId: string,
  buffer: Buffer
): Promise<string> {
  const key = `generated/${reportId}/charts/${chartId}.png`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable', // 1 year
      })
    );

    const url = `${CDN_BASE_URL}/${key}`;
    logger.info({ reportId, chartId, url }, 'Chart uploaded to storage');

    return url;

  } catch (error) {
    logger.error({ error, reportId, chartId }, 'Storage upload failed');
    throw error;
  }
}
```

---

## Observability Metrics

### Metrics Per Step

Prometheus-compatible histograms and counters:

```typescript
// /apps/worker/src/lib/metrics.ts
import { Registry, Histogram, Counter } from 'prom-client';

export const register = new Registry();

export const stepDuration = new Histogram({
  name: 'worker_step_duration_seconds',
  help: 'Duration of each worker step',
  labelNames: ['step'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const stepErrors = new Counter({
  name: 'worker_errors_total',
  help: 'Total worker errors by step and code',
  labelNames: ['step', 'error_code'],
  registers: [register],
});

export const llmApiCalls = new Counter({
  name: 'llm_api_calls_total',
  help: 'Total LLM API calls',
  labelNames: ['status'], // 'success' or 'failure'
  registers: [register],
});

export const fetcherCacheHits = new Counter({
  name: 'fetcher_cache_hits_total',
  help: 'Fetcher cache hits',
  labelNames: ['source'],
  registers: [register],
});

export const fetcherCacheMisses = new Counter({
  name: 'fetcher_cache_misses_total',
  help: 'Fetcher cache misses',
  labelNames: ['source'],
  registers: [register],
});
```

### Business Metrics

```typescript
export const reportsCreated = new Counter({
  name: 'reports_created_total',
  help: 'Total reports created',
  registers: [register],
});

export const reportsCompleted = new Counter({
  name: 'reports_completed_total',
  help: 'Total reports completed',
  registers: [register],
});

export const reportsFailed = new Counter({
  name: 'reports_failed_total',
  help: 'Total reports failed',
  labelNames: ['error_code'],
  registers: [register],
});
```

---

## Error Handling Policies

### Transient Errors (Retry with Backoff)
- Network timeouts (fetchers, LLM, storage)
- Rate limit errors (429)
- Service unavailable (503)

**Policy:** Exponential backoff (1s, 2s, 4s, 8s, 16s), max 3 retries

### Permanent Errors (Fail Fast)
- Invalid input (400)
- Authentication failures (401, 403)
- Schema validation failures (after repair loop)
- Quota exceeded (402)

**Policy:** Mark job as failed, log error, alert monitoring, do not retry

### Partial Failures
- If 1 of 3 fetchers fails: Log warning, continue with available data
- If LLM repair loop fails: Fail entire job (cannot proceed without valid output)
- If chart rendering fails: Store error placeholder, continue to finalise

---

## Security

### 1. No PII in Logs
- Mask user emails, phone numbers, addresses
- Hash sensitive identifiers (log `reportId`, not `userId`)
- Use `[REDACTED]` for sensitive fields

### 2. Secret Handling
- Load from environment variables only
- Validate presence on boot (fail fast if missing)
- Never log secrets (sanitise stack traces)
- Rotate API keys quarterly

### 3. Input Sanitisation
- Validate all API inputs against JSON Schema (AJV)
- Sanitise HTML before storage (DOMPurify)
- Use parameterised queries (Prisma ORM)
- Escape shell commands (never use user input in shell)

### 4. CSP for Generated HTML
- No `<script>` tags allowed in slots
- No inline event handlers (`onclick`, etc.)
- Only whitelisted CSS classes
- No `data:` URIs (except for tiny icons)

---

## Performance

### Concurrency Limits
- **OpenAI API:** 10 concurrent requests per worker instance
- **Fetchers:** 5 concurrent per source (RERA, Infra, Market)
- **Chart Rendering:** 3 concurrent (CPU-bound with node-canvas)
- **Queue Workers:** 2–4 concurrent jobs per instance

### Caching
- **Fetcher responses:** 24–72h TTL in Redis + DB ledger
- **Chart images:** Immutable (1-year cache control)
- **Completed reports:** Cache API responses for 5 minutes

### Retry/Backoff
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 3 retries for transient errors
- Fail fast for permanent errors (no retries)

---

## Backend Checklist Before Merge

- [ ] All worker steps are idempotent (safe to retry)
- [ ] Checkpoints stored in DB after each step
- [ ] OpenAI API uses Structured Outputs with JSON Schema
- [ ] LLM validation + repair loop implemented (max 2 attempts)
- [ ] Fetchers cache responses (24–72h TTL in Redis + DB)
- [ ] Source ledger records all fetches (url, publisher, date, sha1)
- [ ] Charts rendered server-side (Chart.js + canvas)
- [ ] HTML sanitised (DOMPurify, allowed classes only)
- [ ] Storage layout follows `/generated/{reportId}/charts/*.png`
- [ ] Error taxonomy defined (codes, retryable flags)
- [ ] Observability metrics instrumented (Prometheus)
- [ ] No PII in logs or error messages
- [ ] Secrets handled via environment variables
- [ ] Unit tests cover all business logic (>80% coverage)
- [ ] Contract tests validate all schemas (AJV)
- [ ] Integration tests cover worker pipeline end-to-end
- [ ] Performance: Steps complete <30s each, total pipeline <5min
- [ ] Import boundaries respected (no `@web/*` imports)
- [ ] Files placed in `/apps/worker/**` only

---

**Changelog:**
- v1.0.0 (2025-11-09) – Initial backend rules with worker pipeline, LLM integration, and observability
