# Browser Performance SDK — CLAUDE.md

This file gives Claude Code full context about the project: what it is, how it's structured, what each file does, and how to work on it correctly.

---

## Project overview

A three-package monorepo that builds a browser performance monitoring SDK similar to a lightweight Datadog RUM or Sentry performance module.

- `sdk/` — Vanilla JS/TypeScript SDK. Deployed as a `<script>` tag on any website. Captures Core Web Vitals, JS errors, and DOM mutation diffs for session replay. Builds to a single IIFE bundle under 2KB gzipped. Zero dependencies at runtime.
- `api/` — Node.js + Express ingestion server. Receives batched events from the SDK, rate-limits per domain, writes to TimescaleDB, and pushes live events to dashboard clients via WebSocket.
- `dashboard/` — React + Vite dashboard. Shows Core Web Vitals scores per domain, session list, session replay, and error log. Connects to the API via WebSocket for live updates.

---

## Monorepo structure

```
perf-sdk/
├── sdk/
│   ├── src/
│   │   ├── index.ts          # Entry point — reads data-project-id, inits all observers
│   │   ├── vitals.ts         # PerformanceObserver — LCP, CLS, FID, TTFB
│   │   ├── replay.ts         # MutationObserver — DOM diffs for session replay
│   │   ├── beacon.ts         # Batched sendBeacon sender — flushes every 2s
│   │   ├── errors.ts         # Global error + unhandledrejection capture
│   │   ├── selector.ts       # Generates unique CSS selector path for any DOM node
│   │   └── types.ts          # Shared TypeScript types (MetricType, VitalEntry, etc.)
│   ├── tests/
│   │   ├── vitals.test.ts
│   │   └── beacon.test.ts
│   ├── package.json          # esbuild bundler, vitest tests
│   └── tsconfig.json
│
├── api/
│   ├── src/
│   │   ├── server.ts         # Express app entry, mounts routes, starts HTTP + WS
│   │   ├── db.ts             # pg Pool, TimescaleDB migration on startup
│   │   ├── ws.ts             # WebSocket server, domain-keyed subscribers, broadcast()
│   │   ├── rateLimit.ts      # In-memory sliding window — 1000 events/domain/min
│   │   ├── routes/
│   │   │   ├── ingest.ts     # POST /ingest — validate, rate-limit, bulk INSERT, broadcast
│   │   │   └── metrics.ts    # GET /api/metrics — time_bucket aggregations for dashboard
│   │   └── logger.ts         # Pino structured logger with trace IDs
│   ├── tests/
│   │   └── ingest.test.ts    # Supertest integration tests
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/
│   ├── src/
│   │   ├── App.tsx                      # React Router — 4 routes
│   │   ├── pages/
│   │   │   ├── Overview.tsx             # CWV gauges, live feed via WebSocket
│   │   │   ├── Sessions.tsx             # Session list table
│   │   │   ├── SessionDetail.tsx        # Session replay — applies mutation diffs
│   │   │   └── ErrorLog.tsx             # JS error log
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts          # WS connection + circular buffer (last 500 events)
│   │   ├── components/
│   │   │   ├── VitalGauge.tsx           # LCP/CLS/FID/TTFB gauge with good/poor thresholds
│   │   │   └── ReplayPlayer.tsx         # Applies DOM diffs in sequence
│   │   └── lib/
│   │       └── thresholds.ts            # Google CWV thresholds (lcp:2500/4000, etc.)
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml         # api + db (TimescaleDB) + dashboard
├── loadtest.js                # k6 load test — 200 VUs, 30s, p99 < 200ms target
├── .github/
│   └── workflows/
│       └── ci.yml             # lint → typecheck → test → coverage gate (75%)
└── README.md                  # ADRs + benchmark results (fill in after k6 run)
```

---

## Tech stack and why

| Layer | Choice | Reason |
|---|---|---|
| SDK language | Vanilla TypeScript, no framework | No deps on host pages. Frameworks risk version conflicts and add KB. |
| SDK bundler | esbuild | Fastest, outputs IIFE, easy config. |
| SDK test | Vitest + jsdom | Fast, native TS, good browser API mocking. |
| API runtime | Node.js + Express + TypeScript | Familiar stack, good ecosystem for WS. |
| Database | TimescaleDB (Postgres extension) | Append-only time-series data. Hypertables compress ~90% better than plain Postgres, 10-100x faster on time range queries. Same pg client. |
| Real-time | ws (not Socket.io) | Lighter. No need for Socket.io features here. |
| API logger | Pino | Structured JSON logs, trace IDs per request. |
| API test | Jest + Supertest | Integration tests against real Express app + test DB. |
| Dashboard | React + Vite + TypeScript | Modern, fast dev server. |
| Dashboard data | TanStack Query | Server state management — fills resume gap. |
| Dashboard charts | Recharts | Simple, composable, React-native. |
| Infra | Docker Compose | All three services in one command. |
| CI/CD | GitHub Actions | Lint, typecheck, test, coverage gate on every PR. |
| Load test | k6 | Industry standard, free, scriptable. |

---

## Core Web Vitals thresholds

These are Google's official thresholds. Use them in `thresholds.ts` and in VitalGauge:

```typescript
export const thresholds = {
  lcp:  { good: 2500,  poor: 4000  },  // milliseconds
  fid:  { good: 100,   poor: 300   },  // milliseconds
  cls:  { good: 0.1,   poor: 0.25  },  // unitless
  ttfb: { good: 800,   poor: 1800  },  // milliseconds
} as const

export type Rating = 'good' | 'needs-improvement' | 'poor'

export function getRating(metric: keyof typeof thresholds, value: number): Rating {
  const t = thresholds[metric]
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}
```

---

## SDK implementation rules

### vitals.ts
- LCP fires multiple times as larger elements load. Keep updating `lcpValue` on every LCP entry. Finalize and enqueue it on the first user input event (pointerdown, keydown) or on `visibilitychange: hidden` — whichever comes first.
- CLS is cumulative — add every layout-shift entry value together, but skip entries with `hadRecentInput: true`.
- FID is captured via `first-input` entry type. Only fires once.
- TTFB comes from `navigation` entry: `performance.getEntriesByType('navigation')[0].responseStart`.

```typescript
// Observer setup
const po = new PerformanceObserver((list) => { ... })
po.observe({ entryTypes: ['largest-contentful-paint', 'layout-shift', 'first-input'] })
```

### beacon.ts
- Always use `navigator.sendBeacon()`, not `fetch()`. Beacon is fire-and-forget and survives tab close. fetch() does not.
- Batch events in a queue. Flush every 2000ms via `setTimeout`.
- Also flush on `visibilitychange` when `document.visibilityState === 'hidden'`. Do NOT use `beforeunload` — it is blocked on mobile browsers.
- Payload: `{ projectId, domain: location.hostname, sessionId, events: [...] }`.
- Serialize as `Blob` with `type: 'application/json'` — required for sendBeacon to set Content-Type correctly.

### replay.ts
- Observe `document.body` with `{ childList: true, subtree: true, attributes: true, attributeOldValue: true }`.
- For each mutation record, serialize: `{ type, target: getSelector(target), added, removed, attr, oldValue, newValue, ts: performance.now() }`.
- `serializeNode()` must handle circular references. Only serialize `tagName`, `attributes`, `textContent` — never the full node reference.
- Enqueue serialized diffs via `beacon.enqueue()`. Do not send individual mutations — they get batched.

### selector.ts
- Walk up the DOM from the target element to `document.body`.
- If the element has an `id`, stop there — `#myId` is unique enough.
- Otherwise use `:nth-child(n)` to disambiguate siblings.
- Return a `>` separated selector path: `div:nth-child(2) > p:nth-child(1)`.

### index.ts (SDK entry)
- Read `data-project-id` from `document.currentScript` at module evaluation time, before any async code.
- Generate a `sessionId` with `crypto.randomUUID()` once per page load. Include it in every event.
- Initialize all observers after `DOMContentLoaded` fires (or immediately if already loaded).

---

## API implementation rules

### db.ts
- Run migrations on every startup via `migrate()`. Use `IF NOT EXISTS` guards so it's idempotent.
- Always create the hypertable with `if_not_exists => TRUE`.
- Index: `CREATE INDEX IF NOT EXISTS events_domain_time ON events(domain, time DESC)` — this is what makes per-domain dashboard queries fast.

### ingest.ts (POST /ingest)
- Validate: `domain` (string), `sessionId` (UUID), `events` (array, max 200 items).
- Run rate limit check before touching the DB. Return 429 immediately if blocked.
- Use a single bulk `INSERT` for all events in one request — never loop with individual inserts.
- After writing, call `broadcast(domain, events)` to push to WebSocket subscribers.
- Log with Pino: `{ traceId, domain, count, latencyMs }` on every request.

### metrics.ts (GET /api/metrics)
- Use TimescaleDB `time_bucket()` for aggregations — it's faster than `date_trunc`.
- Return `p75` (75th percentile) for each metric — this is what Google Lighthouse uses.
- Support `range` query param: `1h`, `24h`, `7d`, `30d`. Map to Postgres interval strings.

### ws.ts
- Key subscribers by `domain` (string), not by project ID.
- Always check `ws.readyState === WebSocket.OPEN` before sending — never send to a closing socket.
- Clean up on `close` event: remove the socket from the subscriber set.

### rateLimit.ts
- In-memory is fine for a single instance. Add a note in the code that Redis pub/sub would be needed for horizontal scaling.
- Window: 60 seconds. Limit: 1000 events per domain. These are generous enough for real use.

---

## Dashboard implementation rules

### useWebSocket.ts
- Circular buffer: keep only the last 500 events in state. `setEvents(prev => [...prev.slice(-499), ...newEvents])`.
- Reconnect on close with exponential backoff (start at 1s, max 30s).
- Clean up WebSocket on component unmount — always return a cleanup function from `useEffect`.

### SessionDetail.tsx (replay)
- Fetch the initial DOM snapshot and all mutation diffs for the session from `/api/sessions/:id`.
- Apply diffs one at a time via a stepper. Do not apply all at once.
- Use `document.createElement` to reconstruct nodes from serialized data — never use `innerHTML` with untrusted content.

### Overview.tsx
- Use `useQuery` from TanStack Query with a 30s `staleTime`. Do not poll manually.
- Connect to WebSocket via `useWebSocket` hook. Merge live events into the displayed metrics.
- Show rating badges (good / needs improvement / poor) with color coding next to each metric value.

---

## TimescaleDB schema

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS events (
  time        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  domain      TEXT            NOT NULL,
  project_id  TEXT            NOT NULL,
  session_id  UUID            NOT NULL,
  metric      TEXT            NOT NULL,
  value       DOUBLE PRECISION,
  meta        JSONB
);

SELECT create_hypertable('events', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS events_domain_time     ON events (domain, time DESC);
CREATE INDEX IF NOT EXISTS events_project_session ON events (project_id, session_id, time);
```

---

## Docker Compose

```yaml
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/perf
      NODE_ENV: development
    depends_on:
      db:
        condition: service_healthy

  db:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: perf
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d perf"]
      interval: 5s
      retries: 10

  dashboard:
    build: ./dashboard
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_WS_URL: ws://localhost:8080

volumes:
  pgdata:
```

---

## GitHub Actions CI

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      db:
        image: timescale/timescaledb:latest-pg15
        env:
          POSTGRES_USER: user
          POSTGRES_PASSWORD: pass
          POSTGRES_DB: perf_test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test SDK
        working-directory: sdk
        run: npm test -- --coverage

      - name: Test API
        working-directory: api
        env:
          DATABASE_URL: postgres://user:pass@localhost:5432/perf_test
        run: npm test -- --coverage

      - name: Coverage gate
        run: npx nyc check-coverage --lines 75
```

---

## k6 load test

Run after deployment to get real benchmark numbers for the resume:

```javascript
// loadtest.js — run: k6 run loadtest.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

export const options = {
  scenarios: {
    load: {
      executor: 'constant-vus',
      vus: 200,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const payload = JSON.stringify({
    domain: 'test.com',
    projectId: 'proj_test',
    sessionId: uuidv4(),
    events: [
      { metric: 'lcp', value: Math.random() * 3000, ts: Date.now() },
      { metric: 'cls', value: Math.random() * 0.3,  ts: Date.now() },
    ],
  })

  const res = http.post('http://localhost:3000/ingest', payload, {
    headers: { 'Content-Type': 'application/json' },
  })

  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })

  sleep(0.1)
}
```

Record the actual p99 number from the k6 output and put it in `README.md` and your resume bullet.

---

## README.md template (fill in after building)

```markdown
## Architecture Decision Records

**Why Vanilla JS over React for the SDK?**
The SDK runs on third-party sites with unknown tech stacks. A framework dependency
risks version conflicts and bundle bloat. Vanilla JS keeps the script tag under 2KB gzipped
and introduces zero risk to the host page.

**Why navigator.sendBeacon over fetch?**
fetch() is cancelled when the tab closes. sendBeacon() is guaranteed delivery even on
unload — critical for capturing the final LCP value and flushing the event queue.

**Why TimescaleDB over plain PostgreSQL?**
Performance data is append-only time-series. TimescaleDB hypertables auto-partition by
time, compress ~90% better than standard Postgres for this access pattern, and use
time_bucket() for aggregations that are 10-100x faster on time ranges.

**Why batched beacons over per-event sends?**
Individual sends on a JS-heavy page causes request storms. Batching with a 2s debounce
reduces network requests by ~90% while keeping dashboard data fresh enough for real-time display.

**Why in-memory rate limiting over Redis?**
Single-instance deployment. For horizontal scaling, replace rateLimit.ts with a Redis
sliding window counter using INCR + EXPIRE.

## Benchmarks
- SDK script weight: [run: gzip -c dist/sdk.js | wc -c] KB gzipped
- Ingestion p99 latency: [from k6 output]ms at 200 concurrent users
- Dashboard query time: [measure /api/metrics response time]ms for 24h aggregation

## Test coverage
- SDK: [vitest --coverage output]
- API: [jest --coverage output]
```

---

## Build order (follow this exactly)

1. `sdk/src/vitals.ts` — get LCP value logging to console on a plain `test.html` page
2. `sdk/src/beacon.ts` — get events POSTing to a `console.log` Express endpoint
3. `api/src/db.ts` + `api/src/routes/ingest.ts` — write events to TimescaleDB, verify row appears
4. `api/src/ws.ts` — broadcast to a WebSocket client, verify event arrives
5. `sdk/src/replay.ts` — serialize DOM mutations, verify diffs are readable
6. `sdk/src/errors.ts` — capture errors, verify they appear in ingestion
7. `dashboard/` — build all four pages against real API data
8. Tests — SDK unit tests, API integration tests
9. Docker Compose — verify all three services start and connect
10. GitHub Actions CI — verify pipeline passes
11. k6 load test — record benchmark numbers, update README

---

## Common mistakes to avoid

- **Do not use `beforeunload` for beacon flush.** It is blocked on iOS Safari. Use `visibilitychange` with `hidden` check instead.
- **Do not store DOM node references in mutation records.** They become stale. Store the selector path and serialized node data only.
- **Do not loop INSERT individual events.** Always bulk insert in one query.
- **Do not skip the `if_not_exists` flag on `create_hypertable`.** It will error on restart if the table already exists.
- **Do not use `innerHTML` to reconstruct session replay DOM.** Deserialize nodes manually with `createElement`/`setAttribute` to avoid XSS.
- **Do not hardcode `localhost` in dashboard WebSocket URL.** Read from `VITE_WS_URL` env var.
- **LCP fires multiple times.** Take the last value before user interaction, not the first value.
- **CLS entries with `hadRecentInput: true` must be excluded** from the cumulative score per the spec.