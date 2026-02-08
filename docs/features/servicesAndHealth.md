# Services and operational health

_Last updated: 2026-02-08_

## Context

Operational utilities include service catalog CRUD (`/services`) and environment/system monitoring (`/server-status`).

## UI workflow

### Services management

1. `/services` loads current service definitions.
2. Operators can create, edit, and remove entries.
3. Changes are reflected immediately in the table after mutation.

### Server status

1. `/server-status` pings `/api/server-status`.
2. UI displays health for app runtime, databases, and external dependencies.
3. Manual refresh allows rapid incident validation after remediation.

## Backend and API touchpoints

- `GET/POST /api/services`
- `GET/PUT/DELETE /api/services/[id]`
- `GET /api/server-status`
- `GET /api/health`
- `GET /api/ping`

## Database structure

- **backoffice_db**
  - service configuration tables (owned by service routes)
- Health checks also probe:
  - **mythoria_db** connectivity
  - **workflows_db** connectivity
  - **backoffice_db** connectivity
