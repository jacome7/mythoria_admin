# Print fulfillment operations

Updated 2026-11-24.

The tickets page exposes the WebApp-owned default provider and per-copy landed EUR ceiling. The initial provider is **None / manual**, and changes apply to future orders. Set Admin `PRINT_INTERNAL_AUDIENCE` to the exact same OIDC audience as the WebApp setting, and set `WEBAPP_URL` to the WebApp base URL. WebApp `PRINT_ADMIN_SERVICE_ACCOUNT` must equal the email of the Admin runtime identity that signs the ID token. Configure the audience on the Admin runtime before switching WebApp checkout to paid print fulfillment. Cloud Build preserves the runtime value. Local development needs application default credentials for the configured service identity. Configure the WebApp scheduler, private proof bucket and vendor prerequisites before enabling checkout or Lulu. [Shared rollout runbook](https://github.com/jacome7/Mythoria-webapp/blob/master/docs/PRINT_FULFILLMENT.md)

The same settings card controls the optional hardcover credit price. To enable it, enter a positive whole-number price. Disabling it retains the previous price. A5 hardcover requires Lulu as the default and a configured A5 product. The approved square profile can be sold with the default set to None. The Admin audit log records the actor, outcome, and before-and-after values for successful settings changes.

New paid print tickets retain their print request ID. On the ticket, staff can select a provider, prepare or revise proof, inspect the current proof, put the order on hold, clear a hold, and refresh fulfillment. Lulu submission requires the current proof to pass QA and be emailed, a current quote, inbox review, and explicit confirmation of the total. The WebApp owns and enforces fulfillment state and financial limits. Review supplier shipping and delivery status in the fulfillment panel.

The fulfillment view shows the shipping snapshot for the paid order. For a held and unsubmitted order, staff can enter a shipping correction explicitly confirmed by the customer. Saving the correction retains the hold and invalidates the prior proof and quote. Fulfillment sends the order confirmation with the proof and suppresses generic ticket-created and ticket-status emails for linked paid orders.

For manual orders, review the inbox and proof version, then send the frozen proof pair to an active printer partner from the linked ticket. Admin reserves that proof version before calling Notification Engine with an idempotency key, both object generations, and both SHA-256 digests. Investigate timeouts and responses without a confirmed sent status before taking further action.

For an open legacy print ticket, choose **Open story for legacy print** on the ticket and use the story's print action. The server verifies that the ticket belongs to this story, has no paid print link, and predates any paid reservations. The general story-page action rejects stories with paid reservations, including those awaiting tickets. Both legacy entry points use the current story PDFs.

Paid checkout creates the linked ticket at `POST /api/tickets/paid-print` using the Admin API key and `orderDetails.fulfillmentVersion: 1`. Admin returns the ticket ID and matching print request ID before WebApp completes its checkout. Ticket creation deduplicates linked requests using a transaction-scoped lock in `backoffice_db`. The legacy `/api/tickets` endpoint retains its existing manual and email workflow for unversioned callers. The fulfillment data remains in the WebApp-owned `mythoria_db`. Admin records command attempts and manual dispatch outcomes in its audit log.

## Premium square hardcover

If generation stopped before publication, use the story workflow retry action in Admin. For a premium story, Admin sends an authenticated request to SGW to resume the original run and records the attempt. This retains its revision, completed illustration stages and original charge. After publication, use the correction process below.

Square hardcover is released from the paid ticket to Lulu. Review the edition and exact proof pair, confirm the purchaser received the current proof, check the reply inbox, and verify tracked shipping and the landed quote against the per-copy limit. Enter the EUR total and use **Release square order to Lulu**. The server checks the proof version, supplier validation and refreshed quote before creating a job.

Place the order on hold before a correction. After the corrected direct successor is published, enter its revision ID and the reason under **Bind published correction**. The ticket keeps its hold. Clearing it queues the new proof, quote and customer email. Review the new proof and check the inbox again before release. The audit records the operator, predecessor, successor and reason. For an uncertain or submitted job, use **Refresh order** and reconcile its supplier references before handling cancellation or replacement.
