# Survey analytics (Surveys / Customer Research)

Last updated: 2026-10-28. Cross-service contract: `../../docs/SURVEYS.md`. Requirements: PRD sections 9.5, 11, 12 (ADM-001..016).

Analysis and monitoring only; surveys are authored in code and published from the WebApp. Study setup (`/surveys/studies`) is documented with the studies module.

## Data sources

| Data                                                                                                                                                                                    | Database        | Access                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `surveys`, `survey_versions`, `survey_studies`, `survey_study_cohorts`, `survey_invitations`, `survey_responses`, `survey_answers`, `survey_text_answers`, `survey_reward_entitlements` | `mythoria_db`   | Read-only. Schema copied by `npm run sync-mythoria-db-schema` (`src/db/schema/surveys.ts`).                          |
| `payment_orders`, `stories`, `product_generation_requests` (`funding_source`)                                                                                                           | `mythoria_db`   | Read-only (business outcomes).                                                                                       |
| `marketing_campaigns`, `marketing_campaign_recipients`                                                                                                                                  | `backoffice_db` | Read-only, joined at application level (campaign ids come from `survey_study_cohorts`).                              |
| `survey_admin_roles`, `admin_audit_events`                                                                                                                                              | `backoffice_db` | Owned by Admin (`src/db/schema/survey-rbac.ts`, `src/db/schema/admin-audit.ts`; both listed in `drizzle.config.ts`). |

The sync script now skips WebApp-only types `sample-book.ts` and `story-template.ts` (they import the WebApp `@/constants/*` alias and break the Admin typecheck).

## Access control

Roles live in `backoffice_db.survey_admin_roles` and are independent from referral roles.

| Role             | Permissions                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `survey_viewer`  | `survey:view` (aggregated results, funnel, rewards, outcomes, definitions) |
| `survey_analyst` | view + `survey:analyze` (free-text answers, CSV export)                    |
| `survey_manager` | view + analyze + `survey:manage`                                           |
| `super_admin`    | all survey permissions                                                     |

`requireSurveyPermission(permission)` (`src/lib/surveys/permissions.ts`) throws `SurveyAdminError` with status 401 (not signed in) or 403 (no matching role). Pages render a 403 notice; API routes return 401/403 JSON.

### Granting a role (no UI)

```sql
-- backoffice_db. The person must already exist in managers (sign in once / add via /managers).
INSERT INTO survey_admin_roles (manager_id, role, granted_by)
SELECT manager_id, 'survey_analyst', 'you@mythoria.pt'
FROM managers
WHERE lower(email) = lower('person@mythoria.pt')
ON CONFLICT (manager_id, role) DO NOTHING;

-- Revoke
DELETE FROM survey_admin_roles
WHERE role = 'survey_analyst'
  AND manager_id = (SELECT manager_id FROM managers WHERE lower(email) = lower('person@mythoria.pt'));
```

Valid roles: `survey_viewer`, `survey_analyst`, `survey_manager`, `super_admin` (enforced by a CHECK constraint).

## Audit log

`logAdminAudit({ actorEmail, action, entityType, entityId?, metadata? })` (`src/lib/audit.ts`) inserts into `admin_audit_events` and never throws. Recorded actions:

- `survey.export` (entity `survey_version`): filters, `includeText`, `rowCount`.
- `survey.text.view` (entity `survey_version`): filters, page, rows returned, total.

```sql
SELECT created_at, actor_email, action, entity_id, metadata
FROM admin_audit_events
WHERE entity_type = 'survey_version'
ORDER BY created_at DESC;
```

## Routes

UI: `/surveys` (list), `/surveys/[surveyVersionId]` (Overview, Questions, Open feedback, Export, Definition tabs), `/surveys/insights/[studyId]` (study overview, cross-cohort comparison, reward ops, 7/30-day outcomes).

API (all under `/api/admin/surveys`; the `studies/**` subtree belongs to study management):

| Route                                                                                         | Permission       |
| --------------------------------------------------------------------------------------------- | ---------------- |
| `GET /` (filters `surveyId, studyId, campaignId, status, cohort, from, to`)                   | view             |
| `GET /[surveyVersionId]/results` (`studyId, cohort, respondentLocale, from, to, locale`)      | view             |
| `GET /[surveyVersionId]/text` (`questionId, cohort, studyId, search, page`)                   | analyze, audited |
| `GET /[surveyVersionId]/export` (`studyId, cohort, from, to, includeText`) streams `text/csv` | analyze, audited |
| `GET /studies-analytics/[studyId]/overview`                                                   | view             |
| `GET /studies-analytics/[studyId]/rewards`                                                    | view             |
| `GET /studies-analytics/[studyId]/outcomes?windowDays=7                                       | 30`              | view |
| `GET /studies-analytics/[studyId]/comparison`                                                 | view             |

Date filters (`from`/`to`) apply to `survey_invitations.created_at` (audience snapshot date), so funnel and question results always describe the same invited population.

## Metric and denominator rules

- Funnel: eligible (all snapshot invitations incl. holdout) -> invited (not holdout) -> sent (invite-campaign recipients with status `sent`) -> opened (survey opened) -> started -> completed. **Delivered is not tracked** and is labelled as such. No linked invite campaign means `sent` is "not tracked".
- `response_rate` = completed / sent (falls back to invited when no send data, labelled in the payload); also reported against invited. Delivery failures (`failed`/`skipped` recipients) are shown separately.
- `completion_rate` = completed / started. `survey_visit_rate` = opened / invited. Completion duration is the median of `survey_responses.duration_ms` where measured.
- Per question: `submittedN` (eligible), `shownN` (response `shown_question_ids` contains the question), `answeredN` (valid, excludes N/A), `notApplicableN`, `skippedN`; `shownN = answeredN + notApplicableN + skippedN`. Branch questions (`visibleWhen`) never count hidden respondents as skipped (`notShownN` reported). Selection rate = option respondents / `answeredN` (valid respondents shown). Ratings/numeric means exclude N/A and skipped. When `shown_question_ids` is missing, shown is estimated from answer presence and flagged `shownEstimated`.
- Persistence assumptions (WebApp submit is the source of truth): one `survey_answers` row per selected option (choice) or per numeric value; N/A answers have `is_not_applicable = true`; shown-but-unanswered optional questions have `is_skipped = true` (a missing row for a shown question is also treated as skipped); free text only in `survey_text_answers`.
- Business outcomes (7/30 days): groups are respondents (window from `submitted_at`), invited non-respondents and holdout (window from invitation `created_at`). Only users whose full window has elapsed are counted. First paid purchase = first-ever `payment_orders` row with `status = 'completed'` and `amount > 0`, among users without a paid purchase at snapshot. Repeat creation = a published story inside the window. Premium attach (paid) = completed `product_generation_requests` with `funding_source = 'credits'`; `survey_reward` runs are reported separately and **never** counted as paid. Pricing-page visits and reading depth are GA4-only and shown as unavailable.
- Cross-cohort comparison: dimensions `primary_intent`, `preferred_output`, `payment_model_preference`, `repeat_trigger` (`open_improvement` is excluded). Each cohort keeps its own wording, option set and denominators; differing option sets are flagged and never merged.
- Surveys are self-selected samples; every analytics page carries that caveat. `C09`-style intention scores are not NPS.

## CSV export

Columns: `response_id, survey_id, version, cohort_key, locale, submitted_at, question_id, dimension, option_id, value_numeric, is_not_applicable, is_skipped`, plus `text_kind, text_value` only when `includeText=true`. No email addresses or author ids are exported. Cells starting with `=`, `+`, `-`, `@`, TAB or CR are prefixed with `'` (`src/lib/csv.ts`).

## Rollout notes

- Backoffice migration must include `survey_admin_roles` and `admin_audit_events` (generate from `drizzle.config.ts`; do not hand-edit).
- Existing roles are not backfilled; grant yourself a role with the SQL above before opening `/surveys`.
