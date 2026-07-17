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

| Doc                                | Scope                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/api-reference.md`            | REST route map, accepted query params, and response shapes.                         |
| `docs/mcp.md`                      | Model Context Protocol server (streamable HTTP + SSE), auth, tools, and statistics. |
| `docs/mythoria-admin-openapi.yaml` | Machine-readable OpenAPI spec (sync this when routes change).                       |
| `docs/features/*.md`               | Per-page feature deep dives (context, UI workflow, DB structures).                  |
| `docs/features/fiscalDocuments.md` | Fiscal document monitoring, retry, PDF access, and KeyInvoice audit trail behavior. |
| `docs/AGENTS.md`                   | Directory-specific editing conventions for contributors and agents.                 |

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
4. Keep runtime pins aligned across `.node-version`, `.nvmrc`, `package.json`, `Dockerfile`, `cloudbuild.yaml`, and deployment docs.
5. When you add a doc, register it under the correct Diátaxis table above so Copilot knowledge bases can locate it deterministically.[^2]

## Contributing to docs

1. Pick the category above before writing. Mixing guidance types makes retrieval worse for vibe-coding sessions and Copilot knowledge bases.[^1][^3]
2. Use short sections, tables, and fenced code blocks so agents can lift snippets without extra prompt engineering.[^2]
3. Update timestamps/version callouts when content materially changes.
4. Link related docs via relative paths; avoid repeating long explanations.
5. Run `npm run format:fix` after editing Markdown so Prettier keeps tables aligned.

## Recent behavior notes

- 2026-02-08: Email campaign audience estimation now uses draft filters and metadata from the detail page (see `docs/features/emailMarketing.md`).
- 2026-02-09: Added a dependency update prompt for upgrading packages and running quality gates (see `.github/prompts/update-dependencies.prompt.md`).
- 2026-03-11: Stories management now supports filtering by target audience, novel style, and graphical style, and exposes those attributes in the admin table (see `docs/features/storiesManagement.md`).
- 2026-04-04: MCP `get_project_statistics` supports date windows and merged daily or monthly buckets (see `docs/mcp.md`).
- 2026-05-03: MCP `update_blog` and `translate_blog` update existing blog translation content by `(post_id, locale)` instead of attempting duplicate inserts (see `docs/mcp.md`).
- 2026-05-17: Runtime pins now use Node.js 24.15.0 LTS consistently across local version-manager files, package metadata, Docker, Cloud Build, and deployment docs.
- 2026-06-14: Runtime pins now use Node.js 24.16.0 LTS consistently across local version-manager files, package metadata, Docker, Cloud Build, and deployment docs.
- 2026-06-15: Local production deploys now run npm work through pinned Node.js/npm versions and prefer the Windows `gcloud.cmd` wrapper with explicit Python discovery (see `docs/deployment.md`).
- 2026-05-17: MCP `/api/mcp` accepts streamable HTTP `POST` requests for Codex clients while preserving the legacy SSE flow (see `docs/mcp.md`).
- 2026-06-14: MCP `list_users`, `list_stories`, and `list_tickets` now serialize list payloads inside named object keys for SDK result validation (see `docs/mcp.md`).
- 2026-06-14: Added fiscal document monitoring, admin PDF access, and single-document retry (see `docs/features/fiscalDocuments.md`).
- 2026-07-01: MCP now exposes fiscal document list/detail/issue-count tools and KeyInvoice retry parity with the admin fiscal documents page (see `docs/mcp.md`).
- 2026-07-01: Fiscal document detail now supports a guarded manual mark-issued reconciliation override with audit events (see `docs/features/fiscalDocuments.md`).
- 2026-07-02: Cloud Run cleanup scripts now separate `gcloud` stderr from JSON output and fail `cleanup-all.ps1` on the first cleanup step error (see `docs/deployment.md`).
- 2026-07-17: Story readers now validate image URIs, resolve relative image paths against the generated-stories storage bucket, center chapter illustrations, and bypass stale chapter, cover, and back-cover image caches (see `docs/features/storiesManagement.md`).

---

[^1]: https://diataxis.fr/

[^2]: https://developers.google.com/tech-writing/one

[^3]: https://docs.github.com/en/copilot/get-started/what-is-github-copilot

_Index refreshed: 2026-07-17_
