# Mythoria Admin Portal

The governance hub for Mythoria: a Next.js 15.4.6 / React 19.1.1 admin surface that secures workflows, leads, tickets, and platform health while running on Google Cloud Run.

## Stack and hosting

| Layer        | Details                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| Runtime      | Next.js App Router (Node 20) deployed to Cloud Run via Cloud Build                       |
| UI kit       | Tailwind CSS + DaisyUI components scoped to `src/app` and `src/components`               |
| Auth         | NextAuth v5 with Google OAuth + domain allowlisting (`src/auth.ts`, `src/middleware.ts`) |
| Data         | Three PostgreSQL databases wired through Drizzle ORM (`src/db/**`, `drizzle/`)           |
| Integrations | Pub/Sub story jobs, Notification Engine proxies, Google Postmaster telemetry             |

## Quick start

```pwsh
npm install
npm run dev -- --port 3001 # Turbopack dev server
```

## Everyday commands

| Task                      | Command                                             |
| ------------------------- | --------------------------------------------------- |
| Production build          | `npm run build`                                     |
| Start prod server locally | `npm run start -- --port 3001`                      |
| Lint + typecheck + test   | `npm run lint && npm run typecheck && npm run test` |
| Format sources            | `npm run format:fix`                                |
| Seed/reset databases      | `npm run db:setup`                                  |

## Development workflow

1. Route all feature work through authenticated layouts; rely on helpers from `src/services`/`src/lib` so route handlers stay thin and testable.
2. Model data with the Drizzle schema modules in `src/db/schema/**` plus the generated helpers in `src/db/services.ts`; avoid ad-hoc SQL in components or API handlers.
3. Update `env.manifest.ts` before touching `.env.*` files so `npm run check:env` and CI keep configuration in sync.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run format:fix` before opening a PR—these mirror Cloud Build gates.

## Architecture snapshot

- **UI** – App Router pages and widgets in `src/app` feed re-usable components from `src/components`.
- **APIs** – Route handlers under `src/app/api/**` reuse middleware from `src/middleware.ts` and session helpers in `src/auth.ts`.
- **Data** – `src/db/index.ts` fans out to `mythoria_db`, `workflows_db`, and `backoffice_db`; migrations live in `drizzle/`.
- **Integrations** – Google OAuth, Pub/Sub (story + audiobook), Notification Engine proxies, Google Postmaster traffic stats.

See `docs/ARCHITECTURE.md` for the detailed runtime slices, data layout, and extension checklist.

## Documentation & AI context

We organize documentation with the Diátaxis taxonomy so humans and agents can jump straight to tutorials, how-tos, references, or explanations.[^1] When you add features:

- Update the relevant doc listed in `docs/README.md` so Copilot Spaces and other knowledge bases can ingest accurate snippets.[^2]
- Prefer short sections, tables, and typed code samples to keep retrieval deterministic.
- Note new env vars in `env.manifest.ts` and mention command updates inside `docs/deployment.md` if they affect release workflows.

---

[^1]: https://diataxis.fr/

[^2]: https://docs.github.com/en/copilot/get-started/what-is-github-copilot
