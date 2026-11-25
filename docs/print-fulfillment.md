# Print fulfillment operations

Updated 2026-11-25.

The tickets page exposes the WebApp-owned default provider and per-copy landed EUR ceiling. The initial provider is **None / manual**, and changes apply to future orders. Set Admin `PRINT_INTERNAL_AUDIENCE` to the exact same OIDC audience as the WebApp setting, and set `WEBAPP_URL` to the WebApp base URL. WebApp `PRINT_ADMIN_SERVICE_ACCOUNT` must equal the email of the Admin runtime identity that signs the ID token. Configure the audience on the Admin runtime before switching WebApp checkout to paid print fulfillment. Cloud Build preserves the runtime value. Configure the WebApp scheduler, private proof bucket and vendor prerequisites before enabling checkout or Lulu. [Shared rollout runbook](https://github.com/jacome7/Mythoria-webapp/blob/master/docs/PRINT_FULFILLMENT.md)

Cloud Run uses the configured public Admin origin (`NEXTAUTH_URL` or `AUTH_URL`) to check browser requests for print settings, proof preparation, and dispatch. Keep that setting aligned with the Admin URL used by staff.

For local Admin-to-WebApp calls, set `PRINT_IMPERSONATE_SERVICE_ACCOUNT` to the same identity as WebApp `PRINT_ADMIN_SERVICE_ACCOUNT`. Local application default credentials need `iam.serviceAccounts.getOpenIdToken` for that identity. The override applies only in development and preserves the configured audience and Admin session checks.

The same settings card controls the optional hardcover credit price. To enable it, enter a positive whole-number price. Disabling it retains the previous price. A5 hardcover requires Lulu as the default and a configured A5 product. Square checkout requires physical proof approval. **None / manual** prepares orders for a print partner and accepts manual approval or a Lulu approval for the current environment. **Lulu** prepares a validated supplier quote and requires approval for its environment. The Admin audit log records the actor, outcome, and before-and-after values for successful settings changes.

New paid print tickets retain their print request ID. On the ticket, staff can select a provider, prepare or revise proof, inspect the current proof, put the order on hold, clear a hold, and refresh fulfillment. Lulu submission requires the current proof to pass QA and be emailed, a current quote, inbox review, and explicit confirmation of the total. The WebApp owns and enforces fulfillment state and financial limits. Review supplier shipping and delivery status in the fulfillment panel.

The fulfillment view shows the shipping snapshot for the paid order. For a held and unsubmitted order, staff can enter a shipping correction explicitly confirmed by the customer. Saving the correction retains the hold and invalidates the prior proof and quote. Fulfillment sends the order confirmation with the proof and suppresses generic ticket-created and ticket-status emails for linked paid orders.

For manual orders, review the inbox and proof version, then send the frozen proof pair to an active printer partner from the linked ticket. Admin reserves that proof version before calling Notification Engine with an idempotency key, both object generations, and both SHA-256 digests. Investigate timeouts and responses without a confirmed sent status before taking further action.

For an open legacy print ticket, choose **Open story for legacy print** on the ticket and use the story's print action. The server verifies that the ticket belongs to this story, has no paid print link, and predates any paid reservations. The general story-page action rejects stories with paid reservations, including those awaiting tickets. Both legacy entry points use the current story PDFs.

Paid checkout creates the linked ticket at `POST /api/tickets/paid-print` using the Admin API key and `orderDetails.fulfillmentVersion: 1`. Admin returns the ticket ID and matching print request ID before WebApp completes its checkout. Ticket creation deduplicates linked requests using a transaction-scoped lock in `backoffice_db`. The legacy `/api/tickets` endpoint retains its existing manual and email workflow for unversioned callers. The fulfillment data remains in the WebApp-owned `mythoria_db`. Admin records command attempts and manual dispatch outcomes in its audit log.

## Premium square hardcover

If generation stopped before publication, use the story workflow retry action in Admin. For a premium story, Admin sends an authenticated request to SGW to resume the original run and records the attempt. This retains its revision, completed illustration stages and original charge. After publication, use the correction process below.

Open **Read Premium Edition** on a published story to inspect its verified cover, numbered pages, back cover and selectable text. Opening and closing pages with preview artwork also offer **Preview Page Artwork**. The reader and its images require the Admin session and use the current manifest’s pinned revision.

Use **Request one staff print proof** on that story while public checkout is closed or open. Enter the staff ship-to address and create the ticket. A retry for the same story and revision opens the existing ticket. It prepares one square hardcover with no credit charge or customer email. For a manual printer, review both PDFs from the ticket then choose the printer and confirm **Send print request**. For Lulu, use **Prepare for Lulu** and review the validated files and quote. Confirm the landed total to **Submit one proof to Lulu**. A positive per-copy limit applies to Lulu. The chosen supplier receives the proof only after explicit release from the ticket.

For a paid square ticket, confirm the purchaser received the current proof and check the reply inbox before either release action. Manual dispatch includes the frozen shipping address and quantity with the exact proof files. For Lulu, also verify tracked shipping and the landed quote against the per-copy limit, then enter the total and use **Release square order to Lulu**. The server verifies the proof version, supplier validation and refreshed quote before creating the job. Changing the provider versions the proof but retains the ticket’s edition.

Place the order on hold before a correction. After the corrected direct successor is published, enter its revision ID and the reason under **Bind published correction**. The ticket keeps its hold. Clearing it queues the new proof, quote and customer email. Review the new proof and check the inbox again before release. The audit records the operator, predecessor, successor and reason. For an uncertain or submitted job, use **Refresh order** and reconcile its supplier references before handling cancellation or replacement.

## Lulu payment, delivery and support

The ticket shows the current quote, Lulu job ID, supplier status and available tracking data. Use **Refresh order** to read the order again from Lulu. Resolve unpaid jobs in the Lulu Developer Portal. After checking supplier records, record cancellation, replacement, supplier credit and any separate Mythoria customer refund in the ticket.

## Printing costs

Open **Printing costs** under **Financials**. The range selector offers Last 7 days, Last 30 days, Last 90 days and Forever. The chart uses Lulu's job date in UTC and the request table uses the date the print request was placed. Forever uses monthly chart buckets. A request can fall into a different period from its supplier cost.

The table shows Lulu's tax-exclusive total in the original currency and its EUR equivalent when available. Requests handled by other providers have an untracked cost. The homepage **Revenue vs costs** chart subtracts the same recorded EUR totals and AI costs from revenue. Pending prices and conversions are flagged in the charts. A priced job can appear in the total while Lulu is awaiting payment.

The WebApp owns price capture, conversion and backfill. Apply its additive cost migration, `0055_print_fulfillment_costs`, before rolling out these Admin routes. See [the shared rollout runbook](https://github.com/jacome7/Mythoria-webapp/blob/master/docs/PRINT_FULFILLMENT.md).

## Admin-Initiated Lulu Orders & Lifecycle Controls

- **From Story Pages (`/stories/[storyId]`)**: Both `PremiumStoryActions` (for published 8.5×8.5" Premium Square books) and `StoryActionPanel` (for published Standard A5 books) include collapsible **Order / Dispatch via Lulu** panels (`AdminLuluOrderForm` -> `POST /api/admin/stories/[storyId]/lulu-print`) supporting `1–10` copy admin print-and-ship orders and single-copy staff proofs.
- **From Legacy Print Tickets (`/tickets/[id]`)**: Open or in-progress unlinked `print_request` tickets display **Upgrade & Dispatch via Lulu Fulfillment**, linking a newly prepared `print_request` / `print_fulfillments` pair back to the existing ticket via `POST /api/tickets/admin-print`.
- **In-Ticket Operations (`PrintFulfillment`)**: Supports immediate proof/quote preparation (`runImmediately: true` with 4-second polling while active), proof cover-dimension and normalized page-count display, quote cost breakdowns, structured tracking URLs and carrier IDs, `UNPAID` / `PRODUCTION_DELAYED` / `uncertain` operational alerts, and **Cancel Lulu job** (requires an audit reason).
- **Printing Costs (`/printing-costs`)**: Displays `Quoted (incl. tax)` alongside `Cost excl. tax` and badged vendor statuses.
