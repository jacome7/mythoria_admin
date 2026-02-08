# Dashboard feature

_Last updated: 2026-02-08_

## Context

The home dashboard (`src/app/page.tsx`) is the operational landing page for admins. It consolidates KPIs for users, stories, credits, print requests, tickets, and health signals so the team can triage issues quickly.

## UI workflow

1. The page mounts and requests `/api/admin/kpis`.
2. Skeleton cards and chart placeholders render first to keep perceived latency low.
3. KPI cards update once payloads arrive (registrations, service usage, system counters).
4. Linked cards route admins into detail pages (`/users`, `/stories`, `/tickets`, `/server-status`, `/ai-usage`).
5. Error states are shown inline with retry actions.

## Backend and API touchpoints

- `GET /api/admin/kpis` aggregates cross-surface metrics.
- Analytics helpers used by dashboard charts:
  - `src/lib/analytics/registrations.ts`
  - `src/lib/analytics/service-usage.ts`

## Database structure

Dashboard data is read-only and aggregated from multiple stores:

- **mythoria_db**: `authors`, `stories`, `credit_ledger`, `print_requests`, `leads`.
- **workflows_db**: `story_generation_runs`, `token_usage_tracking`.
- **backoffice_db**: `tickets`, `managers`.
