# Revenue analytics

_Last updated: 2026-02-08_

## Context

The revenue page (`/revenue`) provides period-based gross revenue and transaction trend analysis for operators and leadership.

## UI workflow

1. Admin selects date range (`7d`, `30d`, `90d`, `forever`).
2. Client requests `/api/admin/revenue/snapshot`.
3. KPI cards show total revenue, transactions, and average order value.
4. Chart displays normalized daily/monthly buckets.

## Backend and API touchpoints

- `GET /api/admin/revenue/snapshot?range=...`
- Aggregation helpers in `src/lib/analytics/revenue.ts`.

## Database structure

- **mythoria_db**
  - `payment_orders`
  - `payment_events`
  - `payments`
  - `credits` (for purchase-to-credit correlation where needed)
