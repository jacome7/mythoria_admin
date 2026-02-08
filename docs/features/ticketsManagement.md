# Ticketing and support workflows

_Last updated: 2026-02-08_

## Context

Ticket operations include queue overview (`/tickets`) and deep incident handling (`/tickets/[id]`). MB Way actions are integrated for payment-confirmation workflows.

## UI workflow

1. Queue view loads tickets with status/category/priority filters and metrics cards.
2. Selecting a ticket opens the conversation and metadata timeline.
3. Agents can change status, add comments, and execute context actions (for example MB Way payment validation).
4. Action endpoint can close tickets, issue credits, or attach audit data.

## Backend and API touchpoints

- `GET /api/tickets`
- `GET /api/tickets/metrics`
- `GET/PATCH /api/tickets/[id]`
- `POST /api/tickets/[id]/comments`
- `POST /api/tickets/[id]/actions`

## Database structure

- **backoffice_db**
  - `tickets`
  - `ticket_comments`
  - `ticket_notification_config`
- **mythoria_db** (for payment verification and credit operations)
  - `payment_orders`
  - `payment_events`
  - `credit_ledger`
  - `author_credit_balances`
