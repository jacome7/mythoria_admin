# Mythoria Admin MCP Server

The Mythoria Admin application exposes a fully functional **Model Context Protocol (MCP)** server natively within the Next.js App Router framework. This server allows AI assistants (like Claude Desktop, Cursor, Agentic Frameworks) to securely manage Mythoria's services and interact with our system databases.

## Integration Architecture

We implement the official `@modelcontextprotocol/sdk` using a custom HTTP Server-Sent Events (SSE) transport wrapper built on Next.js edge streams. Standard desktop AI assistants seamlessly translate JSON-RPC protocols through HTTP endpoints seamlessly natively.

## Endpoints

- **Connection Type**: SSE (Server-Sent Events)
- **Local Endpoint**: `http://localhost:3001/api/mcp`
- **Production Endpoint**: `https://<admin-domain>/api/mcp`

## Security and Authentication

Due to the highly sensitive domain of admin tools, the MCP server forces strict authorization rules automatically on every connection and message attempt:

1. **API Key Generation Requirement**: The system expects a secure passkey to be defined using the `.env` variable `MCP_SECRET_KEY`.
2. **Bearer Verification**: All connections specify headers using `Authorization: Bearer <your-secret-key>`.
3. **Timing-Safe Evaluation**: Verification utilizes constant-time string comparisons (`crypto.timingSafeEqual`) to prevent brute-force timing attacks against the secret configuration length.
4. **Audit Trails**: Mutative execution tasks are heavily logged. Tools stream structured logs prefixed with `[MCP AUDIT] Session <id> executing payload:` for external tracing within Google Cloud Logging.

## Supplied Services

The MCP Server implements 9 main business domain groups directly mapped into our existing `src/db/services` libraries. They possess full execution powers matching an administrator role.

### A & B. Project Statistics & Server Status
- `get_project_statistics`: Quickly grab aggregated user, story, and ticket totals.
- `get_server_status`: Query active instances for Mythoria health metrics.

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

### H. FAQs
- `list_faqs` / `get_faq_details`: Check active queries.
- `create_faq` / `update_faq` / `delete_faq`: Fully CRUD the content arrays.

### I. Promotion Codes
- `list_promo_codes`: Explore active bulk codes.
- `get_promo_code_details`: Observe redemptions metrics deeply.
- `create_promo_code`: Output generated promotional codes granting various balance injections automatically safely.
- `toggle_promo_code`: Activate or disable a promotional code globally immediately.
