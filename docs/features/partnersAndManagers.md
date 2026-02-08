# Partners and managers

_Last updated: 2026-02-08_

## Context

These pages manage internal operators (`/managers`) and external business entities (`/partners`) used for fulfillment and commercial operations.

## UI workflow

### Managers

1. `/managers` lists existing manager accounts.
2. Admin creates/edits manager records from the same form modal.
3. Delete actions remove stale manager records.

### Partners

1. `/partners` lists all partners with status and type filtering.
2. Inline form supports create/edit flows.
3. Delete action removes partner records after confirmation.

## Backend and API touchpoints

- `GET/POST /api/admin/managers`
- `GET/PUT/DELETE /api/admin/managers/[id]`
- `GET/POST /api/admin/partners`
- `GET/PUT/DELETE /api/admin/partners/[id]`

## Database structure

- **backoffice_db**
  - `managers`
- **mythoria_db**
  - `partners`
