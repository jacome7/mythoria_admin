# Leads and email marketing

_Last updated: 2026-08-31_

## Context

Lead acquisition and outbound campaign setup is split between `/leads` (data hygiene/import/lifecycle) and `/email-marketing` (campaign sending and status checks).

## UI workflow

1. `/leads` shows global delivery-status cards above the management controls: total leads, hard bounces, soft bounces, and unsubscribes. Each status card includes its count and its percentage of all leads.
2. `/leads` supports searching, bulk status updates, CSV import, and lead detail edits.
3. Import modal submits CSV files and receives row-level validation outcomes.
4. Use the Status filter to inspect individual hard-bounced, soft-bounced, or unsubscribed leads. Filters affect the table only; the summary cards remain global totals.
5. Bulk controls update email status flags used for targeting.
6. `/email-marketing` loads list size stats and dispatches campaign batches through Notification Engine proxies.

## Delivery-status definitions

| Metric       | Definition                                                          |
| ------------ | ------------------------------------------------------------------- |
| Total leads  | All records in `mythoria_db.leads`.                                 |
| Hard bounces | `email_status = hard_bounce`; excluded from future marketing sends. |
| Soft bounces | `email_status = soft_bounce`; eligible for a later retry.           |
| Unsubscribes | `email_status = unsub`; excluded from future marketing sends.       |

The cards use the authenticated `GET /api/admin/leads/stats` endpoint. They refresh together with the lead table and are not scoped by its search or language filters.

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
