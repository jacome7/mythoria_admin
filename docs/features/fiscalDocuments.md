# Fiscal documents

_Last updated: 2026-07-01_

## Context

The fiscal documents page (`/fiscal-documents`) lets administrators monitor KeyInvoice fiscal document generation for Stripe-paid credit orders. Issuing remains owned by `mythoria-webapp`; the admin portal reads shared `mythoria_db` tables and delegates retry requests back to the webapp issuer.

## UI workflow

1. Admin opens `/fiscal-documents` from the Financials menu or the dashboard issue card.
2. The list page calls `GET /api/admin/fiscal-documents` with optional status, needs-attention, search, and pagination filters.
3. Admin opens a document detail page to inspect payment data, customer data, fiscal totals, retry state, and the chronological `fiscal_document_events` audit trail.
4. Issued documents with a stored PDF can be opened through the admin-authorized PDF route.
5. Retry is available only for `pending` or `failed` documents whose `next_retry_at` is empty or due.

## Status and attention rules

- `failed` and `credit_note_required` always need attention.
- `pending` older than 15 minutes needs attention.
- `issuing` with `updated_at` older than 15 minutes needs attention.
- Retry is allowed only for `pending` or `failed` documents due now.
- Draft-only events show `Remote KeyInvoice document created: No` so local/ngrok test rows are not mistaken for remote KeyInvoice documents.

## Backend and API touchpoints

- `GET /api/admin/fiscal-documents`
- `GET /api/admin/fiscal-documents/[id]`
- `GET /api/admin/fiscal-documents/issues/count`
- `GET /api/admin/fiscal-documents/[id]/pdf`
- `POST /api/admin/fiscal-documents/[id]/retry`

The retry route proxies to `mythoria-webapp` at `POST /api/admin/fiscal-documents/[id]/retry` with `ADMIN_API_KEY`. That webapp endpoint records `admin_retry_requested` and calls the existing idempotent fiscal document issuer.

## MCP tools

- `list_fiscal_documents` mirrors the list page filters and returns fiscal document summaries plus pagination.
- `get_fiscal_document_details` mirrors the detail route and redacts likely secrets from fiscal event payloads.
- `get_fiscal_document_issue_counts` mirrors the dashboard issue count endpoint.
- `retry_fiscal_document_keyinvoice` delegates retry to the same shared retry service as the REST route, using source `mythoria-admin-mcp` for audit attribution.

## Database structure

- **mythoria_db**
  - `fiscal_documents`
  - `fiscal_document_events`
  - `keyinvoice_customers`
  - `payment_orders`
  - `authors`

The fiscal schema is synchronized from `mythoria-webapp`; do not evolve these tables directly in the admin repository.
