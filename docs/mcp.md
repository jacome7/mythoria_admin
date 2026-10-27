# Mythoria Admin MCP Server

The Mythoria Admin application exposes a fully functional **Model Context Protocol (MCP)** server natively within the Next.js App Router framework. This server allows AI assistants (like Claude Desktop, Cursor, Agentic Frameworks) to securely manage Mythoria's services and interact with our system databases.

## Integration Architecture

We implement the official `@modelcontextprotocol/sdk` on Next.js App Router route handlers. The `/api/mcp` endpoint uses stateless Streamable HTTP `POST` requests with finite JSON responses. Each request authenticates its principal, creates an isolated protocol server and closes it after the response is ready. No background SSE connection or in-memory session registry is required.

Transport update: 2026-10-27. Legacy SSE has been retired to let request-based Cloud Run billing stop between requests. Authenticated `GET` and `DELETE` requests return `405` with `Allow: POST`; optional GET streams are not offered. Authenticated requests to the old `POST /api/mcp/messages` endpoint return `410` with migration instructions. Missing or invalid credentials still return `401` on these routes.

## Endpoints

- **Connection type**: Stateless Streamable HTTP (`POST /api/mcp`), with JSON responses and `202` for accepted notifications
- **Local Endpoint**: `http://localhost:3001/api/mcp`
- **Production Endpoint**: `https://<admin-domain>/api/mcp`

## Security and Authentication

Due to the highly sensitive domain of admin tools, the MCP server forces strict authorization rules automatically on every connection and message attempt:

1. **API Key Generation Requirement**: The system expects a secure passkey to be defined using the `.env` variable `MCP_SECRET_KEY`.
2. **Bearer verification**: Every MCP request must send `Authorization: Bearer <your-secret-key>`. `MCP_SECRET_KEY` grants the existing admin tools; the separate referral management and finance credentials retain their scoped permissions. See [referrals](referrals.md).
3. **Timing-Safe Evaluation**: Verification utilizes constant-time string comparisons (`crypto.timingSafeEqual`) to prevent brute-force timing attacks against the secret configuration length.
4. **Audit trails**: Requests log an `[MCP AUDIT] Streamable HTTP message` summary containing the method, message ID and top-level keys, without logging credentials or the full payload. Existing tool-level audit behavior is unchanged.

### Codex and streamable HTTP clients

- Transport is **streamable HTTP**: send MCP JSON-RPC requests to `POST /api/mcp` with `Authorization: Bearer <MCP_SECRET_KEY>`.
- Codex config should use the exact `/api/mcp` URL with `bearer_token_env_var = "MYTHORIA_ADMIN_MCP_SECRET"` and should not include a trailing slash.
- Initialization returns `application/json` in JSON response mode so clients do not receive the framework HTML fallback for unsupported methods.

### Migrating clients and local bridges

- Configure clients for Streamable HTTP at `/api/mcp`, using their existing bearer credential. Optional GET attempts receive `405`; a compatible client continues to use POST without reconnecting a stream.
- The bundled `scripts/start-mythoria-admin-mcp.ps1` bridge now uses `mcp-remote --transport http-only`. Restart existing bridge processes after updating the script.
- SSE-only clients must migrate before rollout. There is no legacy streaming endpoint enabled by default or as an automatic fallback.
- **URL shape**: Use exactly `/api/mcp` with **no trailing slash**. A request to `/api/mcp/` receives **308** to `/api/mcp`; many HTTP stacks drop or alter `Authorization` on redirect, which shows up as **401 Unauthorized** on the follow-up request.
- The bearer value must match **`MCP_SECRET_KEY` configured on the Cloud Run (or hosting) environment** for this admin deployment. Store the same value in Google Secret Manager and inject it into OpenClaw (for example `MYTHORIA_ADMIN_MCP_SECRET` on the OpenClaw VM). A mismatch produces **401 Unauthorized**.
- `test_mcp.py` uses the Python SDK's Streamable HTTP client for read-only initialization and tool discovery.

### Validation and rollback

- Local regression coverage: `npm test -- --runInBand __tests__/api/mcp-transport.test.ts` uses the real MCP client and transport SDK, a read-only fixture tool and synthetic credentials. It checks admin, management and finance request isolation, initialization, optional GET handling, tool discovery, tool calls, authentication and protocol cleanup without accessing databases or paid APIs.
- Before promotion, smoke-test initialization, `tools/list` and an authorized read-only tool with each real client. Check that unauthenticated requests remain `401`, optional authenticated GET requests return promptly with `405`, POST responses are JSON and no `Mcp-Session-Id` is issued.
- After deployment, allow existing requests on the previous revision to drain, then use `scripts/check-mcp-costs.ps1 -Days 1` after a complete UTC day and `-Days 7` after seven complete days. Target zero successful streaming GET responses and less than one billable instance-hour per day, while checking tool failures and latency. These are acceptance targets, not measured savings. The script only reads logs and Monitoring metrics using `gcloud` credentials and reports incomplete or unavailable evidence as an error.
- Roll back to the previous known-good revision if real clients fail required read-only operations. The previous revision restores SSE and its one-hour timeout, so the previous cost exposure also returns. Restore matching client transport settings if those clients require SSE. A shorter timeout alone does not stop a reconnect loop.

## Supplied Services

The MCP Server implements 10 main business domain groups directly mapped into our existing `src/db/services` libraries. They possess full execution powers matching an administrator role.

### A & B. Project Statistics & Server Status

- `get_project_statistics`: KPIs and optional time-window analytics (aligned with the Dashboard: registrations, revenue from completed payment orders, credit consumption and grants, service usage by event type, AI token cost in EUR from `workflows_db`, stories and tickets created per bucket). With **no arguments**, returns only `{ users, stories, openTickets }` (global totals; `openTickets` counts open plus in-progress). With a **window**, the response adds `generatedAt`, `range` (preset or `custom`), `startDate`, `endDate`, `granularity` (`day` or `month` for `forever`), `summary` (window totals), and optional `daily` (merged buckets). Arguments (all optional, validated together):
  - `range`: `7d` | `30d` | `90d` | `forever` (mutually exclusive with `startDate`/`endDate`).
  - `startDate` / `endDate`: ISO strings interpreted as **UTC calendar days**; both required together; max span **366** inclusive days for daily series.
  - `includeDaily`: if `true`, include `daily[]` with per-bucket fields (`dateKey`, `newRegistrations`, `revenue`, `transactions`, `totalServiceActions`, `totalServiceCredits`, `serviceUsageByEvent`, `aiCostEUR`, `aiTokens`, `aiRequests`, `newStories`, `creditsGranted`, `newTickets`). Requires a window.
  - `includeAiBreakdowns`: if `true`, add `modelBreakdown` and `actionBreakdown` (same idea as `/api/ai-usage/stats`). Requires a window.
    If `workflows_db` is unavailable, `warnings` may include a note and AI fields will be zeroed.
- `get_server_status`: Query active instances for Mythoria health metrics.

_Last updated: 2026-08-04 - `restart_story_workflow` now uses the same durable, zero-credit Pub/Sub dispatcher as the Admin UI and exposes `published` or `retrying`. Prior: 2026-07-01 - added fiscal document list/detail/issue-count/retry tools for KeyInvoice operations. Prior: 2026-06-14 - list tools serialize arrays inside named object keys for SDK result validation. Prior: 2026-05-17 - `/api/mcp` now supports streamable HTTP `POST` for Codex clients while preserving legacy SSE._

### C. User Management

- `list_users`: Paginate over core author attributes. Tool text serializes as `{ "users": [...] }`.
- `get_user_details`: Extrapolate complex user balances and profile objects.
- `update_user_credits`: Assign varying types of system credits (promotions, refunds, vouchers) to targeted users securely.

### D. Stories Management

- `list_stories`: Survey the master catalog for published and drafted materials. Tool text serializes as `{ "stories": [...] }`.
- `get_story_details`: Explore deep content routing values.
- `restart_story_workflow`: Correct a failed story generation without charging the author. The tool persists a zero-credit durable request, attempts Pub/Sub delivery, and returns `published` or `retrying`; completion sends the customer a fresh story email.

### E. Tickets

- `list_tickets`: Retrieve operational queues. Tool text serializes as `{ "tickets": [...] }`.
- `update_ticket_status`: Assign transitions through the resolution queue securely (`open`, `in_progress`, `resolved`, `closed`).

### F. Blog Content

- `list_blogs`: View general news outputs.
- `create_blog` / `update_blog`: Manage global draft models. `update_blog` upserts provided translations by `(post_id, locale)`, so existing locale rows are updated in place, including `contentMdx`.
- `translate_blog`: Save one localized translation directly. Existing locale rows are updated in place by `(post_id, locale)`, including `contentMdx`.
- `update_blog_status`: Push live or strip document access entirely globally (`publish`, `archive`).

### G. Email Marketing

- `list_campaigns`: Track bulk email lifecycles.
- `create_campaign` / `edit_campaign` / `get_campaign_details`: Directly manage Handlebars templates inside DB layers.
- `pause_campaign`: Securely dispatch "paused" lifecycle transitions explicitly halting notification service aggregations.
- `resume_campaign`: Transition a **paused** campaign back to **active** (same `id` + `adminEmail` audit fields as `pause_campaign`).
- `mark_email_bounced`: Mark an email as `hard` or `soft` bounced across both leads and registered users. Matching is case-insensitive; the tool is idempotent and returns separate lead/user match counts. Never use a sender or forwarding address from a bounce notice as the recipient key.

### H. FAQs

- `list_faqs` / `get_faq_details`: Check active queries.
- `create_faq` / `update_faq` / `delete_faq`: Fully CRUD the content arrays.

### I. Fiscal Documents

- `list_fiscal_documents`: List KeyInvoice fiscal documents with page, limit, status, needs-attention, error, customer mode, provider, date-window, search, and sort filters. Tool text serializes as `{ "fiscalDocuments": [...], "pagination": {...} }`.
- `get_fiscal_document_details`: Return one fiscal document with payment order, author, KeyInvoice customer, retry state, PDF metadata, and a redacted `fiscal_document_events` timeline.
- `get_fiscal_document_issue_counts`: Count failed, stale pending, stale issuing, credit-note-required, and total fiscal documents needing attention.
- `retry_fiscal_document_keyinvoice`: Retry one due `pending` or `failed` document through `mythoria-webapp`; requires `id` and `adminEmail`, sends source `mythoria-admin-mcp`, and preserves the existing idempotent KeyInvoice issuer boundary.

### J. Promotion Codes

- `list_promo_codes`: Explore active bulk codes.
- `get_promo_code_details`: Observe redemptions metrics deeply.
- `create_promo_code`: Output generated promotional codes granting various balance injections automatically safely.
- `toggle_promo_code`: Activate or disable a promotional code globally immediately.
