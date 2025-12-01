# Mythoria Admin Portal – API Reference

This reference highlights the REST endpoints implemented under `src/app/api/**`. Use it alongside the source TypeScript types (`src/db/services.ts`, `src/services/**`, and the `zod` schemas inside each route) to keep behavior in sync.

## Authentication & headers

- Every request requires a valid NextAuth session; use the client/route helpers in `src/auth.ts` when calling APIs from the UI.
- Service-to-service calls (email providers, job workers) supply `Authorization: Bearer <ADMIN_API_KEY>` or `X-API-Key`. Validate keys through `/api/ping` before writing automation.
- All routes return JSON with `{ error, message }` metadata on failures. Stick to the existing HTTP status codes (401 for unauthenticated, 403 for disallowed domains, 422 for validation errors).

## Endpoint map

| Area          | Method + path                        | Notes                                                                                              |
| ------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------ | --- | ---------- |
| Health        | `GET /api/health`                    | Lightweight DB + downstream probe. Add `?debug=true` for env metadata.                             |
| Health        | `GET /api/server-status`             | Aggregated status card data (env parity, Pub/Sub, Notification Engine).                            |
| Health        | `GET /api/ping`                      | API-key validation for service-to-service traffic.                                                 |
| Users         | `GET /api/admin/users`               | Paginated admin directory. Query params: `page`, `limit`, `search`, `sortBy`, `sortOrder`.         |
| Users         | `GET /api/admin/users/registrations` | Aggregated author registrations for the dashboard chart (`range=7d                                 | 30d                      | 90d | forever`). |
| Leads         | `GET /api/admin/leads`               | Paginated leads table with filters (`status`, `language`).                                         |
| Leads         | `POST /api/admin/leads`              | Upsert a single lead (email + language required).                                                  |
| Leads         | `POST /api/admin/leads/bulk`         | Bulk status changes (e.g., set `emailStatus` to `hard_bounce`). Requires API key.                  |
| Leads         | `POST /api/admin/leads/import`       | CSV upload endpoint used by the admin UI (multipart form data).                                    |
| Stories       | `GET /api/admin/stories`             | Story moderation feed (filters for author, status, timeframe).                                     |
| Stories       | `PATCH /api/admin/stories/[id]`      | Update status/moderation metadata.                                                                 |
| Workflows     | `GET /api/workflows`                 | Workflow run history + filters.                                                                    |
| Workflows     | `GET /api/workflows/[runId]`         | Detailed run diagnostics.                                                                          |
| Workflows     | `GET /api/workflows/token-usage`     | Aggregated token + cost analytics.                                                                 |
| Tickets       | `GET /api/tickets`                   | Support ticket list with `status`, `category`, `priority`, `search`, `page`, `limit` query params. |
| Tickets       | `POST /api/tickets`                  | Create a ticket (contact, print request, payment). UI and public forms hit the same handler.       |
| Tickets       | `GET /api/tickets/[id]`              | Full ticket detail + comments.                                                                     |
| Tickets       | `PATCH /api/tickets/[id]`            | Update status or priority.                                                                         |
| Tickets       | `POST /api/tickets/[id]/actions`     | Admin-only MB Way workflow actions: `{ action: 'confirmPayment'                                    | 'paymentNotReceived' }`. |
| Tickets       | `POST /api/tickets/[id]/comments`    | Append comments (`isInternal` toggles private notes).                                              |
| Tickets       | `GET /api/tickets/metrics`           | Dashboard stats for the Tickets widget.                                                            |
| Notifications | `GET /api/mail-marketing/*`          | Proxy routes for notification-engine APIs (campaign controls, stats).                              |
| Postmaster    | `GET /api/postmaster/traffic-stats`  | Google Postmaster telemetry for deliverability dashboards.                                         |

### Blog management

| Area | Method + path                 | Notes                                                                                                                                                                                            |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blog | `GET /api/admin/blog`         | Paginated list with `status`, `locale`, and `search` filters.                                                                                                                                    |
| Blog | `POST /api/admin/blog`        | Creates a draft. Response includes `fieldLimits` and optional `warnings` when data needs sanitizing.                                                                                             |
| Blog | `GET /api/admin/blog/[id]`    | Returns `{ data, fieldLimits }` so the editor can enforce live DB limits.                                                                                                                        |
| Blog | `PUT /api/admin/blog/[id]`    | Updates hero image, status, and translations. Response shape: `{ data, fieldLimits, warnings }`. Summaries exceeding the DB column length are truncated server-side and surfaced via `warnings`. |
| Blog | `DELETE /api/admin/blog/[id]` | Deletes the post plus translations.                                                                                                                                                              |

`fieldLimits` mirrors the active PostgreSQL schema (values pulled from `information_schema` at runtime) and exposes `{ slug, title, summary }` maximum lengths. Clients should prefer these numbers over hard-coded limits. When the API returns `warnings` (e.g., "Summary for en-US exceeded 500 characters and was truncated."), keep the editor open, highlight the affected locale, and let the author decide whether to revise or accept the shorter summary.

Keep the OpenAPI file (`docs/mythoria-admin-openapi.yaml`) aligned with this table when you add or rename routes.

### FAQ management

| Area | Method + path                          | Notes                                                                                                                              |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FAQ  | `GET /api/faq/entries`                 | Paginated FAQ entries with search, locale, section, FAQ key, publish status, and sort controls.                                    |
| FAQ  | `POST /api/faq/entries`                | Creates a FAQ entry. New entries are published by default unless `isPublished` is set to `false`.                                  |
| FAQ  | `POST /api/faq/entries/[id]/translate` | Translates a single FAQ to missing locales via Story Generation Workflow and publishes the created translations.                   |
| FAQ  | `POST /api/faq/entries/bulk-translate` | Starts a server-side bulk translation job for multiple FAQ IDs. Poll status with `GET /api/faq/entries/bulk-translate?jobId=<id>`. |

## Response shapes

- **Use the exported types** – `adminService`, `TicketService`, and the workflow helpers already expose TypeScript interfaces. Re-export or import those types in your UI components/tests to avoid drift.
- **Validation** – Route handlers rely on `zod` schemas stored beside each API (`src/app/api/**/schema.ts` when present). Update those schemas first, then adjust services/tests.
- **Pagination objects** – Follow the existing `{ page, limit, totalPages, totalCount, hasNext, hasPrev }` structure returned by `adminService`. Reuse that contract when adding list endpoints.

## Error handling

- Wrap route logic in `try/catch` and log with `console.error` (logs are shipped to Cloud Logging).
- Return `{ error: string, message: string, timestamp: new Date().toISOString() }` for unexpected failures—see `/api/admin/leads` for an example.
- Reuse the centralized domain checks (`ALLOWED_DOMAINS` from `src/config/auth.ts`) to avoid duplicating logic per route.

## Testing

- UI tests live in `__tests__/components/**`; API handlers expose pure helpers that can be unit-tested through the services (`adminService`, `TicketService`, etc.).
- When you touch API contracts, update mocks in `__tests__/` and fixtures under `src/services/__tests__` if they exist.

---

_Last updated: February 11, 2026_
