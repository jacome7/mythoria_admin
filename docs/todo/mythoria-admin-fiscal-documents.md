# Mythoria Admin Fiscal Documents Specification

## Purpose

Build a Mythoria Admin section that lets administrators monitor automatic KeyInvoice fiscal document generation from `mythoria-webapp`.

The admin must quickly answer:

- Which paid Stripe orders have fiscal documents?
- Which fiscal documents are still pending, draft, issuing, failed, issued, voided, or requiring correction?
- Which documents failed and why?
- Which documents need operational attention or retry?
- What KeyInvoice payload and response data exists for audit/debugging?

This is an admin monitoring and operations surface. It is not an invoice approval workflow.

## Source System

Fiscal document generation remains owned by `mythoria-webapp`.

`mythoria-webapp`:

- Confirms Stripe payment through verified webhooks.
- Grants credits.
- Creates or updates `fiscal_documents`.
- Writes audit rows to `fiscal_document_events`.
- Talks to KeyInvoice when `KEYINVOICE_ENABLED=true` and `KEYINVOICE_DRAFT_ONLY=false`.
- Stores KeyInvoice document numbers, status, PDF storage path, retry state, and errors.

`mythoria-admin` should read and display this data, and may expose controlled retry/reconciliation actions if the backend API supports them.

## Data Model

Use the shared database tables created by the KeyInvoice integration.

### `fiscal_documents`

Important columns:

- `id`
- `order_id`
- `author_id`
- `provider`
- `status`
- `doc_type`
- `doc_series`
- `doc_num`
- `full_doc_number`
- `at_doc_code_id`
- `gross_total`
- `net_total`
- `tax_total`
- `vat_rate`
- `tax_id`
- `customer_mode`
- `key_invoice_customer_id`
- `key_invoice_client_id`
- `final_consumer_vat_number`
- `stripe_checkout_session_id`
- `stripe_payment_intent_id`
- `pdf_storage_path`
- `pdf_sha256`
- `last_error`
- `attempt_count`
- `next_retry_at`
- `issued_at`
- `created_at`
- `updated_at`

### `fiscal_document_events`

Important columns:

- `id`
- `fiscal_document_id`
- `order_id`
- `event_type`
- `request_payload`
- `response_payload`
- `created_at`

Use this table as the audit trail for payloads, KeyInvoice responses, failures, refund/dispute fiscal events, and draft-only local test payloads.

### Related Tables

Join or fetch related data from:

- `payment_orders`: amount, status, provider, credit bundle, Stripe session/payment ids, metadata.
- `authors`: customer/user identity.
- `keyinvoice_customers`: mapped KeyInvoice client data when a VAT/NIF customer exists.

## Status Semantics

Display statuses exactly and map them to admin-friendly labels.

| Status                 | Meaning                                                                                                    | Severity               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `draft`                | Draft-only payload prepared locally; no remote KeyInvoice document created. Expected in local/ngrok tests. | Neutral                |
| `pending`              | Fiscal document row exists and is waiting to be issued/retried.                                            | Warning if old         |
| `issuing`              | Issuing attempt is in progress.                                                                            | Info; warning if stale |
| `issued`               | KeyInvoice document was created and PDF was stored.                                                        | Success                |
| `failed`               | Issuing failed; check `last_error` and events.                                                             | Error                  |
| `voided`               | Document was voided.                                                                                       | Neutral                |
| `credit_note_required` | Refund/dispute happened and fiscal correction is needed.                                                   | Error/warning          |
| `credit_note_issued`   | Correction document was issued.                                                                            | Success                |

Stale rules:

- `pending` older than 15 minutes: needs attention.
- `issuing` older than 15 minutes: likely stale lock; needs attention.
- `failed` with `next_retry_at <= now`: retryable now.
- `failed` with repeated `attempt_count >= 3`: high priority.
- `credit_note_required`: high priority until corrected.

## Admin Navigation

Add a section in Mythoria Admin:

- Main nav item: `Fiscal Documents`
- Optional dashboard card: `Fiscal document issues`
- Optional alert badge count:
  - `failed`
  - stale `pending`
  - stale `issuing`
  - `credit_note_required`

## List Page

Route suggestion:

```text
/fiscal-documents
```

### Table Columns

Recommended columns:

- Created date
- Updated date
- Status
- Priority/attention badge
- Full document number
- Stripe payment/order reference
- Customer/user
- Customer mode
- Amount gross
- VAT rate
- Attempts
- Next retry
- Last error preview
- Actions

### Filters

Required filters:

- Status multi-select
- Has error: yes/no
- Needs attention: yes/no
- Date range
- Customer mode: `final_consumer`, `keyinvoice_client`
- Provider: `keyinvoice`

Useful filters:

- Order ID
- Fiscal document ID
- Stripe checkout session ID
- Stripe payment intent ID
- KeyInvoice document number
- Author email/name
- VAT/NIF/client id

### Sorting

Default sort:

```text
needs_attention desc, updated_at desc
```

Other useful sorts:

- `created_at desc`
- `updated_at desc`
- `attempt_count desc`
- `next_retry_at asc`
- `issued_at desc`

### Row Actions

Required:

- View details
- Copy order ID
- Copy fiscal document ID
- Copy Stripe payment intent/session ID

Optional, if backend supports it:

- Retry now for failed/pending document
- Open PDF for issued document
- Open related payment order
- Open related author/user
- Mark operational note/resolution
- Mark issued manually only as a reconciliation override after the invoice already exists in KeyInvoice/accounting. This action must not call KeyInvoice or create a fiscal document.

## Detail Page

Route suggestion:

```text
/fiscal-documents/:id
```

### Header

Show:

- Status badge
- Full document number or `No remote document`
- Gross total
- Customer mode
- Created/updated/issued dates
- High-priority warning if failed/stale/correction required

### Sections

#### Payment

Show:

- Order ID
- Payment order status
- Amount
- Credit bundle
- Stripe checkout session ID
- Stripe payment intent ID
- Stripe payment status from metadata, when available

#### Customer

Show:

- Author ID
- Author email/name, if available
- Customer mode
- KeyInvoice client id, if available
- VAT/NIF, if available
- Final consumer VAT number `999999990`, when applicable
- Billing address data from Stripe/customer payload, when available

#### Fiscal Document

Show:

- Provider
- Status
- Doc type
- Doc series
- Doc number
- Full document number
- AT doc code id
- Gross/net/tax totals
- VAT rate
- Tax id
- PDF availability
- PDF hash

#### Error And Retry

Show prominently if present:

- `last_error`
- `attempt_count`
- `next_retry_at`
- Latest failure event
- Whether retry is due now

#### Event Timeline

Show all `fiscal_document_events` for the document/order in chronological order.

For each event:

- Timestamp
- Event type
- Request payload, collapsible JSON
- Response payload, collapsible JSON

Important event types to recognize:

- `draft_document_prepared`
- `insert_document_requested`
- `insert_document_succeeded`
- `pdf_stored`
- `register_at_succeeded`
- `issue_failed`
- `refund_recorded`
- `dispute_created`

For `draft_document_prepared`, clearly show:

```text
Remote KeyInvoice document created: No
```

## Needs Attention Logic

Create a computed field in the API or frontend:

```ts
needsAttention =
  status === 'failed' ||
  status === 'credit_note_required' ||
  (status === 'pending' && ageMinutes > 15) ||
  (status === 'issuing' && updatedAgeMinutes > 15);
```

Create a second field:

```ts
retryableNow = ['pending', 'failed'].includes(status) && (!nextRetryAt || nextRetryAt <= now);
```

Use these to drive badges, dashboard counts, and default sorting.

## API Requirements

Prefer backend endpoints from `mythoria-webapp` or an admin backend that has secure DB access.

### List Endpoint

```http
GET /admin/fiscal-documents
```

Query parameters:

- `status`
- `needsAttention`
- `hasError`
- `customerMode`
- `dateFrom`
- `dateTo`
- `q`
- `limit`
- `cursor` or `page`
- `sort`

Response should include:

- fiscal document summary
- payment order summary
- author summary
- computed `needsAttention`
- computed `retryableNow`

### Detail Endpoint

```http
GET /admin/fiscal-documents/:id
```

Response should include:

- fiscal document
- related payment order
- related author
- related KeyInvoice customer, if any
- event timeline

### Retry Endpoint

Optional but recommended:

```http
POST /admin/fiscal-documents/:id/retry
```

Rules:

- Admin-only.
- Only allowed for `pending` or `failed`.
- Must call the same idempotent issuing service used by automatic retries.
- Must not create duplicate KeyInvoice documents for the same order.
- Must write an audit event with admin user id.

### PDF Endpoint

Reuse existing secured PDF route if available:

```http
GET /api/payments/fiscal-documents/:documentId/pdf
```

Admin may need a separate admin-authorized proxy if the existing route only authorizes the owning customer.

## UI States

Required empty states:

- No fiscal documents.
- No documents match filters.
- No errors found.

Required loading/error states:

- Table loading skeleton.
- Detail loading skeleton.
- Failed to load list.
- Failed to load detail.
- Failed to retry.

## Security

- Admin-only access.
- Do not expose KeyInvoice API keys or session ids.
- JSON payload viewers must not show secrets if any future event accidentally stores them.
- Retry action must require an authenticated admin user and should be auditable.
- PDF download must be admin-authorized, not customer-session-authorized.

## Acceptance Criteria

- Admin can list all fiscal documents.
- Admin can filter to `failed` documents.
- Admin can filter to documents needing attention.
- Admin can open a detail page and see the exact latest error.
- Admin can inspect the KeyInvoice request/response timeline.
- Admin can identify local draft-only records that did not create remote KeyInvoice documents.
- Admin can identify issued records and download/open the stored PDF.
- Admin can see documents requiring correction after refunds/disputes.
- If retry is implemented, retry is idempotent and writes an audit event.

## Initial Implementation Scope

Build first:

1. List page with filters for status, needs attention, and search.
2. Detail page with payment, customer, fiscal document, error, and event timeline sections.
3. Dashboard count for failed/attention-needed documents.
4. Admin-authorized PDF access for issued documents.

Defer:

- Manual edit of invoice payloads.
- Manual approval workflow.
- Bulk retry.
- Credit note issuing workflow.
- Direct KeyInvoice reconciliation screen.
