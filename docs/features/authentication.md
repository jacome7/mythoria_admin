# Authentication surfaces

_Last updated: 2026-02-08_

## Context

The admin authentication UX is exposed in `src/app/auth/signin/page.tsx` and `src/app/auth/error/page.tsx`, while enforcement is handled globally by middleware and NextAuth configuration.

## UI workflow

1. Unauthenticated access to protected routes redirects to sign-in.
2. Sign-in page starts Google OAuth through NextAuth.
3. Domain allowlist checks validate authorized company domains.
4. Error page communicates OAuth/session failures with retry navigation.

## Backend and API touchpoints

- `GET/POST /api/auth/[...nextauth]`
- `src/auth.ts` for provider/session config.
- `src/middleware.ts` for route protection logic.

## Database structure

- **backoffice_db** (NextAuth adapter tables)
  - `user`
  - `account`
  - `session`
  - `verification_token`
