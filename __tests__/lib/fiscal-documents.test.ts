import {
  canManuallyMarkFiscalDocumentIssued,
  computeNeedsAttention,
  computeRetryableNow,
  formatFiscalDocumentFullNumber,
  redactFiscalPayload,
} from '@/lib/fiscal-documents';

describe('fiscal document utilities', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('marks failed and credit-note-required documents as needing attention', () => {
    expect(
      computeNeedsAttention({
        status: 'failed',
        createdAt: now,
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      computeNeedsAttention({
        status: 'credit_note_required',
        createdAt: now,
        updatedAt: now,
        now,
      }),
    ).toBe(true);
  });

  it('marks old pending and stale issuing documents as needing attention', () => {
    expect(
      computeNeedsAttention({
        status: 'pending',
        createdAt: '2026-06-14T11:44:00.000Z',
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      computeNeedsAttention({
        status: 'issuing',
        createdAt: now,
        updatedAt: '2026-06-14T11:44:00.000Z',
        now,
      }),
    ).toBe(true);
  });

  it('only allows pending or failed documents due now to be retried', () => {
    expect(computeRetryableNow({ status: 'pending', nextRetryAt: null, now })).toBe(true);
    expect(
      computeRetryableNow({
        status: 'failed',
        nextRetryAt: '2026-06-14T11:59:00.000Z',
        now,
      }),
    ).toBe(true);
    expect(
      computeRetryableNow({
        status: 'failed',
        nextRetryAt: '2026-06-14T12:01:00.000Z',
        now,
      }),
    ).toBe(false);
    expect(computeRetryableNow({ status: 'issued', nextRetryAt: null, now })).toBe(false);
  });

  it('recursively redacts likely secret payload fields', () => {
    expect(
      redactFiscalPayload({
        apiKey: 'secret',
        nested: {
          sessionId: 'session',
          safe: 'visible',
          items: [{ authorization: 'bearer token' }],
        },
      }),
    ).toEqual({
      apiKey: '[REDACTED]',
      nested: {
        sessionId: '[REDACTED]',
        safe: 'visible',
        items: [{ authorization: '[REDACTED]' }],
      },
    });
  });

  it('allows manual issued reconciliation only for supported states', () => {
    const now = new Date('2026-06-14T12:00:00.000Z');

    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'draft',
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'pending',
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'failed',
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'issuing',
        updatedAt: '2026-06-14T11:44:00.000Z',
        now,
      }),
    ).toBe(true);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'issuing',
        updatedAt: '2026-06-14T11:46:00.000Z',
        now,
      }),
    ).toBe(false);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'issued',
        updatedAt: now,
        now,
      }),
    ).toBe(false);
    expect(
      canManuallyMarkFiscalDocumentIssued({
        status: 'credit_note_required',
        updatedAt: now,
        now,
      }),
    ).toBe(false);
  });

  it('formats a fiscal document full number from its identity fields', () => {
    expect(
      formatFiscalDocumentFullNumber({
        docType: '34',
        docSeries: '23',
        docNum: '9',
      }),
    ).toBe('34 23/9');
  });
});
