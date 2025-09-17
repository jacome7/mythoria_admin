# Mythoria Admin Portal

The Mythoria Admin Portal is the governance hub for the Mythoria platform, delivering secure administrative control over users, stories, workflows, notifications, and platform configuration. It is built on Next.js 15 with TypeScript and operates as a containerized service on Google Cloud Run.

## Platform Role
- Anchors platform governance alongside Mythoria Web App (front-office), Story Generation Workflows (GenAI services), and Notification Engine (messaging).
- Provides domain-restricted Google OAuth entry point for all staff and partner administrators.
- Acts as the single-pane interface for real-time health, operational metrics, and workflow oversight across the Mythoria ecosystem.

## Key Capabilities
- **Authentication & Access Control** - Google OAuth via NextAuth v5, domain allowlisting, JWT sessions, email verification, and admin role controls.
- **User & Account Operations** - Directory search, status changes, profile editing, activity analytics, and bulk operations across the mythoria_db user catalog.
- **Content Governance** - Story lifecycle management with moderation workflows, publication state control, media asset visibility, and content analytics.
- **AI Workflow Oversight** - Monitoring of generation runs, step-level diagnostics, token and cost tracking, and workflow recovery tooling linked to Story Generation Workflows.
- **Observability & Alerts** - Health dashboard backed by `/api/health`, performance and error telemetry, audit logs, and integration with Notification Engine for escalations.

## High-Level Architecture
- **Frontend** - Next.js App Router delivering hybrid SSR/ISR experiences, React 19 UI components, Tailwind CSS 4 + DaisyUI for consistent theming, and shared UI primitives in `src/components`.
- **Server Runtime** - Node.js 22.12 runtime with Next.js server actions, request-level middleware in `src/middleware.ts`, and secure API routes under `src/app/api/*` guarded by NextAuth.
- **Data Layer** - Drizzle ORM (v0.44) models split across three PostgreSQL databases: `mythoria_db` (users, stories, notifications), `workflows_db` (generation runs, steps, cost telemetry), and `backoffice_db` (admins, audit logs, system config). Connection pooling and migrations are orchestrated via `src/db` utilities.
- **Inter-Service Integrations** - Publishes and consumes GCP Pub/Sub topics for asynchronous coordination, surfaces workflow state from Story Generation Workflows, and pushes notifications through the Notification Engine.
- **Deployment Topology** - Distributed as a standalone Docker image (Node 22 Alpine base) deployed to Cloud Run in `europe-west9`, reaching Cloud SQL via VPC connectors and retrieving secrets from Google Secret Manager.

## Service Contracts
- `/api/health` - Composite health probe returning database, network, and external service status with optional diagnostics.
- `/api/users` - CRUD surface for user administration with pagination, search, status, and role filters.
- `/api/stories` - Content moderation and publication management endpoints with bulk operations.
- `/api/workflows` - Workflow listing and control plane integration for AI generation runs, token usage, and cost analytics.

## Observability & Compliance
- Structured JSON logging streamed to Google Cloud Logging with configurable log levels.
- Health, authentication, performance, and resource alerts wired into Mythoria monitoring channels.
- Audit logging stored in `backoffice_db` for compliance and reconciliation.

## Project Layout
```
mythoria_admin/
|-- docs/                # Architecture, feature, deployment references
|-- scripts/             # Deployment, logging, schema sync utilities
|-- src/
|   |-- app/             # Next.js App Router routes, API handlers, middleware
|   |-- components/      # Shared UI primitives and feature components
|   |-- db/              # Drizzle schema, migrations, connection helpers
|   |-- lib/             # Domain services, auth helpers, observability utils
|   `-- services/        # Integration clients and domain orchestrators
|-- __tests__/           # Jest test suites for UI, API, and integration flows
|-- public/              # Static assets served by Next.js
`-- package.json         # Scripts and dependency manifest
```

## Environment & Deployment Footprint
- Runs on Node.js 22.12 with npm tooling; scripts cover development, linting, testing, and database lifecycle (`npm run lint`, `npm run test`, `npm run db:migrate`).
- Cloud Build pipeline builds and pushes the container image, then deploys to Cloud Run (`oceanic-beach-460916-n5` project) with autoscaling (0-5 instances) and private VPC egress.
- Secrets (OAuth, database credentials, auth secret) are sourced from Google Secret Manager at runtime.

---

**Version**: 0.2.0  
**Last Updated**: September 20, 2025
