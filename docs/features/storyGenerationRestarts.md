# Story generation restarts

_Last updated: 2026-08-04_

## Purpose

Admin story restart is a corrective operation for a generation error. It is not a new customer purchase:

- the author is never charged again;
- the durable request records `credits_spent = 0`;
- no credit-ledger debit is created;
- a permanent dispatch failure does not unpublish the last usable story;
- successful regeneration sends the customer a fresh `story-created` email.

The Admin story UI route, failed-workflow retry route, and `restart_story_workflow` MCP tool all call the same `src/services/story-generation-restart.ts` dispatcher.

## Durable dispatch and ownership

`mythoria_db.story_generation_requests` is the authoritative dispatch queue. The dispatcher:

1. validates that the story exists and is `writing` or `published`;
2. inserts a new request with a new `run_id`, `credits_spent = 0`, and `status = queued`;
3. leaves the story lifecycle status unchanged and sets `story_generation_status = queued`;
4. atomically claims the request as `publishing` and attempts Pub/Sub delivery;
5. records `published` plus the Pub/Sub message id, or `retrying` plus the bounded error and next attempt time.

The existing WebApp outbox drain retries `queued`, `retrying`, and abandoned `publishing` requests. After the final failed attempt it records `delivery_failed` and sets only `story_generation_status = failed` for a zero-credit Admin restart. Customer-paid initial generation keeps its existing idempotent credit compensation behavior.

The producer does not create `workflows_db.story_generation_runs`. SGW owns that runtime record. This avoids a non-atomic dual-database write and the former producer-consumer ownership conflict.

## SGW claim semantics

The originally proposed queued-row `UPDATE` is necessary but incomplete because normal WebApp requests do not pre-create a workflow run. SGW therefore uses one conditional PostgreSQL upsert:

- insert the missing run directly as `running`; or
- on `run_id` conflict, promote it only when the same story still has `status = queued`;
- return no row for an already `running` or terminal run, which is the duplicate case;
- return HTTP 409 when the same `run_id` belongs to another story.

Pub/Sub and Eventarc are at-least-once transports. Re-delivery of the same `{ storyId, runId }` is safe because only one execution can obtain the claim.

## Customer email after regeneration

SGW waits for its `story-created` Notification Engine request when a story-generation run completes. It sends both identifiers:

- `storyId` identifies the updated story and template data;
- `entityId = runId` is the notification idempotency key.

Notification Engine keeps `story-created` as a send-once template, now interpreted as once per generation run. Repeated completion callbacks for one run do not duplicate email, while a new regeneration run sends the email again. Older callers without an explicit `entityId` retain story-level deduplication.

## API states

The Admin route and MCP result expose the durable dispatch state:

- `published`: Pub/Sub accepted the request;
- `publishing`: another dispatcher owns the request;
- `retrying`: immediate publish failed and the durable drain will retry;
- `delivery_failed`: retry budget exhausted; stored on the durable request and reflected by `stories.story_generation_status = failed`.

The REST route returns HTTP 202 with `dispatchFailed: true` for `retrying`. This means the corrective request was durably accepted, not that generation completed.

## Verification

Automated coverage is split at the service boundaries:

- Admin story UI, workflows retry UI, and MCP tests prove all surfaces call the shared dispatcher.
- Admin dispatcher tests prove persistence precedes the stable Pub/Sub `{ storyId, runId }` publish and that failure becomes `retrying` without a credit charge.
- SGW tests prove the conditional claim and that workflow asset-persistence calls precede completion.
- WebApp tests prove a zero-credit permanent dispatch failure preserves the published story and creates no refund ledger row.
- Notification Engine and SGW tests prove `story-created` deduplication uses `runId` and is attempted again for a new run.

After deployment, run one UI restart and one MCP restart against controlled error stories. For each path verify:

1. one `story_generation_requests` row with `credits_spent = 0`;
2. Pub/Sub message id and a Google Workflow execution for the same `run_id`;
3. SGW claim returns `claimed: true`, followed by outline/chapter/image persistence logs;
4. the run becomes `completed` and the story assets reference the regenerated files;
5. one new `story-created` notification exists with `entity_id = run_id` and reaches the customer;
6. the author's credit balance and credit ledger are unchanged.

Do not declare the live end-to-end check complete from unit tests alone; Eventarc, Cloud Workflows, Cloud SQL, Storage, and email delivery require post-deployment evidence.

## Deployment order

Deploy the WebApp failure semantics and Notification Engine idempotency override first, then SGW, then Admin. No database migration is required: `story_generation_requests` already exists and Admin only adds the synchronized Drizzle schema mirror.
