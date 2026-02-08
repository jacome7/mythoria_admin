# Notification management

_Last updated: 2026-02-08_

## Context

Notification operations span listing entities (`/notifications`) and editing rule/template details (`/notifications/rules/[id]`, `/notifications/templates/[id]`).

## UI workflow

1. Main page loads rules, templates, and channels.
2. Operators can pause/resume rules and channels directly from the list.
3. Rule editor allows create/update with template/channel bindings.
4. Template editor manages subject/body variants and publishing state.

## Backend and API touchpoints

- `GET/POST /api/notifications/rules`
- `GET/PUT/DELETE /api/notifications/rules/[id]`
- `GET/POST /api/notifications/templates`
- `GET/PUT/DELETE /api/notifications/templates/[id]`
- `GET/POST /api/notifications/channels`
- `PUT /api/notifications/channels/[id]`

## Database structure

Notification metadata is managed by the downstream Notification Engine service. The admin portal stores minimal local config and forwards CRUD calls via service APIs.
