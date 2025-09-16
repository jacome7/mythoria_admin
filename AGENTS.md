# Mythoria Admin Portal – Agent Guide

This document follows the [AGENTS.md best practices](https://agents.md) by keeping the most relevant instructions for coding agents in a single, predictable place. Treat it as the canonical source of truth for automated changes in this repository.

## Setup commands
- Install dependencies: `npm install`
- Start the dev server (Turbopack, port 3001 by default): `npm run dev`
- Build for production: `npm run build`
- Start the production server locally: `npm run start -- --port 3001`
- Launch the standalone build produced by `next build` in Docker: see the `Dockerfile` (defaults to port 3000 inside the container).

## Testing & quality gates
- Lint with ESLint + Next rules: `npm run lint`
- Type-check with the strict TypeScript configuration: `npm run typecheck`
- Enforce Prettier formatting: `npm run format` (use `npm run format:fix` to apply fixes)
- Run the Jest test suite (React Testing Library + jsdom): `npm run test`
- Watch mode: `npm run test:watch`
- Coverage report: `npm run test:coverage`
- Always run lint, typecheck, format, and test before opening a PR or committing.

## Database & data tooling
- Generate Drizzle SQL: `npm run db:generate`
- Apply migrations via runtime script (loads env vars): `npm run db:migrate`
- Push schema changes using the Drizzle CLI: `npm run db:push`
- Reset all three databases (drops + re-applies migrations): `npm run db:reset`
- Combined reset + push helper: `npm run db:setup`
- Seed development data: `npm run db:seed`
- Open Drizzle Studio: `npm run db:studio`
- Sync shared schemas from the customer-facing app when needed:
  - `npm run sync-mythoria-db-schema`
  - `npm run sync-workflows-schema`
- Keep the new `src/db/AGENTS.md` in mind for directory-specific conventions when editing database code or schema files.

## Project overview
### Runtime & frameworks
- Next.js **15.4.6** using the App Router under `src/app`
- React **19.1.1**
- TypeScript **5.9** (strict mode enabled, `moduleResolution: bundler`)
- Node.js **>=22.0.0** (Docker images pin to 22.12-alpine)
- Package manager: npm (lockfile present)
- Styling: Tailwind CSS **4.1** + DaisyUI **5.0** (see `tailwind.config.ts` and `postcss.config.mjs`)
- ORM: Drizzle ORM **0.44.4** with PostgreSQL pools via `pg`
- Authentication: NextAuth.js **5.0.0-beta.29** with Google OAuth and JWT sessions
- Cloud integrations: Google Pub/Sub and Workflows SDK clients are available for background orchestration tasks.

### Application structure
- `src/app`: App Router routes, API endpoints, and layouts. API routes cover health checks, authentication, notifications, workflows, tickets, stories, admin KPIs, and more.
- `src/components`: Shared client-side UI built with Tailwind + DaisyUI patterns.
- `src/services`: Domain-specific service helpers used by routes and components.
- `src/lib`: Cross-cutting utilities (auth middleware, Pub/Sub publisher, database configuration helpers, notification client wrappers).
- `src/config`: Static configuration (e.g., allowed authentication domains).
- `src/styles`: Global CSS + Tailwind entry points.
- `docs/`: In-depth product and feature documentation referenced by admins and developers.

### Authentication & authorization
- Google OAuth is the only allowed provider. `src/auth.ts` configures NextAuth to require verified emails from approved domains.
- Allowed domains (suffix match) live in `src/config/auth.ts`: `@mythoria.pt` and `@caravanconcierge.com`.
- JWT session strategy stores basic profile data (email, name, avatar).
- Custom sign-in (`/auth/signin`) and error pages handle onboarding flows.
- API-level key validation utilities exist in `src/lib/auth` for service-to-service requests via `ADMIN_API_KEY`.

### Data layer
- Three PostgreSQL databases (`mythoria`, `workflows`, `backoffice`) share connection settings built by `getMultiDatabaseConfig` in `src/lib/database-config.ts`.
- Connection pools are lazily initialized in `src/db/index.ts`; build and test phases skip database setup to avoid failures.
- Schema modules live in `src/db/schema`. The `sync-*` scripts regenerate the auto-maintained `index.ts` exports and copy schema/type definitions from the webapp.
- Database utility services reside in `src/db/services` and `src/db/services.ts`.

### UI & styling
- Tailwind 4 content scanning targets `src/app`, `src/components`, and `src/pages` for compatibility.
- DaisyUI themes are available globally; follow existing component patterns before introducing new theme tokens.
- Global fonts, resets, and shared CSS live in `src/styles`.

### Integrations & telemetry
- `src/lib/pubsub.ts` publishes story and audiobook jobs via Google Pub/Sub topics defined by `PUBSUB_TOPIC` and `PUBSUB_AUDIOBOOK_TOPIC`.
- `src/services/workflow-monitor.ts` polls Google Workflows for story-generation runs; keep workflow names in sync with infrastructure.
- Notification APIs call external services configured by `NOTIFICATION_ENGINE_URL` and `NOTIFICATION_ENGINE_API_KEY`.
- Health and diagnostics endpoints (`/api/health`, `/api/server-status`, `/api/debug/*`) report connectivity, environment configuration, and downstream service status.

## Environment configuration
Create a `.env.local` for local development. Key variables detected in the codebase include:

### Core authentication
- `AUTH_SECRET`
- `NEXTAUTH_URL` (usually `http://localhost:3001` in dev)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Database connectivity
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_MAX_CONNECTIONS`
- `MYTHORIA_DB`, `WORKFLOWS_DB`, `BACKOFFICE_DB`

### Public URLs exposed to the frontend
- `WEBAPP_URL`
- `ADMIN_URL`
- `STORY_GENERATION_WORKFLOW_URL`
- `NOTIFICATION_ENGINE_URL`

### Service credentials & integrations
- `ADMIN_API_KEY`
- `NOTIFICATION_ENGINE_API_KEY`
- `GOOGLE_CLOUD_PROJECT_ID`
- `PUBSUB_TOPIC`
- `PUBSUB_AUDIOBOOK_TOPIC`

All of the `NEXT_PUBLIC_*` keys are injected via `next.config.ts` to mirror these backend environment values. Default fallbacks exist for local usage, but production deployments require explicit configuration.

## Deployment & operations
- `npm run build` produces a standalone output consumed by the Dockerfile. The resulting image exposes port 3000 and runs `server.js` in production mode as the non-root `nextjs` user.
- Google Cloud Build configuration (`cloudbuild.yaml`) coordinates container builds, sets required environment variables, and sources secrets for OAuth, database credentials, and service API keys.
- PowerShell scripts in `scripts/*.ps1` automate Windows-based deployment, logging, and environment setup.
- For local smoke tests against production-like artifacts, build the container and run `docker run -p 3001:3000 mythoria-admin` to match the development port mapping.

## Coding conventions
- Prettier is the source of truth: default formatting uses double quotes and semicolons. Run `npm run format:fix` after large changes.
- ESLint inherits `next/core-web-vitals` and `next/typescript` rules; fix lint warnings before merging.
- TypeScript strict mode is enabled. Prefer explicit types for exported functions, API handlers, and service interfaces.
- Use the `@/` path alias for local imports (`@/components/...`, `@/lib/...`). Absolute paths keep module resolution consistent in both app and test environments.
- Group domain logic in `src/services` and keep React components lean. Fetch data via server actions or route handlers where possible.
- Keep environment-sensitive code (database calls, Pub/Sub publishing) on the server only; avoid importing those modules into client components.

## Troubleshooting
- **OAuth failures**: Confirm Google credentials, allowed redirect URI (`/api/auth/callback/google`), and that the user email ends with an allowed domain and is verified.
- **Database connection errors**: Ensure the three database names exist, credentials match, and firewall/VPC access allows connectivity. For local development, PostgreSQL 14+ is recommended.
- **Missing env vars in production**: `/api/health` and `/api/server-status` report which credentials are configured at runtime—use them to debug secret injection issues.
- **Pub/Sub publishing issues**: Check `GOOGLE_CLOUD_PROJECT_ID`, topic names, and service account permissions. The publisher logs topic names and payloads for easier tracing.
- **Notification API errors**: Verify `NOTIFICATION_ENGINE_URL` and `NOTIFICATION_ENGINE_API_KEY`; use `/api/server-status` to confirm downstream connectivity.

## Metadata
```yaml
name: mythoria-admin
version: 0.2.0
framework: nextjs
router: app
language: typescript
package_manager: npm
port_dev: 3001
port_container: 3000
authentication: google-oauth-via-nextauth
orm: drizzle-orm
updated: 2025-09-15
```
