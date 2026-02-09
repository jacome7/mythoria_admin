# Leads and email marketing

_Last updated: 2026-02-08_

## Context

Lead acquisition and outbound campaign setup is split between `/leads` (data hygiene/import/lifecycle) and `/email-marketing` (campaign sending and status checks).

## UI workflow

1. `/leads` supports searching, bulk status updates, CSV import, and lead detail edits.
2. Import modal submits CSV files and receives row-level validation outcomes.
3. Bulk controls update email status flags used for targeting.
4. `/email-marketing` loads list size stats and dispatches campaign batches through Notification Engine proxies.

## Backend and API touchpoints

- `GET/POST /api/admin/leads`
- `GET/PATCH/DELETE /api/admin/leads/[id]`
- `POST /api/admin/leads/import`
- `POST /api/admin/leads/bulk`
- `POST /api/admin/leads/bounce`
- `GET /api/admin/leads/stats`
- `GET/PUT /api/mail-marketing/config`
- `POST /api/mail-marketing/send-batch`
- `GET /api/mail-marketing/status`
- `GET /api/postmaster/traffic-stats`

## Database structure

- **mythoria_db**
  - `leads` (email status, source attribution, campaign eligibility)
- **backoffice_db**
  - optional audit/operational records for admin actions (service-level)
  - `marketing_campaigns`, `marketing_campaign_assets`, `marketing_campaign_batches`, `marketing_campaign_recipients` — multi-campaign email marketing tables (see [emailMarketing.md](emailMarketing.md))
