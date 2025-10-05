# src Directory - Agent Notes

## Scope

- Application source for the Mythoria Admin Portal, including routing, UI, services, and database access.
- All production code lives here; changes impact Cloud Run deployments.

## Key Entry Points

- `app/` - App Router routes, API handlers, layouts, middleware.
- `components/` - Reusable UI elements; shared styling relies on Tailwind CSS 4 + DaisyUI.
- `db/` - Drizzle schemas, migrations, and connection helpers for mythoria_db, workflows_db, and backoffice_db.
- `lib/` - Cross-cutting helpers (auth, observability, formatting, feature toggles).
- `services/` - Integration clients (GCP Pub/Sub, Notification Engine, Story Generation Workflows).

## When Editing

- Preserve server/client boundaries: add `'use client'` directives only when required; keep heavy logic on the server.
- Maintain strong typing: update interfaces in `src/types/` or module-local type declarations when adding new fields.
- For API handlers, enforce authentication with existing guard utilities and surface errors via typed responses.
- Database changes must be reflected in Drizzle schemas and accompanied by a migration in `src/db/migrations`.
- Coordinate payload updates with downstream services (Story Generation Workflows, Notification Engine) before merging.

## Testing

- Cover UI changes with Jest + React Testing Library in `__tests__` or co-located `*.test.tsx` files.
- For API/service logic, prefer integration-style tests using mocked database connections.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` before delivery; call out any intentionally skipped checks.

_Last refreshed: September 20, 2025_
