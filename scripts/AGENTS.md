# scripts Directory - Agent Notes

## Overview

- PowerShell operational scripts for deployment, logging, and status reporting.
- TypeScript utilities executed via `tsx` for schema synchronization and service diagnostics.

## Usage Guidelines

- Prefer npm script wrappers when available (`npm run sync-workflows-schema`, `npm run sync-mythoria-db-schema`).
- For direct PowerShell execution use: `pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/<script>.ps1`.
- TypeScript helpers should be run with environment variables loaded (`tsx -r dotenv/config ./scripts/<file>.ts`).
- Do not store secrets in scripts; rely on environment variables or Secret Manager bindings.

## Safety Checks

- Deployment scripts assume authenticated gcloud CLI and configured project `oceanic-beach-460916-n5`.
- Schema sync scripts modify database structures; confirm target environment (dev/staging only) before running.
- Logging and status scripts may hit production services; ensure read-only intent and provide change notes in PRs when adjusting query scopes.

_Last refreshed: September 20, 2025_
