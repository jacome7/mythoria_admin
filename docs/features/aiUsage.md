# AI usage and cost analytics

_Last updated: 2026-02-08_

## Context

The AI usage page (`src/app/ai-usage/page.tsx`) tracks token spend and model distribution for operational cost control.

## UI workflow

1. Admin selects a range (`7d`, `30d`, `90d`, `forever`).
2. Client fetches `/api/ai-usage/stats?period=...`.
3. Summary cards show total cost, total tokens, average cost/request, and action count.
4. Daily/monthly usage chart visualizes spend trends.
5. Model and action tables expose top cost drivers.

## Backend and API touchpoints

- `GET /api/ai-usage/stats`
- `GET /api/ai-usage/records`

## Database structure

- **workflows_db**
  - `token_usage_tracking`: canonical per-action token and cost rows.
  - `story_generation_runs`: used for story-linked aggregation context.
