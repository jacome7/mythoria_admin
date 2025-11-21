# Mythoria Admin Portal – Architecture

This guide condenses how the admin portal is wired today and merges the useful content from the previous architecture and feature documents so you can reference a single file.

## Runtime slices

| Layer           | What runs here                                                                                                           | Key directories                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| UI composition  | Next.js 15.4.6 App Router (React 19.1.1) with Tailwind 4.1 + DaisyUI 5 powering layouts, forms, dashboards, and widgets. | `src/app`, `src/components`, `src/styles`          |
| API + actions   | Route handlers, server actions, and middleware that enforce auth, Zod validation, and service orchestration.             | `src/app/api`, `src/middleware.ts`, `src/services` |
| Domain services | Pure helpers that talk to Drizzle clients, Pub/Sub publishers, workflow monitors, and notification clients.              | `src/lib`, `src/services`, `src/db/services.ts`    |
| Data access     | Drizzle 0.44 schema modules, migrations, and `getMultiDatabaseConfig` helpers for the three PostgreSQL databases.        | `src/db`, `drizzle/`                               |

## Domain surfaces

- **Accounts & identity** – Admin-only Google OAuth (NextAuth v5) with domain allowlisting; session helpers live in `src/auth.ts` and navigation primitives in `src/components/AdminHeader.tsx`.
- **Growth analytics** – The dashboard renders a Recharts-powered “New Users” timeline fed by `mythoria_db.authors`, with DaisyUI controls for 7/30/90-day snapshots or monthly/cumulative forever views.
- **Service usage analytics** – A companion “Service Usage” chart queries `credit_ledger` for debit events (story generation, narration, print, text/image edits) and stacks them by the same range filters so ops can spot expensive workloads quickly.
- **Leads & marketing** – CSV import, deliverability health, and bounce APIs share the `/api/admin/leads*`, `/api/postmaster/*`, and `/api/mail-marketing/*` routes with UI in `src/app/leads` and `src/app/email-marketing`.
- **Content & AI workflows** – Story moderation plus workflow diagnostics are handled in `src/app/stories`, `/api/admin/stories`, and `/api/workflows`. Token/cost tiles lean on `workflow-monitor.ts` and Drizzle queries against `workflows_db`.
- **Tickets & support** – The ticketing UI (`src/app/tickets`, `src/components/TicketsWidget.tsx`) fronts `/api/tickets` and `TicketService`, storing state in `backoffice_db`. MB Way payment tickets embed service-to-service metadata from the web app and expose dedicated actions in `src/app/tickets/[id]/page.tsx` that call `/api/tickets/[id]/actions` to auto-credit accounts or close unresolved requests (guarded by a 5-day window and silent closures when payment never lands).
- **Ops & health** – `/api/health`, `/api/server-status`, `/api/ping`, and the dashboard KPIs expose environmental, DB, and downstream reachability data for on-call staff.
- **Dashboard streaming** – The homepage fetches `/api/admin/kpis` first and then progressively mounts each Recharts surface behind skeleton placeholders so users see structure immediately while heavier analytics hydrate sequentially.

## Data layout

| Database        | Purpose                                                                   | Backed by                                                     |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `mythoria_db`   | User roster, generated stories, notification history, leads, CSV imports. | `src/db/schema/mythoria` fragments + `adminService` helpers   |
| `workflows_db`  | Story generation runs, workflow steps, token/cost telemetry.              | `src/db/schema/workflows`, `src/services/workflow-monitor.ts` |
| `backoffice_db` | Admin accounts, audit logs, tickets, system config.                       | `src/db/schema/backoffice`, `TicketService`, audit utilities  |

Pools are lazy-loaded in `src/db/index.ts`, allowing build/test phases to skip live DB access. Health endpoints rely on `Promise.allSettled` against lightweight selects to avoid locking hot tables.

## Request and data flow

```
Browser (App Router + client components)
  │
  ├─ Authenticated navigation -> middleware (`src/middleware.ts`) -> NextAuth session revalidation
  ├─ Data fetching hooks -> server components -> Drizzle queries via domain services
  └─ Mutations -> route handlers (e.g., /api/admin/leads) -> service helpers -> DB + external APIs
```

Every admin API enforces:

1. NextAuth session validation (`auth()` or `getServerSession`).
2. Domain suffix checks via `ALLOWED_DOMAINS`.
3. Optional API key verification for service-to-service calls (e.g., `/api/ping`, `/api/admin/leads/bulk`).

## Integrations & observability

- **Google Cloud** – Cloud Run hosts the standalone Next build, Cloud Build handles CI, and Pub/Sub topics ship through `src/lib/pubsub.ts` for story/audiobook jobs.
- **Notification engine & Postmaster** – Proxy routes under `/api/mail-marketing/*` and `/api/postmaster/*` enforce admin auth before calling external services. Supporting guides live beside this file (`bounceAPI.md`, `postmaster-setup.md`).
- **Metrics & alerts** – JSON logs feed Cloud Logging; `/api/server-status` aggregates DB reachability, Pub/Sub health, Notification Engine ping, and env parity checks to power dashboard cards.

## Extension checklist

1. **Choose the right datastore** – user-facing data belongs in `mythoria_db`, workflow telemetry in `workflows_db`, and admin-only artifacts in `backoffice_db`.
2. **Keep route handlers thin** – push orchestration into services so APIs and server components reuse the same logic.
3. **Document the surface** – new features should add a short entry to the relevant how-to or reference doc (see `docs/README.md`) so Copilot knowledge bases and vibe-coding sessions have structured context to ingest.

---

**Architecture Version**: 2.2.2  
**Last Updated**: November 20, 2025
