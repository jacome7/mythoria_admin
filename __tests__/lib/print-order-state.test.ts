import { classifyPrintOrder, type PrintOrderStateInput } from '@/lib/print-order-state';

const ready: PrintOrderStateInput = {
  ticketStatus: 'open',
  fulfillmentStatus: 'proof_ready',
  linked: true,
  purpose: 'customer',
  provider: 'lulu',
  hasQuote: true,
  proofSent: true,
  qaPassed: true,
};

describe('print order next action', () => {
  it.each([
    ['CANCELED', 'needs_attention', 'Review canceled job'],
    ['unpaid', 'needs_attention', 'Check supplier payment'],
    ['ERROR', 'needs_attention', 'Investigate supplier error'],
    ['SHIPPED', 'with_supplier', 'Check shipment tracking'],
  ])('keeps supplier follow-up for an existing %s job', (vendorStatus, group, label) => {
    expect(classifyPrintOrder({ ...ready, vendorStatus, held: true })).toEqual({
      stage: 'supplier',
      group,
      label,
    });
  });

  it.each(['uncertain', 'manual_uncertain', 'submitting', 'manual_dispatching', 'manual_sent'])(
    'keeps %s out of the release flow even on a closed ticket',
    (fulfillmentStatus) => {
      expect(
        classifyPrintOrder({ ...ready, ticketStatus: 'closed', fulfillmentStatus }).stage,
      ).toBe('supplier');
    },
  );

  it('separates an unlinked legacy request from missing linked fulfillment', () => {
    const missing = { ...ready, fulfillmentStatus: null };
    expect(classifyPrintOrder(missing).group).toBe('needs_attention');
    expect(classifyPrintOrder({ ...missing, linked: false }).group).toBe('legacy');
  });

  it('distinguishes a paid inbox check from staff proof review', () => {
    expect(classifyPrintOrder(ready).group).toBe('awaiting_review');
    expect(classifyPrintOrder({ ...ready, purpose: 'staff_proof', proofSent: false }).group).toBe(
      'ready',
    );
    expect(classifyPrintOrder({ ...ready, purpose: undefined, proofSent: false }).group).toBe(
      'needs_attention',
    );
  });

  it.each<Partial<PrintOrderStateInput>>([
    { held: true },
    { hasQuote: false },
    { qaPassed: false },
    { proofSent: false },
    { blockReason: 'Market unavailable' },
    { fulfillmentStatus: 'unknown' },
  ])('keeps a blocked order out of the ready group', (change) => {
    expect(classifyPrintOrder({ ...ready, ...change }).group).toBe('needs_attention');
  });

  it('does not require a Lulu quote to review a manual order', () => {
    expect(classifyPrintOrder({ ...ready, provider: 'manual', hasQuote: false }).stage).toBe(
      'review',
    );
  });
});
