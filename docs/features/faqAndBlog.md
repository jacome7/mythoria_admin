# FAQ and blog content management

_Last updated: 2026-02-08_

## Context

Editorial tooling includes FAQ maintenance (`/faq`) and blog authoring (`/blog`, `/blog/new`, `/blog/[id]`) with translation support.

## UI workflow

### FAQ

1. FAQ page has tabs for sections and entries.
2. Editors create/update/delete sections and entries.
3. Translation actions trigger single-entry or bulk translation jobs.
4. Polling updates translation job status until completion.

### Blog

1. Blog list supports filtering and management operations.
2. New/edit pages provide MDX editing with preview endpoint integration.
3. Translation action generates localized variants.
4. Publish action updates publication status.

## Backend and API touchpoints

- FAQ routes:
  - `GET/POST /api/faq/sections`
  - `GET/PUT/DELETE /api/faq/sections/[id]`
  - `GET/POST /api/faq/entries`
  - `GET/PUT/DELETE /api/faq/entries/[id]`
  - `POST /api/faq/entries/[id]/translate`
  - `POST/GET /api/faq/entries/bulk-translate`
- Blog routes:
  - `GET/POST /api/admin/blog`
  - `GET/PUT/DELETE /api/admin/blog/[id]`
  - `POST /api/admin/blog/[id]/publish`
  - `POST /api/admin/blog/mdx/preview`
  - `POST /api/admin/blog/translate`

## Database structure

- **mythoria_db**
  - `faq_sections`
  - `faq_entries`
  - `blog_posts`
  - `blog_post_translations`
