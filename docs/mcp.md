# Mythoria Admin MCP Server

The Mythoria Admin application exposes a fully functional **Model Context Protocol (MCP)** server natively within the Next.js App Router framework. This server allows AI assistants (like Claude Desktop, Cursor, Agentic Frameworks) to securely manage Mythoria's services and interact with our system databases.

## Integration Architecture

We implement the official `@modelcontextprotocol/sdk` using a custom HTTP Server-Sent Events (SSE) transport wrapper on Next.js App Router route handlers (`ReadableStream`). Each SSE session constructs its own `McpServer` so concurrent connections on the same instance are supported. Standard clients send JSON-RPC over the MCP HTTP+SSE flow.

## Endpoints

- **Connection Type**: SSE (Server-Sent Events)
- **Local Endpoint**: `http://localhost:3001/api/mcp`
- **Production Endpoint**: `https://<admin-domain>/api/mcp`

## Security and Authentication

Due to the highly sensitive domain of admin tools, the MCP server forces strict authorization rules automatically on every connection and message attempt:

1. **API Key Generation Requirement**: The system expects a secure passkey to be defined using the `.env` variable `MCP_SECRET_KEY`.
2. **Bearer Verification**: SSE `GET` and message `POST` must send `Authorization: Bearer <your-secret-key>` (same value as `MCP_SECRET_KEY`).
3. **Timing-Safe Evaluation**: Verification utilizes constant-time string comparisons (`crypto.timingSafeEqual`) to prevent brute-force timing attacks against the secret configuration length.
4. **Audit Trails**: Mutative execution tasks are heavily logged. Tools stream structured logs prefixed with `[MCP AUDIT] Session <id> executing payload:` for external tracing within Google Cloud Logging.

### OpenClaw and other remote MCP clients

- Transport is **SSE**: connect with `GET /api/mcp` and header `Authorization: Bearer <MCP_SECRET_KEY>`.
- **URL shape**: Use exactly `/api/mcp` with **no trailing slash**. A request to `/api/mcp/` receives **308** to `/api/mcp`; many HTTP stacks drop or alter `Authorization` on redirect, which shows up as **401 Unauthorized** on the follow-up request.
- The bearer value must match **`MCP_SECRET_KEY` configured on the Cloud Run (or hosting) environment** for this admin deployment. Store the same value in Google Secret Manager and inject it into OpenClaw (for example `MYTHORIA_ADMIN_MCP_SECRET` on the OpenClaw VM). A mismatch produces **401 Unauthorized**.
- The `/api/mcp/messages` endpoint is tied to the session established on the SSE connection; clients must follow the MCP SSE flow end to end and include the **same Bearer token** on every `POST`.

## Supplied Services

The MCP Server implements 9 main business domain groups directly mapped into our existing `src/db/services` libraries. They possess full execution powers matching an administrator role.

### A & B. Project Statistics & Server Status

- `get_project_statistics`: KPIs and optional time-window analytics (aligned with the Dashboard: registrations, revenue from completed payment orders, credit consumption and grants, service usage by event type, AI token cost in EUR from `workflows_db`, stories and tickets created per bucket). With **no arguments**, returns only `{ users, stories, openTickets }` (global totals; `openTickets` counts open plus in-progress). With a **window**, the response adds `generatedAt`, `range` (preset or `custom`), `startDate`, `endDate`, `granularity` (`day` or `month` for `forever`), `summary` (window totals), and optional `daily` (merged buckets). Arguments (all optional, validated together):
  - `range`: `7d` | `30d` | `90d` | `forever` (mutually exclusive with `startDate`/`endDate`).
  - `startDate` / `endDate`: ISO strings interpreted as **UTC calendar days**; both required together; max span **366** inclusive days for daily series.
  - `includeDaily`: if `true`, include `daily[]` with per-bucket fields (`dateKey`, `newRegistrations`, `revenue`, `transactions`, `totalServiceActions`, `totalServiceCredits`, `serviceUsageByEvent`, `aiCostEUR`, `aiTokens`, `aiRequests`, `newStories`, `creditsGranted`, `newTickets`). Requires a window.
  - `includeAiBreakdowns`: if `true`, add `modelBreakdown` and `actionBreakdown` (same idea as `/api/ai-usage/stats`). Requires a window.
    If `workflows_db` is unavailable, `warnings` may include a note and AI fields will be zeroed.
- `get_server_status`: Query active instances for Mythoria health metrics.

_Last updated: 2026-04-05 — per-session MCP server for concurrent SSE; Bearer on POST `/api/mcp/messages`; document no trailing slash (308 + Authorization). Prior: 2026-04-04 — extended `get_project_statistics` with date windows and merged daily/monthly series._

### C. User Management

- `list_users`: Paginate over core author attributes.
- `get_user_details`: Extrapolate complex user balances and profile objects.
- `update_user_credits`: Assign varying types of system credits (promotions, refunds, vouchers) to targeted users securely.

### D. Stories Management

- `list_stories`: Survey the master catalog for published and drafted materials.
- `get_story_details`: Explore deep content routing values.
- `restart_story_workflow`: Immediately kick off new Cloud Workflow generations to unstick stalled process assets.

### E. Tickets

- `list_tickets`: Retrieve operational queues.
- `update_ticket_status`: Assign transitions through the resolution queue securely (`open`, `in_progress`, `resolved`, `closed`).

### F. Blog Content

- `list_blogs`: View general news outputs.
- `create_blog` / `update_blog`: Manage global draft models.
- `translate_blog`: Invoke localized schema arrays directly within active document versions.
- `update_blog_status`: Push live or strip document access entirely globally (`publish`, `archive`).

### G. Email Marketing

- `list_campaigns`: Track bulk email lifecycles.
- `create_campaign` / `edit_campaign` / `get_campaign_details`: Directly manage Handlebars templates inside DB layers.
- `pause_campaign`: Securely dispatch "paused" lifecycle transitions explicitly halting notification service aggregations.
- `resume_campaign`: Transition a **paused** campaign back to **active** (same `id` + `adminEmail` audit fields as `pause_campaign`).

### H. FAQs

- `list_faqs` / `get_faq_details`: Check active queries.
- `create_faq` / `update_faq` / `delete_faq`: Fully CRUD the content arrays.

### I. Promotion Codes

- `list_promo_codes`: Explore active bulk codes.
- `get_promo_code_details`: Observe redemptions metrics deeply.
- `create_promo_code`: Output generated promotional codes granting various balance injections automatically safely.
- `toggle_promo_code`: Activate or disable a promotional code globally immediately.
