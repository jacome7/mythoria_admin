# Workflow operations

_Last updated: 2026-02-08_

## Context

The workflows page (`/workflows`) exposes story generation run health, failure triage, status synchronization, and retry controls.

## UI workflow

1. Tabbed UI separates running, failed, and completed runs.
2. Counts are fetched per tab for quick at-a-glance backlog sizing.
3. Sync button checks status drift and reconciles stale runs.
4. Failed runs can be retried from the list.
5. Drill-down routes load a run detail payload for diagnostic inspection.

## Backend and API touchpoints

- `GET /api/workflows`
- `GET /api/workflows/[runId]`
- `POST /api/workflows/[runId]/retry`
- `GET /api/admin/workflows?action=status`
- `POST /api/admin/workflows?action=sync-all`
- `GET /api/admin/workflows/[runId]`

## Database structure

- **workflows_db**
  - `story_generation_runs`
  - `story_generation_steps`
  - `token_usage_tracking`
