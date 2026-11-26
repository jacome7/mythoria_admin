export const printOrderGroups = [
  'needs_attention',
  'awaiting_review',
  'ready',
  'with_supplier',
  'preparing',
  'legacy',
  'closed',
] as const;

export type PrintOrderGroup = (typeof printOrderGroups)[number];
export const printOrderGroupLabels: Record<PrintOrderGroup, string> = {
  needs_attention: 'Needs attention',
  awaiting_review: 'Awaiting customer review',
  ready: 'Ready for staff review',
  with_supplier: 'With supplier',
  preparing: 'Preparing',
  legacy: 'Legacy tickets',
  closed: 'Closed',
};

export interface PrintOrderStateInput {
  ticketStatus: string;
  fulfillmentStatus: string | null;
  vendorStatus?: string | null;
  hasVendor?: boolean;
  provider?: string | null;
  purpose?: 'customer' | 'staff_proof' | 'admin_order' | 'legacy';
  held?: boolean;
  proofSent?: boolean;
  qaPassed?: boolean;
  hasQuote?: boolean;
  blockReason?: string | null;
  linked?: boolean;
  legacyDispatchStatus?: string | null;
}

interface PrintOrderAction {
  stage: 'legacy' | 'investigate' | 'preparation' | 'review' | 'supplier' | 'closed';
  group: PrintOrderGroup;
  label: string;
}

function supplierAction(label: string, group: PrintOrderGroup = 'with_supplier'): PrintOrderAction {
  return { stage: 'supplier', group, label };
}

function investigate(label: string): PrintOrderAction {
  return { stage: 'investigate', group: 'needs_attention', label };
}

// Describes the next staff task. Permission to dispatch is decided by the fulfillment service.
export function classifyPrintOrder(input: PrintOrderStateInput): PrintOrderAction {
  const status = input.fulfillmentStatus;
  const closed = input.ticketStatus === 'closed' || input.ticketStatus === 'resolved';
  const vendor = input.vendorStatus?.trim().toUpperCase();
  if (input.linked === false) {
    switch (input.legacyDispatchStatus) {
      case 'dispatching':
        return supplierAction('Check legacy printer dispatch', 'needs_attention');
      case 'uncertain':
        return supplierAction('Verify legacy printer email delivery', 'needs_attention');
      case 'sent':
        return supplierAction(
          'Follow up with the legacy printer',
          closed ? 'closed' : 'with_supplier',
        );
    }
  }
  switch (status) {
    case 'uncertain':
      return supplierAction('Reconcile Lulu submission', 'needs_attention');
    case 'manual_uncertain':
      return supplierAction('Verify printer email delivery', 'needs_attention');
    case 'submitting':
      return supplierAction('Check Lulu submission');
    case 'manual_dispatching':
      return supplierAction('Check printer dispatch');
    case 'manual_sent':
      return supplierAction('Follow up with the printer', closed ? 'closed' : 'with_supplier');
  }

  if (input.hasVendor || vendor || status === 'submitted') {
    switch (vendor) {
      case 'CANCELED':
      case 'CANCELLED':
        return supplierAction('Review canceled job', closed ? 'closed' : 'needs_attention');
      case 'REJECTED':
        return supplierAction('Investigate rejected job', closed ? 'closed' : 'needs_attention');
      case 'ERROR':
        return supplierAction('Investigate supplier error', closed ? 'closed' : 'needs_attention');
      case 'UNPAID':
        return supplierAction('Check supplier payment', 'needs_attention');
      case 'PAYMENT_IN_PROGRESS':
        return supplierAction('Check payment status');
      case 'SHIPPED':
        return supplierAction('Check shipment tracking', closed ? 'closed' : 'with_supplier');
      case 'DELIVERED':
        return supplierAction('Review delivery outcome', closed ? 'closed' : 'with_supplier');
      case 'PRODUCTION_DELAYED':
        return supplierAction('Check production delay');
      default:
        return supplierAction('Check supplier status');
    }
  }

  if (closed) return { stage: 'closed', group: 'closed', label: 'View ticket history' };
  if (!status) {
    return input.linked === false
      ? { stage: 'legacy', group: 'legacy', label: 'Review legacy print request' }
      : investigate('Check fulfillment link');
  }
  if (input.held || status === 'held') return investigate('Resolve order hold');
  if (status === 'manual_review') return investigate('Review preparation issue');
  if (status === 'awaiting_ticket') return investigate('Check ticket linkage');
  if (status === 'pending' || status === 'preparing') {
    return { stage: 'preparation', group: 'preparing', label: 'Check preparation progress' };
  }
  if (status !== 'proof_ready') return investigate('Inspect fulfillment status');
  if (input.blockReason) return investigate('Review release requirements');
  if (!input.qaPassed) return investigate('Check proof quality');
  if (input.provider === 'lulu' && !input.hasQuote) return investigate('Prepare a supplier quote');
  const staffOrder = input.purpose === 'admin_order' || input.purpose === 'staff_proof';
  if (!staffOrder && !input.proofSent) return investigate('Check proof email');
  if (!staffOrder) {
    return { stage: 'review', group: 'awaiting_review', label: 'Check reply inbox and proof' };
  }
  return { stage: 'review', group: 'ready', label: 'Review proof for release' };
}
