# Stories management

_Last updated: 2026-03-11_

## Context

Story operations include queue-level monitoring (`/stories`), moderation and lifecycle controls (`/stories/[storyId]`), plus chapter reading routes for audit workflows.

## UI workflow

1. `/stories` lists stories with filters for status, featured state, target audience, novel style, graphical style, search, and pagination.
2. Selecting a story opens `/stories/[storyId]` for deep operations.
3. Detail screen shows metadata, chapter table, feature/restart actions, PDF generation, and audiobook generation.
4. Read-only flows (`/stories/[storyId]/read`, `/read/chapter/[chapterNumber]`) help verify generated content chapter-by-chapter.

## Backend and API touchpoints

- `GET /api/admin/stories`
- `GET /api/admin/stories/[storyId]`
- `GET /api/admin/stories/[storyId]/chapters`
- `GET /api/admin/stories/[storyId]/chapters/[chapterNumber]`
- `POST /api/admin/stories/[storyId]/feature`
- `POST /api/admin/stories/[storyId]/restart`
- `POST /api/stories/[storyId]/generate-pdfs`
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
- **workflows_db**
  - `story_generation_runs`
  - `story_generation_steps`

## Notes

- `GET /api/admin/stories` now accepts `target_audience`, `novel_style`, and `graphical_style` query params in addition to the existing status, featured, search, sort, and pagination controls.
- The stories list now surfaces those three story attributes directly in the moderation table so operators can scan and narrow catalog slices without opening the detail page.
