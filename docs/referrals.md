# Referral administration v1

Owner lists in Overview and Owners show all-time Visits, Registrations and Revenue. The canonical WebApp owner-list response supplies `visits`, `registrations`, and `revenueCents`. Visits count consented visit records; registrations count registration funnel events; revenue sums gross purchase amounts for live commissions, before refund adjustments, matching the owner summary. Missing metrics from an older WebApp display as unavailable, not zero. Deploy the updated WebApp before Admin to populate the new columns.

Configuration update 2026-09-12: `.env.local` and `.env.example` now include the referral audience and optional MCP keys. For local Admin-to-WebApp calls, use `WEBAPP_URL=http://localhost:3000` and `REFERRAL_INTERNAL_AUDIENCE=http://localhost:3000` in both services. Admin's development-only `REFERRAL_IMPERSONATE_SERVICE_ACCOUNT` must match WebApp's `REFERRAL_ADMIN_SERVICE_ACCOUNT`. Local ADC must have `iam.serviceAccounts.getOpenIdToken` on that service account (the Service Account OpenID Connect Identity Token Creator role provides this permission). No service-account key or authentication bypass is used. The override is ignored in production. Restart local servers after configuration changes if Next.js does not reload them.

The live Admin identity was verified as `803421888801-compute@developer.gserviceaccount.com`. Cloud Build explicitly attaches that identity and uses the verified WebApp URL `https://mythoria-webapp-x2qrlilyyq-od.a.run.app` as the shared audience. `scripts/deploy.ps1` and `scripts/deploy-production.ps1` inherit these runtime substitutions. A dedicated Admin identity can replace the current identity by changing the Admin attachment and WebApp trust together.

On 2026-09-12, the operator approved creation of separate Secret Manager credentials `REFERRAL_MCP_MANAGEMENT_KEY` and `REFERRAL_MCP_FINANCE_KEY`. Both were provisioned, and Cloud Build now binds their latest versions by default. The deployment scripts inherit these bindings; `-ReferralMcp` remains compatible but is no longer required. Do not put secret values in substitutions or source control. Configure authorized MCP clients with the appropriate credential through a secure channel: management permits viewing and owner/code management; finance permits viewing, review and settlement operations. Empty credentials disable the corresponding access path. The deployment does not distribute credentials to clients or grant referral roles to human Admin users.

Updated 2026-09-12: the referral page handles missing permissions with a "Referral access required" message instead of an uncaught runtime error. Expired sessions redirect to sign-in. API permission checks remain unchanged; unexpected backend errors still propagate.

If an authenticated manager cannot open `/referrals`, verify that their sign-in email matches a `managers` record with an explicit `referral_admin_roles` binding. Migrations create the role table without granting access. Assign only the approved role (`referral_viewer`, `referral_manager`, `finance`, or `super_admin`) to the identified manager and record the identified grantor in `granted_by`. Do not use the manager's legacy free-form role or a development bypass to grant referral privileges. Local development can use the shared database, so role assignments also affect other services using that database.

Database update 2026-09-11: referral roles and the ownership-only migration are applied to `backoffice_db`. Credit schemas are excluded from Admin migration generation because WebApp owns them. Legacy backoffice credit data was preserved. See [the database operation record](../../docs/REFERRALS_DATABASE_MIGRATION_2026-09-11.md); do not replay old mixed-ownership migrations.

Updated 2026-09-09. See [the cross-service runbook](../../docs/REFERRALS.md) for the complete API, commercial policy, settlement and rollout contracts.

The seven referral pages live under /referrals. The REST facade under /api/admin/referrals resolves the authenticated manager's role in backoffice_db, checks permissions and calls the canonical WebApp domain with a Google OIDC service identity. There is no parallel commission calculator or direct financial writer in Admin.

Explicit role rows are required in referral_admin_roles. Roles are referral_viewer, referral_manager, finance and super_admin. A manager's existing free-form role field does not grant referral access. Review scripts/referral-roles.sql, generated from the new Drizzle schema, before applying it to backoffice_db; ignored historical migration files are not a portable deployment chain. Seed no privileges without an identified grantor.

REFERRAL_INTERNAL_AUDIENCE and existing WEBAPP_URL select the canonical backend. REFERRAL_MCP_MANAGEMENT_KEY and REFERRAL_MCP_FINANCE_KEY are distinct Secret Manager keys. Legacy MCP credentials receive no referral tools. SSE sessions are bound to the initiating principal; each authorized tool uses the same WebApp API as the UI. Run npm run sync-mythoria-db-schema after upstream schema changes, followed by format/lint/typecheck/build/test.

## Production release — 2026-09-12

Verified revision: `mythoria-admin-00088-wz5`; image source: `12e16f56bef4dd3e77e851decc570e5f18b2788b`. The revision passed HTTP 200 health and serves 100% of traffic. The release includes the referral implementation and the other reviewed local changes. See the WebApp's `docs/referrals-release-2026-09-12.md` for cross-service proof and remaining operating work.

Referral Scheduler jobs and the external signup/Checkout/email/settlement journey matrix remain outstanding. Package audit warnings remain documented in that release record. Runtime health is a bounded check, not proof of payment or email delivery.

Both MCP secrets are deployed and their distinct management/finance permissions and authenticated WebApp reads were verified on the production URL. Cloud Build now explicitly promotes latest traffic after deployment. Recursive Docker test exclusions and explicit TypeScript test globals keep clean production builds consistent with local validation.
