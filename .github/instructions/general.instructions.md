---
applyTo: '**'
---

Challenge my assumptions and provide alternative solutions.
If you are unsure about something, ask for clarification.
Do not always agree with me; provide your own perspective.
If you need to make assumptions, state them clearly.
The database schema is located within \src\db.
Always user Powershell to run commands.
When creating powershell scripts NEVER use emojies or special characters.

## Charts and Data Visualization

Use **Recharts** library for all charts and data visualizations in the admin portal.

Best practices when using Recharts:

- Always wrap charts in `ResponsiveContainer` for proper sizing and responsiveness
- Define explicit TypeScript types for all chart data structures
- Use client components (`"use client"` directive) when rendering charts
- Available chart types: AreaChart, BarChart, LineChart, ComposedChart, PieChart, RadarChart, RadialBarChart, ScatterChart, FunnelChart, Treemap, and Sankey
- Common components: ResponsiveContainer, Legend, Tooltip, XAxis, YAxis, CartesianGrid
- Make components reusable by accepting typed props for data, axis keys, and styling
- Handle asynchronous data fetching properly with loading states
- Customize tooltips and legends to match DaisyUI theme colors

## Mythoria Admin Portal guardrails

- Keep admin routes locked behind the existing NextAuth helpers in `src/middleware.ts` and `src/auth.ts`.
- Prefer `src/services/**` and Drizzle helpers for data access; avoid wiring DB clients directly inside UI components.
- Update docs in the proper Diataxis bucket (`docs/README.md`) every time behavior changes so Copilot knowledge stays current.
- Reuse the existing session guards and `ALLOWED_DOMAINS` checks; never bypass them for convenience.
- Clarify whether database changes touch `mythoria_db`, `workflows_db`, or `backoffice_db`, and update both `src/db/schema/**` and `env.manifest.ts` together.
- Pipeline errors through structured logs (`console.error`) so Cloud Logging keeps context.
- Run `npm run format:fix` after editing Markdown/TSX to align with the Prettier config.

## Workflow checklist

1. Sync these instructions before editing.
2. Create or update docs in the right Diataxis category and timestamp significant changes.
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

- `docs/ARCHITECTURE.md` - runtime slices, data layout, extension checklist.
- `docs/deployment.md` - Cloud Run + Cloud Build promotion playbook.
- `docs/authentication.md` - Google OAuth setup and guard reuse.
- `docs/api-reference.md` - current route map and validation notes.
- `docs/features/emailMarketing.md` - multi-campaign email marketing system (schema, API, UI, compliance).
- `../docs/EMAIL_CAMPAIGNS.md` - cross-service campaign runbook and Phase 4 validation checklist.
- Specialized guides (CSV import, bounce API, Postmaster, ticketing) live next to those files; link them from `docs/README.md` when you add new surfaces.

## Email campaigns module

- Schema: `src/db/schema/campaigns.ts` (6 enums, 4 tables in `backoffice_db`).
- Service: `src/db/services/campaigns.ts` (CRUD, state transitions, filter evaluation, audience counting via `mythoria_db`).
- Validation: `src/lib/schemas/campaigns.ts` (Zod schemas for all campaign inputs).
- API routes: `src/app/api/email-campaigns/` (13 endpoints covering CRUD, lifecycle, sending, analytics).
- Shared helpers: `src/lib/api-helpers.ts` (auth + NE proxy), `src/lib/campaignClient.ts` (client SDK).
- UI: `src/app/email-marketing/page.tsx` (list), `src/app/email-campaigns/[id]/page.tsx` (detail), `src/components/email-campaigns/` (11 components).

When modifying campaigns, coordinate with `notification-engine` for dispatch changes and keep `docs/features/emailMarketing.md` up to date.
