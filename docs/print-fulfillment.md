# Print fulfillment operations

For the manager's step-by-step procedure, field requirements and recovery paths, see [Submit a physical book to Lulu](how-to/submit-a-lulu-print-order.md). See also the [manager experience review](lulu-manager-experience.md).

Updated 2026-11-26.

### Order entry and delivery

Use **Order a printed copy** on a published story or **Upgrade this print ticket** on the original legacy ticket. For a gift, the purchaser reviews the proof and the ship-to recipient receives the parcel. Staff can reuse destinations saved under their own Admin login. Apply the [staff destination migration](../scripts/staff-print-destinations-migration.sql) to the Admin backoffice database before using the address book. Saved destinations omit tax IDs. Removing an address leaves existing orders intact.

If a create response is lost, reopen the form in the same browser and check the previous request. Review any possible matches before creating a separate shipment. On a held ticket compare the entered and suggested fields, confirm the correction and save it. Clearing the hold queues a replacement proof and quote.

Open **Tickets > Print orders** to work through linked orders and legacy tickets. Search by title or order reference, then select a purpose or next action to narrow the results. Next-action counts reflect the current title/reference and purpose filters across all pages. A row opens the original ticket. Expand **Order states** to see the support ticket, fulfillment, and supplier statuses behind the displayed next action. The queue uses saved summaries. Open the ticket to review proofs or perform supplier actions. Use **Assign to me** on an unassigned ticket to take ownership, and **Release ownership** to return your ticket to **Unassigned**.

**Tickets > Print settings** exposes the WebApp-owned default provider and per-copy landed EUR ceiling. The initial provider is **None / manual**, and changes apply to future orders. Set Admin `PRINT_INTERNAL_AUDIENCE` to the exact same OIDC audience as the WebApp setting, and set `WEBAPP_URL` to the WebApp base URL. WebApp `PRINT_ADMIN_SERVICE_ACCOUNT` must equal the email of the Admin runtime identity that signs the ID token. Configure the audience on the Admin runtime before switching WebApp checkout to paid print fulfillment. Cloud Build preserves the runtime value. Configure the WebApp scheduler, private proof bucket and vendor prerequisites before enabling checkout or Lulu. [Shared rollout runbook](https://github.com/jacome7/Mythoria-webapp/blob/master/docs/PRINT_FULFILLMENT.md)

Cloud Run uses the configured public Admin origin (`NEXTAUTH_URL` or `AUTH_URL`) to check browser requests for print settings, proof preparation, and dispatch. Keep that setting aligned with the Admin URL used by staff.

For local Admin-to-WebApp calls, set `PRINT_IMPERSONATE_SERVICE_ACCOUNT` to the same identity as WebApp `PRINT_ADMIN_SERVICE_ACCOUNT`. Local application default credentials need `iam.serviceAccounts.getOpenIdToken` for that identity. The override applies only in development and preserves the configured audience and Admin session checks.

The same settings card controls the optional hardcover credit price. To enable it, enter a positive whole-number price. Disabling it retains the previous price. A5 hardcover requires Lulu as the default and a configured A5 product. Square checkout requires physical proof approval. **None / manual** prepares orders for a print partner and accepts manual approval or a Lulu approval for the current environment. **Lulu** prepares a validated supplier quote and requires approval for its environment. The Admin audit log records the actor, outcome, and before-and-after values for successful settings changes.

New paid print tickets retain their print request ID. On the ticket, staff can select a provider, prepare or revise proof, inspect the current proof, put the order on hold, clear a hold, and refresh fulfillment. Lulu submission requires the current proof to pass QA and be emailed, a current quote, inbox review, and explicit confirmation of the total. The WebApp owns and enforces fulfillment state and financial limits. Review supplier shipping and delivery status in the fulfillment panel.

The fulfillment view shows the shipping snapshot for the paid order. For a held and unsubmitted order, staff can enter a shipping correction explicitly confirmed by the customer. Saving the correction retains the hold and invalidates the prior proof and quote. Fulfillment sends the order confirmation with the proof and suppresses generic ticket-created and ticket-status emails for linked paid orders.

For manual orders, review the inbox and proof version, then send the frozen proof pair to an active printer partner from the linked ticket. Admin reserves that proof version before calling Notification Engine with an idempotency key, both object generations, and both SHA-256 digests. Investigate timeouts and responses without a confirmed sent status before taking further action.

On an active legacy print ticket, choose **Upgrade this print ticket** to prepare a fulfillment order that keeps the original ticket. Compare any existing paid tickets for the story. Open the paid ticket if it covers this request. For a separate shipment select **Confirm separate shipment on this ticket**. To use the original manual printing path, choose **Open story and print PDFs**, then **Send to manual printer**. If the manual path finds a possible paid match, it returns you to the original ticket for comparison and upgrade. The server serializes upgrade and direct dispatch so the ticket follows one fulfillment path.

The legacy printer action reserves the original ticket before contacting the printer. Use **Needs attention** in the queue to investigate an unconfirmed send or a dispatch interrupted before its status was recorded. Confirmed legacy sends appear under **With supplier** for follow-up. If the upgrade succeeded in Admin while checkout was interrupted, reopening the original ticket completes its fulfillment link.

Paid checkout creates the linked ticket at `POST /api/tickets/paid-print` using the Admin API key and `orderDetails.fulfillmentVersion: 1`. Admin returns the ticket ID and matching print request ID before WebApp completes its checkout. Ticket creation deduplicates linked requests using a transaction-scoped lock in `backoffice_db`. The legacy `/api/tickets` endpoint retains its existing manual and email workflow for unversioned callers. The fulfillment data remains in the WebApp-owned `mythoria_db`. Admin records command attempts and manual dispatch outcomes in its audit log.

## Premium square hardcover

If generation stopped before publication, use the story workflow retry action in Admin. For a premium story, Admin sends an authenticated request to SGW to resume the original run and records the attempt. This retains its revision, completed illustration stages and original charge. After publication, use the correction process below.

Open **Read Premium Edition** on a published story to inspect its verified cover, numbered pages, back cover and selectable text. Opening and closing pages with preview artwork also offer **Preview Page Artwork**. The reader and its images require the Admin session and use the current manifest’s pinned revision.

Choose **Order a printed copy** and **One staff proof** on the published story. Select the staff destination and create the ticket. A repeat for the same premium story and revision opens the existing ticket. It prepares one square hardcover with no credit charge or customer email. For a manual printer, review both PDFs from the ticket then choose the printer and confirm **Send print request**. For Lulu, review the validated files and quote and confirm the landed total to **Submit one proof to Lulu**. A positive per-copy limit applies to Lulu. The chosen supplier receives the proof only after explicit release from the ticket.

The ticket displays any WebApp-provided reason that square Lulu fulfillment is blocked. While blocked, Lulu preparation and release are disabled; manual printer preparation remains available. The WebApp enforces eligibility again for direct requests and release, including when the ticket view was loaded before eligibility changed.

For a paid square ticket, confirm the purchaser received the current proof and check the reply inbox before either release action. Manual dispatch includes the frozen shipping address and quantity with the exact proof files. For Lulu, also verify tracked shipping and the landed quote against the per-copy limit, then enter the total and use **Release square order to Lulu**. The server verifies the proof version, supplier validation and refreshed quote before creating the job. Changing the provider versions the proof but retains the ticket’s edition.

Place the order on hold before a correction. After the corrected direct successor is published, enter its revision ID and the reason under **Bind published correction**. The ticket keeps its hold. Clearing it queues the new proof, quote and customer email. Review the new proof and check the inbox again before release. The audit records the operator, predecessor, successor and reason. For an uncertain or submitted job, use **Refresh order** and reconcile its supplier references before handling cancellation or replacement.

## Lulu payment, delivery and support

The ticket shows the current quote, Lulu job ID, supplier status and available tracking data. Use **Refresh order** to read the order again from Lulu. Resolve unpaid jobs in the Lulu Developer Portal. After checking supplier records, record cancellation, replacement, supplier credit and any separate Mythoria customer refund in the ticket.

## Saved staff destinations

Under **Delivery address source**, choose **Saved staff destination**, **Confirmed customer address**, or **Someone else**. Confirm the recipient before using the customer's address for a shipment. The form shows the purchaser and proof reviewer separately from the ship-to contact. Choose **Add a staff destination**, enter its contact and address, then select **Save staff destination** to reuse it on later orders. **Remove saved destination** removes it from your address book. The order keeps the shipping details captured at creation.

Saved staff destinations live in `backoffice_db` and are scoped to the signed-in staff account. The save and remove audit records contain the destination reference and actor. A Lulu shipment that requires a tax ID collects it for the individual order after the saved destination is selected. The address book stores the delivery contact and address.

Before deploying this version, use the approved backoffice connection and run `npm run db:migrate:staff-print-destinations` from the Admin checkout. The command runs the additive, standalone SQL checked into `scripts/staff-print-destinations-migration.sql`. The repo ignores `drizzle/` and its local migration journal. Generating against the existing local snapshot also picked up unfinished-draft campaign changes, so this command applies only the saved destinations table and indexes. Fresh development databases need the base Admin schema before using the feature.

The shipping forms use localized country names and subdivision names for the active Lulu markets that require them. Additional destinations with a carrier subdivision requirement accept their short code. Subdivision labels come from [Unicode CLDR 48](https://github.com/unicode-org/cldr/tree/release-48/common/subdivisions).

## Printing costs

Open **Printing costs** under **Financials**. The range selector offers Last 7 days, Last 30 days, Last 90 days and Forever. The chart uses Lulu's job date in UTC and the request table uses the date the print request was placed. Forever uses monthly chart buckets. A request can fall into a different period from its supplier cost.

The table shows Lulu's tax-exclusive total in the original currency and its EUR equivalent when available. Requests handled by other providers have an untracked cost. The homepage **Revenue vs costs** chart subtracts the same recorded EUR totals and AI costs from revenue. Pending prices and conversions are flagged in the charts. A priced job can appear in the total while Lulu is awaiting payment.

The WebApp owns price capture, conversion and backfill. Apply its additive cost migration, `0055_print_fulfillment_costs`, before rolling out these Admin routes. See [the shared rollout runbook](https://github.com/jacome7/Mythoria-webapp/blob/master/docs/PRINT_FULFILLMENT.md).

## Admin print order entry and lifecycle controls

- On a published story, **Order a printed copy** offers **One staff proof** and **Print and ship** for 1–10 copies. The form selects the eligible format and shows links to any existing paid tickets. **Download print PDFs** is available separately.
- If creation times out, select **Check previous request** or reopen the form after reloading. The browser retains the request reference, and the print service uses it to recover the same order and ticket. When a similar shipment already exists, open its ticket or explicitly choose **Create a separate shipment**.
- On an active unlinked legacy ticket, **Upgrade this print ticket** prepares the selected format and delivery details and attaches the order to that ticket via `POST /api/tickets/admin-print`.
- **In-Ticket Operations (`PrintFulfillment`)**: Supports immediate proof/quote preparation (`runImmediately: true` with 4-second polling while active), proof cover-dimension and normalized page-count display, quote cost breakdowns, structured tracking URLs and carrier IDs, `UNPAID` / `PRODUCTION_DELAYED` / `uncertain` operational alerts, and **Cancel Lulu job** (requires an audit reason).
- **Printing Costs (`/printing-costs`)**: Displays `Quoted (incl. tax)` alongside `Cost excl. tax` and badged vendor statuses.
