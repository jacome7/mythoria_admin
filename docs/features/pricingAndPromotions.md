# Pricing and promotion codes

_Last updated: 2026-02-08_

## Context

Commercial controls are split between credit package catalog management (`/pricing`) and marketing promotions (`/promotion-codes`).

## UI workflow

### Credit packages

1. `/pricing` lists packages and active/inactive state.
2. `/pricing/add` creates new packages.
3. `/pricing/edit/[id]` edits package metadata, credits, and price points.
4. Toggle action activates/deactivates packages without deletion.

### Promotion codes

1. `/promotion-codes` provides searchable code inventory.
2. `/promotion-codes/new` creates new codes with validity windows and limits.
3. `/promotion-codes/[id]` shows status plus redemption history.
4. Toggle action enables/disables a code while retaining history.

## Backend and API touchpoints

- `GET/POST /api/credit-packages`
- `GET/PUT /api/credit-packages/[id]`
- `POST /api/credit-packages/[id]/toggle`
- `GET/POST /api/admin/promotion-codes`
- `GET/PUT/DELETE /api/admin/promotion-codes/[id]`
- `POST /api/admin/promotion-codes/[id]/toggle`
- `GET /api/admin/promotion-codes/[id]/redemptions`

## Database structure

- **mythoria_db**
  - `credit_packages`
  - `promotion_codes`
  - `promotion_code_redemptions`
  - `credit_ledger` (downstream redemption credit events)
