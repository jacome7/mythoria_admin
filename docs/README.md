# Documentation Index

We apply the Diátaxis model so that each document answers a single type of question (tutorial, how-to, reference, or explanation) and stays readable for both people and Copilot-powered tooling.[^1][^2] Use this index whenever you update or add docs.

## Tutorials (learning-oriented)

| Doc           | Purpose                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Coming soon_ | We capture end-to-end walkthroughs in the main README (local setup) and deployment how-tos below. Add a tutorial when you need a step-by-step story rather than discrete tasks. |

## How-to guides (task-oriented)

| Doc                                | Scope                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `docs/deployment.md`               | Deploying to Cloud Run via Cloud Build, managing secrets, rollback steps. |
| `docs/authentication.md`           | Configuring Google OAuth + NextAuth and protecting routes.                |
| `docs/csv-import-guide.md`         | Uploading and validating lead CSV files from the admin UI.                |
| `docs/bounceAPI.md`                | Updating lead email statuses from external providers (bounce tracking).   |
| `docs/postmaster-setup.md`         | Reading Google Postmaster metrics through the admin portal.               |
| `docs/TICKETING_IMPLEMENTATION.md` | Operating and extending the ticketing stack (form ingestion + admin UI).  |

## Reference (lookup)

| Doc                                | Scope                                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| `docs/api-reference.md`            | REST route map, accepted query params, and response shapes.         |
| `docs/mythoria-admin-openapi.yaml` | Machine-readable OpenAPI spec (sync this when routes change).       |
| `docs/features/*.md`               | Per-page feature deep dives (context, UI workflow, DB structures).  |
| `docs/AGENTS.md`                   | Directory-specific editing conventions for contributors and agents. |

## Explanation (deep understanding)

| Doc                    | Scope                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | Combined architecture + feature overview (runtime slices, data layout, extension checklist). |
| `docs/features.md`     | Legacy pointer retained for compatibility; detailed page docs live in `docs/features/`.      |
| `docs/features/*.md`   | Feature-by-feature implementation explanations for each `src/app` surface.                   |

## House rules

1. Review `docs/AGENTS.md` and `.github/instructions/general.instructions.md` before editing; both spell out formatting expectations for contributors and automation.
2. Timestamp significant rewrites inside each doc so on-call staff know which version they are reading.
3. Capture new env vars in `env.manifest.ts` and reference them from the relevant doc instead of duplicating `.env` snippets.
4. When you add a doc, register it under the correct Diátaxis table above so Copilot knowledge bases can locate it deterministically.[^2]

## Contributing to docs

1. Pick the category above before writing. Mixing guidance types makes retrieval worse for vibe-coding sessions and Copilot knowledge bases.[^1][^3]
2. Use short sections, tables, and fenced code blocks so agents can lift snippets without extra prompt engineering.[^2]
3. Update timestamps/version callouts when content materially changes.
4. Link related docs via relative paths; avoid repeating long explanations.
5. Run `npm run format:fix` after editing Markdown so Prettier keeps tables aligned.

## Recent behavior notes

- 2026-02-08: Email campaign audience estimation now uses draft filters and metadata from the detail page (see `docs/features/emailMarketing.md`).
- 2026-02-09: Added a dependency update prompt for upgrading packages and running quality gates (see `.github/prompts/update-dependencies.prompt.md`).

---

[^1]: https://diataxis.fr/

[^2]: https://developers.google.com/tech-writing/one

[^3]: https://docs.github.com/en/copilot/get-started/what-is-github-copilot

_Index refreshed: 2026-02-09_
