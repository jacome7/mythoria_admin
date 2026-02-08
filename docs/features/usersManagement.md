# Users management

_Last updated: 2026-02-08_

## Context

User administration covers list search/filter (`src/app/users/page.tsx`) and user detail operations (`src/app/users/[id]/page.tsx`), including story history and manual credit adjustments.

## UI workflow

1. Admin opens `/users` and filters by search query, registration window, and pagination size.
2. List fetches `/api/admin/users` and renders key attributes (name, email, registration date, activity).
3. Selecting a user opens `/users/[id]`.
4. Detail view loads profile, stories, and credit ledger in parallel.
5. Admin can assign credits (voucher/support compensation) through a guarded action.

## Backend and API touchpoints

- `GET /api/admin/users`
- `GET /api/admin/users/[id]`
- `GET /api/admin/users/[id]/stories`
- `GET /api/admin/users/[id]/credits`
- `POST /api/admin/users/[id]/assign-credits`
- `GET /api/admin/users/registrations`

## Database structure

- **mythoria_db**
  - `authors`
  - `stories`
  - `credit_ledger`
  - `author_credit_balances`
  - `credits` (legacy/compat rows)
