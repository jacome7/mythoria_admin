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
- Specialized guides (CSV import, bounce API, Postmaster, ticketing) live next to those files; link them from `docs/README.md` when you add new surfaces.

---

[^1]: https://diataxis.fr/
