# Notification event identities

Updated: 2026-11-04.

See the [shared reliability contract and cutover runbook](../../docs/EMAIL_DELIVERY_RELIABILITY.md) for Notification Engine's delivery ledger and rollout requirements.

Admin credit/refund helpers require the actual inserted credit ledger ID. MB Way confirmation uses the payment order ID. Ticket creation and comments use their persistent IDs; status updates use ticket ID plus update timestamp. A retried notification reuses that identity, while a different operation has a different identity. Do not fall back to an author ID for credit events.

Clients expose `deliveryStatus` and parse the webhook's nested `result` envelope. `success` can mean accepted/queued; count only `deliveryStatus='sent'` as Gmail acceptance. Schema migrations for this feature belong to Notification Engine, not Admin's databases. Existing campaign claims remain in force after unknown sends.
