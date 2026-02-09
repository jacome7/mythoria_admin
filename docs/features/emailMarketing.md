# Email campaign management

_Last updated: 2026-02-09_

## Overview

The Email Campaigns feature replaces the legacy single-campaign email marketing system with a fully-fledged multi-campaign architecture. Admins can create, manage, and track multiple concurrent marketing email campaigns—each with its own audience targeting, locale-specific templates, lifecycle controls, and send progress.

Campaigns live in `backoffice_db` (owned by this service) and target audiences in `mythoria_db` (read-only). Actual email dispatch is handled by the Notification Engine, which the admin portal proxies through authenticated API routes.

---

## Concepts

### Campaign lifecycle

Every campaign passes through a well-defined state machine:

| State       | Description                                                          | Allowed transitions                       |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `draft`     | Being configured—assets and filters not finalized. Cannot be sent.   | `active`, `cancelled`                     |
| `active`    | Eligible for batch sending by the scheduler.                         | `paused`, `completed` (auto), `cancelled` |
| `paused`    | Temporarily halted; no batches sent.                                 | `active` (resume), `cancelled`            |
| `completed` | Auto-triggered when a batch returns 0 eligible recipients. Terminal. | —                                         |
| `cancelled` | Manually cancelled by admin. Terminal.                               | —                                         |

State transitions are validated server-side in `campaignService.transitionCampaignStatus()`. Invalid transitions return a `400` error.

### Audience source and filtering

Each campaign targets one of three audience sources:

- **`users`** — registered authors in `mythoria_db.authors`
- **`leads`** — marketing leads in `mythoria_db.leads`
- **`both`** — union of both tables

**Default suppression** (always enforced, cannot be removed):

| Audience | Rule                                                                                             | Rationale                              |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Users    | `notificationPreference` must be in the campaign's allowed list (default: `news`, `inspiration`) | Respect user communication preferences |
| Leads    | `emailStatus != 'unsub'` AND `emailStatus != 'hard_bounce'`                                      | Global suppression list                |

**Filters** are stored as a JSONB tree on the campaign (`filter_tree` column) and built interactively in the admin UI. Example:

```json
{
  "logic": "and",
  "conditions": [
    { "field": "createdAt", "operator": "gte", "value": "2025-01-01T00:00:00Z" },
    { "field": "preferredLocale", "operator": "in", "value": ["pt-PT", "en-US"] }
  ]
}
```

#### Filterable fields

| Audience | Field                    | Operators                                      |
| -------- | ------------------------ | ---------------------------------------------- |
| Users    | `createdAt`              | `gt`, `gte`, `lt`, `lte`, `between`            |
| Users    | `lastLoginAt`            | `gt`, `gte`, `lt`, `lte`, `between`, `is_null` |
| Users    | `preferredLocale`        | `eq`, `in`, `not_in`                           |
| Users    | `notificationPreference` | `eq`, `in`, `not_in`                           |
| Users    | `gender`                 | `eq`, `in`                                     |
| Users    | `literaryAge`            | `eq`, `in`                                     |
| Leads    | `language`               | `eq`, `in`, `not_in`                           |
| Leads    | `emailStatus`            | `eq`, `in`, `not_in`                           |
| Leads    | `lastEmailSentAt`        | `gt`, `gte`, `lt`, `lte`, `between`, `is_null` |

### Campaign assets (templates)

Each campaign has locale-specific assets—one per `(channel, language)` pair. Currently only the `email` channel is supported.

Each asset contains:

- **Subject** — Handlebars template for the email subject line
- **HTML body** — Handlebars HTML content
- **Text body** — Handlebars plaintext fallback

Assets are edited in-place (no versioning). A SHA-256 hash snapshot is stored per batch for audit purposes.

#### Available template variables

| Variable               | Description               | Available for |
| ---------------------- | ------------------------- | ------------- |
| `{{name}}`             | Full name                 | Users + Leads |
| `{{firstName}}`        | First name                | Users + Leads |
| `{{email}}`            | Email address             | Users + Leads |
| `{{trackingPixelUrl}}` | Open tracking pixel       | Leads         |
| `{{signUpLink}}`       | Sign-up CTA with tracking | Leads         |
| `{{unsubscribeLink}}`  | One-click unsubscribe     | Users + Leads |
| `{{homepageLink}}`     | Homepage with tracking    | Leads         |
| `{{termsLink}}`        | Terms and conditions      | Leads         |
| `{{physicalAddress}}`  | Company physical address  | Users + Leads |

### Batch sending and rate limiting

Global settings (owned by Notification Engine, editable from admin):

- `batchSize` — 10-500, default 100
- `sendWindowStart` / `sendWindowEnd` — time-of-day boundaries
- `timezone` — IANA timezone (default `Europe/Lisbon`)

Per-campaign optional `daily_send_limit` caps how many emails a single campaign sends per UTC day.

### Per-recipient tracking

The `marketing_campaign_recipients` table decouples campaign send status from the global lead `emailStatus`. This allows the same lead/user to be targeted by multiple campaigns independently. A unique constraint on `(campaign_id, recipient_id)` prevents duplicate sends.

---

## UI workflow

### Campaign list (`/email-marketing`)

1. **Status filter tabs** — Filter by Draft, Active, Paused, Completed, Cancelled, or show All.
2. **Campaign table** — Sortable columns: title, audience source, status, created date, and actions.
3. **Create button** — Opens a modal to specify title, description, audience source, daily send limit, and start/end dates.
4. **Action buttons** — Per-row: Activate, Pause, Cancel, Duplicate, Delete (draft/cancelled only).
5. **Pagination** — Page-based navigation.
6. **Global settings panel** — Collapsible section showing batch size slider and current send window (proxied to Notification Engine).

### Campaign detail (`/email-campaigns/[id]`)

Accessible by clicking a campaign title or the edit action in the list.

**Sections:**

1. **Header** — Campaign title, status badge, lifecycle action buttons, and Duplicate.
2. **Metadata** (draft only) — Editable title, description, audience source, user notification preferences, daily limit, dates.
3. **Filter editor** — Interactive filter builder with field/operator/value selectors, add/remove conditions, and real-time audience count estimation.

- **Estimate Audience** uses the current draft filters and metadata, even before saving.
- A change badge appears next to the total after a second estimate to show the delta.

4. **Asset editor** — Locale tabs (en-US, pt-PT, es-ES, fr-FR, de-DE) with subject, HTML body, and text body editors. Includes a collapsible variables reference panel.
  - **Generate Email Assets** (draft only) — Opens a modal to generate AI-powered email content. The admin provides the source locale, subject, body description, and selects a reference template. The system generates the source locale email body using AI, then translates to the selected target locales (all locales by default). Results are loaded into the asset editor for review before saving.
5. **Sample send** — Test a specific locale's asset by sending to an arbitrary email address with optional variable overrides.
6. **Progress** (active/paused/completed campaigns) — Stats grid (estimated audience, sent, remaining, failed, skipped), progress bar, and batch history table.

---

## Data model

All tables live in `backoffice_db` and are defined in `src/db/schema/campaigns.ts`.

### Tables

| Table                           | Purpose                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `marketing_campaigns`           | Campaign definitions with metadata, audience config, user notification preferences, filters, and lifecycle state |
| `marketing_campaign_assets`     | Per-locale email templates (subject, HTML, text) linked to a campaign                                            |
| `marketing_campaign_batches`    | Batch execution records with stats, timing, and asset snapshot hashes                                            |
| `marketing_campaign_recipients` | Per-recipient send records with delivery status and error tracking                                               |

### Enums

| Enum                        | Values                                                |
| --------------------------- | ----------------------------------------------------- |
| `campaign_status`           | `draft`, `active`, `paused`, `completed`, `cancelled` |
| `campaign_audience_source`  | `users`, `leads`, `both`                              |
| `campaign_channel`          | `email`                                               |
| `campaign_batch_status`     | `queued`, `running`, `completed`, `failed`            |
| `campaign_recipient_status` | `queued`, `sent`, `failed`, `skipped`                 |
| `campaign_recipient_type`   | `user`, `lead`                                        |

---

## Backend and API touchpoints

### Campaign CRUD

| Method   | Path                                  | Description                                                 |
| -------- | ------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/email-campaigns`                | List campaigns. Query params: `page`, `limit`, `status`.    |
| `POST`   | `/api/email-campaigns`                | Create campaign (starts as `draft`).                        |
| `GET`    | `/api/email-campaigns/[id]`           | Campaign detail with assets.                                |
| `PATCH`  | `/api/email-campaigns/[id]`           | Update campaign metadata and/or upsert assets.              |
| `DELETE` | `/api/email-campaigns/[id]`           | Delete campaign (only `draft` or `cancelled`).              |
| `POST`   | `/api/email-campaigns/[id]/duplicate` | Duplicate a campaign into a new `draft` with copied assets. |

### Lifecycle transitions

| Method | Path                                 | Description                                           |
| ------ | ------------------------------------ | ----------------------------------------------------- |
| `POST` | `/api/email-campaigns/[id]/activate` | Transition: `draft`/`paused` -> `active`.             |
| `POST` | `/api/email-campaigns/[id]/pause`    | Transition: `active` -> `paused`.                     |
| `POST` | `/api/email-campaigns/[id]/cancel`   | Transition: `draft`/`active`/`paused` -> `cancelled`. |

### Sending

| Method | Path                                    | Description                                             |
| ------ | --------------------------------------- | ------------------------------------------------------- |
| `POST` | `/api/email-campaigns/[id]/send-batch`  | Trigger manual batch (proxied to Notification Engine).  |
| `POST` | `/api/email-campaigns/[id]/send-sample` | Send test email. Body: `{ locale, email, variables? }`. |

### Analytics

| Method | Path                                       | Description                                        |
| ------ | ------------------------------------------ | -------------------------------------------------- |
| `GET`  | `/api/email-campaigns/[id]/audience-count` | Estimated audience count based on current filters. |
| `GET`  | `/api/email-campaigns/[id]/progress`       | Sent/failed/skipped counts plus batch history.     |

### Global settings (existing)

| Method      | Path                         | Description                                                    |
| ----------- | ---------------------------- | -------------------------------------------------------------- |
| `GET/PATCH` | `/api/mail-marketing/config` | Notification Engine global settings (batch size, send window). |

### AI asset generation

| Method | Path                                              | Description                                                                                                          |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/email-campaigns/[id]/generate-assets`       | Trigger async AI email asset generation (proxied to SGW `POST /api/jobs/generate-email-assets`).                     |
| `GET`  | `/api/email-campaigns/[id]/generate-assets?jobId` | Poll async job status (proxied to SGW `GET /api/jobs/{jobId}`). Returns progress and generated assets on completion. |

**Generate assets request body:**

```json
{
  "sourceLocale": "en-US",
  "subject": "Your story awaits",
  "bodyDescription": "A warm welcome email for new leads...",
  "templateName": "default",
  "targetLocales": ["en-US", "pt-PT", "es-ES", "fr-FR", "de-DE"]
}
```

The admin proxy reads the selected HTML template from `src/templates/email/`, appends it to the payload, and forwards to SGW. The SGW creates an async job that:

1. Generates the source locale email (HTML body + text fallback) via AI using the reference template structure.
2. Translates the subject, HTML body, and text body to each remaining locale (`en-US`, `pt-PT`, `es-ES`, `fr-FR`, `de-DE`).
3. Returns all locale assets in the job result for the admin to review and save.

---

## Service layer

### `src/db/services/campaigns.ts`

The `campaignService` object provides all data-access methods:

| Method                                               | Description                                        |
| ---------------------------------------------------- | -------------------------------------------------- |
| `createCampaign(data, createdBy)`                    | Insert a new campaign with `draft` status.         |
| `getCampaign(id)`                                    | Fetch campaign with joined assets.                 |
| `listCampaigns(options)`                             | Paginated listing with optional status filter.     |
| `updateCampaign(id, data, updatedBy)`                | Update metadata and/or filter tree.                |
| `deleteCampaign(id)`                                 | Delete (only `draft`/`cancelled`).                 |
| `transitionCampaignStatus(id, newStatus, updatedBy)` | Validate and apply state transition.               |
| `upsertCampaignAsset(campaignId, asset)`             | Insert or update a locale-specific asset.          |
| `deleteCampaignAsset(assetId)`                       | Remove an asset.                                   |
| `getCampaignAssets(campaignId)`                      | List all assets for a campaign.                    |
| `createBatchRecord(campaignId, requestedBy)`         | Create a new batch execution record.               |
| `updateBatchRecord(id, data)`                        | Update batch status and stats.                     |
| `insertRecipientRecords(records)`                    | Bulk-insert per-recipient delivery records.        |
| `getCampaignProgress(campaignId)`                    | Aggregate sent/failed/skipped counts.              |
| `getBatchHistory(campaignId, limit)`                 | Fetch recent batch records.                        |
| `getDailySendCount(campaignId)`                      | Count today's sends (for daily limit enforcement). |
| `getEstimatedAudienceCount(campaign)`                | Evaluate filter tree against `mythoria_db` tables. |

### `src/lib/schemas/campaigns.ts`

Zod validation schemas for all campaign inputs:

- `createCampaignSchema` — title (required), description, audienceSource, dailySendLimit, startAt, endAt
- `updateCampaignSchema` — all fields optional
- `campaignAssetSchema` — channel, language, subject, htmlBody, textBody
- `sampleSendSchema` — locale, email, variables (optional JSON)
- `filterTreeSchema` — recursive AND/OR logic tree with conditions
- `paginationSchema` — page, limit with defaults

### `src/lib/campaignClient.ts`

Client-side SDK used by the admin UI. Provides typed methods for all campaign API calls, including:

- `generateAssets(id, data)` — Trigger AI email asset generation for a campaign.
- `getGenerateAssetsJobStatus(id, jobId)` — Poll the async generation job status.

### `src/lib/api-helpers.ts`

Shared utilities:

- `authenticateAdmin()` — NextAuth session + domain check
- `proxyToNotificationEngine(path, options)` — Authenticated proxy with API key

### `src/templates/email/`

Reference HTML email templates used by the AI asset generation feature. These are copied from `notification-engine/src/templates/` and serve as structural references for AI-generated emails.

| Template            | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `template.html.hbs` | Default Mythoria email template (table-based, responsive, Spectral + Inter fonts) |

---

## Components

All campaign UI components are in `src/components/email-campaigns/`:

| Component              | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `CampaignStatusBadge`  | Color-coded DaisyUI badge for campaign status                  |
| `CampaignListTable`    | Sortable campaign table with action buttons                    |
| `CreateCampaignModal`  | Modal form for creating new campaigns                          |
| `DeleteCampaignModal`  | Confirmation dialog for campaign deletion                      |
| `GlobalSettingsPanel`  | Batch size slider and send window display                      |
| `CampaignDetailHeader` | Title, status badge, and lifecycle action buttons              |
| `CampaignFilterEditor` | Interactive filter builder with audience estimation            |
| `CampaignAssetEditor`  | Locale-tabbed template editor with variables panel             |
| `GenerateAssetsModal`  | AI-powered modal to generate email assets for all locales      |
| `VariablesPanel`       | Available Handlebars variable reference with copy-to-clipboard |
| `SampleSendForm`       | Test send form with locale/email/variables inputs              |
| `CampaignProgress`     | Stats grid, progress bar, and batch history                    |

---

## Compliance (GDPR / CAN-SPAM)

All campaign emails must include:

1. **One-click unsubscribe** — visible link in footer + `List-Unsubscribe` / `List-Unsubscribe-Post` headers.
2. **Physical postal address** — configurable company address in the email footer.
3. **Suppression enforcement** — checked before every send: lead global suppression (`unsub`, `hard_bounce`), user notification preferences, and per-campaign deduplication.
4. **Unsubscribe processing** — honored immediately; recipient suppressed before the next batch.

---

## Relationship with legacy system

The legacy single-campaign system (`/api/mail-marketing/*`) remains operational for backward compatibility but is deprecated. The new campaign system operates independently:

- Legacy `mail_marketing_config` controls global send settings shared by both systems.
- Lead `emailStatus` continues to serve as a global indicator; the new `marketing_campaign_recipients` table tracks per-campaign delivery status separately.
- The `MAIL_MARKETING_TEMPLATE_ID` environment variable is deprecated. Template assets are now stored as campaign assets in `backoffice_db`.
- Cloud Scheduler should be updated to call `/internal/campaigns/send-batch` instead of `/internal/mail-marketing/send-batch`.

### Template migration (Phase 3)

Two legacy file-based Handlebars templates have been migrated into campaign assets:

| Campaign               | Status      | Audience | Locales                           | Original template                                |
| ---------------------- | ----------- | -------- | --------------------------------- | ------------------------------------------------ |
| Christmas 2025         | `completed` | users    | en-US, pt-PT, es-ES, fr-FR, de-DE | `christmas-2025.{html,subject,text}.hbs`         |
| Welcome Intro Mythoria | `paused`    | leads    | pt-PT                             | `welcome-intro-mythoria.{html,subject,text}.hbs` |

The original `.hbs` files have been deleted from `notification-engine/src/templates/email/`. Their content now lives in `marketing_campaign_assets` rows in `backoffice_db`.

### Lead status association (Phase 3)

Leads whose `emailStatus` was `sent`, `open`, or `click` (from the legacy single-campaign flow) have been retroactively associated with the "Welcome Intro Mythoria" campaign via `marketing_campaign_recipients` records with `status = 'sent'`. This preserves historical delivery tracking without mutating the leads table.

### Migration SQL scripts

Located in `scripts/`:

- `phase3-step3.1-migrate-templates.sql` -- Creates campaign records and inserts template assets into `backoffice_db`.
- `phase3-step3.2-migrate-lead-statuses.sql` -- Creates recipient records for leads already emailed by the legacy system (requires `dblink` extension).

## Notification Engine integration (Phase 2)

The Notification Engine handles the actual email dispatch for campaigns. The admin portal proxies batch and sample send requests to the engine through the campaign API routes.

### Campaign dispatch endpoints (Notification Engine)

| Method | Path                                  | Description                                                               |
| ------ | ------------------------------------- | ------------------------------------------------------------------------- |
| `POST` | `/internal/campaigns/send-batch`      | Scheduler target: round-robin batch dispatch across all active campaigns. |
| `POST` | `/internal/campaigns/:id/send-batch`  | Manual trigger for a single campaign's batch.                             |
| `POST` | `/internal/campaigns/:id/send-sample` | Send a test email for a campaign locale.                                  |

### Backoffice DB access

The Notification Engine connects to `backoffice_db` (3-connection pool) to:

- Read campaign definitions, filter trees, and assets.
- Write batch records (`marketing_campaign_batches`) and per-recipient delivery records (`marketing_campaign_recipients`).
- Auto-transition campaigns to `completed` when no eligible recipients remain.

### Filter evaluation

The Notification Engine's `campaignFilterEvaluator` translates the JSONB filter tree into SQL WHERE clauses executed against `mythoria_db`. It applies default suppression, deduplicates against existing recipients, and returns eligible audience rows with name, email, and locale information.

### Key source files (Notification Engine)

| File                                      | Purpose                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `src/db/backofficeConnection.ts`          | Drizzle connection pool to `backoffice_db`                               |
| `src/db/backofficeSchema.ts`              | Campaign table schema (mirror of admin schema)                           |
| `src/services/campaignFilterEvaluator.ts` | Filter tree evaluation and audience resolution                           |
| `src/services/campaignDispatch.ts`        | Core dispatch logic with round-robin, template rendering, and compliance |
| `src/routes/campaigns.ts`                 | Express routes mounted at `/internal/campaigns`                          |

---

## Related documentation

- [Leads and Email Marketing](leadsAndEmail.md) — lead lifecycle and legacy email controls
- [API Reference](../api-reference.md) — full route map
- [Architecture](../ARCHITECTURE.md) — database topology and service boundaries
- [Notification Engine AGENTS.md](../../../notification-engine/AGENTS.md) — dispatch service details
