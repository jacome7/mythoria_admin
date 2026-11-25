# Print fulfillment operations

Updated: 2026-11-24

The tickets page exposes the WebApp-owned default provider and per-copy landed EUR ceiling. The default applies to future orders only; the initial provider is none. Set Admin `PRINT_INTERNAL_AUDIENCE` to the exact same OIDC audience as the WebApp setting, and set `WEBAPP_URL` to the WebApp base URL. WebApp `PRINT_ADMIN_SERVICE_ACCOUNT` must equal the email of the Admin runtime identity that signs the ID token. Admin Cloud Build leaves the audience empty by default, so configure its substitution during an authorized rollout. Local development also needs application default credentials for that identity; ordinary user credentials do not satisfy the WebApp service-account check. Configure the WebApp scheduler, private proof bucket and vendor prerequisites before enabling checkout or Lulu. See [the shared rollout runbook](../../docs/PRINT_FULFILLMENT.md).

The same settings card controls the optional hardcover credit price. Enable it and enter a positive whole-number price; no price is supplied by default. Disabling retains any previously saved price, and unrelated settings changes leave hardcover pricing unchanged. Customer availability also requires Lulu to be the default and its hardcover product to be configured. Successful settings changes record the actor, outcome, and previous and resulting provider, ceiling, and hardcover price in the Admin audit log.

New paid print tickets retain their print request ID. On the ticket, staff can select a provider, prepare or revise proof, inspect the current proof, put the order on hold, clear a hold, and refresh fulfillment. Lulu submission requires the current proof to pass QA and be emailed, a current quote, inbox review, and explicit confirmation of the total. The WebApp owns and enforces fulfillment state and financial limits; ticket status does not mean that a vendor has shipped or delivered an order.

For a held and unsubmitted order, staff can enter a shipping correction explicitly confirmed by the customer. Saving the correction retains the hold and invalidates the prior proof and quote. Vendor suggestions are not accepted automatically. Linked paid print tickets do not send the generic ticket-created or ticket-status emails: the proof email is handled by fulfillment, and closing a ticket does not establish delivery.

Manual orders are dispatched from the linked ticket to a printer partner using the frozen proof pair. Each dispatch reserves the order before calling Notification Engine with an idempotency key. A timeout or response without a confirmed sent status is treated as uncertain and must be investigated; do not resend automatically. The legacy story-page action is blocked for stories with linked paid print tickets, while unlinked legacy stories keep their previous workflow.

Ticket creation deduplicates requests carrying a print request ID using a transaction-scoped lock in backoffice_db. The fulfillment data itself remains in the WebApp-owned mythoria_db. Admin records command attempts in its audit log. This change requires no Admin schema migration.

## Printing costs

Open **Printing costs** under **Financials**. The range selector offers Last 7 days, Last 30 days, Last 90 days and Forever. The chart uses Lulu's job date in UTC and the request table uses the date the print request was placed. Forever uses monthly chart buckets. A request can fall into a different period from its supplier cost.

The table shows Lulu's tax-exclusive total in the original currency and its EUR equivalent when available. Requests handled by other providers have an untracked cost. The homepage **Revenue vs costs** chart subtracts the same recorded EUR totals and AI costs from revenue. Pending prices and conversions are flagged in the charts. A priced job can appear in the total while Lulu is awaiting payment.

The WebApp owns price capture, conversion and backfill. Apply its additive cost migration before rolling out these Admin routes. See [the shared rollout runbook](../../docs/PRINT_FULFILLMENT.md).
