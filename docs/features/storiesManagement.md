# Stories management

_Last updated: 2026-11-26_

## Context

Story operations include queue-level monitoring (`/stories`), moderation and lifecycle controls (`/stories/[storyId]`), plus chapter reading routes for audit workflows.

## UI workflow

1. `/stories` lists stories with filters for status, featured state, target audience, novel style, graphical style, search, and pagination.
2. Selecting a story opens `/stories/[storyId]` for deep operations.
3. Detail screen shows metadata, chapter table, feature/restart actions, PDF generation, and audiobook generation.
4. Read-only flows (`/stories/[storyId]/read`, `/read/chapter/[chapterNumber]`) help verify generated content chapter-by-chapter.

For premium editions with the lettered cover design, the Admin reader shows the selected style logo and publication QR on the back cover. **Preview Page Artwork** displays the pinned rendering alongside access to the transcript. The live dedication view uses the same smaller italic signature as the pinned version 1 artwork.

Published Premium Children Books show **Print PDFs** on the story page. Admin opens an existing verified package for the current edition or starts a staff export when the package is missing. Staff exports provide RGB and CMYK versions of the square interior and casewrap cover. If an existing package contains only RGB, staff can download those files or request the full set. The action shows the queue, generation and retry states. Downloads require Admin access and redirect to short-lived links for the exact stored file version. The staff proof and print-and-ship controls continue to handle physical orders.

## Backend and API touchpoints

- `GET /api/admin/stories`
- `GET /api/admin/stories/[storyId]`
- `GET /api/admin/stories/[storyId]/chapters`
- `GET /api/admin/stories/[storyId]/chapters/[chapterNumber]`
- `POST /api/admin/stories/[storyId]/feature`
- `POST /api/admin/stories/[storyId]/restart`
- `POST /api/workflows/[runId]/retry`
- `POST /api/stories/[storyId]/generate-pdfs`
- `GET` and `POST /api/admin/stories/[storyId]/premium-print?revision=<uuid>`
- `GET /api/admin/stories/[storyId]/premium-print/[runId]/[part]?revision=<uuid>`
- `POST /api/admin/stories/[storyId]/generate-audiobook`
- `GET /api/admin/stories/[storyId]/audio/[chapterIndex]`

## Database structure

- **mythoria_db**
  - `stories`
  - `chapters`
  - `story_versions`
  - `story_collaborators`
  - `share_links`
  - `characters`, `story_characters`
  - `story_generation_requests` (durable restart dispatch and retry state)
- **workflows_db**
  - `story_generation_runs`
  - `story_generation_steps`

## Notes

- `GET /api/admin/stories` now accepts `target_audience`, `novel_style`, and `graphical_style` query params in addition to the existing status, featured, search, sort, and pagination controls.
- Graphical-style filter options are derived from the shared enum synchronized from the WebApp; this includes `claymation` and `papercut`. The story list and detail view render the canonical human-readable labels.
- The stories list now surfaces those three story attributes directly in the moderation table so operators can scan and narrow catalog slices without opening the detail page.
- Story reading routes return only the latest stored version of each chapter and disable response caching. Chapter, cover, and back-cover image URIs are validated before rendering, `gs://` URIs are converted to HTTPS, and mutable absolute image URLs receive a per-request cache key so regenerated artwork is shown immediately.
- Relative story image paths are resolved against `https://storage.googleapis.com/mythoria-generated-stories/`, never the admin site's origin. Persisted query strings and fragments are removed from these versioned storage paths before rendering.
- Chapter illustrations are horizontally centered within the story reader at every screen size.
- Admin story UI, failed-workflow retry UI, and MCP restarts share one durable dispatcher. A restart is corrective, records zero credits, never debits the author, and does not pre-create a workflow run. Immediate Pub/Sub failure returns a visible `retrying` state for the existing WebApp outbox drain.
- When the regenerated run completes, SGW sends `story-created` again using the new `runId` as the notification idempotency key. See `storyGenerationRestarts.md` for the cross-service contract and live verification checklist.
- On mobile, the detail header stacks management actions below the story title, which wraps rather than competing for horizontal space. The restart and return controls use the concise labels `Restart` and `Back`.
- The classic PDF and audiobook actions validate the browser origin against the configured Admin URL (`NEXTAUTH_URL`, then `AUTH_URL`) behind Cloud Run. If neither is configured, they use the request URL. An origin mismatch returns 403 before any job is queued.
- The story detail Author card links both the display name and full author ID to `/users/[authorId]`. Story Actions omits unavailable PDF rows, and Audio Narration uses a compact disclosure that starts collapsed.
