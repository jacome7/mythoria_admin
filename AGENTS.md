# Mythoria Admin Portal – Agent Guide

Use this playbook whenever you script or automate changes in the repo.

## Mission control

- Keep admin routes locked behind the existing NextAuth helpers in `src/middleware.ts` and `src/auth.ts`.
- Prefer `src/services/**` and Drizzle helpers for data access; avoid wiring DB clients directly inside UI components.
- Update docs in the proper Diátaxis bucket (`docs/README.md`) every time you touch behavior so Copilot knowledge stays current.[^1]

## Core guardrails

1. **Authentication** – Reuse the existing session guards and `ALLOWED_DOMAINS` checks; never bypass them for convenience.
2. **Three databases** – Clarify whether the change touches `mythoria_db`, `workflows_db`, or `backoffice_db`, and update both `src/db/schema/**` and `env.manifest.ts` together.
3. **Observability** – Pipeline errors through structured logs (`console.error`) so Cloud Logging keeps context.
4. **Formatting** – Run `npm run format:fix` after editing Markdown/TSX to align with the Prettier config.

## Workflow checklist

1. Sync instructions in `.github/instructions/general.instructions.md` before editing.
2. Create or update docs in the right Diátaxis category and timestamp significant changes.
3. Run `npm run lint`, `npm run typecheck`, `npm run test`, and any affected `npm run db:*` scripts before handing work back.
4. Summarize assumptions and alternatives in PR descriptions so reviewers can challenge decisions early.

## Fast commands

| Purpose          | Command                                                          |
| ---------------- | ---------------------------------------------------------------- |
| Install deps     | `npm install`                                                    |
| Dev server       | `npm run dev -- --port 3001`                                     |
| Build + start    | `npm run build && npm run start -- --port 3001`                  |
| Quality gates    | `npm run lint && npm run typecheck && npm run test`              |
| Format           | `npm run format:fix`                                             |
| Database tooling | `npm run db:generate`, `npm run db:migrate`, `npm run db:studio` |

## Knowledge map

- `docs/ARCHITECTURE.md` – runtime slices, data layout, extension checklist.
- `docs/deployment.md` – Cloud Run + Cloud Build promotion playbook.
- `docs/authentication.md` – Google OAuth setup and guard reuse.
- `docs/api-reference.md` – current route map and validation notes.
- `docs/features/emailMarketing.md` – multi-campaign email marketing system (schema, API, UI, compliance).
- `../docs/EMAIL_CAMPAIGNS.md` – cross-service campaign runbook and Phase 4 validation checklist.
- Specialized guides (CSV import, bounce API, Postmaster, ticketing) live next to those files; link them from `docs/README.md` when you add new surfaces.

## Email campaigns module

The multi-campaign marketing system is spread across:

- **Schema** – `src/db/schema/campaigns.ts` (6 enums, 4 tables in `backoffice_db`).
- **Service** – `src/db/services/campaigns.ts` (CRUD, state transitions, filter evaluation, audience counting via `mythoria_db`).
- **Validation** – `src/lib/schemas/campaigns.ts` (Zod schemas for all campaign inputs).
- **API routes** – `src/app/api/email-campaigns/` (13 endpoints covering CRUD, lifecycle, sending, analytics).
- **Shared helpers** – `src/lib/api-helpers.ts` (auth + NE proxy), `src/lib/campaignClient.ts` (client SDK).
- **UI** – `src/app/email-marketing/page.tsx` (list), `src/app/email-campaigns/[id]/page.tsx` (detail), `src/components/email-campaigns/` (11 components).

When modifying campaigns, coordinate with `notification-engine` for dispatch changes and keep `docs/features/emailMarketing.md` up to date.

### Phase 3 migration artifacts

SQL migration scripts live in `scripts/`:

- `phase3-step3.1-migrate-templates.sql` – creates campaign records and assets from legacy Handlebars templates.
- `phase3-step3.2-migrate-lead-statuses.sql` – associates previously emailed leads as campaign recipients (requires `dblink`).

After Phase 3, marketing templates are stored in `backoffice_db` campaign assets; the legacy `.hbs` files in notification-engine have been deleted.

### Phase 4 test coverage

- `__tests__/db/services/campaigns.test.ts` validates campaign service CRUD, transitions, assets, and progress aggregation.
- `__tests__/api/email-campaigns.test.ts` validates campaign API route lifecycle, auth guards, and proxy behavior.
