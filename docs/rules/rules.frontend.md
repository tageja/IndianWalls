# Frontend Development Rules – IndianWalls (Next.js)

## Scope & Responsibilities
This document governs the Next.js web application (`/apps/web`) including pages, components, API routes, and client-side logic.

**Version:** 1.0.0  
**Last Updated:** 2025-11-09

---

## Tech Stack & Versions

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript 5+ (strict mode)
- **Styling:** Tailwind CSS 3+
- **Charts:** Chart.js 4+ (`react-chartjs-2`)
- **Sanitisation:** DOMPurify 3+ (`isomorphic-dompurify`)
- **Validation:** AJV 8+ (JSON Schema) + Zod (form validation)
- **HTTP Client:** Native `fetch` (App Router Server Actions)
- **Forms:** React Hook Form 7+ + Zod
- **State:** React Context or Zustand (avoid Redux)
- **Testing:** Vitest + Testing Library + Playwright (E2E)

---

## Directory Conventions

```
/apps/web
  /app
    /page.tsx                       # Home page
    /layout.tsx                     # Root layout (CSP headers)
    /pricing
      /page.tsx                     # Pricing page
    /dashboard
      /page.tsx                     # User dashboard (report list)
    /reports
      /new
        /page.tsx                   # New report form
      /[id]
        /page.tsx                   # Report detail (slot viewer)
    /api
      /reports
        /route.ts                   # POST (create), GET (list)
        /[id]
          /route.ts                 # GET (detail)
          /pdf
            /route.ts               # POST (PDF export)
      /render-charts
        /route.ts                   # POST (chart render)
      /compose-report
        /route.ts                   # POST (HTML assembly)

  /components
    /ui                             # Base UI (Button, Card, Badge, Input)
    /charts                         # ChartWrapper, ChartEmbed
    /slots                          # SlotViewer, SlotRenderer
    /forms                          # ReportForm, InputField
    /layout                         # Header, Footer, Nav

  /lib
    /api-client.ts                  # Fetch wrappers for /api/reports
    /sanitise.ts                    # DOMPurify wrapper
    /validators.ts                  # Form validators (Zod schemas)
    /utils.ts                       # Frontend utilities

  /public
    /fonts                          # Inter, custom fonts
    /icons                          # SVG icons
    /images                         # Static images
    /styles
      /print.css                    # Print-friendly styles

  /styles
    /globals.css                    # Tailwind imports + custom tokens
```

---

## Routing & Pages

### 1. Home Page (`/`)
- Hero section with value proposition
- Feature highlights (3–4 key features)
- Social proof (testimonials, stats)
- CTA to `/reports/new` or `/pricing`
- **Server Component** (static generation)

### 2. Pricing Page (`/pricing`)
- Plans: Free, Pro, Enterprise
- Feature comparison table
- Quota limits clearly displayed
- CTA to sign up / upgrade
- **Server Component** (static generation)

### 3. Dashboard (`/dashboard`)
- List user's reports (table or card grid)
- Columns: Report ID, Project Name, Created, Status, Actions
- Actions: View (→ `/reports/[id]`), Download PDF
- Pagination (10 per page)
- **Server Component** with auth check

### 4. New Report Page (`/reports/new`)
- Form fields:
  - Project name (required)
  - Location (required, autocomplete)
  - RERA ID (optional)
  - Additional notes (optional, textarea)
- Submit → POST `/api/reports` → redirect to `/reports/[id]`
- Client Component (React Hook Form + Zod validation)

### 5. Report Detail Page (`/reports/[id]`)
- Poll status every 5s until `completed` or `failed`
- Loading state: Progress indicator with step names
- Completed state: Render HTML slots + charts
- Failed state: Error message + retry button
- Actions: Print, Download PDF
- **Server Component** for initial load, Client Component for polling

---

## Slots Contract

### Allowed Slot Keys
- `slot-hero` – Title, subtitle, summary
- `slot-key-metrics` – Key-value pairs (label + value + trend icon)
- `slot-chart-1` – First chart embed
- `slot-chart-2` – Second chart embed
- `slot-evidence` – Bulleted claims with source citations

### Allowed CSS Classes (Tailwind Whitelist)
- **Layout:** `container`, `grid`, `flex`, `space-y-*`, `space-x-*`, `p-*`, `m-*`, `gap-*`
- **Typography:** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `text-gray-*`, `text-blue-*`
- **Components:** `badge`, `chip`, `card`, `kv`, `btn`
- **Lists:** `list-disc`, `list-decimal`, `list-inside`, `list-none`
- **Borders:** `border`, `border-*`, `rounded`, `rounded-*`
- **Backgrounds:** `bg-white`, `bg-gray-*`, `bg-blue-*`

### Forbidden Elements (Sanitised Out)
- **No `<script>` tags** – removed by DOMPurify
- **No `<iframe>`, `<object>`, `<embed>`** – XSS risk
- **No `on*` event handlers** – (`onclick`, `onload`, etc.)
- **No inline styles** – use classes only
- **No `<form>` tags** – forms only in React components

### Slot Rendering

```typescript
// /apps/web/components/slots/SlotViewer.tsx
import { sanitise } from '@web/lib/sanitise';

interface SlotViewerProps {
  slotKey: string;
  html: string;
}

export function SlotViewer({ slotKey, html }: SlotViewerProps) {
  const sanitised = sanitise(html);

  return (
    <div
      className={`slot slot-${slotKey} prose max-w-none`}
      dangerouslySetInnerHTML={{ __html: sanitised }}
    />
  );
}
```

---

## Data Flow

### 1. Fetch Report Data (Server Component)

```typescript
// /apps/web/app/reports/[id]/page.tsx
import { ReportViewer } from '@web/components/ReportViewer';

async function getReport(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/${id}`, {
    cache: 'no-store',
  });
  return res.json();
}

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const report = await getReport(params.id);

  if (report.status !== 'completed') {
    return <ReportPolling reportId={params.id} initialStatus={report.status} />;
  }

  return <ReportViewer report={report} />;
}
```

### 2. Mount Slots (Client Component)

```typescript
// /apps/web/components/ReportViewer.tsx
'use client';

import { SlotViewer } from '@web/components/slots/SlotViewer';
import { ChartEmbed } from '@web/components/charts/ChartEmbed';

interface ReportViewerProps {
  report: ReportData;
}

export function ReportViewer({ report }: ReportViewerProps) {
  return (
    <div className="report-container max-w-4xl mx-auto p-6">
      <SlotViewer slotKey="slot-hero" html={report.htmlSlots['slot-hero']} />

      <SlotViewer slotKey="slot-key-metrics" html={report.htmlSlots['slot-key-metrics']} />

      <div className="charts-section space-y-6 my-8">
        {report.charts.map((chart, idx) => (
          <ChartEmbed key={chart.id} chart={chart} />
        ))}
      </div>

      <SlotViewer slotKey="slot-evidence" html={report.htmlSlots['slot-evidence']} />

      <div className="actions mt-8 flex gap-4 no-print">
        <button onClick={() => window.print()} className="btn-primary">
          Print Report
        </button>
        <a href={`/api/reports/${report.id}/pdf`} className="btn-secondary">
          Download PDF
        </a>
      </div>
    </div>
  );
}
```

### 3. Chart Embed (Static Image from Storage)

```typescript
// /apps/web/components/charts/ChartEmbed.tsx
interface ChartEmbedProps {
  chart: {
    id: string;
    url: string;
    altText: string;
  };
}

export function ChartEmbed({ chart }: ChartEmbedProps) {
  return (
    <figure className="chart-figure">
      <img
        src={chart.url}
        alt={chart.altText}
        className="w-full h-auto rounded-lg shadow-md"
        loading="lazy"
      />
      <figcaption className="text-sm text-gray-600 mt-2 text-center">
        {chart.altText}
      </figcaption>
    </figure>
  );
}
```

---

## Security (CSP)

### Content Security Policy Headers

Set in `/apps/web/app/layout.tsx` or `next.config.js`:

```typescript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://cdn.indianwalls.com;
  font-src 'self';
  connect-src 'self' https://api.indianwalls.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};
```

### HTML Sanitisation

```typescript
// /apps/web/lib/sanitise.ts
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u',
  'a', 'img', 'figure', 'figcaption', 'blockquote',
];

const ALLOWED_ATTR = ['class', 'href', 'src', 'alt', 'title'];

export function sanitise(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
```

---

## Print/PDF Styles

### Print Stylesheet (`/apps/web/public/styles/print.css`)

```css
@media print {
  /* Hide interactive elements */
  nav,
  footer,
  .no-print,
  button,
  a[href^="http"] {
    display: none !important;
  }

  /* Page setup */
  @page {
    margin: 2cm;
    size: A4 portrait;
  }

  /* Avoid breaks inside elements */
  .slot,
  .chart-figure,
  .card {
    page-break-inside: avoid;
  }

  /* Chart sizing */
  .chart-figure img {
    max-width: 100%;
    height: auto;
    page-break-inside: avoid;
  }

  /* Typography adjustments */
  body {
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }

  /* Remove shadows and decorations */
  .shadow-md,
  .shadow-lg {
    box-shadow: none !important;
  }
}
```

### Print Button

```typescript
<button
  onClick={() => window.print()}
  className="btn-primary no-print"
>
  Print Report
</button>
```

---

## Performance

### Code Splitting
- Dynamic imports for heavy components:
  ```typescript
  const ChartRenderer = dynamic(() => import('@web/components/charts/ChartRenderer'), {
    ssr: false,
    loading: () => <div>Loading chart...</div>,
  });
  ```

### Image Optimisation
- Use Next.js `<Image>` for static assets
- Lazy load charts below fold
- WebP format with PNG fallback

### Caching Strategy
- **Static pages:** ISR with 1 hour revalidation
- **API routes:** `cache: "no-store"` for dynamic data
- **Report data:** Cache completed reports for 5 minutes

### Bundle Size
- Run `pnpm build` and check bundle analysis
- Target: <200KB gzipped for main bundle
- Code split by route automatically (App Router)

---

## Frontend Checklist Before Merge

- [ ] All pages render without TypeScript errors
- [ ] CSP headers configured (no `unsafe-inline` for scripts)
- [ ] HTML slots sanitised via DOMPurify
- [ ] No inline styles in content slots
- [ ] Charts render correctly (responsive, alt text)
- [ ] Print stylesheet tested (Chrome, Firefox, Safari)
- [ ] Forms validated with React Hook Form + Zod
- [ ] Error states handled (404, 500, loading, empty)
- [ ] Tailwind classes purged (no unused CSS in production)
- [ ] Lighthouse score >90 (Performance, Accessibility, Best Practices)
- [ ] No `console.log` or debug code
- [ ] Responsive on mobile (360px) and desktop (1920px)
- [ ] Import boundaries respected (no `@worker/*` imports)
- [ ] Files placed in `/apps/web/**` only

---

**Changelog:**
- v1.0.0 (2025-11-09) – Initial frontend rules with monorepo structure and security hardening
